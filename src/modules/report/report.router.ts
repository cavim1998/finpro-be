import { Router } from "express";
import { ReportController } from "./report.controller.js";
import {
  verifyToken,
  authorizeRole,
} from "../../middlewares/jwt.middleware.js";
import { JWT_SECRET } from "../../config/env.js";
import { RoleCode } from "../../../generated/prisma/client.js";

export class ReportRouter {
  private router: Router;

  constructor(private reportController: ReportController) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    const allowedRoles = [RoleCode.SUPER_ADMIN, RoleCode.OUTLET_ADMIN];

    this.router.get(
      "/sales",
      verifyToken(JWT_SECRET),
      authorizeRole(allowedRoles),
      this.reportController.getSales,
    );

    this.router.get(
      "/performance",
      verifyToken(JWT_SECRET),
      authorizeRole(allowedRoles),
      this.reportController.getPerformance,
    );
  }

  getRouter() {
    return this.router;
  }
}
