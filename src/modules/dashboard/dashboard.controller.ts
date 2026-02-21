import { Request, Response, NextFunction } from "express";
import { DashboardService } from "./dashboard.service.js";
import { RoleCode } from "../../../generated/prisma/client.js";

export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = res.locals.user;

      let outletId =
        user.role === RoleCode.SUPER_ADMIN
          ? Number(req.query.outletId)
          : user.outletId;
      if (isNaN(outletId)) outletId = undefined;

      const stats = await this.dashboardService.getStats(outletId);

      res.status(200).json({ message: "Dashboard stats fetched", data: stats });
    } catch (error) {
      next(error);
    }
  };
}
