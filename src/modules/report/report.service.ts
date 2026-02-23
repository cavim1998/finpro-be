import {
  PrismaClient,
  OrderStatus,
  StationStatus,
  TaskStatus,
  RoleCode,
} from "../../../generated/prisma/client.js";

export class ReportService {
  constructor(private prisma: PrismaClient) {}

  private getDateFilter(startDate?: string, endDate?: string) {
    if (!startDate && !endDate) return undefined;
    return {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
  }

  async getSalesReport(outletId?: number, start?: string, end?: string) {
    const dateFilter = this.getDateFilter(start, end);
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.RECEIVED_BY_CUSTOMER,
        ...(outletId && { outletId }),
        ...(dateFilter && { createdAt: dateFilter }),
      },
      select: { totalAmount: true, createdAt: true, id: true },
    });

    const totalIncome = orders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );
    return { totalIncome, totalOrders: orders.length, orders };
  }

  async getPerformanceReport(outletId?: number, start?: string, end?: string) {
    const dateFilter = this.getDateFilter(start, end);
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: [RoleCode.WORKER, RoleCode.DRIVER] },
        ...(outletId && { outletStaff: { some: { outletId } } }),
      },
      select: {
        id: true,
        role: true,
        profile: { select: { fullName: true } },
        assignedStations: {
          where: { status: StationStatus.COMPLETED, completedAt: dateFilter },
        },
        driverTasks: {
          where: { status: TaskStatus.DONE, completedAt: dateFilter },
        },
      },
    });

    return users
      .map((u) => ({
        name: u.profile?.fullName || "Tanpa Nama",
        role: u.role,
        jobsDone: u.assignedStations.length + u.driverTasks.length,
      }))
      .sort((a, b) => b.jobsDone - a.jobsDone);
  }
}
