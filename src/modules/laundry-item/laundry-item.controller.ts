import { Request, Response } from "express";
import { LaundryItemService } from "./laundry-item.service.js";

export class LaundryItemController {
  constructor(private laundryItemService: LaundryItemService) {}

  getItems = async (req: Request, res: Response) => {
    const items = await this.laundryItemService.getAllItems({
      search: req.query.search as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
      sortBy: (req.query.sortBy as string) || "name",
      sortOrder: (req.query.sortOrder as "asc" | "desc") || "asc",
    });

    const formatted = items.data.map((item: any) => ({
      id: item.id,
      name: item.name,
      unit: item.unit,
      price: item.price,
      isActive: item.isActive,
      usageCount: item._count?.orderItems || 0,
    }));

    res.status(200).send(formatted);
  };

  createItem = async (req: Request, res: Response) => {
    try {
      const result = await this.laundryItemService.createItem(req.body);
      res.status(201).send(result);
    } catch (error: any) {
      if (error.code === "P2002") {
        res.status(400).send({ error: "Nama item laundry sudah ada" });
      } else {
        throw error;
      }
    }
  };

  updateItem = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const result = await this.laundryItemService.updateItem(id, req.body);
    res.status(200).send(result);
  };

  deleteItem = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    await this.laundryItemService.deleteItem(id);
    res.status(200).send({ message: "Item deleted successfully" });
  };
}
