import crypto from "crypto";
import {
  PrismaClient,
  Prisma,
  OrderStatus,
  PaymentStatus,
} from "../../../generated/prisma/client.js";
import { MIDTRANS_SERVER_KEY } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { WebhookPayload } from "./payment.types.js";

type PaymentWithOrder = Prisma.PaymentGetPayload<{
  include: { order: true };
}>;

export class PaymentWebhookService {
  constructor(private prisma: PrismaClient) {}

  private validateSignature(payload: WebhookPayload) {
    const { order_id, status_code, gross_amount, signature_key } = payload;
    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return;
    }

    const signaturePayload = `${order_id}${status_code}${gross_amount}${MIDTRANS_SERVER_KEY}`;
    const expectedSignature = crypto
      .createHash("sha512")
      .update(signaturePayload)
      .digest("hex");

    if (signature_key !== expectedSignature) {
      throw new ApiError("Signature Midtrans tidak valid", 401);
    }
  }

  private async findPaymentByGatewayRef(gatewayRef: string) {
    return this.prisma.payment.findUnique({
      where: { gatewayRef },
      include: { order: true },
    });
  }

  private async resolvePaymentOrThrow(payload: WebhookPayload) {
    const orderId = payload.order_id;
    const transactionId = payload.transaction_id;

    if (!orderId && !transactionId) {
      throw new ApiError("Payment tidak ditemukan", 404);
    }

    let payment: PaymentWithOrder | null = null;
    if (orderId) {
      payment = await this.findPaymentByGatewayRef(orderId);
    }

    if (!payment && transactionId) {
      payment = await this.findPaymentByGatewayRef(transactionId);
    }

    if (!payment || !payment.order) {
      throw new ApiError("Payment tidak ditemukan", 404);
    }

    return payment;
  }

  private mapPaymentStatus(transactionStatus?: string) {
    switch (transactionStatus) {
      case "settlement":
      case "capture":
      case "success":
        return { paymentStatus: PaymentStatus.PAID, orderNeedsUpdate: true };
      case "pending":
        return {
          paymentStatus: PaymentStatus.PENDING,
          orderNeedsUpdate: false,
        };
      case "deny":
      case "cancel":
        return { paymentStatus: PaymentStatus.FAILED, orderNeedsUpdate: false };
      case "expire":
        return {
          paymentStatus: PaymentStatus.EXPIRED,
          orderNeedsUpdate: false,
        };
      default:
        return {
          paymentStatus: PaymentStatus.PENDING,
          orderNeedsUpdate: false,
        };
    }
  }

  private async updatePaymentTransaction(
    paymentId: number,
    orderId: string,
    paymentStatus: PaymentStatus,
    orderNeedsUpdate: boolean,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: paymentStatus,
          paidAt: paymentStatus === PaymentStatus.PAID ? new Date() : null,
        },
      });

      if (!orderNeedsUpdate || paymentStatus !== PaymentStatus.PAID) {
        return;
      }

      await tx.order.update({
        where: { id: orderId },
        data: { paidAt: new Date() },
      });
    });
  }

  async handlePaymentWebhook(webhookData: any) {
    const payload = webhookData as WebhookPayload;
    this.validateSignature(payload);

    const payment = await this.resolvePaymentOrThrow(payload);
    const mappedStatus = this.mapPaymentStatus(payload.transaction_status);

    await this.updatePaymentTransaction(
      payment.id,
      payment.order.id,
      mappedStatus.paymentStatus,
      mappedStatus.orderNeedsUpdate,
    );

    const orderStatus = mappedStatus.orderNeedsUpdate
      ? OrderStatus.READY_TO_DELIVER
      : payment.order.status;

    return {
      success: true,
      paymentStatus: mappedStatus.paymentStatus,
      orderStatus,
    };
  }
}
