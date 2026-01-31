import { Request, Response } from "express";
import { OutletService } from "./outlet.service.js";

export class OutletController {
  constructor(private outletService: OutletService) {}

  getOutlets = async (req: Request, res: Response) => {
    const outlets = await this.outletService.getAllOutlets();

    const formatted = outlets.map((o) => ({
      ...o,
      staffCount: o._count.staff,
    }));

    res.status(200).send(formatted);
  };

  getOutletById = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const outlet = await this.outletService.getOutletById(id);

    if (!outlet) {
      res.status(404).send({ error: "Outlet not found" });
      return;
    }

    res.status(200).send(outlet);
  };

  createOutlet = async (req: Request, res: Response) => {
    const result = await this.outletService.createOutlet(req.body);
    res.status(201).send(result);
  };

  updateOutlet = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const result = await this.outletService.updateOutlet(id, req.body);
    res.status(200).send(result);
  };

  deleteOutlet = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    await this.outletService.deleteOutlet(id);
    res.status(200).send({ message: "Outlet deleted successfully" });
  };
}
