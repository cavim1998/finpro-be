import {
  PrismaClient,
  OrderStatus,
  PaymentStatus,
} from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { MIDTRANS_MERCHANT_ID } from "../../config/env.js";
import { CreatePaymentDTO } from "./dto/create-payment.dto.js";
import { PaymentMidtransService } from "./payment-midtrans.service.js";
import { MidtransSnapResponse, OrderForPayment } from "./payment.types.js";

export class PaymentCreationService {
  private readonly payableStatuses: OrderStatus[] = [
    OrderStatus.ARRIVED_AT_OUTLET,
    OrderStatus.WASHING,
    OrderStatus.IRONING,
    OrderStatus.PACKING,
    OrderStatus.WAITING_PAYMENT,
  ];

  private paymentMidtransService: PaymentMidtransService;

  constructor(private prisma: PrismaClient) {
    this.paymentMidtransService = new PaymentMidtransService();
  }

  private async getOrderOrThrow(orderId: string, customerId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: {
        payments: true,
        items: { include: { item: true } },
        customer: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true, phone: true } },
          },
        },
      },
    });

    if (!order) {
      throw new ApiError("Order tidak ditemukan", 404);
    }

    return order as OrderForPayment;
  }

  private ensureStatusPayable(status: OrderStatus) {
    if (!this.payableStatuses.includes(status)) {
      throw new ApiError("Order tidak dalam status yang dapat dibayar", 400);
    }
  }

  private ensureNoPaidPayment(order: OrderForPayment) {
    const existingPaidPayment = order.payments.find(
      (payment) => payment.status === PaymentStatus.PAID,
    );

    if (existingPaidPayment) {
      throw new ApiError("Order sudah dibayar", 400);
    }
  }

  private ensureNoPendingPayment(order: OrderForPayment) {
    const existingPendingPayment = order.payments.find(
      (payment) => payment.status === PaymentStatus.PENDING,
    );

    if (existingPendingPayment) {
      throw new ApiError("Masih ada pembayaran yang pending", 400);
    }
  }

  private ensurePaymentDeadline(order: OrderForPayment) {
    if (order.paymentDueAt && new Date() > order.paymentDueAt) {
      throw new ApiError("Batas waktu pembayaran telah lewat", 400);
    }
  }

  private validatePayableOrder(order: OrderForPayment) {
    this.ensureStatusPayable(order.status);
    this.ensureNoPaidPayment(order);
    this.ensureNoPendingPayment(order);
    this.ensurePaymentDeadline(order);
  }

  private async createPaymentRecord(
    dto: CreatePaymentDTO,
    grossAmount: number,
    gatewayRef: string,
    snapResponse: MidtransSnapResponse,
  ) {
    return this.prisma.payment.create({
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
  }

  private buildSnapContext(order: OrderForPayment) {
    const paymentAttempt = order.payments.length + 1;
    const gatewayRef = this.paymentMidtransService.buildGatewayRef(
      order.orderNo,
      paymentAttempt,
    );

    const itemDetails = this.paymentMidtransService.buildItemDetails(order);
    const grossAmount =
      this.paymentMidtransService.calculateGrossAmount(itemDetails);
    const payload = this.paymentMidtransService.buildPayload(
      order,
      gatewayRef,
      grossAmount,
      itemDetails,
    );

    return { gatewayRef, grossAmount, payload };
  }

  private buildPaymentResponse(
    payment: Awaited<ReturnType<typeof this.createPaymentRecord>>,
    snapResponse: MidtransSnapResponse,
    expiresAt: Date | null,
  ) {
    return {
      ...payment,
      snapToken: snapResponse.token,
      paymentUrl: snapResponse.redirect_url,
      expiresAt: expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async createPayment(dto: CreatePaymentDTO, customerId: number) {
    const order = await this.getOrderOrThrow(dto.orderId, customerId);
    this.validatePayableOrder(order);

    const snapContext = this.buildSnapContext(order);

    const snapResponse = await this.paymentMidtransService.createSnap(
      snapContext.payload,
    );
    const payment = await this.createPaymentRecord(
      dto,
      snapContext.grossAmount,
      snapContext.gatewayRef,
      snapResponse,
    );

    return this.buildPaymentResponse(payment, snapResponse, order.paymentDueAt);
  }
}
