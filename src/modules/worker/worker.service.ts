import {
  StationStatus,
  StationType,
  OrderStatus,
  BypassStatus,
} from "../../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/api-error.js";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

// urutan status order setelah station selesai
function nextOrderStatusByStation(stationType: StationType): OrderStatus {
  switch (stationType) {
    case "WASHING":
      return OrderStatus.IRONING;
    case "IRONING":
      return OrderStatus.PACKING;
    case "PACKING":
      return OrderStatus.WAITING_PAYMENT;
    default:
      return OrderStatus.ARRIVED_AT_OUTLET;
  }
}

// status order saat sedang dikerjakan station
function inProgressOrderStatus(stationType: StationType): OrderStatus {
  switch (stationType) {
    case "WASHING":
      return OrderStatus.WASHING;
    case "IRONING":
      return OrderStatus.IRONING;
    case "PACKING":
      return OrderStatus.PACKING;
    default:
      return OrderStatus.ARRIVED_AT_OUTLET;
  }
}

// Order status saat station ini sudah boleh mulai dikerjakan (incoming/claimable)
function readyOrderStatusForStation(stationType: StationType): OrderStatus {
  switch (stationType) {
    case "WASHING":
      return OrderStatus.ARRIVED_AT_OUTLET;
    case "IRONING":
      return OrderStatus.IRONING;
    case "PACKING":
      return OrderStatus.PACKING;
    default:
      return OrderStatus.ARRIVED_AT_OUTLET;
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

type OrderStationLookupInclude = {
  order?: {
    include?: {
      items?: boolean;
    };
  };
  itemCounts?: boolean;
};

export class WorkerService {
  private async findStationByParam(
    db: any,
    stationType: StationType,
    orderParam: string,
    include?: OrderStationLookupInclude,
  ) {
    if (isUuid(orderParam)) {
      return db.orderStation.findUnique({
        where: { orderId_stationType: { orderId: orderParam, stationType } },
        include,
      });
    }

    const stationId = Number(orderParam);
    if (!Number.isInteger(stationId) || stationId <= 0) {
      throw new ApiError("Invalid order identifier", 400);
    }

    return db.orderStation.findFirst({
      where: { id: stationId, stationType },
      include,
    });
  }

  async getStationStats(userId: number, stationType: StationType) {
    const readyStatus = readyOrderStatusForStation(stationType);

    const [incoming, inProgress, completed] = await Promise.all([
      prisma.orderStation.count({
        where: {
          stationType,
          status: StationStatus.PENDING,
          assignedWorkerId: null,
          order: { status: readyStatus },
        },
      }),
      prisma.orderStation.count({
        where: {
          stationType,
          assignedWorkerId: userId,
          status: {
            in: [StationStatus.IN_PROGRESS, StationStatus.WAITING_BYPASS],
          },
        },
      }),
      prisma.orderStation.count({
        where: {
          stationType,
          assignedWorkerId: userId,
          status: StationStatus.COMPLETED,
          completedAt: { gte: startOfToday(), lte: endOfToday() },
        },
      }),
    ]);

    return { incoming, inProgress, completed };
  }

  async getOrders(
    userId: number,
    stationType: StationType,
    scope: "incoming" | "my" | "completed" = "my",
    page = 1,
    limit = 10,
  ) {
    const skip = (page - 1) * limit;
    const readyStatus = readyOrderStatusForStation(stationType);

    const where =
      scope === "incoming"
        ? {
            stationType,
            status: StationStatus.PENDING,
            assignedWorkerId: null,
            order: { status: readyStatus },
          }
        : scope === "completed"
          ? {
              stationType,
              assignedWorkerId: userId,
              status: StationStatus.COMPLETED,
            }
          : {
              stationType,
              assignedWorkerId: userId,
              status: {
                in: [StationStatus.IN_PROGRESS, StationStatus.WAITING_BYPASS],
              },
            };

    const stations = await prisma.orderStation.findMany({
      where,
      orderBy: { id: "desc" },
      skip,
      take: limit,
      include: {
        order: {
          include: {
            customer: { include: { profile: true } },
            items: true,
          },
        },
        itemCounts: true,
      },
    });

    return stations.map((s) => {
      const clothesCount = s.order.items.reduce(
        (sum, it) => sum + (it.qty ?? 0),
        0,
      );

      const customerName =
        s.order.customer?.profile?.fullName ||
        s.order.customer?.email ||
        "Customer";

      return {
        orderStationId: s.id,
        orderId: s.orderId,
        orderNo: s.order.orderNo,
        customerName,
        clothesCount,
        totalKg: Number(s.order.totalWeightKg),
        enteredAt: s.order.createdAt,
        stationStatus: s.status,
      };
    });
  }

  async getOrderDetail(userId: number, orderParam: string) {
    const staff = await prisma.outletStaff.findFirst({
      where: { userId, isActive: true },
      select: { outletId: true },
    });

    if (!staff) {
      throw new ApiError("Worker is not assigned to any outlet", 403);
    }

    const includeOrder = {
      customer: { include: { profile: true } },
      outlet: true,
      items: { include: { item: true } },
      stations: {
        include: {
          worker: {
            include: { profile: true },
          },
        },
        orderBy: { id: "asc" as const },
      },
    };

    let order: any = null;

    if (isUuid(orderParam)) {
      order = await prisma.order.findFirst({
        where: { id: orderParam, outletId: staff.outletId },
        include: includeOrder,
      });
    } else {
      const stationId = Number(orderParam);
      if (!Number.isInteger(stationId) || stationId <= 0) {
        throw new ApiError("Invalid order identifier", 400);
      }

      const station = await prisma.orderStation.findFirst({
        where: {
          id: stationId,
          order: { outletId: staff.outletId },
        },
        include: {
          order: {
            include: includeOrder,
          },
        },
      });

      order = station?.order ?? null;
    }

    if (!order) throw new ApiError("Order not found", 404);

    const clothesCount = order.items.reduce(
      (sum: number, it: { qty: number }) => sum + (it.qty ?? 0),
      0,
    );

    return {
      id: order.id,
      orderNo: order.orderNo,
      orderNumber: order.orderNo,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      totalAmount: Number(order.totalAmount),
      totalKg: Number(order.totalWeightKg),
      clothesCount,
      customer: {
        id: String(order.customer.id),
        name: order.customer.profile?.fullName ?? order.customer.email ?? null,
        fullName: order.customer.profile?.fullName ?? null,
        email: order.customer.email ?? null,
      },
      outlet: {
        id: order.outlet.id,
        name: order.outlet.name,
      },
      items: order.items.map((it: any) => ({
        id: it.id,
        itemId: it.itemId,
        name: it.item?.name ?? null,
        qty: it.qty,
        price: Number(it.item?.price ?? 0),
        item: it.item
          ? {
              id: it.item.id,
              name: it.item.name,
              price: Number(it.item.price),
            }
          : undefined,
      })),
      stations: order.stations.map((st: any) => ({
        id: st.id,
        stationType: st.stationType,
        status: st.status,
        startedAt: st.startedAt,
        completedAt: st.completedAt,
        worker: st.worker
          ? {
              id: String(st.worker.id),
              name: st.worker.profile?.fullName ?? st.worker.email ?? null,
              fullName: st.worker.profile?.fullName ?? null,
              email: st.worker.email ?? null,
            }
          : undefined,
      })),
    };
  }

  async claimOrder(userId: number, stationType: StationType, orderId: string) {
    const station = await this.findStationByParam(prisma, stationType, orderId);
    if (!station) throw new ApiError("Order station not found", 404);
    const readyStatus = readyOrderStatusForStation(stationType);

    const active = await prisma.orderStation.findFirst({
      where: {
        stationType,
        assignedWorkerId: userId,
        status: {
          in: [StationStatus.IN_PROGRESS, StationStatus.WAITING_BYPASS],
        },
      },
      select: { id: true, orderId: true },
    });

    if (active && active.orderId !== station.orderId) {
      throw new ApiError(
        "You still have an active task. Finish it first.",
        400,
      );
    }
    if (station.status !== StationStatus.PENDING)
      throw new ApiError("Order is not available to claim", 400);
    if (station.assignedWorkerId)
      throw new ApiError("Order already claimed", 400);

    const order = await prisma.order.findUnique({
      where: { id: station.orderId },
      select: { status: true },
    });
    if (!order) throw new ApiError("Order not found", 404);
    if (order.status !== readyStatus) {
      throw new ApiError("Order is not ready for this station yet", 400);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.orderStation.update({
        where: { id: station.id },
        data: {
          assignedWorkerId: userId,
          status: StationStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: station.orderId },
        data: { status: inProgressOrderStatus(stationType) },
      });

      return updated;
    });
  }

  async completeTask(
    userId: number,
    stationType: StationType,
    orderId: string,
    payload: { itemCounts: Array<{ itemId: number; qty: number }> },
  ) {
    const itemCounts = payload?.itemCounts ?? [];

    return prisma.$transaction(async (tx) => {
      const station = await this.findStationByParam(tx, stationType, orderId, {
        order: { include: { items: true } }, // OrderItem: itemId, qty
      });
      const ACTIVE_STATION_STATUSES = new Set<StationStatus>([
        StationStatus.IN_PROGRESS,
        StationStatus.WAITING_BYPASS,
      ]);

      if (!station) throw new ApiError("Order station not found", 404);
      if (station.assignedWorkerId !== userId)
        throw new ApiError("You are not assigned to this order", 403);

      if (!ACTIVE_STATION_STATUSES.has(station.status)) {
        throw new ApiError("Station is not in progress", 400);
      }

      // expected qty per LaundryItem.id
      const expected = new Map<number, number>();
      for (const it of station.order.items) expected.set(it.itemId, it.qty);

      const normalizedItemCounts = itemCounts.map((it) => ({
        itemId: Number(it.itemId),
        qty: Number(it.qty),
      }));

      // validate payload
      for (const it of normalizedItemCounts) {
        if (!Number.isInteger(it.itemId) || !expected.has(it.itemId))
          throw new ApiError("Invalid itemId", 400);
        if (!Number.isInteger(it.qty) || it.qty < 0)
          throw new ApiError("Invalid qty", 400);
      }

      // upsert counts
      for (const it of normalizedItemCounts) {
        await tx.stationItemCount.upsert({
          where: {
            orderStationId_itemId: {
              orderStationId: station.id,
              itemId: it.itemId,
            },
          },
          create: {
            orderStationId: station.id,
            itemId: it.itemId,
            qty: it.qty,
          },
          update: {
            qty: it.qty,
          },
        });
      }

      // mismatch check (harus persis sama)
      const mismatches: Array<{
        itemId: number;
        expectedQty: number;
        actualQty: number;
      }> = [];

      for (const [itemId, expectedQty] of expected.entries()) {
        const actualQty =
          normalizedItemCounts.find((x) => x.itemId === itemId)?.qty ?? 0;
        if (actualQty !== expectedQty)
          mismatches.push({ itemId, expectedQty, actualQty });
      }

      if (mismatches.length > 0) {
        // FE: munculkan tombol bypass
        throw new ApiError("Item counts mismatch. Use bypass if needed.", 400);
      }

      const updated = await tx.orderStation.update({
        where: { id: station.id },
        data: {
          status: StationStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: station.orderId },
        data: { status: nextOrderStatusByStation(stationType) },
      });

      return updated;
    });
  }

  async bypassTask(
    userId: number,
    stationType: StationType,
    orderId: string,
    payload: {
      reason: string;
      itemCounts: Array<{ itemId: number; qty: number }>;
    },
  ) {
    const reason = payload?.reason?.trim();
    if (!reason) throw new ApiError("Reason is required", 400);

    const itemCounts = payload?.itemCounts ?? [];

    return prisma.$transaction(async (tx) => {
      const station = await this.findStationByParam(tx, stationType, orderId, {
        order: { include: { items: true } },
      });
      const ACTIVE_STATION_STATUSES = new Set<StationStatus>([
        StationStatus.IN_PROGRESS,
        StationStatus.WAITING_BYPASS,
      ]);

      if (!station) throw new ApiError("Order station not found", 404);
      if (station.assignedWorkerId !== userId)
        throw new ApiError("You are not assigned to this order", 403);

      if (!ACTIVE_STATION_STATUSES.has(station.status)) {
        throw new ApiError("Station is not in progress", 400);
      }

      const expected = new Map<number, number>();
      for (const it of station.order.items) expected.set(it.itemId, it.qty);

      const normalizedItemCounts = itemCounts.map((it) => ({
        itemId: Number(it.itemId),
        qty: Number(it.qty),
      }));

      // upsert StationItemCount (optional tapi recommended)
      for (const it of normalizedItemCounts) {
        if (!Number.isInteger(it.itemId) || !expected.has(it.itemId))
          throw new ApiError("Invalid itemId", 400);
        if (!Number.isInteger(it.qty) || it.qty < 0)
          throw new ApiError("Invalid qty", 400);

        await tx.stationItemCount.upsert({
          where: {
            orderStationId_itemId: {
              orderStationId: station.id,
              itemId: it.itemId,
            },
          },
          create: {
            orderStationId: station.id,
            itemId: it.itemId,
            qty: it.qty,
          },
          update: { qty: it.qty },
        });
      }

      // cek bypass request yang masih REQUESTED untuk station ini
      const existing = await tx.bypassRequest.findFirst({
        where: {
          orderStationId: station.id,
          status: BypassStatus.REQUESTED,
        },
        select: { id: true },
      });

      if (!existing) {
        const diffs: Array<{
          itemId: number;
          prevQty: number;
          currentQty: number;
        }> = [];

        for (const [itemId, prevQty] of expected.entries()) {
          const currentQty =
            normalizedItemCounts.find((x) => x.itemId === itemId)?.qty ?? 0;
          if (currentQty !== prevQty)
            diffs.push({ itemId, prevQty, currentQty });
        }

        await tx.bypassRequest.create({
          data: {
            orderStationId: station.id,
            requestedByWorkerId: userId,
            reason,
            status: BypassStatus.REQUESTED,
            diffs: diffs.length ? { createMany: { data: diffs } } : undefined,
          },
        });
      }

      const updated = await tx.orderStation.update({
        where: { id: station.id },
        data: { status: StationStatus.WAITING_BYPASS },
      });

      return updated;
    });
  }
}
