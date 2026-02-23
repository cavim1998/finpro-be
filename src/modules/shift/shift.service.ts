import { PrismaClient } from "../../../generated/prisma/client.js";

interface GetShiftsQuery {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  outletId?: number;
}

export class ShiftService {
  constructor(private prisma: PrismaClient) {}

  getShifts = async (query: GetShiftsQuery) => {
    const {
      page,
      limit,
      search,
      sortBy = "name",
      sortOrder = "asc",
      outletId,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
      ...(outletId ? { outletId } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.shiftTemplate.findMany({
        where,
        include: {
          outlet: { select: { name: true } },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.shiftTemplate.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        take: limit,
        total,
      },
    };
  };

  createShift = async (data: {
    outletId: number;
    name: string;
    startTime: string;
    endTime: string;
  }) => {
    const toDate = (time: string) => {
      const [hh, mm] = time.split(":").map(Number);
      const d = new Date();
      d.setUTCFullYear(1970, 0, 1);
      d.setUTCHours(hh, mm, 0, 0);
      return d;
    };

    return await this.prisma.shiftTemplate.create({
      data: {
        outletId: Number(data.outletId),
        name: data.name,
        startTime: toDate(data.startTime),
        endTime: toDate(data.endTime),
      },
    });
  };

  deleteShift = async (id: number) => {
    return await this.prisma.shiftTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  };
}
