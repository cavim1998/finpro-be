import { Router } from "express";
import { OrderController } from "./order.controller.js";
import {
  verifyToken,
  authorizeRole,
} from "../../middlewares/jwt.middleware.js";
import { JWT_SECRET } from "../../config/env.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { CreateOrderDTO } from "./dto/create-order.dto.js";
import { RoleCode } from "../../../generated/prisma/client.js";

export class OrderRouter {
  private router: Router;

  constructor(
    private orderController: OrderController,
    private validationMiddleware: ValidationMiddleware,
  ) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(
      "/",
      verifyToken(JWT_SECRET),
      authorizeRole([RoleCode.OUTLET_ADMIN, RoleCode.SUPER_ADMIN]),
      this.orderController.findAll,
    );

    this.router.get(
      "/:id",
      verifyToken(JWT_SECRET),
      this.orderController.getOrderById,
    );

    this.router.post(
      "/",
      verifyToken(JWT_SECRET),
      authorizeRole([RoleCode.OUTLET_ADMIN, RoleCode.SUPER_ADMIN]),
      this.validationMiddleware.validateBody(CreateOrderDTO),
      this.orderController.create,
    );

    this.router.patch(
      "/:id",
      verifyToken(JWT_SECRET),
      this.orderController.confirmOrder,
    );

    this.router.get(
      "/admin/:id",
      verifyToken(JWT_SECRET),
      authorizeRole([RoleCode.SUPER_ADMIN, RoleCode.OUTLET_ADMIN]),
      this.orderController.getAdminOrderById,
    );
  }

  getRouter() {
    return this.router;
  }
}
