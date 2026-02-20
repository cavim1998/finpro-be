import { Request, Response } from "express";
import { DriverService } from "./driver.service.js";
import { DriverDashboardQueryDTO } from "./dto/driver-dashboard.query.dto.js";
import { PickupIdParamDTO } from "./dto/pickup-id.params.dto.js";
import { TaskIdParamDTO } from "./dto/task-id.params.dto.js";
import { OrderIdParamDTO } from "./dto/order-id.params.dto.js";
import { RoleCode } from "../../../generated/prisma/client.js";

type LocalsUser = {
  user: {
    id: number;
    role: RoleCode;
  };
};

export class DriverController {
  constructor(private driverService: DriverService) {}

  getDashboard = async (req: Request, res: Response<any, LocalsUser>) => {
    const userId = Number((res.locals.user as any)?.sub);
    const role = (res.locals.user as any)?.role;

    const data = await this.driverService.getDashboard(
      userId,
      role,
      req.query as any as DriverDashboardQueryDTO,
    );

    return res.json({ data });
  };

  claimPickup = async (req: Request, res: Response<any, LocalsUser>) => {
    const { id: userId, role } = res.locals.user;
    const { pickupId } = req.params as any as PickupIdParamDTO;

    const data = await this.driverService.claimPickup(userId, role, pickupId);
    return res.json({ data });
  };

  startTask = async (req: Request, res: Response<any, LocalsUser>) => {
    const { id: userId, role } = res.locals.user;
    const { taskId } = req.params as any as TaskIdParamDTO;

    const data = await this.driverService.startTask(userId, role, taskId);
    return res.json({ data });
  };

  cancelPickup = async (req: Request, res: Response<any, LocalsUser>) => {
    const { id: userId, role } = res.locals.user;
    const { taskId } = req.params as any as TaskIdParamDTO;

    const data = await this.driverService.cancelPickup(userId, role, taskId);
    return res.json({ data });
  };

  pickupPickedUp = async (req: Request, res: Response<any, LocalsUser>) => {
    const { id: userId, role } = res.locals.user;
    const { taskId } = req.params as any as TaskIdParamDTO;

    const data = await this.driverService.pickupPickedUp(userId, role, taskId);
    return res.json({ data });
  };

  pickupArrived = async (req: Request, res: Response<any, LocalsUser>) => {
    const { id: userId, role } = res.locals.user;
    const { taskId } = req.params as any as TaskIdParamDTO;

    const data = await this.driverService.pickupArrivedOutlet(
      userId,
      role,
      taskId,
    );
    return res.json({ data });
  };

  claimDelivery = async (req: Request, res: Response<any, LocalsUser>) => {
    const { id: userId, role } = res.locals.user;
    const { orderId } = req.params as any as OrderIdParamDTO;

    const data = await this.driverService.claimDelivery(userId, role, orderId);
    return res.json({ data });
  };

  completeDelivery = async (req: Request, res: Response<any, LocalsUser>) => {
    const { id: userId, role } = res.locals.user;
    const { taskId } = req.params as any as TaskIdParamDTO;

    const data = await this.driverService.completeDelivery(
      userId,
      role,
      taskId,
    );
    return res.json({ data });
  };
}
