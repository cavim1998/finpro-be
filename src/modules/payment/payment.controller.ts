import { Request, Response, NextFunction } from "express";
import { PaymentService } from "./payment.service.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { ApiError } from "../../utils/api-error.js";

export class PaymentController {
  constructor(
    private paymentService: PaymentService,
    private cloudinaryService: CloudinaryService = new CloudinaryService(),
  ) {}

  createPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);
      const customerId = parseInt(authUser.sub);

      const result = await this.paymentService.createPayment(
        req.body,
        customerId,
      );

      res.status(201).json({
        message: "Payment berhasil dibuat",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.paymentService.handlePaymentWebhook(req.body);

      res.status(200).json({
        message: "Webhook processed successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getPaymentsByOrder = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);
      const customerId = parseInt(authUser.sub);

      const { orderId } = req.params;

      const result = await this.paymentService.getPaymentsByOrder(
        orderId,
        customerId,
      );

      res.status(200).json({
        message: "Payments berhasil diambil",
        data: result,
      });
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
      const { orderId } = req.params;
      const result = await this.paymentService.mockPaymentSuccess(orderId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // Upload payment proof image (QRIS receipt)
  uploadPaymentProof = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);
      const customerId = parseInt(authUser.sub);

      const { paymentId } = req.params;
      const file = req.file;

      if (!file) {
        throw new ApiError("File bukti pembayaran tidak diterima", 400);
      }

      // Upload to Cloudinary
      const uploadResult = await this.cloudinaryService.upload(file);
      const proofUrl = uploadResult.secure_url;

      const paymentIdNum = parseInt(paymentId);

      const result = await this.paymentService.uploadPaymentProof(
        paymentIdNum,
        proofUrl,
        customerId,
      );

      res.status(200).json({
        message: "Bukti pembayaran berhasil diupload",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
