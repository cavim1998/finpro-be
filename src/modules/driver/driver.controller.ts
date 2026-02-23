import { Request, Response } from "express";
import { DriverService } from "./driver.service.js";
import { DriverDashboardQueryDTO } from "./dto/driver-dashboard.query.dto.js";
import { PickupIdParamDTO } from "./dto/pickup-id.params.dto.js";
import { TaskIdParamDTO } from "./dto/task-id.params.dto.js";
import { OrderIdParamDTO } from "./dto/order-id.params.dto.js";
import { RoleCode } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";

type LocalsUser = {
  user: { sub?: number | string; role?: RoleCode };
};

export class DriverController {
  constructor(private driverService: DriverService) {}

  private getAuthUser(res: Response<any, LocalsUser>) {
    const user = (res.locals.user ?? {}) as LocalsUser["user"];
    const userId = Number(user?.sub);
    const role = user?.role as RoleCode;

    if (!user?.sub || !Number.isFinite(userId) || !role) {
      throw new ApiError("Unauthorized", 401);
    }

    return { userId, role };
  }

  getDashboard = async (req: Request, res: Response<any, LocalsUser>) => {
    const { userId, role } = this.getAuthUser(res);

    const data = await this.driverService.getDashboard(
      userId,
      role,
      req.query as any as DriverDashboardQueryDTO,
    );

    return res.json({ data });
  };

  claimPickup = async (req: Request, res: Response<any, LocalsUser>) => {
    const { userId, role } = this.getAuthUser(res);
    const { pickupId } = req.params as any as PickupIdParamDTO;

    const data = await this.driverService.claimPickup(userId, role, pickupId);
    return res.json({ data });
  };

  startTask = async (req: Request, res: Response<any, LocalsUser>) => {
    const { userId, role } = this.getAuthUser(res);
    const { taskId } = req.params as any as TaskIdParamDTO;

    const data = await this.driverService.startTask(userId, role, taskId);
    return res.json({ data });
  };

  cancelPickup = async (req: Request, res: Response<any, LocalsUser>) => {
    const { userId, role } = this.getAuthUser(res);
    const { taskId } = req.params as any as TaskIdParamDTO;

    const data = await this.driverService.cancelPickup(userId, role, taskId);
    return res.json({ data });
  };

  pickupPickedUp = async (req: Request, res: Response<any, LocalsUser>) => {
    const { userId, role } = this.getAuthUser(res);
    const { taskId } = req.params as any as TaskIdParamDTO;

    const data = await this.driverService.pickupPickedUp(userId, role, taskId);
    return res.json({ data });
  };

  pickupArrived = async (req: Request, res: Response<any, LocalsUser>) => {
    const { userId, role } = this.getAuthUser(res);
    const { taskId } = req.params as any as TaskIdParamDTO;

    const data = await this.driverService.pickupArrivedOutlet(
      userId,
      role,
      taskId,
    );
    return res.json({ data });
  };

  claimDelivery = async (req: Request, res: Response<any, LocalsUser>) => {
    const { userId, role } = this.getAuthUser(res);
    const { orderId } = req.params as any as OrderIdParamDTO;

    const data = await this.driverService.claimDelivery(userId, role, orderId);
    return res.json({ data });
  };

  completeDelivery = async (req: Request, res: Response<any, LocalsUser>) => {
    const { userId, role } = this.getAuthUser(res);
    const { taskId } = req.params as any as TaskIdParamDTO;

    const data = await this.driverService.completeDelivery(
      userId,
      role,
      taskId,
    );
    return res.json({ data });
  };
}
