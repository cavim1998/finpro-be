import { Router } from "express";
import { verifyToken } from "../../middlewares/jwt.middleware.js";
import { JWT_SECRET } from "../../config/env.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { WorkerController } from "./worker.controller.js";
import { WorkerService } from "./worker.service.js";
import { RoleCode } from "../../../generated/prisma/enums.js";
import { StationParamDto } from "./dto/station-param.dto.js";
import { GetWorkerOrdersDto } from "./dto/get-worker-orders.dto.js";
import { ClaimOrderParamDto } from "./dto/claim-order-param.dto.js";
import { CompleteStationParamDto } from "./dto/complete-station-param.dto.js";
import { CompleteStationDto } from "./dto/complete-station.dto.js";
import { WorkerOrderDetailParamDto } from "./dto/worker-order-detail-param.dto.js";
export class WorkerRouter {
  private router: Router;

  constructor(private validationMiddleware: ValidationMiddleware) {
    this.router = Router();

    // services/controllers
    const workerService = new WorkerService();
    const workerController = new WorkerController(workerService);

    this.initializedRoutes(workerController);
  }

  private initializedRoutes(workerController: WorkerController) {
    this.router.use(verifyToken(JWT_SECRET));
    this.router.use(requireRole([RoleCode.WORKER]));

    /**
     * =========================
     * DASHBOARD: STATS + LISTS
     * =========================
     */
    this.router.get(
      "/stations/:stationType/stats",
      this.validationMiddleware.validateParams(StationParamDto),
      workerController.getStationStats,
    );

    this.router.get(
      "/stations/:stationType/orders",
      this.validationMiddleware.validateParams(StationParamDto),
      this.validationMiddleware.validateQuery(GetWorkerOrdersDto),
      workerController.getStationOrders,
    );

    this.router.get(
      "/orders/:orderId",
      this.validationMiddleware.validateParams(WorkerOrderDetailParamDto),
      workerController.getOrderDetail,
    );

    // 1) CLAIM (startTask)
    this.router.post(
      "/stations/:stationType/:orderId/claim",
      this.validationMiddleware.validateParams(ClaimOrderParamDto),
      workerController.claimOrder,
    );

    // 2) COMPLETE (completeTask) -> payload itemCounts
    this.router.post(
      "/stations/:stationType/:orderId/complete",
      this.validationMiddleware.validateParams(CompleteStationParamDto),
      this.validationMiddleware.validateBody(CompleteStationDto),
      workerController.completeOrderStation,
    );

    // 3) BYPASS -> request ke admin
    this.router.post(
      "/stations/:stationType/:orderId/bypass",
      this.validationMiddleware.validateParams(CompleteStationParamDto),
      workerController.bypassOrderStation,
    );
  }

  public getRouter() {
    return this.router;
  }
}
