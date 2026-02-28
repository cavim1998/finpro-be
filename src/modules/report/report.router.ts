import { Router } from "express";
import { ReportController } from "./report.controller.js";
import {
  verifyToken,
  authorizeRole,
} from "../../middlewares/jwt.middleware.js";
import { JWT_SECRET } from "../../config/env.js";
import { RoleCode } from "../../../generated/prisma/client.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { GetAttendanceReportDto } from "./dto/get-attendance-report.dto.js";
import { OutletStaffParamDto } from "./dto/outlet-staff-param.dto.js";

export class ReportRouter {
  private router: Router;

  constructor(
    private reportController: ReportController,
    private validationMiddleware: ValidationMiddleware,
  ) {
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

    this.router.get(
      "/attendance",
      verifyToken(JWT_SECRET),
      authorizeRole([RoleCode.OUTLET_ADMIN]),
      this.validationMiddleware.validateQuery(GetAttendanceReportDto),
      this.reportController.getAttendance,
    );

    this.router.get(
      "/attendance/:outletStaffId/history",
      verifyToken(JWT_SECRET),
      authorizeRole([RoleCode.OUTLET_ADMIN]),
      this.validationMiddleware.validateParams(OutletStaffParamDto),
      this.validationMiddleware.validateQuery(GetAttendanceReportDto),
      this.reportController.getAttendanceHistoryDetail,
    );
  }

  getRouter() {
    return this.router;
  }
}
