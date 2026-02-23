import {
  PrismaClient,
  OrderStatus,
  PickupStatus,
  BypassStatus,
} from "../../../generated/prisma/client.js";

export class DashboardService {
  constructor(private prisma: PrismaClient) {}

  async getStats(outletId?: number) {
    const outFilter = outletId ? { outletId } : {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [orders, pickups, bypasses, rev] = await Promise.all([
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
    ]);

    return {
      totalOrders: orders,
      activePickups: pickups,
      pendingBypass: bypasses,
      todayRevenue: Number(rev._sum.totalAmount || 0),
    };
  }
}
