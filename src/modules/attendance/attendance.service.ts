import { PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";

const DEFAULT_TZ = "Asia/Jakarta";

export class AttendanceService {
  constructor(private prisma: PrismaClient) {}

  private getDateKeyToday = (timeZone = DEFAULT_TZ) => {
    // en-CA => YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  };
  //hello world
  private getTodayDate = (timeZone = DEFAULT_TZ) => {
    const key = this.getDateKeyToday(timeZone); // YYYY-MM-DD
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)); // UTC midnight
  };

  private resolveOutletStaff = async (userId: number) => {
    const staffList = await this.prisma.outletStaff.findMany({
      where: { userId, isActive: true },
      select: { id: true, outletId: true },
    });

    if (staffList.length === 0) {
      throw new ApiError("Outlet staff not found for this user", 404);
    }

    if (staffList.length > 1) {
      throw new ApiError(
        "User is assigned to more than 1 outlet. Please fix outletStaff data.",
        409,
      );
    }

    return staffList[0];
  };

  getToday = async (userId: number) => {
    const staff = await this.resolveOutletStaff(userId);

    const today = this.getTodayDate();
    const log = await this.prisma.attendanceLog.findFirst({
      where: { outletStaffId: staff.id, date: today },
      orderBy: { createdAt: "desc" },
    });

    return {
      outletStaffId: staff.id,
      outletId: staff.outletId,
      date: today,
      log,
      isCheckedIn: !!log?.clockInAt && !log?.clockOutAt,
      isCompleted: !!log?.clockInAt && !!log?.clockOutAt,
    };
  };

  clockIn = async (userId: number, notes?: string) => {
    const staff = await this.resolveOutletStaff(userId);

    const today = this.getTodayDate();
    const existing = await this.prisma.attendanceLog.findFirst({
      where: { outletStaffId: staff.id, date: today },
    });

    if (existing?.clockInAt && !existing.clockOutAt) {
      throw new ApiError("Already clocked in today", 409);
    }
    if (existing?.clockInAt && existing.clockOutAt) {
      throw new ApiError("Attendance for today is already completed", 409);
    }

    const now = new Date();

    const log = existing
      ? await this.prisma.attendanceLog.update({
          where: { id: existing.id },
          data: { clockInAt: now, notes: notes ?? existing.notes ?? null },
        })
      : await this.prisma.attendanceLog.create({
          data: {
            outletStaffId: staff.id,
            date: today,
            clockInAt: now,
            notes: notes ?? null,
          },
        });

    return log;
  };

  clockOut = async (userId: number, notes?: string) => {
    const staff = await this.resolveOutletStaff(userId);

    const today = this.getTodayDate();
    const existing = await this.prisma.attendanceLog.findFirst({
      where: { outletStaffId: staff.id, date: today },
    });

    if (!existing?.clockInAt) {
      throw new ApiError("You must clock-in before clock-out", 400);
    }
    if (existing.clockOutAt) {
      throw new ApiError("Already clocked out today", 409);
    }

    const now = new Date();

    return this.prisma.attendanceLog.update({
      where: { id: existing.id },
      data: { clockOutAt: now, notes: notes ?? existing.notes ?? null },
    });
  };
}
