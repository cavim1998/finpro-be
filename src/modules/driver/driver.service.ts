import {
  PickupStatus,
  PrismaClient,
  RoleCode,
} from "../../../generated/prisma/client.js";
import { DriverDashboardQueryDTO } from "./dto/driver-dashboard.query.dto.js";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const DEFAULT_TZ = "Asia/Jakarta";

function getDateOnlyByTimeZone(timeZone = DEFAULT_TZ) {
  // en-CA => YYYY-MM-DD
  const key = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)); // UTC midnight
}

type TodayAttendance = {
  date: Date;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  isCheckedIn: boolean;
  isCompleted: boolean;
};

export class DriverService {
  constructor(private prisma: PrismaClient) {}

  private requireDriver(role: RoleCode) {
    if (role !== "DRIVER") {
      const err: any = new Error("Forbidden: driver only");
      err.status = 403;
      throw err;
    }
  }

  async getActiveOutletStaffForDriver(userId: number) {
    const today = getDateOnlyByTimeZone();

    const onDuty = await this.prisma.outletStaff.findFirst({
      where: {
        userId,
        isActive: true,
        shiftAssignments: {
          some: {
            status: "ON_DUTY",
            shift: { shiftDate: today },
          },
        },
      },
      select: { id: true, outletId: true },
    });

    if (onDuty) return onDuty;

    const staff = await this.prisma.outletStaff.findFirst({
      where: { userId, isActive: true },
      select: { id: true, outletId: true },
    });

    if (!staff) {
      const err: any = new Error("Driver is not assigned to any outlet");
      err.status = 403;
      throw err;
    }
    return staff;
  }

  async getTodayAttendance(outletStaffId: number): Promise<TodayAttendance> {
    const today = getDateOnlyByTimeZone();

    const log = await this.prisma.attendanceLog.findUnique({
      where: { outletStaffId_date: { outletStaffId, date: today } },
      select: { clockInAt: true, clockOutAt: true, date: true },
    });

    const isCheckedIn = !!log?.clockInAt && !log?.clockOutAt;
    const isCompleted = !!log?.clockOutAt;

    return {
      date: log?.date ?? today,
      clockInAt: log?.clockInAt ?? null,
      clockOutAt: log?.clockOutAt ?? null,
      isCheckedIn,
      isCompleted,
    };
  }

  private requireCheckedIn(att: TodayAttendance) {
    if (!att.isCheckedIn || att.isCompleted) {
      const err: any = new Error(
        "You must be checked-in (and not completed) to access this resource",
      );
      err.status = 403;
      throw err;
    }
  }

  // GET /driver/dashboard
  async getDashboard(
    userId: number,
    role: RoleCode,
    q: DriverDashboardQueryDTO,
  ) {
    this.requireDriver(role);

    const staff = await this.getActiveOutletStaffForDriver(userId);
    const attendance = await this.getTodayAttendance(staff.id);

    const pageSize = clamp(q.pageSize ?? 5, 1, 50);
    const taskPage = Math.max(1, q.taskPage ?? 1);
    const pickupPage = Math.max(1, q.pickupPage ?? 1);

    const [, inProgress, completed] = await Promise.all([
      this.prisma.pickupRequest.count({
        where: { assignedOutletId: staff.outletId, status: "WAITING_DRIVER" },
      }),
      this.prisma.driverTask.count({
        where: {
          driverId: userId,
          status: { in: ["ASSIGNED", "IN_PROGRESS"] },
        },
      }),
      this.prisma.driverTask.count({
        where: { driverId: userId, status: "DONE" },
      }),
    ]);

    const [taskTotal, taskItems] = await Promise.all([
      this.prisma.driverTask.count({ where: { driverId: userId } }),
      this.prisma.driverTask
        .findMany({
          where: { driverId: userId },
          orderBy: { createdAt: "desc" },
          skip: (taskPage - 1) * pageSize,
          take: pageSize,
          include: {
            pickupRequest: {
              include: {
                address: true,
                customer: { select: { id: true, email: true, profile: true } },
              },
            },
            order: {
              include: {
                customer: {
                  select: { id: true, email: true, profile: true },
                },
                pickupRequest: {
                  include: {
                    address: true,
                    customer: {
                      select: { id: true, email: true, profile: true },
                    },
                  },
                },
              },
            },
          },
        })
        .then((items) =>
          items.map((task) => {
            const deliveryPickup = task.order?.pickupRequest ?? null;
            const resolvedPickup = task.pickupRequest ?? deliveryPickup;
            const resolvedCustomer =
              resolvedPickup?.customer ?? task.order?.customer ?? null;
            const resolvedToLat =
              task.toLat ?? (resolvedPickup?.address?.latitude as any) ?? null;
            const resolvedToLng =
              task.toLng ?? (resolvedPickup?.address?.longitude as any) ?? null;

            return {
              ...task,
              toLat: resolvedToLat,
              toLng: resolvedToLng,
              customerName: resolvedCustomer?.profile?.fullName ?? null,
              customerPhone: resolvedCustomer?.profile?.phone ?? null,
              customerAddressText: resolvedPickup?.address?.addressText ?? null,
            };
          }),
        ),
    ]);

    const [pickupItemsRaw, orderPickupItems, readyDeliveryItems] =
      await Promise.all([
        this.prisma.pickupRequest.findMany({
          where: { assignedOutletId: staff.outletId, status: "WAITING_DRIVER" },
          orderBy: { createdAt: "desc" },
          include: {
            address: true,
            customer: { select: { id: true, email: true, profile: true } },
          },
        }),
        this.prisma.order.findMany({
          where: {
            outletId: staff.outletId,
            status: "WAITING_DRIVER_PICKUP",
            driverTasks: {
              none: {
                taskType: "PICKUP",
                status: { in: ["ASSIGNED", "IN_PROGRESS"] },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          include: {
            pickupRequest: {
              include: {
                address: true,
                customer: {
                  select: { id: true, email: true, profile: true },
                },
              },
            },
          },
        }),
        this.prisma.order.findMany({
          where: {
            outletId: staff.outletId,
            status: "READY_TO_DELIVER",
            driverTasks: {
              none: {
                taskType: "DELIVERY",
                status: { in: ["ASSIGNED", "IN_PROGRESS"] },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          include: {
            pickupRequest: {
              include: {
                address: true,
                customer: {
                  select: { id: true, email: true, profile: true },
                },
              },
            },
          },
        }),
      ]);

    const availablePickupFromOrder = orderPickupItems
      .filter((o) => !!o.pickupRequest)
      .map((o) => ({
        ...(o.pickupRequest as any),
        orderId: o.id,
        orderNo: o.orderNo,
        orderStatus: o.status,
        driverAction: "PICKUP",
      }));

    const availableDelivery = readyDeliveryItems
      .filter((o) => !!o.pickupRequest)
      .map((o) => ({
        ...(o.pickupRequest as any),
        orderId: o.id,
        orderNo: o.orderNo,
        orderStatus: o.status,
        driverAction: "DELIVERY",
      }));

    const pickupItemsAll = [
      ...pickupItemsRaw.map((p) => ({ ...p, driverAction: "PICKUP" })),
      ...availablePickupFromOrder,
      ...availableDelivery,
    ].sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const pickupTotal = pickupItemsAll.length;
    const pickupItems = pickupItemsAll.slice(
      (pickupPage - 1) * pageSize,
      pickupPage * pageSize,
    );

    const incoming = pickupTotal;

    return {
      outletStaff: staff,
      attendance,
      stats: { incoming, inProgress, completed },
      tasks: { items: taskItems, page: taskPage, pageSize, total: taskTotal },
      pickupRequests: {
        items: pickupItems,
        page: pickupPage,
        pageSize,
        total: pickupTotal,
      },
    };
  }

  // POST /driver/pickups/:pickupId/claim
  async claimPickup(userId: number, role: RoleCode, pickupId: string) {
    this.requireDriver(role);

    const staff = await this.getActiveOutletStaffForDriver(userId);
    const attendance = await this.getTodayAttendance(staff.id);
    this.requireCheckedIn(attendance);

    return this.prisma.$transaction(async (tx) => {
      const upd = await tx.pickupRequest.updateMany({
        where: {
          id: pickupId,
          assignedOutletId: staff.outletId,
          OR: [
            { status: "WAITING_DRIVER" },
            {
              status: "ARRIVED_OUTLET",
              order: {
                is: { status: "WAITING_DRIVER_PICKUP" },
              },
            },
          ],
        },
        data: { status: "DRIVER_ASSIGNED" },
      });

      if (upd.count === 0) {
        const err: any = new Error("Pickup no longer available");
        err.status = 409;
        throw err;
      }

      const pickup = await tx.pickupRequest.findUnique({
        where: { id: pickupId },
        include: { address: true, outlet: true },
      });

      if (!pickup) {
        const err: any = new Error("Pickup not found");
        err.status = 404;
        throw err;
      }

      const task = await tx.driverTask.create({
        data: {
          taskType: "PICKUP",
          outletId: pickup.assignedOutletId,
          driverId: userId,
          pickupRequestId: pickup.id,
          fromLat: pickup.address.latitude as any,
          fromLng: pickup.address.longitude as any,
          toLat: pickup.outlet.latitude as any,
          toLng: pickup.outlet.longitude as any,
          status: "ASSIGNED",
          assignedAt: new Date(),
        },
        include: { pickupRequest: true, order: true },
      });

      return task;
    });
  }

  async cancelPickup(userId: number, role: RoleCode, taskId: number) {
    this.requireDriver(role);

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.driverTask.findFirst({
        where: {
          id: taskId,
          driverId: userId,
          taskType: "PICKUP",
          status: "ASSIGNED",
        },
      });

      if (!task?.pickupRequestId) {
        const err: any = new Error("Task cannot be canceled");
        err.status = 400;
        throw err;
      }

      await tx.driverTask.update({
        where: { id: task.id },
        data: { status: "CANCELED", completedAt: new Date() },
      });

      await tx.pickupRequest.updateMany({
        where: { id: task.pickupRequestId, status: "DRIVER_ASSIGNED" },
        data: { status: "WAITING_DRIVER" },
      });

      return { success: true };
    });
  }

  // POST /driver/pickups/:taskId/picked-up  (langsung picked up)
  async pickupPickedUp(userId: number, role: RoleCode, taskId: number) {
    this.requireDriver(role);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.driverTask.updateMany({
        where: {
          id: taskId,
          driverId: userId,
          taskType: "PICKUP",
          status: "ASSIGNED",
        },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });

      if (updated.count === 0) {
        const err: any = new Error("Invalid pickup task");
        err.status = 400;
        throw err;
      }

      const task = await tx.driverTask.findUnique({ where: { id: taskId } });
      if (!task?.pickupRequestId) {
        const err: any = new Error("Pickup task missing pickupRequestId");
        err.status = 500;
        throw err;
      }

      await tx.pickupRequest.updateMany({
        where: { id: task.pickupRequestId, status: "DRIVER_ASSIGNED" },
        data: { status: "PICKED_UP" },
      });

      return { success: true };
    });
  }

  // POST /driver/pickups/:taskId/arrived  (arrived outlet)
  async pickupArrivedOutlet(userId: number, role: RoleCode, taskId: number) {
    this.requireDriver(role);

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.driverTask.findFirst({
        where: {
          id: taskId,
          driverId: userId,
          taskType: "PICKUP",
        },
      });

      if (!task) {
        const err: any = new Error("Pickup task not found");
        err.status = 404;
        throw err;
      }

      if (task.status === "DONE") {
        return { success: true };
      }

      if (!["ASSIGNED", "IN_PROGRESS"].includes(task.status)) {
        const err: any = new Error("Invalid pickup completion");
        err.status = 400;
        throw err;
      }

      const now = new Date();

      await tx.driverTask.update({
        where: { id: task.id },
        data: {
          status: "DONE",
          // Allow direct arrived from ASSIGNED for FE flow that skips picked-up/start.
          startedAt: task.startedAt ?? now,
          completedAt: now,
        },
      });

      if (!task?.pickupRequestId) {
        const err: any = new Error("Pickup task missing pickupRequestId");
        err.status = 500;
        throw err;
      }

      await tx.pickupRequest.updateMany({
        where: {
          id: task.pickupRequestId,
          status: {
            in: ["DRIVER_ASSIGNED", "PICKED_UP"] as PickupStatus[],
          },
        },
        data: { status: "ARRIVED_OUTLET" },
      });

      return { success: true };
    });
  }

  // POST /driver/orders/:orderId/claim
  async claimDelivery(userId: number, role: RoleCode, orderId: string) {
    this.requireDriver(role);

    const staff = await this.getActiveOutletStaffForDriver(userId);
    const attendance = await this.getTodayAttendance(staff.id);
    this.requireCheckedIn(attendance);

    return this.prisma.$transaction(async (tx) => {
      const upd = await tx.order.updateMany({
        where: {
          id: orderId,
          outletId: staff.outletId,
          status: "READY_TO_DELIVER",
        },
        data: { status: "DELIVERING_TO_CUSTOMER" },
      });

      if (upd.count === 0) {
        const err: any = new Error("Delivery not available");
        err.status = 409;
        throw err;
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          outlet: true,
          pickupRequest: {
            include: {
              address: true,
              customer: { select: { id: true, email: true, profile: true } },
            },
          },
        },
      });

      if (!order) {
        const err: any = new Error("Order not found");
        err.status = 404;
        throw err;
      }

      const fallbackLat =
        order.customerLatitude ??
        (order.pickupRequest?.address?.latitude as any)?.toString?.() ??
        null;
      const fallbackLng =
        order.customerLongitude ??
        (order.pickupRequest?.address?.longitude as any)?.toString?.() ??
        null;

      const task = await tx.driverTask.create({
        data: {
          taskType: "DELIVERY",
          outletId: order.outletId,
          driverId: userId,
          orderId: order.id,
          pickupRequestId: order.pickupRequestId,
          fromLat: order.outlet.latitude as any,
          fromLng: order.outlet.longitude as any,
          toLat: fallbackLat as any,
          toLng: fallbackLng as any,
          status: "ASSIGNED",
          assignedAt: new Date(),
        },
        include: { order: true, pickupRequest: true },
      });

      return task;
    });
  }

  // POST /driver/tasks/:taskId/start  (untuk TASK apa saja: pickup/delivery)
  async startTask(userId: number, role: RoleCode, taskId: number) {
    this.requireDriver(role);

    const updated = await this.prisma.$transaction(async (tx) => {
      const task = await tx.driverTask.findFirst({
        where: {
          id: taskId,
          driverId: userId,
          status: "ASSIGNED",
        },
        include: {
          order: {
            include: {
              pickupRequest: {
                include: { address: true },
              },
            },
          },
          pickupRequest: {
            include: { address: true },
          },
        },
      });

      if (!task) return 0;

      const updateData: any = {
        status: "IN_PROGRESS",
        startedAt: new Date(),
      };

      if (task.taskType === "DELIVERY" && (!task.toLat || !task.toLng)) {
        const fallbackLat =
          task.order?.customerLatitude ??
          (task.order?.pickupRequest?.address?.latitude as any)?.toString?.() ??
          (task.pickupRequest?.address?.latitude as any)?.toString?.() ??
          null;
        const fallbackLng =
          task.order?.customerLongitude ??
          (
            task.order?.pickupRequest?.address?.longitude as any
          )?.toString?.() ??
          (task.pickupRequest?.address?.longitude as any)?.toString?.() ??
          null;

        updateData.toLat = task.toLat ?? (fallbackLat as any);
        updateData.toLng = task.toLng ?? (fallbackLng as any);
      }

      await tx.driverTask.update({
        where: { id: task.id },
        data: updateData,
      });

      return 1;
    });

    if (updated === 0) {
      const err: any = new Error("Task cannot be started");
      err.status = 400;
      throw err;
    }

    return { success: true };
  }

  // POST /driver/deliveries/:taskId/complete
  async completeDelivery(userId: number, role: RoleCode, taskId: number) {
    this.requireDriver(role);

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.driverTask.findFirst({
        where: {
          id: taskId,
          driverId: userId,
          taskType: "DELIVERY",
          status: "IN_PROGRESS",
        },
      });

      if (!task?.orderId) {
        const err: any = new Error("Invalid delivery task");
        err.status = 400;
        throw err;
      }

      await tx.driverTask.update({
        where: { id: task.id },
        data: { status: "DONE", completedAt: new Date() },
      });

      await tx.order.updateMany({
        where: { id: task.orderId, status: "DELIVERING_TO_CUSTOMER" },
        data: { status: "RECEIVED_BY_CUSTOMER", deliveredAt: new Date() },
      });

      return { success: true };
    });
  }
}
