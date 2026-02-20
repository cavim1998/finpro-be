import { PrismaClient } from "../../../generated/prisma/client.js";
import {
  BypassStatus,
  OrderStatus,
  RoleCode,
  StationStatus,
  StationType,
} from "../../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/api-error.js";

function assertStationType(stationType: string): StationType {
  const ok = Object.values(StationType).includes(stationType as StationType);
  if (!ok) throw new ApiError(`Invalid stationType: ${stationType}`, 400);
  return stationType as StationType;
}

type ItemCountPayload = { itemId: number; qty: number };

type WorkerOrderCardDTO = {
  orderStationId: number;
  orderId: string;
  orderNo: string;
  customerName: string;
  clothesCount: number;
  totalKg: number;
  enteredAt: string; // ISO
  stationStatus: StationStatus;
};

function mapStationToCardDTO(s: any): WorkerOrderCardDTO {
  const order = s.order;
  const items = order?.items ?? [];

  const clothesCount = items.reduce(
    (acc: number, it: any) => acc + (it.qty ?? 0),
    0,
  );

  const customerName =
    order?.customer?.profile?.fullName || order?.customer?.email || "Customer";

  return {
    orderStationId: s.id,
    orderId: s.orderId,
    orderNo: order?.orderNo ?? order?.id ?? "-",
    customerName,
    clothesCount,
    totalKg: Number(order?.totalWeightKg ?? 0), // Decimal -> number
    enteredAt: new Date(order?.createdAt).toISOString(),
    stationStatus: s.status,
  };
}

function calcDiffs(
  expected: Map<number, number>,
  current: Map<number, number>,
) {
  const diffs: Array<{ itemId: number; prevQty: number; currentQty: number }> =
    [];
  for (const [itemId, prevQty] of expected.entries()) {
    const currentQty = current.get(itemId) ?? 0;
    if (prevQty !== currentQty) diffs.push({ itemId, prevQty, currentQty });
  }
  return diffs;
}

function nextOrderStatusByStation(
  stationType: StationType,
): OrderStatus | null {
  if (stationType === StationType.WASHING) return OrderStatus.IRONING;
  if (stationType === StationType.IRONING) return OrderStatus.PACKING;
  if (stationType === StationType.PACKING) return OrderStatus.WAITING_PAYMENT;
  return null;
}

export class WorkerStationsService {
  constructor(private prisma: PrismaClient) {}

  async getIncoming(stationTypeRaw: string) {
    const stationType = assertStationType(stationTypeRaw);

    const rows = await prisma.orderStation.findMany({
      where: {
        stationType,
        status: StationStatus.PENDING,
        assignedWorkerId: null,
      },
      orderBy: { order: { createdAt: "desc" } },
      include: {
        order: {
          include: {
            customer: { include: { profile: true } },
            items: true,
          },
        },
      },
    });
    return rows.map(mapStationToCardDTO);
  }

  async getMyTasks(stationTypeRaw: string, workerId: number) {
    const stationType = assertStationType(stationTypeRaw);

    const rows = await prisma.orderStation.findMany({
      where: {
        stationType,
        assignedWorkerId: workerId,
        status: {
          in: [StationStatus.IN_PROGRESS, StationStatus.WAITING_BYPASS],
        },
      },
      orderBy: { startedAt: "desc" },
      include: {
        order: {
          include: {
            customer: { include: { profile: true } },
            items: true,
          },
        },
      },
    });

    return rows.map(mapStationToCardDTO);
  }

  async startTask(stationTypeRaw: string, orderId: string, workerId: number) {
    const stationType = assertStationType(stationTypeRaw);

    return prisma.$transaction(async (tx) => {
      const active = await tx.orderStation.findFirst({
        where: {
          assignedWorkerId: workerId,
          status: {
            in: [StationStatus.IN_PROGRESS, StationStatus.WAITING_BYPASS],
          },
        },
        select: { id: true, orderId: true, stationType: true },
      });
      if (active) {
        throw new ApiError(
          `You still have an active task (${active.stationType})`,
          400,
        );
      }

      const station = await tx.orderStation.findUnique({
        where: { orderId_stationType: { orderId, stationType } },
      });

      if (!station) throw new ApiError("OrderStation not found", 404);
      if (station.status !== StationStatus.PENDING)
        throw new ApiError("Station is not PENDING", 400);
      if (station.assignedWorkerId)
        throw new ApiError("Already assigned to another worker", 400);

      return tx.orderStation.update({
        where: { id: station.id },
        data: {
          assignedWorkerId: workerId,
          startedAt: station.startedAt ?? new Date(),
          status: StationStatus.IN_PROGRESS,
        },
      });
    });
  }

  async completeTask(
    stationTypeRaw: string,
    orderId: string,
    workerId: number,
    payload: { itemCounts: ItemCountPayload[] },
  ) {
    const stationType = assertStationType(stationTypeRaw);
    const itemCounts = payload?.itemCounts ?? [];

    const inProgressStatuses: StationStatus[] = [
      StationStatus.IN_PROGRESS,
      StationStatus.WAITING_BYPASS,
    ];

    return prisma.$transaction(async (tx) => {
      const station = await tx.orderStation.findUnique({
        where: { orderId_stationType: { orderId, stationType } },
        include: {
          order: { include: { items: true } },
        },
      });

      if (!station) throw new ApiError("OrderStation not found", 404);
      if (station.assignedWorkerId !== workerId)
        throw new ApiError("Not your task", 403);
      if (!inProgressStatuses.includes(station.status))
        throw new ApiError("Station is not in progress", 400);

      const expected = new Map<number, number>();
      for (const it of station.order.items) expected.set(it.itemId, it.qty);

      for (const it of itemCounts) {
        if (!expected.has(it.itemId)) throw new ApiError("Invalid itemId", 400);
        if (typeof it.qty !== "number" || it.qty < 0)
          throw new ApiError("Invalid qty", 400);
      }

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

      const currentRows = await tx.stationItemCount.findMany({
        where: { orderStationId: station.id },
        select: { itemId: true, qty: true },
      });
      const current = new Map<number, number>();
      for (const r of currentRows) current.set(r.itemId, r.qty);

      const diffs = calcDiffs(expected, current);
      if (diffs.length > 0) {
        throw new ApiError("Item counts mismatch. Please request bypass.", 409);
      }

      const nextStatus = nextOrderStatusByStation(stationType);

      const updated = await tx.orderStation.update({
        where: { id: station.id },
        data: {
          completedAt: new Date(),
          status: StationStatus.COMPLETED,
        },
      });

      if (nextStatus) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: nextStatus },
        });
      }

      return updated;
    });
  }

  async requestBypass(
    stationTypeRaw: string,
    orderId: string,
    workerId: number,
    payload: { reason: string },
  ) {
    const stationType = assertStationType(stationTypeRaw);
    const reason = (payload?.reason ?? "").trim();
    if (!reason) throw new ApiError("Reason is required", 400);

    const inProgressStatuses: StationStatus[] = [
      StationStatus.IN_PROGRESS,
      StationStatus.WAITING_BYPASS,
    ];

    return prisma.$transaction(async (tx) => {
      const station = await tx.orderStation.findUnique({
        where: { orderId_stationType: { orderId, stationType } },
        include: {
          order: { include: { items: true } },
          itemCounts: true,
        },
      });

      if (!station) throw new ApiError("OrderStation not found", 404);
      if (station.assignedWorkerId !== workerId)
        throw new ApiError("Not your task", 403);
      if (!inProgressStatuses.includes(station.status))
        throw new ApiError("Station is not in progress", 400);

      const expected = new Map<number, number>();
      for (const it of station.order.items) expected.set(it.itemId, it.qty);

      const current = new Map<number, number>();
      for (const it of station.itemCounts) current.set(it.itemId, it.qty);

      const diffs = calcDiffs(expected, current);
      if (diffs.length === 0) {
        throw new ApiError("No mismatch found. Bypass not needed.", 400);
      }

      const existing = await tx.bypassRequest.findFirst({
        where: { orderStationId: station.id, status: BypassStatus.REQUESTED },
        include: { diffs: true },
      });
      if (existing) return existing;

      const bypass = await tx.bypassRequest.create({
        data: {
          orderStationId: station.id,
          requestedByWorkerId: workerId,
          reason,
          status: BypassStatus.REQUESTED,
          diffs: {
            create: diffs.map((d) => ({
              itemId: d.itemId,
              prevQty: d.prevQty,
              currentQty: d.currentQty,
            })),
          },
        },
        include: { diffs: true },
      });

      await tx.orderStation.update({
        where: { id: station.id },
        data: { status: StationStatus.WAITING_BYPASS },
      });

      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { outletId: true, orderNo: true },
      });

      if (order) {
        const admins = await tx.user.findMany({
          where: {
            role: RoleCode.OUTLET_ADMIN,
            outletStaff: {
              some: { outletId: order.outletId, isActive: true },
            },
          },
          select: { id: true },
        });

        if (admins.length > 0) {
          await tx.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              type: "GENERAL",
              title: "Bypass Request",
              message: `Bypass requested for order ${order.orderNo} at ${stationType}. Reason: ${reason}`,
            })),
          });
        }
      }

      return bypass;
    });
  }
}
