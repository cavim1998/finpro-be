import { Request, Response } from "express";
import { BypassService } from "./bypass.service.js";
import { RoleCode } from "../../../generated/prisma/client.js";

export class BypassController {
  constructor(private bypassService: BypassService) {}

  findAll = async (req: Request, res: Response) => {
    try {
      const user = res.locals.user;

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const sortBy = (req.query.sortBy as string) || "createdAt";
      const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";
      const status = req.query.status as string | undefined;

      let outletId: number | undefined;

      if (user.role === RoleCode.SUPER_ADMIN) {
        if (req.query.outletId) outletId = Number(req.query.outletId);
      } else {
        outletId = user.outletId;
        if (!outletId)
          return res.status(403).send({ error: "Outlet ID required" });
      }

      const result = await this.bypassService.findAll({
        outletId,
        page,
        limit,
        sortBy,
        sortOrder,
        status,
      });

      res.send(result);
    } catch (error: any) {
      res.status(500).send({ error: error.message });
    }
  };

  decision = async (req: Request, res: Response) => {
    try {
      const user = res.locals.user;
      const { id } = req.params;
      const { action, notes } = req.body;

      if (!["APPROVE", "REJECT"].includes(action)) {
        return res
          .status(400)
          .send({ error: "Action must be APPROVE or REJECT" });
      }

      if (![RoleCode.SUPER_ADMIN, RoleCode.OUTLET_ADMIN].includes(user.role)) {
        return res.status(403).send({ error: "Unauthorized" });
      }

      const result = await this.bypassService.handleDecision(
        Number(id),
        user.sub,
        action,
        notes,
      );

      res.send(result);
    } catch (error: any) {
      res.status(400).send({ error: error.message });
    }
  };
}
