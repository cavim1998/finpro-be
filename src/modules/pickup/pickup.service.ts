import {
  PrismaClient,
  Prisma,
  PickupStatus,
} from "../../../generated/prisma/client.js";

interface FindAllParams {
  outletId?: number;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  status?: string;
  isOrderCreated?: string;
}

export class PickupService {
  constructor(private prisma: PrismaClient) {}

  findAll = async (params: FindAllParams) => {
    const { outletId, page, limit, sortBy, sortOrder, status, isOrderCreated } =
      params;
    const skip = (page - 1) * limit;

    const where: Prisma.PickupRequestWhereInput = {};

    if (outletId) {
      where.assignedOutletId = outletId;
    }

    if (status) {
      where.status = status as PickupStatus;
    }

    if (isOrderCreated === "true") {
      where.order = { isNot: null };
    } else if (isOrderCreated === "false") {
      where.order = { is: null };
    }

    let orderByClause: any = {};

    if (sortBy === "name") {
      orderByClause = {
        customer: {
          profile: {
            fullName: sortOrder,
          },
        },
      };
    } else {
      const validColumns = [
        "createdAt",
        "updatedAt",
        "status",
        "scheduledPickupAt",
      ];

      if (validColumns.includes(sortBy)) {
        orderByClause = { [sortBy]: sortOrder };
      } else {
        orderByClause = { createdAt: "desc" };
      }
    }

    const requests = await this.prisma.pickupRequest.findMany({
      where,
      include: {
        customer: {
          include: { profile: true },
        },
        address: true,
        outlet: true,
        order: { select: { id: true, orderNo: true } },
      },
      skip,
      take: limit,
      orderBy: orderByClause,
    });

    const total = await this.prisma.pickupRequest.count({ where });

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

  findById = async (id: string) => {
    return await this.prisma.pickupRequest.findUnique({
      where: { id },
      include: {
        customer: { include: { profile: true } },
        address: true,
        outlet: true,
      },
    });
  };
}
