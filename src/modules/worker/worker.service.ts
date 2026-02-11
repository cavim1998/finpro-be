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

export class WorkerService {
  async getStationStats(userId: number, stationType: StationType) {
    const [incoming, inProgress, completed] = await Promise.all([
      prisma.orderStation.count({
        where: {
          stationType,
          status: StationStatus.PENDING,
          assignedWorkerId: null,
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

    const where =
      scope === "incoming"
        ? {
            stationType,
            status: StationStatus.PENDING,
            assignedWorkerId: null,
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

  async claimOrder(userId: number, stationType: StationType, orderId: string) {
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

    if (active && active.orderId !== orderId) {
      throw new ApiError(
        "You still have an active task. Finish it first.",
        400,
      );
    }

    const station = await prisma.orderStation.findUnique({
      where: { orderId_stationType: { orderId, stationType } },
    });

    if (!station) throw new ApiError("Order station not found", 404);
    if (station.status !== StationStatus.PENDING)
      throw new ApiError("Order is not available to claim", 400);
    if (station.assignedWorkerId)
      throw new ApiError("Order already claimed", 400);

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
        where: { id: orderId },
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
      const station = await tx.orderStation.findUnique({
        where: { orderId_stationType: { orderId, stationType } },
        include: { order: { include: { items: true } } }, // OrderItem: itemId, qty
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

      // validate payload
      for (const it of itemCounts) {
        if (!expected.has(it.itemId)) throw new ApiError("Invalid itemId", 400);
        if (typeof it.qty !== "number" || it.qty < 0)
          throw new ApiError("Invalid qty", 400);
      }

      // upsert counts
      for (const it of itemCounts) {
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
        const actualQty = itemCounts.find((x) => x.itemId === itemId)?.qty ?? 0;
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
        where: { id: orderId },
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
      const station = await tx.orderStation.findUnique({
        where: { orderId_stationType: { orderId, stationType } },
        include: { order: { include: { items: true } } },
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

      // upsert StationItemCount (optional tapi recommended)
      for (const it of itemCounts) {
        if (!expected.has(it.itemId)) throw new ApiError("Invalid itemId", 400);
        if (typeof it.qty !== "number" || it.qty < 0)
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
            itemCounts.find((x) => x.itemId === itemId)?.qty ?? 0;
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
