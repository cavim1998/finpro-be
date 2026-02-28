import { PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { GetAttendanceHistoryDto } from "./dto/get-attendance-history.dto.js";

const DEFAULT_TZ = "Asia/Jakarta";

export class AttendanceService {
  constructor(private prisma: PrismaClient) {}

  private getDateKeyToday = (timeZone = DEFAULT_TZ) => {
    // en-CA => YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  };

  private getTodayDate = (timeZone = DEFAULT_TZ) => {
    const key = this.getDateKeyToday(timeZone); // YYYY-MM-DD
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)); // UTC midnight
  };

  private parseDateOnly = (dateKey: string) => {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)); // UTC midnight
  };

  private getCurrentMonthRange = (timeZone = DEFAULT_TZ) => {
    const todayKey = this.getDateKeyToday(timeZone); // YYYY-MM-DD
    const [y, m] = todayKey.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    return { start, end };
  };

  private getMonthRangeByDate = (date: Date) => {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m + 1, 0));
    return { start, end };
  };

  private resolveDateRange = (
    query: Pick<GetAttendanceHistoryDto, "startDate" | "endDate">,
  ) => {
    const hasStart = !!query.startDate;
    const hasEnd = !!query.endDate;

    let startDate: Date;
    let endDate: Date;

    if (!hasStart && !hasEnd) {
      const currentMonth = this.getCurrentMonthRange();
      startDate = currentMonth.start;
      endDate = currentMonth.end;
    } else if (hasStart && hasEnd) {
      startDate = this.parseDateOnly(query.startDate as string);
      endDate = this.parseDateOnly(query.endDate as string);
    } else if (hasStart) {
      startDate = this.parseDateOnly(query.startDate as string);
      endDate = this.getMonthRangeByDate(startDate).end;
    } else {
      endDate = this.parseDateOnly(query.endDate as string);
      startDate = this.getMonthRangeByDate(endDate).start;
    }

    if (startDate > endDate) {
      throw new ApiError("startDate cannot be greater than endDate", 400);
    }

    return { startDate, endDate };
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

  getHistory = async (userId: number, query: GetAttendanceHistoryDto) => {
    const staff = await this.resolveOutletStaff(userId);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(31, Math.max(1, query.limit ?? 7));
    const skip = (page - 1) * limit;
    const { startDate, endDate } = this.resolveDateRange(query);

    const [total, items] = await Promise.all([
      this.prisma.attendanceLog.count({
        where: {
          outletStaffId: staff.id,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.attendanceLog.findMany({
        where: {
          outletStaffId: staff.id,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
    ]);

    return {
      outletStaffId: staff.id,
      outletId: staff.outletId,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filter: {
        startDate,
        endDate,
      },
      items,
    };
  };
}
