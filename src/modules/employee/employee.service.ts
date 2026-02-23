import {
  PrismaClient,
  Prisma,
  RoleCode,
  UserStatus,
} from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { ShiftAssignmentStatus } from "../../../generated/prisma/client.js";

export class EmployeeService {
  constructor(private prisma: PrismaClient) {}

  getAllEmployees = async (params: {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
    search?: string;
    outletId?: number;
    role?: string;
  }) => {
    const skip = (params.page - 1) * params.limit;

    const where: Prisma.OutletStaffWhereInput = {
      isActive: true,
      user: { status: UserStatus.ACTIVE },
      ...(params.role && { role: params.role as any }),
      ...(params.outletId && { outletId: params.outletId }),
      ...(params.search && {
        OR: [
          {
            user: {
              email: { contains: params.search, mode: "insensitive" },
              profile: {
                fullName: { contains: params.search, mode: "insensitive" },
              },
            },
          },
        ],
      }),
    };

    const data = await this.prisma.outletStaff.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: { select: { fullName: true } },
          },
        },
        outlet: {
          select: { id: true, name: true },
        },
      },
      skip,
      take: params.limit,
      orderBy:
        params.sortBy === "fullName"
          ? { user: { profile: { fullName: params.sortOrder } } }
          : { [params.sortBy]: params.sortOrder },
    });

    const total = await this.prisma.outletStaff.count({ where });

    return {
      data,
      meta: {
        page: params.page,
        take: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  };

  getAvailableUsers = async () => {
    return await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        outletStaff: {
          none: { isActive: true },
        },
        role: { not: RoleCode.SUPER_ADMIN },
      },
      select: {
        id: true,
        email: true,
        profile: { select: { fullName: true } },
      },
    });
  };

  assignEmployee = async (data: {
    userId: number;
    outletId: number;
    role: any;
    shiftTemplateId: string;
  }) => {
    return await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: data.userId },
        data: { role: data.role },
      });

      const staff = await tx.outletStaff.upsert({
        where: {
          outletId_userId: { outletId: data.outletId, userId: data.userId },
        },
        update: {
          shiftTemplateId: Number(data.shiftTemplateId),
          isActive: true,
        },
        create: {
          outletId: data.outletId,
          userId: data.userId,
          shiftTemplateId: Number(data.shiftTemplateId),
          isActive: true,
        },
      });
      const template = await tx.shiftTemplate.findUnique({
        where: { id: Number(data.shiftTemplateId) },
      });

      if (template) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let dailyShift = await tx.shift.findFirst({
          where: {
            outletId: data.outletId,
            shiftDate: today,
            startTime: template.startTime,
            endTime: template.endTime,
          },
        });

        if (!dailyShift) {
          dailyShift = await tx.shift.create({
            data: {
              outletId: data.outletId,
              shiftDate: today,
              startTime: template.startTime,
              endTime: template.endTime,
            },
          });
        }

        const existingAssignment = await tx.shiftAssignment.findFirst({
          where: { shiftId: dailyShift.id, outletStaffId: staff.id },
        });

        if (!existingAssignment) {
          await tx.shiftAssignment.create({
            data: {
              shiftId: dailyShift.id,
              outletStaffId: staff.id,
              status: ShiftAssignmentStatus.SCHEDULED,
            },
          });
        }
      }

      return staff;
    });
  };

  unassignEmployee = async (userId: number) => {
    const staffRecord = await this.prisma.outletStaff.findFirst({
      where: { userId, isActive: true },
    });

    if (!staffRecord) throw new ApiError("Employee assignment not found", 404);

    await this.prisma.$transaction(async (tx) => {
      await tx.outletStaff.update({
        where: { id: staffRecord.id },
        data: { isActive: false },
      });
    });

    return { message: "Employee unassigned successfully" };
  };
}
