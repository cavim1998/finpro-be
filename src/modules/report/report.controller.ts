import { Request, Response, NextFunction } from "express";
import { ReportService } from "./report.service.js";
import { RoleCode } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";

export class ReportController {
  constructor(private reportService: ReportService) {}

  private getAuthorizedOutletId(
    user: any,
    queryOutlet?: string,
  ): number | undefined {
    if (user.role === RoleCode.SUPER_ADMIN) {
      return queryOutlet ? Number(queryOutlet) : undefined;
    }
    if (!user.outletId) {
      throw new ApiError("Outlet ID is required for Outlet Admin", 400);
    }
    return user.outletId;
  }

  getSales = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const outletId = this.getAuthorizedOutletId(
        res.locals.user,
        req.query.outletId as string,
      );
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;

      const result = await this.reportService.getSalesReport(
        outletId,
        startDate,
        endDate,
        page,
        limit,
      );

      res.status(200).json({
        message: "Laporan penjualan berhasil diambil",
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  getPerformance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const outletId = this.getAuthorizedOutletId(
        res.locals.user,
        req.query.outletId as string,
      );
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;

      const result = await this.reportService.getPerformanceReport(
        outletId,
        startDate,
        endDate,
        page,
        limit,
      );

      res.status(200).json({
        message: "Laporan performa berhasil diambil",
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };
}
