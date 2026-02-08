import cors from "cors";
import express, { Express } from "express";
import "reflect-metadata";
import { JWT_SECRET, PORT } from "./config/env.js";
import { loggerHttp } from "./lib/logger-http.js";
import { prisma } from "./lib/prisma.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { verifyToken } from "./middlewares/jwt.middleware.js";
import { UploaderMiddleware } from "./middlewares/uploader.middleware.js";
import { ValidationMiddleware } from "./middlewares/validation.middleware.js";
import { AttendanceController } from "./modules/attendance/attendance.controller.js";
import { AttendanceRouter } from "./modules/attendance/attendance.router.js";
import { AttendanceService } from "./modules/attendance/attendance.service.js";
import { AuthController } from "./modules/auth/auth.controller.js";
import { AuthRouter } from "./modules/auth/auth.router.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { CloudinaryService } from "./modules/cloudinary/cloudinary.service.js";
import { DriverController } from "./modules/driver/driver.controller.js";
import { DriverRouter } from "./modules/driver/driver.router.js";
import { DriverService } from "./modules/driver/driver.service.js";
import { EmployeeController } from "./modules/employee/employee.controller.js";
import { EmployeeRouter } from "./modules/employee/employee.router.js";
import { EmployeeService } from "./modules/employee/employee.service.js";
import { LaundryItemController } from "./modules/laundry-item/laundry-item.controller.js";
import { LaundryItemRouter } from "./modules/laundry-item/laundry-item.router.js";
import { LaundryItemService } from "./modules/laundry-item/laundry-item.service.js";
import { MailService } from "./modules/mail/mail.service.js";
import { OutletController } from "./modules/outlet/outlet.controller.js";
import { OutletRouter } from "./modules/outlet/outlet.router.js";
import { OutletService } from "./modules/outlet/outlet.service.js";
import { SampleController } from "./modules/sample/sample.controller.js";
import { SampleRouter } from "./modules/sample/sample.router.js";
import { SampleService } from "./modules/sample/sample.service.js";
import { ShiftController } from "./modules/shift/shift.controller.js";
import { ShiftRouter } from "./modules/shift/shift.router.js";
import { ShiftService } from "./modules/shift/shift.service.js";
import { UserController } from "./modules/users/user.controller.js";
import { UserRouter } from "./modules/users/user.router.js";
import { UserService } from "./modules/users/user.service.js";

export class App {
  app: Express;

  constructor() {
    this.app = express();
    this.configure();
    this.registerModules();
    this.handleError();
  }

  private configure() {
    this.app.use(cors());
    this.app.use(loggerHttp);
    this.app.use(express.json());
  }

  private registerModules() {
    // shared dependency
    const prismaClient = prisma;

    // services
    const cloudinaryService = new CloudinaryService();
    const mailService = new MailService();
    const sampleService = new SampleService(prismaClient);
    const authService = new AuthService(
      prismaClient,
      cloudinaryService,
      mailService,
    );
    const userService = new UserService(
      prismaClient,
      cloudinaryService,
      mailService,
    );
    const outletService = new OutletService(prismaClient);
    const laundryItemService = new LaundryItemService(prismaClient);
    const employeeService = new EmployeeService(prismaClient);
    const shiftService = new ShiftService(prismaClient);
    const driverService = new DriverService(prismaClient);

    // controllers
    const sampleController = new SampleController(sampleService);
    const authController = new AuthController(authService);
    const userController = new UserController(userService);
    const outletController = new OutletController(outletService);
    const laundryItemController = new LaundryItemController(laundryItemService);
    const employeeController = new EmployeeController(employeeService);
    const shiftController = new ShiftController(shiftService);
    const driverController = new DriverController(driverService);

    // middlewares
    const validationMiddleware = new ValidationMiddleware();
    const uploaderMiddleware = new UploaderMiddleware();

    // routers
    const sampleRouter = new SampleRouter(
      sampleController,
      validationMiddleware,
    );
    const authRouter = new AuthRouter(authController, validationMiddleware);
    const userRouter = new UserRouter(
      userController,
      validationMiddleware,
      uploaderMiddleware,
    );
    const outletRouter = new OutletRouter(
      outletController,
      validationMiddleware,
    );
    const laundryItemRouter = new LaundryItemRouter(
      laundryItemController,
      validationMiddleware,
    );

    const attendanceService = new AttendanceService(prismaClient);
    const attendanceController = new AttendanceController(attendanceService);
    const attendanceRouter = new AttendanceRouter(
      attendanceController,
      validationMiddleware,
    );
    const employeeRouter = new EmployeeRouter(
      employeeController,
      validationMiddleware,
    );
    const shiftRouter = new ShiftRouter(shiftController, validationMiddleware);
    const driverRouter = new DriverRouter(
      driverController,
      validationMiddleware,
    );

    this.app.use("/samples", sampleRouter.getRouter());
    this.app.use("/auth", authRouter.getRouter());
    this.app.use("/users", userRouter.getRouter());
    this.app.use("/outlets", outletRouter.getRouter());
    this.app.use("/laundry-items", laundryItemRouter.getRouter());
    this.app.use("/attendance", attendanceRouter.getRouter());
    this.app.use("/employees", employeeRouter.getRouter());
    this.app.use("/shifts", shiftRouter.getRouter());
    this.app.use("/driver", verifyToken(JWT_SECRET), driverRouter.getRouter());
  }

  private handleError() {
    this.app.use(errorMiddleware);
  }

  public start() {
    this.app.listen(PORT, () => {
      console.log(`Server running on port: ${PORT}`);
    });
  }
}
