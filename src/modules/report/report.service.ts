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

  async getSalesReport(
    outletId?: number,
    start?: string,
    end?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const dateFilter = this.getDateFilter(start, end);
    const skip = (page - 1) * limit;

    const whereClause = {
      status: OrderStatus.RECEIVED_BY_CUSTOMER,
      ...(outletId && { outletId }),
      ...(dateFilter && { createdAt: dateFilter }),
    };

    const aggregate = await this.prisma.order.aggregate({
      where: whereClause,
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const totalIncome = Number(aggregate._sum.totalAmount || 0);
    const totalOrders = aggregate._count.id;

    const orders = await this.prisma.order.findMany({
      where: whereClause,
      select: {
        id: true,
        orderNo: true,
        totalAmount: true,
        createdAt: true,
        customer: { select: { profile: { select: { fullName: true } } } },
        outlet: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const formattedOrders = orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      createdAt: o.createdAt,
      totalAmount: o.totalAmount,
      customerName: o.customer.profile?.fullName || "Pelanggan Tanpa Nama",
      outletName: o.outlet.name,
    }));

    return {
      data: {
        totalIncome,
        totalOrders,
        orders: formattedOrders,
      },
      meta: {
        page,
        limit,
        total: totalOrders,
        totalPages: Math.ceil(totalOrders / limit),
      },
    };
  }

  async getPerformanceReport(
    outletId?: number,
    start?: string,
    end?: string,
    page: number = 1,
    limit: number = 10,
  ) {
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
        outletStaff: { select: { outlet: { select: { name: true } } } },
        assignedStations: {
          where: { status: StationStatus.COMPLETED, completedAt: dateFilter },
        },
        driverTasks: {
          where: { status: TaskStatus.DONE, completedAt: dateFilter },
        },
      },
    });

    const formattedUsers = users
      .map((u) => {
        const stationJobs = u.assignedStations.length;
        const deliveryJobs = u.driverTasks.length;
        return {
          id: u.id,
          name: u.profile?.fullName || "Tanpa Nama",
          role: u.role,
          outletName: u.outletStaff[0]?.outlet.name || "-",
          stationJobsDone: stationJobs,
          deliveryJobsDone: deliveryJobs,
          jobsDone: stationJobs + deliveryJobs,
        };
      })
      .sort((a, b) => b.jobsDone - a.jobsDone);

    const total = formattedUsers.length;
    const paginatedUsers = formattedUsers.slice(
      (page - 1) * limit,
      page * limit,
    );

    return {
      data: paginatedUsers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
