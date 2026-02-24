import { Request, Response } from "express";
import { OutletService } from "./outlet.service.js";

export class OutletController {
  constructor(private outletService: OutletService) {}

  getOutlets = async (req: Request, res: Response) => {
    const outlets = await this.outletService.getAllOutlets({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
      search: req.query.search as string,
      locationCategory: req.query.locationCategory as string,
      sortBy: (req.query.sortBy as string) || "createdAt",
      sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
    });

    res.status(200).send(outlets);
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

  uploadOutletPhoto = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const result = await this.outletService.updateOutletPhoto(id, req.file);
    res.status(200).send({
      message: "Outlet photo uploaded successfully",
      data: result,
    });
  };

  deleteOutlet = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    await this.outletService.deleteOutlet(id);
    res.status(200).send({ message: "Outlet deleted successfully" });
  };
}
