import { Request, Response } from "express";
import { EmployeeService } from "./employee.service.js";

export class EmployeeController {
  constructor(private employeeService: EmployeeService) {}

  getAll = async (req: Request, res: Response) => {
    const result = await this.employeeService.getAllEmployees();
    res.status(200).send(result);
  };

  getAvailable = async (req: Request, res: Response) => {
    const result = await this.employeeService.getAvailableUsers();
    const formatted = result.map((u) => ({
      id: u.id,
      name: u.profile?.fullName || "No Name",
      email: u.email,
    }));
    res.status(200).send(formatted);
  };

  assign = async (req: Request, res: Response) => {
    try {
      const result = await this.employeeService.assignEmployee(req.body);
      res.status(200).send({ message: "Employee assigned", data: result });
    } catch (error: any) {
      res.status(error.statusCode || 500).send({ error: error.message });
    }
  };

  unassign = async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await this.employeeService.unassignEmployee(Number(id));
    res.status(200).send(result);
  };
}
