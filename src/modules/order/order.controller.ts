import { Request, Response, NextFunction } from "express";
import { OrderService } from "./order.service.js";
import { ApiError } from "../../utils/api-error.js";

export class OrderController {
  constructor(private orderService: OrderService) {}

  createOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);
      const outletAdminId = parseInt(authUser.sub);

      const result = await this.orderService.createOrder(
        req.body,
        outletAdminId,
      );

      res.status(201).json({
        message: "Order berhasil dibuat",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);
      const customerId = parseInt(authUser.sub);

      const result = await this.orderService.getOrders(customerId, req.query);

      res.status(200).json({
        message: "Orders berhasil diambil",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getOrderById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);
      const customerId = parseInt(authUser.sub);

      const { id } = req.params;

      const result = await this.orderService.getOrderById(id, customerId);

      res.status(200).json({
        message: "Order detail berhasil diambil",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  confirmOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);
      const customerId = parseInt(authUser.sub);

      const { id } = req.params;

      const result = await this.orderService.confirmOrderReceived(
        id,
        customerId,
      );

      res.status(200).json({
        message: "Order berhasil dikonfirmasi",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
