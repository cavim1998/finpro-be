import { Request, Response, NextFunction } from "express";
import { PaymentService } from "./payment.service.js";
import { ApiError } from "../../utils/api-error.js";

export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  private getUserIdOrThrow(res: Response) {
    const authUser = res.locals.user as { sub?: string };
    if (!authUser?.sub) {
      throw new ApiError("Unauthorized", 401);
    }

    return parseInt(authUser.sub, 10);
  }

  private sendSuccess(
    res: Response,
    statusCode: number,
    message: string,
    data: unknown,
  ) {
    res.status(statusCode).json({ message, data });
  }

  createPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = this.getUserIdOrThrow(res);
      const result = await this.paymentService.createPayment(
        req.body,
        customerId,
      );
      this.sendSuccess(res, 201, "Payment berhasil dibuat", result);
    } catch (error) {
      next(error);
    }
  };

  handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.paymentService.handlePaymentWebhook(req.body);

      return res.status(200).json({
        message: "Webhook processed",
      });
    } catch (error) {
      console.error("WEBHOOK ERROR:", error);

      return res.status(200).json({
        message: "Webhook received but error internally",
      });
    }
  };

  getPaymentsByOrder = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const customerId = this.getUserIdOrThrow(res);
      const { orderId } = req.params as { orderId: string };
      const result = await this.paymentService.getPaymentsByOrder(
        orderId,
        customerId,
      );
      this.sendSuccess(res, 200, "Payments berhasil diambil", result);
    } catch (error) {
      next(error);
    }
  };

  // Mock endpoint for testing
  mockPaymentSuccess = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { orderId } = req.params as { orderId: string };
      const result = await this.paymentService.mockPaymentSuccess(orderId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
