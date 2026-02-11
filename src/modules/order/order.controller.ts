import { Request, Response } from "express";
import { OrderService } from "./order.service.js";
import { OrderStatus, RoleCode } from "../../../generated/prisma/client.js";

export class OrderController {
  constructor(private orderService: OrderService) {}

  create = async (req: Request, res: Response) => {
    try {
      const adminId = res.locals.user.userId;

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
      });

      res.send(result);
    } catch (error: any) {
      res.status(500).send({ error: error.message });
    }
  };

  findOne = async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const order = await this.orderService.findOne(id);
      res.send(order);
    } catch (error: any) {
      res.status(error.statusCode || 500).send({ error: error.message });
    }
  };
}
