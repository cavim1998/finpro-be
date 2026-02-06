import { Router } from "express";
import { EmployeeController } from "./employee.controller.js";
import { AssignEmployeeDTO } from "./dto/assign-employee.dto.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";

export class EmployeeRouter {
  private router: Router;

  constructor(
    private employeeController: EmployeeController,
    private validationMiddleware: ValidationMiddleware,
  ) {
    this.router = Router();
    this.initRoutes();
  }

  private initRoutes() {
    this.router.get("/", this.employeeController.getAll);

    this.router.get("/available", this.employeeController.getAvailable);

    this.router.post(
      "/assign",
      this.validationMiddleware.validateBody(AssignEmployeeDTO),
      this.employeeController.assign,
    );

    this.router.delete("/:id", this.employeeController.unassign);
  }

  getRouter() {
    return this.router;
  }
}
