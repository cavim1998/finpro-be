import { Router } from "express";
import { PickupController } from "./pickup.controller.js";
import { RoleCode } from "../../../generated/prisma/client.js";
import {
  verifyToken,
  authorizeRole,
} from "../../middlewares/jwt.middleware.js";

export class PickupRouter {
  private router: Router;

  constructor(private pickupController: PickupController) {
    this.router = Router();
    this.initRoutes();
  }

  private initRoutes() {
    this.router.get(
      "/",
      verifyToken(process.env.JWT_SECRET!),
      authorizeRole([RoleCode.SUPER_ADMIN, RoleCode.OUTLET_ADMIN]),
      this.pickupController.findAll,
    );
  }

  getRouter() {
    return this.router;
  }
}
