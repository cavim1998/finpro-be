import { Router } from "express";
import { PickupRequestController } from "./pickup-request.controller.js";
import { verifyToken } from "../../middlewares/jwt.middleware.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { CreatePickupRequestDTO } from "./dto/create-pickup-request.dto.js";
import { GetPickupRequestsDTO } from "./dto/get-pickup-requests.dto.js";
import { JWT_SECRET } from "../../config/env.js";

export class PickupRequestRouter {
  private router: Router;

  constructor(
    private pickupRequestController: PickupRequestController,
    private validationMiddleware: ValidationMiddleware,
  ) {
    this.router = Router();

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
      this.validationMiddleware.validateQuery(GetPickupRequestsDTO),
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
