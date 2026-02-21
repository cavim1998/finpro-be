import { Router } from "express";
import { DashboardController } from "./dashboard.controller.js";
import {
  verifyToken,
  authorizeRole,
} from "../../middlewares/jwt.middleware.js";
import { JWT_SECRET } from "../../config/env.js";
import { RoleCode } from "../../../generated/prisma/client.js";

export class DashboardRouter {
  private router: Router;

  constructor(private controller: DashboardController) {
    this.router = Router();
    this.init();
  }

  private init() {
    this.router.get(
      "/stats",
      verifyToken(JWT_SECRET),
      authorizeRole([RoleCode.SUPER_ADMIN, RoleCode.OUTLET_ADMIN]),
      this.controller.getStats,
    );
  }

  getRouter() {
    return this.router;
  }
}
