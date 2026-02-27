import {
  PrismaClient,
  Prisma,
  BypassStatus,
  StationStatus,
  StationType,
  OrderStatus,
} from "../../../generated/prisma/client.js";

interface FindAllParams {
  outletId?: number;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  status?: string;
  search?: string;
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

export class BypassService {
  constructor(private prisma: PrismaClient) {}

  findAll = async (params: FindAllParams) => {
    const { outletId, page, limit, sortBy, sortOrder, status, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.BypassRequestWhereInput = {};

    if (status) {
      where.status = status as BypassStatus;
    }

    if (outletId) {
      where.orderStation = {
        order: {
          outletId: outletId,
        },
      };
    }

    let orderByClause: any = {};

    if (sortBy === "name") {
      orderByClause = {
        requestedBy: {
          profile: {
            fullName: sortOrder,
          },
        },
      };
    } else if (sortBy === "orderNo") {
      orderByClause = {
        orderStation: {
          order: {
            orderNo: sortOrder,
          },
        },
      };
    } else {
      const validColumns = [
        "id",
        "status",
        "requestedAt",
        "decidedAt",
        "reason",
      ];

      if (validColumns.includes(sortBy)) {
        orderByClause = { [sortBy]: sortOrder };
      } else {
        orderByClause = { requestedAt: "desc" };
      }
    }

    const requests = await this.prisma.bypassRequest.findMany({
      where,
      include: {
        requestedBy: { include: { profile: true } },
        approvedBy: { include: { profile: true } },
        diffs: {
          include: { item: true },
        },
        orderStation: {
          include: {
            order: {
              select: { orderNo: true, outlet: true },
            },
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    const total = await this.prisma.bypassRequest.count({ where });

    return {
      data: requests,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  };

  handleDecision = async (
    id: number,
    adminId: number,
    decision: "APPROVE" | "REJECT",
    adminNote?: string,
  ) => {
    return await this.prisma.$transaction(async (tx) => {
      const request = await tx.bypassRequest.findUnique({
        where: { id },
        include: { diffs: true, orderStation: true },
      });

      if (!request) throw new Error("Bypass Request not found");
      if (request.status !== "REQUESTED")
        throw new Error("Request has already been processed");

      if (decision === "REJECT") {
        await tx.bypassRequest.update({
          where: { id },
          data: {
            status: BypassStatus.REJECTED,
            approvedByAdminId: adminId,
            decidedAt: new Date(),
            adminNote: adminNote,
          },
        });

        await tx.orderStation.update({
          where: { id: request.orderStationId },
          data: { status: StationStatus.IN_PROGRESS },
        });

        return { message: "Bypass Rejected. Worker must recount." };
      } else {
        await tx.bypassRequest.update({
          where: { id },
          data: {
            status: BypassStatus.APPROVED,
            approvedByAdminId: adminId,
            decidedAt: new Date(),
            adminNote: adminNote,
          },
        });

        for (const diff of request.diffs) {
          const existingCount = await tx.stationItemCount.findFirst({
            where: {
              orderStationId: request.orderStationId,
              itemId: diff.itemId,
            },
          });

          const existingOrderItem = await tx.orderItem.findFirst({
            where: {
              orderId: request.orderStation.orderId,
              itemId: diff.itemId,
            },
          });

          if (existingOrderItem) {
            await tx.orderItem.update({
              where: { id: existingOrderItem.id },
              data: { qty: diff.currentQty },
            });
          }
        }

        await tx.orderStation.update({
          where: { id: request.orderStationId },
          data: {
            status: StationStatus.COMPLETED,
            completedAt: new Date(),
          },
        });

        const detailOrderStation = await tx.orderStation.findUnique({
          where: { id: request.orderStationId },
        });

        if (!detailOrderStation) throw new Error("Order Station Not Found");

        let finalOrderStatus = nextOrderStatusByStation(
          detailOrderStation.stationType,
        );

        await tx.order.update({
          where: { id: detailOrderStation.orderId },
          data: { status: finalOrderStatus },
        });

        return {
          message: "Bypass Approved. Inventory updated and station completed.",
        };
      }
    });
  };
}
