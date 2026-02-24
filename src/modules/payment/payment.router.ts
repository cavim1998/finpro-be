import { Router } from "express";
import { PaymentController } from "./payment.controller.js";
import { PaymentService } from "./payment.service.js";
import { verifyToken } from "../../middlewares/jwt.middleware.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { UploaderMiddleware } from "../../middlewares/uploader.middleware.js";
import { CreatePaymentDTO } from "./dto/create-payment.dto.js";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { JWT_SECRET } from "../../config/env.js";

export class PaymentRouter {
  private router: Router;
  private paymentController: PaymentController;
  private validationMiddleware: ValidationMiddleware;
  private uploaderMiddleware: UploaderMiddleware;

  constructor(
    prisma: PrismaClient,
    validationMiddleware: ValidationMiddleware,
  ) {
    this.router = Router();
    this.validationMiddleware = validationMiddleware;
    this.uploaderMiddleware = new UploaderMiddleware();

    const paymentService = new PaymentService(prisma);
    this.paymentController = new PaymentController(paymentService);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Create payment
    this.router.post(
      "/",
      verifyToken(JWT_SECRET),
      this.validationMiddleware.validateBody(CreatePaymentDTO),
      this.paymentController.createPayment,
    );

    // Get payments by order
    this.router.get(
      "/order/:orderId",
      verifyToken(JWT_SECRET),
      this.paymentController.getPaymentsByOrder,
    );

    // Webhook endpoint (no auth needed, verified by signature)
    this.router.post("/webhook", this.paymentController.handleWebhook);

    // Mock payment success for testing
    this.router.post(
      "/mock-success/:orderId",
      verifyToken(JWT_SECRET),
      this.paymentController.mockPaymentSuccess,
    );

    // Upload payment proof (QRIS receipt image) //TIDAK PERLU
    this.router.post(
      "/:paymentId/upload-proof",
      verifyToken(JWT_SECRET),
      this.uploaderMiddleware.upload().single("proof"),
      this.paymentController.uploadPaymentProof,
    );
  }

  getRouter() {
    return this.router;
  }
}
