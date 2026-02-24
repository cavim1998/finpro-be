import {
  PrismaClient,
  OrderStatus,
  PaymentStatus,
} from "../../../generated/prisma/client.js";
import crypto from "crypto";
import { ApiError } from "../../utils/api-error.js";
import { CreatePaymentDTO } from "./dto/create-payment.dto.js";
import {
  FE_URL,
  MIDTRANS_IS_PRODUCTION,
  MIDTRANS_MERCHANT_ID,
  MIDTRANS_SERVER_KEY,
} from "../../config/env.js";

export class PaymentService {
  constructor(private prisma: PrismaClient) {}

  private getMidtransBaseUrl() {
    return MIDTRANS_IS_PRODUCTION
      ? "https://app.midtrans.com"
      : "https://app.sandbox.midtrans.com";
  }

  private async createMidtransSnap(payload: unknown) {
    const url = `${this.getMidtransBaseUrl()}/snap/v1/transactions`;
    const auth = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError("Gagal membuat transaksi Midtrans", 502, "MIDTRANS", {
        status: response.status,
        body: errorText,
      });
    }

    return (await response.json()) as {
      token: string;
      redirect_url: string;
    };
  }

  async createPayment(dto: CreatePaymentDTO, customerId: number) {
    // 1. Validate order exists and belongs to customer
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, customerId },
      include: {
        payments: true,
        items: {
          include: {
            item: true,
          },
        },
        customer: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                fullName: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new ApiError("Order tidak ditemukan", 404);
    }

    // 2. Check if order is in payable status
    const payableStatuses: OrderStatus[] = [
      OrderStatus.ARRIVED_AT_OUTLET,
      OrderStatus.WASHING,
      OrderStatus.IRONING,
      OrderStatus.PACKING,
      OrderStatus.WAITING_PAYMENT,
    ];

    if (!payableStatuses.includes(order.status)) {
      throw new ApiError("Order tidak dalam status yang dapat dibayar", 400);
    }

    // 3. Check if already paid
    const existingPaidPayment = order.payments.find(
      (p) => p.status === PaymentStatus.PAID,
    );
    if (existingPaidPayment) {
      throw new ApiError("Order sudah dibayar", 400);
    }

    const existingPendingPayment = order.payments.find(
      (p) => p.status === PaymentStatus.PENDING,
    );
    if (existingPendingPayment) {
      throw new ApiError("Masih ada pembayaran yang pending", 400);
    }

    // 4. Check payment deadline
    if (order.paymentDueAt && new Date() > order.paymentDueAt) {
      throw new ApiError("Batas waktu pembayaran telah lewat", 400);
    }

    // 5. Create payment with mock gateway integration
    const paymentAttempt = order.payments.length + 1;
    const gatewayRef =
      paymentAttempt > 1 ? `${order.orderNo}-${paymentAttempt}` : order.orderNo;
    const customerName = order.customer.profile?.fullName || "Customer";

    const itemDetails = order.items.map((orderItem) => ({
      id: String(orderItem.itemId),
      name: orderItem.item.name,
      quantity: Math.max(1, orderItem.qty),
      price: Math.max(1, Math.round(Number(orderItem.item.price))),
    }));

    const premiumFee =
      Number(order.totalAmount) -
      Number(order.subtotalAmount) -
      Number(order.deliveryFee);
    if (premiumFee > 0) {
      itemDetails.push({
        id: "PREMIUM_FEE",
        name: "Premium Service Fee",
        quantity: 1,
        price: Math.max(1, Math.round(premiumFee)),
      });
    }

    if (Number(order.deliveryFee) > 0) {
      itemDetails.push({
        id: "DELIVERY_FEE",
        name: "Delivery Fee",
        quantity: 1,
        price: Math.max(1, Math.round(Number(order.deliveryFee))),
      });
    }

    const grossAmount = itemDetails.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const midtransPayload = {
      transaction_details: {
        order_id: gatewayRef,
        gross_amount: grossAmount,
      },
      customer_details: {
        first_name: customerName,
        email: order.customer.email || undefined,
        phone: order.customer.profile?.phone || undefined,
      },
      item_details: itemDetails,
      credit_card: {
        secure: true,
      },
      custom_field1: order.id,
      custom_field2: String(order.customerId),
      callbacks: {
        finish: `${FE_URL}/payments/finish?orderId=${order.id}`,
      },
    };

    const snapResponse = await this.createMidtransSnap(midtransPayload);

    const payment = await this.prisma.payment.create({
      data: {
        orderId: dto.orderId,
        provider: "midtrans",
        amount: grossAmount,
        status: PaymentStatus.PENDING,
        gatewayRef,
        payloadJson: {
          midtrans: snapResponse,
          merchantId: MIDTRANS_MERCHANT_ID,
        },
      },
    });

    return {
      ...payment,
      snapToken: snapResponse.token,
      paymentUrl: snapResponse.redirect_url,
      expiresAt:
        order.paymentDueAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async handlePaymentWebhook(webhookData: any) {
    const {
      order_id,
      transaction_status,
      transaction_id,
      status_code,
      gross_amount,
      signature_key,
    } = webhookData;

    if (signature_key && status_code && gross_amount && order_id) {
      const signaturePayload = `${order_id}${status_code}${gross_amount}${MIDTRANS_SERVER_KEY}`;
      const expectedSignature = crypto
        .createHash("sha512")
        .update(signaturePayload)
        .digest("hex");

      if (signature_key !== expectedSignature) {
        throw new ApiError("Signature Midtrans tidak valid", 401);
      }
    }

    // Find order by orderNo
    let payment = await this.prisma.payment.findUnique({
      where: { gatewayRef: order_id },
      include: { order: true },
    });

    if (!payment && transaction_id) {
      payment = await this.prisma.payment.findUnique({
        where: { gatewayRef: transaction_id },
        include: { order: true },
      });
    }

    if (!payment || !payment.order) {
      throw new ApiError("Payment tidak ditemukan", 404);
    }

    const order = payment.order;

    // Handle payment status based on gateway response
    let paymentStatus: PaymentStatus;
    let orderNeedsUpdate = false;

    switch (transaction_status) {
      case "settlement":
      case "capture":
      case "success":
        paymentStatus = PaymentStatus.PAID;
        orderNeedsUpdate = true;
        break;
      case "pending":
        paymentStatus = PaymentStatus.PENDING;
        break;
      case "deny":
      case "cancel":
        paymentStatus = PaymentStatus.FAILED;
        break;
      case "expire":
        paymentStatus = PaymentStatus.EXPIRED;
        break;
      default:
        paymentStatus = PaymentStatus.PENDING;
    }

    // Update payment in transaction
    await this.prisma.$transaction(async (tx) => {
      // Update payment
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: paymentStatus,
          paidAt: paymentStatus === PaymentStatus.PAID ? new Date() : null,
        },
      });

      // If payment successful, update payment ONLY
      // Worker-stations logic akan handle status progression saat packing selesai
      // Jika sudah ada PAID payment, status langsung ke READY_TO_DELIVER
      // Jika belum, status jadi WAITING_PAYMENT lalu customer bayar
      if (orderNeedsUpdate && paymentStatus === PaymentStatus.PAID) {
        // Update order
        await tx.order.update({
          where: { id: order.id },
          data: {
            // JANGAN update status di sini!
            // Status progression di-handle oleh worker-stations saat packing selesai
            paidAt: new Date(),
          },
        });

        // Get pickup request to get address
        const pickupRequest = await tx.pickupRequest.findUnique({
          where: { id: order.pickupRequestId },
          include: { address: true, outlet: true },
        });

        // NOTE: DriverTask for delivery will be created by driver module
        // Driver module should query Orders with status READY_TO_DELIVER
        // and create DriverTask when driver is ready to deliver
        if (pickupRequest) {
          // Delivery information is available in Order and PickupRequest relations
        }
      }
    });

    // TODO: Send notification to customer and drivers

    const orderStatus = orderNeedsUpdate
      ? OrderStatus.READY_TO_DELIVER
      : order.status;

    return { success: true, paymentStatus, orderStatus };
  }

  async getPaymentsByOrder(orderId: string, customerId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
    });

    if (!order) {
      throw new ApiError("Order tidak ditemukan", 404);
    }

    const payments = await this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });

    return payments.map((payment) => {
      const payload = payment.payloadJson as any;
      return {
        ...payment,
        snapToken: payload?.midtrans?.token,
        paymentUrl: payload?.midtrans?.redirect_url,
      };
    });
  }

  // Upload payment proof image (QRIS receipt)
  async uploadPaymentProof(
    paymentId: number,
    proofUrl: string,
    customerId: number,
  ) {
    // 1. Validate payment exists and belongs to customer
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      throw new ApiError("Payment tidak ditemukan", 404);
    }

    // 2. Verify payment belongs to customer
    const order = await this.prisma.order.findUnique({
      where: { id: payment.orderId },
    });

    if (!order || order.customerId !== customerId) {
      throw new ApiError("Unauthorized", 403);
    }

    // 3. Check if payment is still PENDING
    if (payment.status !== PaymentStatus.PENDING) {
      throw new ApiError("Payment sudah diproses sebelumnya", 400);
    }

    // 4. Validate proof URL
    if (!proofUrl) {
      throw new ApiError("File bukti pembayaran tidak ditemukan", 400);
    }

    // 5. Update payment and order in transaction
    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      // Update payment with proof URL and mark as PAID
      const updatePayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          // proofUrl,
          status: PaymentStatus.PAID,
          paidAt: new Date(),
        },
      });

      // Update order status to READY_TO_DELIVER
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: OrderStatus.READY_TO_DELIVER,
          paidAt: new Date(),
        },
      });

      return updatePayment;
    });

    return updatedPayment;
  }

  // Mock payment confirmation for testing
  async mockPaymentSuccess(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: { status: PaymentStatus.PENDING },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!order) {
      throw new ApiError("Order tidak ditemukan", 404);
    }

    const payment = order.payments[0];
    if (!payment) {
      throw new ApiError("Tidak ada pending payment", 404);
    }

    // Simulate webhook callback
    await this.handlePaymentWebhook({
      order_id: order.orderNo,
      transaction_status: "settlement",
      transaction_id: payment.gatewayRef,
      gross_amount: String(order.totalAmount),
    });

    return { success: true, message: "Payment berhasil (mock)" };
  }
}
