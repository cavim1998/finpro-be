import { PrismaClient } from "../../../generated/prisma/client.js";

export class ShiftService {
  constructor(private prisma: PrismaClient) {}

  getShifts = async (outletId?: number) => {
    return await this.prisma.shiftTemplate.findMany({
      where: {
        isActive: true,
        ...(outletId ? { outletId } : {}),
      },
      include: {
        outlet: { select: { name: true } },
      },
      orderBy: [{ outletId: "asc" }, { startTime: "asc" }],
    });
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
