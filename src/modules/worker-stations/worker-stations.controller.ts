import type { Request, Response } from "express";
import { WorkerStationsService } from "./worker-stations.service.js";

export class WorkerStationsController {
  private service: WorkerStationsService;

  constructor() {
    this.service = new WorkerStationsService();
  }

  getIncoming = async (req: Request, res: Response) => {
    const stationType = String(req.params.stationType);
    const result = await this.service.getIncoming(stationType);
    return res.json({ data: result });
  };

  getMyTasks = async (req: Request, res: Response) => {
    const stationType = String(req.params.stationType);
    const workerId = Number(res.locals.user?.sub);
    const result = await this.service.getMyTasks(stationType, workerId);
    return res.json({ data: result });
  };

  startTask = async (req: Request, res: Response) => {
    const stationType = String(req.params.stationType);
    const orderId = String(req.params.orderId);
    const workerId = Number(res.locals.user?.sub);

    const result = await this.service.startTask(stationType, orderId, workerId);
    return res.json({ data: result });
  };

  completeTask = async (req: Request, res: Response) => {
    const stationType = String(req.params.stationType);
    const orderId = String(req.params.orderId);
    const workerId = Number(res.locals.user?.sub);

    const payload = req.body as {
      itemCounts: Array<{ itemId: number; qty: number }>;
    };

    const result = await this.service.completeTask(
      stationType,
      orderId,
      workerId,
      payload,
    );
    return res.json({ data: result });
  };
}
