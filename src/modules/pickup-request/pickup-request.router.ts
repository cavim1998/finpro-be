import { Router } from "express";
import { PickupRequestController } from "./pickup-request.controller.js";
import { PickupRequestService } from "./pickup-request.service.js";
import { verifyToken } from "../../middlewares/jwt.middleware.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { CreatePickupRequestDTO } from "./dto/create-pickup-request.dto.js";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { JWT_SECRET } from "../../config/env.js";

export class PickupRequestRouter {
  private router: Router;
  private pickupRequestController: PickupRequestController;
  private validationMiddleware: ValidationMiddleware;

  constructor(
    prisma: PrismaClient,
    validationMiddleware: ValidationMiddleware,
  ) {
    this.router = Router();
    this.validationMiddleware = validationMiddleware;

    const pickupRequestService = new PickupRequestService(prisma);
    this.pickupRequestController = new PickupRequestController(
      pickupRequestService,
    );

    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Customer routes
    this.router.post(
      "/",
      verifyToken(JWT_SECRET),
      this.validationMiddleware.validateBody(CreatePickupRequestDTO),
      this.pickupRequestController.createPickupRequest,
    );

    this.router.get(
      "/",
      verifyToken(JWT_SECRET),
      this.pickupRequestController.getPickupRequests,
    );

    this.router.get(
      "/:id",
      verifyToken(JWT_SECRET),
      this.pickupRequestController.getPickupRequestById,
    );

    // Outlet admin routes
    this.router.get(
      "/arrived/outlet",
      verifyToken(JWT_SECRET),
      this.pickupRequestController.getArrivedPickups,
    );
  }

  getRouter() {
    return this.router;
  }
}
