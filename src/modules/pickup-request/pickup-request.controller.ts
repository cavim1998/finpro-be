import { Request, Response, NextFunction } from "express";
import { PickupRequestService } from "./pickup-request.service.js";
import { PickupStatus } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";

export class PickupRequestController {
  constructor(private pickupRequestService: PickupRequestService) {}

  createPickupRequest = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);
      const customerId = parseInt(authUser.sub);

      const result = await this.pickupRequestService.createPickupRequest(
        req.body,
        customerId,
      );

      res.status(201).json({
        message: "Pickup request berhasil dibuat",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getPickupRequests = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);
      const customerId = parseInt(authUser.sub);

      const { status } = req.query;

      const result = await this.pickupRequestService.getPickupRequests(
        customerId,
        status as PickupStatus,
      );

      res.status(200).json({
        message: "Pickup requests berhasil diambil",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getPickupRequestById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);
      const customerId = parseInt(authUser.sub);

      const { id } = req.params;

      const result = await this.pickupRequestService.getPickupRequestById(
        id,
        customerId,
      );

      res.status(200).json({
        message: "Pickup request detail berhasil diambil",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getArrivedPickups = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);
      const userId = parseInt(authUser.sub);

      // Query parameter for outlet (optional, for outlet admin with multiple outlets)
      const outletIdParam = req.query.outletId
        ? Number(req.query.outletId)
        : undefined;

      const result = await this.pickupRequestService.getArrivedPickupsForOutlet(
        userId,
        outletIdParam,
      );

      res.status(200).json({
        message: "Pickup yang telah sampai berhasil diambil",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
