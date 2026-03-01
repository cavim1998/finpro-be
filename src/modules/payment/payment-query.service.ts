import {
  PrismaClient,
  PaymentStatus,
} from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { PaymentWebhookService } from "./payment-webhook.service.js";

export class PaymentQueryService {
  constructor(
    private prisma: PrismaClient,
    private paymentWebhookService: PaymentWebhookService,
  ) {}

  private async ensureOrderOwnedOrThrow(orderId: string, customerId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
    });

    if (!order) {
      throw new ApiError("Order tidak ditemukan", 404);
    }
  }

  async getPaymentsByOrder(orderId: string, customerId: number) {
    await this.ensureOrderOwnedOrThrow(orderId, customerId);

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

  private async getOrderForMockOrThrow(orderId: string) {
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

    return order;
  }

  async mockPaymentSuccess(orderId: string) {
    const order = await this.getOrderForMockOrThrow(orderId);
    const payment = order.payments[0];

    if (!payment) {
      throw new ApiError("Tidak ada pending payment", 404);
    }

    await this.paymentWebhookService.handlePaymentWebhook({
      order_id: order.orderNo,
      transaction_status: "settlement",
      transaction_id: payment.gatewayRef,
      gross_amount: String(order.totalAmount),
    });

    return { success: true, message: "Payment berhasil (mock)" };
  }
}
