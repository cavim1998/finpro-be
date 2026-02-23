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
}

export class PickupService {
  constructor(private prisma: PrismaClient) {}

  findAll = async (params: FindAllParams) => {
    const { outletId, page, limit, sortBy, sortOrder, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.PickupRequestWhereInput = {};

    if (outletId) {
      where.assignedOutletId = outletId;
    }

    if (status) {
      where.status = status as PickupStatus;
    }

    const requests = await this.prisma.pickupRequest.findMany({
      where,
      include: {
        customer: {
          include: { profile: true },
        },
        address: true,
        outlet: true,
      },
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
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
