import { Router } from "express";
import { PaymentController } from "./payment.controller.js";
import { verifyToken } from "../../middlewares/jwt.middleware.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { CreatePaymentDTO } from "./dto/create-payment.dto.js";
import { JWT_SECRET } from "../../config/env.js";

export class PaymentRouter {
  private router: Router;

  constructor(
    private paymentController: PaymentController,
    private validationMiddleware: ValidationMiddleware,
  ) {
    this.router = Router();

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
  }

  getRouter() {
    return this.router;
  }
}
