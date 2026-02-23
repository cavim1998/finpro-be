import { Request, Response, NextFunction } from "express";
import { OrderService } from "./order.service.js";
import { OrderStatus, RoleCode } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";

export class OrderController {
  constructor(private orderService: OrderService) {}

  create = async (req: Request, res: Response) => {
    try {
      // const adminId = res.locals.user.userId;
      const adminId = res.locals.user.sub;

      if (!adminId) {
        return res
          .status(401)
          .send({ error: "Unauthorized: User ID not found in token" });
      }

      const result = await this.orderService.createOrder(req.body, adminId);

      res.status(201).send({
        message: "Order created successfully",
        data: result,
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).send({ error: error.message });
    }
  };

  findAll = async (req: Request, res: Response) => {
    try {
      const user = res.locals.user;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const sortBy = (req.query.sortBy as string) || "createdAt";
      const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";
      const status = req.query.status as OrderStatus | undefined;
      const search = req.query.search as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      let outletId: number | undefined;

      if (user.role === RoleCode.SUPER_ADMIN) {
        if (req.query.outletId) {
          outletId = Number(req.query.outletId);
        }
      } else {
        outletId = user.outletId;

        if (!outletId) {
          return res
            .status(400)
            .send({ error: "Outlet ID is required for Outlet Admin" });
        }
      }

      const result = await this.orderService.findAll({
        outletId,
        page,
        limit,
        sortBy,
        sortOrder,
        status,
        search,
        startDate,
        endDate,
      });

      res.send(result);
    } catch (error: any) {
      res.status(500).send({ error: error.message });
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

      // Optional: validate status from body if provided
      const { status } = req.body || {};
      if (status && status !== "RECEIVED_BY_CUSTOMER") {
        throw new ApiError(
          "Invalid status. Only RECEIVED_BY_CUSTOMER is allowed",
          400,
        );
      }

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

  getAdminOrderById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = res.locals.user;
      const { id } = req.params;

      const result = await this.orderService.getAdminOrderById(
        id,
        user.role as RoleCode,
        user.outletId,
      );

      res.status(200).json({
        message: "Order detail (Admin) berhasil diambil",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
