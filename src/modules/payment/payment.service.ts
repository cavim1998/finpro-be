import { PrismaClient } from "../../../generated/prisma/client.js";
import { CreatePaymentDTO } from "./dto/create-payment.dto.js";
import { PaymentCreationService } from "./payment-creation.service.js";
import { PaymentWebhookService } from "./payment-webhook.service.js";
import { PaymentQueryService } from "./payment-query.service.js";

export class PaymentService {
  private paymentCreationService: PaymentCreationService;
  private paymentWebhookService: PaymentWebhookService;
  private paymentQueryService: PaymentQueryService;

  constructor(private prisma: PrismaClient) {
    this.paymentCreationService = new PaymentCreationService(this.prisma);
    this.paymentWebhookService = new PaymentWebhookService(this.prisma);
    this.paymentQueryService = new PaymentQueryService(
      this.prisma,
      this.paymentWebhookService,
    );
  }

  async createPayment(dto: CreatePaymentDTO, customerId: number) {
    return this.paymentCreationService.createPayment(dto, customerId);
  }

  async handlePaymentWebhook(webhookData: any) {
    return this.paymentWebhookService.handlePaymentWebhook(webhookData);
  }

  async getPaymentsByOrder(orderId: string, customerId: number) {
    return this.paymentQueryService.getPaymentsByOrder(orderId, customerId);
  }

  async mockPaymentSuccess(orderId: string) {
    return this.paymentQueryService.mockPaymentSuccess(orderId);
  }
}
