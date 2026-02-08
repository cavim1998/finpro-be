import {
  PrismaClient,
  OrderStatus,
  PaymentStatus,
} from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { CreatePaymentDTO } from "./dto/create-payment.dto.js";

export class PaymentService {
  constructor(private prisma: PrismaClient) {}

  async createPayment(dto: CreatePaymentDTO, customerId: number) {
    // 1. Validate order exists and belongs to customer
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, customerId },
      include: {
        payments: true,
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

    // 4. Check payment deadline
    if (order.paymentDueAt && new Date() > order.paymentDueAt) {
      throw new ApiError("Batas waktu pembayaran telah lewat", 400);
    }

    // 5. Create payment with mock gateway integration
    // In production, integrate with actual QRIS gateway
    const gatewayRef = `${dto.provider.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Mock payment gateway response
    const mockGatewayResponse = {
      snapToken: `SNAP-${gatewayRef}`,
      paymentUrl: `https://app.${dto.provider}.com/payment/${gatewayRef}`,
      expiresAt:
        order.paymentDueAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const payment = await this.prisma.payment.create({
      data: {
        orderId: dto.orderId,
        provider: dto.provider,
        amount: order.totalAmount,
        status: PaymentStatus.PENDING,
        gatewayRef,
        payloadJson: mockGatewayResponse,
      },
    });

    // TODO: In production, call actual QRIS gateway API

    return {
      ...payment,
      snapToken: mockGatewayResponse.snapToken,
      paymentUrl: mockGatewayResponse.paymentUrl,
      expiresAt: mockGatewayResponse.expiresAt,
    };
  }

  async handlePaymentWebhook(webhookData: any) {
    // In production, verify signature from payment gateway
    const { order_id, transaction_status, transaction_id } = webhookData;

    // Find order by orderNo
    const order = await this.prisma.order.findFirst({
      where: { orderNo: order_id },
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
      throw new ApiError("Payment tidak ditemukan", 404);
    }

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
      case "expire":
        paymentStatus = PaymentStatus.FAILED;
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
          gatewayRef: transaction_id || payment.gatewayRef,
        },
      });

      // If payment successful, update order and create delivery task
      if (orderNeedsUpdate && paymentStatus === PaymentStatus.PAID) {
        // Update order
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.READY_TO_DELIVER,
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

    return { success: true, paymentStatus, orderStatus: order.status };
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

    return payments;
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
          proofUrl,
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
