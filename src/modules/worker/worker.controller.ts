import { Request, Response } from "express";
import { WorkerService } from "./worker.service.js";
import { StationType } from "../../../generated/prisma/enums.js";

export class WorkerController {
  constructor(private workerService: WorkerService) {}

  getStationStats = async (req: Request, res: Response) => {
    const userId = Number(res.locals.user?.sub);
    const stationType = req.params.stationType as StationType;

    const data = await this.workerService.getStationStats(userId, stationType);
    res.json({ data });
  };

  getStationOrders = async (req: Request, res: Response) => {
    const userId = Number(res.locals.user?.sub);
    const stationType = req.params.stationType as StationType;
    const outletId = Number(req.params.outletId);

    const { scope = "my", page = 1, limit = 5 } = req.query as any;

    const data = await this.workerService.getOrders(
      userId,
      stationType,
      outletId,
      scope,
      Number(page),
      Number(limit),
    );

    res.json({ data });
  };

  getOrderDetail = async (req: Request, res: Response) => {
    const userId = Number(res.locals.user?.sub);
    const orderId = String(req.params.orderId);

    const data = await this.workerService.getOrderDetail(userId, orderId);
    res.json({ data });
  };

  getTaskHistory = async (req: Request, res: Response) => {
    const userId = Number(res.locals.user?.sub);
    const { page = 1, limit = 10 } = req.query as any;

    const data = await this.workerService.getTaskHistory(
      userId,
      Number(page),
      Number(limit),
    );

    res.json({ data });
  };

  claimOrder = async (req: Request, res: Response) => {
    const userId = Number(res.locals.user?.sub);
    const stationType = req.params.stationType as StationType;
    const orderId = String(req.params.orderId);

    const data = await this.workerService.claimOrder(
      userId,
      stationType,
      orderId,
    );
    res.json({ data });
  };

  completeOrderStation = async (req: Request, res: Response) => {
    const userId = Number(res.locals.user?.sub);
    const stationType = req.params.stationType as StationType;
    const orderId = String(req.params.orderId);

    const { itemCounts } = req.body as {
      itemCounts: Array<{ itemId: number; qty: number }>;
    };

    const data = await this.workerService.completeTask(
      userId,
      stationType,
      orderId,
      { itemCounts: itemCounts ?? [] },
    );

    res.json({ data });
  };

  bypassOrderStation = async (req: Request, res: Response) => {
    const userId = Number(res.locals.user?.sub);
    const stationType = req.params.stationType as StationType;
    const orderId = String(req.params.orderId);

    const { reason, itemCounts } = req.body as {
      reason: string;
      itemCounts?: Array<{ itemId: number; qty: number }>;
    };

    const data = await this.workerService.bypassTask(
      userId,
      stationType,
      orderId,
      { reason, itemCounts: itemCounts ?? [] },
    );

    res.json({ data });
  };
}
