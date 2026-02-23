import { Router } from "express";
import { DriverController } from "./driver.controller.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { verifyToken } from "../../middlewares/jwt.middleware.js";
import { JWT_SECRET } from "../../config/env.js";

import { DriverDashboardQueryDTO } from "./dto/driver-dashboard.query.dto.js";
import { PickupIdParamDTO } from "./dto/pickup-id.params.dto.js";
import { TaskIdParamDTO } from "./dto/task-id.params.dto.js";
import { OrderIdParamDTO } from "./dto/order-id.params.dto.js";

import { requireRole } from "../../middlewares/role.middleware.js";
import { RoleCode } from "../../../generated/prisma/enums.js";

export class DriverRouter {
  private router: Router;

  constructor(
    private driverController: DriverController,
    private validation: ValidationMiddleware,
  ) {
    this.router = Router();
    this.initRoutes();
  }

  private initRoutes() {
    this.router.use(verifyToken(JWT_SECRET));
    this.router.use(requireRole([RoleCode.DRIVER]));

    this.router.get(
      "/dashboard",
      this.validation.validateQuery(DriverDashboardQueryDTO),
      this.driverController.getDashboard,
    );

    this.router.post(
      "/pickups/claim/:pickupId",
      this.validation.validateParams(PickupIdParamDTO),
      this.driverController.claimPickup,
    );
    this.router.post(
      "/pickups/:pickupId/claim",
      this.validation.validateParams(PickupIdParamDTO),
      this.driverController.claimPickup,
    );

    this.router.post(
      "/tasks/start/:taskId",
      this.validation.validateParams(TaskIdParamDTO),
      this.driverController.startTask,
    );
    this.router.post(
      "/tasks/:taskId/start",
      this.validation.validateParams(TaskIdParamDTO),
      this.driverController.startTask,
    );

    this.router.post(
      "/pickups/cancel/:taskId",
      this.validation.validateParams(TaskIdParamDTO),
      this.driverController.cancelPickup,
    );
    this.router.post(
      "/pickups/:taskId/cancel",
      this.validation.validateParams(TaskIdParamDTO),
      this.driverController.cancelPickup,
    );

    this.router.post(
      "/pickups/picked-up/:taskId",
      this.validation.validateParams(TaskIdParamDTO),
      this.driverController.pickupPickedUp,
    );
    this.router.post(
      "/pickups/:taskId/picked-up",
      this.validation.validateParams(TaskIdParamDTO),
      this.driverController.pickupPickedUp,
    );

    this.router.post(
      "/pickups/arrived/:taskId",
      this.validation.validateParams(TaskIdParamDTO),
      this.driverController.pickupArrived,
    );
    this.router.post(
      "/pickups/:taskId/arrived",
      this.validation.validateParams(TaskIdParamDTO),
      this.driverController.pickupArrived,
    );

    this.router.post(
      "/orders/claim/:orderId",
      this.validation.validateParams(OrderIdParamDTO),
      this.driverController.claimDelivery,
    );
    this.router.post(
      "/orders/:orderId/claim",
      this.validation.validateParams(OrderIdParamDTO),
      this.driverController.claimDelivery,
    );

    this.router.post(
      "/deliveries/complete/:taskId",
      this.validation.validateParams(TaskIdParamDTO),
      this.driverController.completeDelivery,
    );
    this.router.post(
      "/deliveries/:taskId/complete",
      this.validation.validateParams(TaskIdParamDTO),
      this.driverController.completeDelivery,
    );
  }

  public getRouter() {
    return this.router;
  }
}
