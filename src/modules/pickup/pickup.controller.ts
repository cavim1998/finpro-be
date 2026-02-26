import { Request, Response } from "express";
import { PickupService } from "./pickup.service.js";
import { RoleCode } from "../../../generated/prisma/client.js";

export class PickupController {
  constructor(private pickupService: PickupService) {}

  findAll = async (req: Request, res: Response) => {
    try {
      const user = res.locals.user;

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const sortBy = (req.query.sortBy as string) || "createdAt";
      const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";
      const status = req.query.status as string | undefined;
      const isOrderCreated = req.query.isOrderCreated as string | undefined;

      let outletId: number | undefined;

      console.log(user);

      if (user.role === RoleCode.SUPER_ADMIN) {
        if (req.query.outletId) {
          outletId = Number(req.query.outletId);
        }
      } else {
        outletId = user.outletId;
        if (!outletId) {
          return res
            .status(400)
            .send({ error: "Unauthorized: User missing Outlet ID" });
        }
      }

      const result = await this.pickupService.findAll({
        outletId,
        page,
        limit,
        sortBy,
        sortOrder,
        status,
        isOrderCreated,
      });

      res.send(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).send({ error: error.message || "Internal Server Error" });
    }
  };
}
