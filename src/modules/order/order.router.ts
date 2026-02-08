import { Router } from "express";
import { OrderController } from "./order.controller.js";
import { OrderService } from "./order.service.js";
import { verifyToken } from "../../middlewares/jwt.middleware.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { CreateOrderDTO } from "./dto/create-order.dto.js";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { JWT_SECRET } from "../../config/env.js";

export class OrderRouter {
  private router: Router;
  private orderController: OrderController;
  private validationMiddleware: ValidationMiddleware;

  constructor(
    prisma: PrismaClient,
    validationMiddleware: ValidationMiddleware,
  ) {
    this.router = Router();
    this.validationMiddleware = validationMiddleware;

    const orderService = new OrderService(prisma);
    this.orderController = new OrderController(orderService);

    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Customer routes
    this.router.get(
      "/",
      verifyToken(JWT_SECRET),
      this.orderController.getOrders,
    );

    this.router.get(
      "/:id",
      verifyToken(JWT_SECRET),
      this.orderController.getOrderById,
    );

    this.router.post(
      "/:id/confirm",
      verifyToken(JWT_SECRET),
      this.orderController.confirmOrder,
    );

    // Outlet admin routes
    this.router.post(
      "/",
      verifyToken(JWT_SECRET),
      this.validationMiddleware.validateBody(CreateOrderDTO),
      this.orderController.createOrder,
    );
  }

  getRouter() {
    return this.router;
  }
}
