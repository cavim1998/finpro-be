import {
  PrismaClient,
  OrderStatus,
  PickupStatus,
  BypassStatus,
  RoleCode,
} from "../../../generated/prisma/client.js";

export class DashboardService {
  constructor(private prisma: PrismaClient) {}

  async getStats(outletId?: number) {
    const outFilter = outletId ? { outletId } : {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      orders,
      pickups,
      bypasses,
      rev,
      newCustomers,
      completedOrders,
      allTimeOrders,
    ] = await Promise.all([
      this.prisma.order.count({
        where: {
          ...outFilter,
          status: {
            notIn: [OrderStatus.RECEIVED_BY_CUSTOMER, OrderStatus.CANCELED],
          },
        },
      }),

      this.prisma.pickupRequest.count({
        where: {
          ...(outletId && { assignedOutletId: outletId }),
          status: PickupStatus.WAITING_DRIVER,
        },
      }),

      this.prisma.bypassRequest.count({
        where: {
          status: BypassStatus.REQUESTED,
          orderStation: { order: outFilter },
        },
      }),

      this.prisma.order.aggregate({
        where: { ...outFilter, createdAt: { gte: today } },
        _sum: { totalAmount: true },
      }),

      this.prisma.user.count({
        where: {
          role: RoleCode.CUSTOMER,
          createdAt: { gte: today },
        },
      }),

      this.prisma.order.count({
        where: {
          ...outFilter,
          status: OrderStatus.RECEIVED_BY_CUSTOMER,
        },
      }),

      this.prisma.order.count({
        where: { ...outFilter },
      }),
    ]);

    const performanceRate =
      allTimeOrders > 0
        ? Math.round((completedOrders / allTimeOrders) * 100)
        : 0;

    return {
      totalOrders: orders,
      activePickups: pickups,
      pendingBypass: bypasses,
      todayRevenue: Number(rev._sum.totalAmount || 0),
      newCustomers: newCustomers,
      outletPerformance: performanceRate,
    };
  }
}
