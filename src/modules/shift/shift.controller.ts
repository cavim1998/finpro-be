import { Request, Response } from "express";
import { ShiftService } from "./shift.service.js";

export class ShiftController {
  constructor(private shiftService: ShiftService) {}

  getShifts = async (req: Request, res: Response) => {
    const outletId = Number(req.query.outletId);
    if (!outletId) return res.status(400).send({ error: "Outlet ID required" });

    const result = await this.shiftService.getShifts(outletId);

    const formatted = result.map((s) => ({
      ...s,
      startTime: s.startTime.toISOString().substring(11, 16),
      endTime: s.endTime.toISOString().substring(11, 16),
    }));

    res.status(200).send(formatted);
  };

  createShift = async (req: Request, res: Response) => {
    try {
      const result = await this.shiftService.createShift(req.body);
      res.status(201).send({ message: "Shift created", data: result });
    } catch (error: any) {
      res.status(500).send({ error: error.message });
    }
  };

  deleteShift = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    await this.shiftService.deleteShift(id);
    res.status(200).send({ message: "Shift deleted" });
  };
}
