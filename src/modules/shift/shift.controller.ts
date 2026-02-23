import { Request, Response } from "express";
import { ShiftService } from "./shift.service.js";

export class ShiftController {
  constructor(private shiftService: ShiftService) {}

  getShifts = async (req: Request, res: Response) => {
    const outletId = req.query.outletId
      ? Number(req.query.outletId)
      : undefined;

    const shift = await this.shiftService.getShifts({
      search: req.query.search as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
      sortBy: (req.query.sortBy as string) || "name",
      sortOrder: (req.query.sortOrder as "asc" | "desc") || "asc",
      outletId,
    });

    res.status(200).send(shift);
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
