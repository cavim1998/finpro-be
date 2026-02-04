import { NextFunction, Request, Response } from "express";
import { ApiError } from "../../utils/api-error.js";
import { AttendanceService } from "./attendance.service.js";

export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  getToday = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = res.locals.user as { sub?: number | string };
      const userId = Number(auth?.sub);
      if (!userId) throw new ApiError("Unauthorized", 401);

      const data = await this.attendanceService.getToday(userId);
      res.status(200).send({ status: "success", data });
    } catch (err) {
      next(err);
    }
  };

  clockIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = res.locals.user as { sub?: number | string };
      const userId = Number(auth?.sub);
      if (!userId) throw new ApiError("Unauthorized", 401);

      const { notes } = req.body as { notes?: string };

      const data = await this.attendanceService.clockIn(userId, notes);
      res
        .status(200)
        .send({ status: "success", message: "Clock-in success", data });
    } catch (err) {
      next(err);
    }
  };

  clockOut = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = res.locals.user as { sub?: number | string };
      const userId = Number(auth?.sub);
      if (!userId) throw new ApiError("Unauthorized", 401);

      const { notes } = req.body as { notes?: string };
      const data = await this.attendanceService.clockOut(userId, notes);
      res
        .status(200)
        .send({ status: "success", message: "Clock-out success", data });
    } catch (err) {
      next(err);
    }
  };
}
