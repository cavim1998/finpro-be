import { Router } from "express";
import { verifyToken } from "../../middlewares/jwt.middleware.js";
import { JWT_SECRET } from "../../config/env.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { WorkerController } from "./worker.controller.js";
import { WorkerService } from "./worker.service.js";
import { WorkerStationsService } from "../worker-stations/worker-stations.service.js";
import { StationParamDto } from "./dto/station-param.dto.js";
import { GetWorkerOrdersDto } from "./dto/get-worker-orders.dto.js";
import { ClaimOrderParamDto } from "./dto/claim-order-param.dto.js";
import { CompleteStationParamDto } from "./dto/complete-station-param.dto.js";
import { CompleteStationDto } from "./dto/complete-station.dto.js";
export class WorkerRouter {
  private router: Router;

  constructor(private validationMiddleware: ValidationMiddleware) {
    this.router = Router();

    // services/controllers
    const workerService = new WorkerService();
    const workerController = new WorkerController(workerService);

    const workerStationsService = new WorkerStationsService();

    this.initializedRoutes(workerController, workerStationsService);
  }

  private initializedRoutes(
    workerController: WorkerController,
    workerStationsService: WorkerStationsService,
  ) {
    // semua endpoint worker harus login
    this.router.use(verifyToken(JWT_SECRET));

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

    // GET /worker/stations/:stationType/orders?scope=incoming|my|completed&page=1&limit=10
    this.router.get(
      "/stations/:stationType/orders",
      this.validationMiddleware.validateParams(StationParamDto),
      this.validationMiddleware.validateQuery(GetWorkerOrdersDto),
      workerController.getStationOrders,
    );

    // 1) CLAIM (startTask)
    this.router.post(
      "/stations/:stationType/:orderId/claim",
      this.validationMiddleware.validateParams(ClaimOrderParamDto),
      async (req, res) => {
        const userId = Number(res.locals.user?.sub);
        const { stationType, orderId } = req.params as any;

        const data = await workerStationsService.startTask(
          stationType,
          orderId,
          userId,
        );

        res.json({ data });
      },
    );

    // 2) COMPLETE (completeTask) -> payload itemCounts
    this.router.post(
      "/stations/:stationType/:orderId/complete",
      this.validationMiddleware.validateParams(CompleteStationParamDto),
      this.validationMiddleware.validateBody(CompleteStationDto),
      async (req, res) => {
        const userId = Number(res.locals.user?.sub);
        const { stationType, orderId } = req.params as any;

        // CompleteStationDTO harus bentuknya:
        // { itemCounts: Array<{ itemId: number; qty: number }> }
        const payload = req.body;

        const data = await workerStationsService.completeTask(
          stationType,
          orderId,
          userId,
          payload,
        );

        res.json({ data });
      },
    );

    // 3) BYPASS -> request ke admin
    this.router.post(
      "/stations/:stationType/:orderId/bypass",
      this.validationMiddleware.validateParams(CompleteStationParamDto),
      async (req, res) => {
        const userId = Number(res.locals.user?.sub);
        const { stationType, orderId } = req.params as any;

        const payload = req.body as any;

        const data = await workerStationsService.requestBypass(
          stationType,
          orderId,
          userId,
          payload,
        );

        res.json({ data });
      },
    );
  }

  public getRouter() {
    return this.router;
  }
}
