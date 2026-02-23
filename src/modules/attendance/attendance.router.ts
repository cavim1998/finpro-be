import { Router } from "express";
import { JWT_SECRET } from "../../config/env.js";
import { verifyToken } from "../../middlewares/jwt.middleware.js";
import { requireRole } from "../../middlewares/auth.middleware.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { AttendanceController } from "./attendance.controller.js";
import { ClockInDto } from "./dto/clock-in.dto.js";
import { ClockOutDto } from "./dto/clock-out.dto.js";
import { GetAttendanceHistoryDto } from "./dto/get-attendance-history.dto.js";

export class AttendanceRouter {
  private router: Router;

  constructor(
    private attendanceController: AttendanceController,
    private validationMiddleware: ValidationMiddleware,
  ) {
    this.router = Router();

    this.router.get(
      "/me/today",
      verifyToken(JWT_SECRET),
      requireRole(["WORKER", "DRIVER"]),
      this.attendanceController.getToday,
    );

    this.router.get(
      "/me/history",
      verifyToken(JWT_SECRET),
      requireRole(["WORKER", "DRIVER"]),
      this.validationMiddleware.validateQuery(GetAttendanceHistoryDto),
      this.attendanceController.getHistory,
    );

    this.router.post(
      "/me/clock-in",
      verifyToken(JWT_SECRET),
      requireRole(["WORKER", "DRIVER"]),
      this.validationMiddleware.validateBody(ClockInDto),
      this.attendanceController.clockIn,
    );

    this.router.post(
      "/me/clock-out",
      verifyToken(JWT_SECRET),
      requireRole(["WORKER", "DRIVER"]),
      this.validationMiddleware.validateBody(ClockOutDto),
      this.attendanceController.clockOut,
    );
  }

  getRouter = () => this.router;
}
