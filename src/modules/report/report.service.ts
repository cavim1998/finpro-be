import {
  PrismaClient,
  OrderStatus,
  StationStatus,
  TaskStatus,
  RoleCode,
} from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { GetAttendanceReportDto } from "./dto/get-attendance-report.dto.js";

export class ReportService {
  constructor(private prisma: PrismaClient) {}

  private getDateKeyToday(timeZone = "Asia/Jakarta") {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  }

  private parseDateOnly(dateKey: string) {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  private getCurrentMonthRange(timeZone = "Asia/Jakarta") {
    const todayKey = this.getDateKeyToday(timeZone);
    const [y, m] = todayKey.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    return { start, end };
  }

  private getMonthRangeByDate(date: Date) {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m + 1, 0));
    return { start, end };
  }

  private resolveAttendanceDateRange(query: GetAttendanceReportDto) {
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
  }

  private getDateFilter(startDate?: string, endDate?: string) {
    if (!startDate && !endDate) return undefined;
    return {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
  }

  async getSalesReport(
    outletId?: number,
    start?: string,
    end?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const dateFilter = this.getDateFilter(start, end);
    const skip = (page - 1) * limit;

    const whereClause = {
      status: OrderStatus.RECEIVED_BY_CUSTOMER,
      ...(outletId && { outletId }),
      ...(dateFilter && { createdAt: dateFilter }),
    };

    const aggregate = await this.prisma.order.aggregate({
      where: whereClause,
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const totalIncome = Number(aggregate._sum.totalAmount || 0);
    const totalOrders = aggregate._count.id;

    const orders = await this.prisma.order.findMany({
      where: whereClause,
      select: {
        id: true,
        orderNo: true,
        totalAmount: true,
        createdAt: true,
        customer: { select: { profile: { select: { fullName: true } } } },
        outlet: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const formattedOrders = orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      createdAt: o.createdAt,
      totalAmount: o.totalAmount,
      customerName: o.customer.profile?.fullName || "Pelanggan Tanpa Nama",
      outletName: o.outlet.name,
    }));

    return {
      data: {
        totalIncome,
        totalOrders,
        orders: formattedOrders,
      },
      meta: {
        page,
        limit,
        total: totalOrders,
        totalPages: Math.ceil(totalOrders / limit),
      },
    };
  }

  async getPerformanceReport(
    outletId?: number,
    start?: string,
    end?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const dateFilter = this.getDateFilter(start, end);

    const users = await this.prisma.user.findMany({
      where: {
        role: { in: [RoleCode.WORKER, RoleCode.DRIVER] },
        ...(outletId && { outletStaff: { some: { outletId } } }),
      },
      select: {
        id: true,
        role: true,
        profile: { select: { fullName: true } },
        outletStaff: { select: { outlet: { select: { name: true } } } },
        assignedStations: {
          where: { status: StationStatus.COMPLETED, completedAt: dateFilter },
        },
        driverTasks: {
          where: { status: TaskStatus.DONE, completedAt: dateFilter },
        },
      },
    });

    const formattedUsers = users
      .map((u) => {
        const stationJobs = u.assignedStations.length;
        const deliveryJobs = u.driverTasks.length;
        return {
          id: u.id,
          name: u.profile?.fullName || "Tanpa Nama",
          role: u.role,
          outletName: u.outletStaff[0]?.outlet.name || "-",
          stationJobsDone: stationJobs,
          deliveryJobsDone: deliveryJobs,
          jobsDone: stationJobs + deliveryJobs,
        };
      })
      .sort((a, b) => b.jobsDone - a.jobsDone);

    const total = formattedUsers.length;
    const paginatedUsers = formattedUsers.slice(
      (page - 1) * limit,
      page * limit,
    );

    return {
      data: paginatedUsers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAttendanceReport(outletId: number, query: GetAttendanceReportDto) {
    const workerRoles: RoleCode[] = [RoleCode.WORKER, RoleCode.DRIVER];
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;
    const { startDate, endDate } = this.resolveAttendanceDateRange(query);

    const [total, staffList, attendanceCounts] = await Promise.all([
      this.prisma.outletStaff.count({
        where: {
          outletId,
          isActive: true,
          user: {
            is: {
              role: {
                in: workerRoles,
              },
            },
          },
        },
      }),
      this.prisma.outletStaff.findMany({
        where: {
          outletId,
          isActive: true,
          user: {
            is: {
              role: {
                in: workerRoles,
              },
            },
          },
        },
        select: {
          id: true,
          workerStation: true,
          outlet: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              profile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip,
        take: limit,
      }),
      this.prisma.attendanceLog.groupBy({
        by: ["outletStaffId"],
        where: {
          staff: {
            outletId,
            isActive: true,
            user: {
              is: {
                role: {
                  in: workerRoles,
                },
              },
            },
          },
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          clockInAt: true,
          clockOutAt: true,
        },
      }),
    ]);

    const countMap = new Map(
      attendanceCounts.map((item) => [
        item.outletStaffId,
        {
          totalClockIn: item._count.clockInAt,
          totalClockOut: item._count.clockOutAt,
        },
      ]),
    );

    const data = staffList.map((staff) => ({
      outletStaffId: staff.id,
      userId: staff.user.id,
      employeeName:
        staff.user.profile?.fullName || staff.user.email || "Tanpa Nama",
      position:
        staff.user.role === RoleCode.DRIVER
          ? "DRIVER"
          : staff.workerStation || "-",
      outlet: {
        id: staff.outlet.id,
        name: staff.outlet.name,
      },
      totalClockIn: countMap.get(staff.id)?.totalClockIn ?? 0,
      totalClockOut: countMap.get(staff.id)?.totalClockOut ?? 0,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filter: {
        startDate,
        endDate,
      },
    };
  }

  async getAttendanceHistoryDetail(
    outletId: number,
    outletStaffId: number,
    query: GetAttendanceReportDto,
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;
    const { startDate, endDate } = this.resolveAttendanceDateRange(query);

    const staff = await this.prisma.outletStaff.findFirst({
      where: {
        id: outletStaffId,
        outletId,
        isActive: true,
      },
      select: {
        id: true,
        workerStation: true,
        outlet: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!staff) {
      throw new ApiError("Attendance staff not found in your outlet", 404);
    }

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
      data: {
        outletStaffId: staff.id,
        userId: staff.user.id,
        employeeName:
          staff.user.profile?.fullName || staff.user.email || "Tanpa Nama",
        position:
          staff.user.role === RoleCode.DRIVER
            ? "DRIVER"
            : staff.workerStation || "-",
        outlet: {
          id: staff.outlet.id,
          name: staff.outlet.name,
        },
        items,
      },
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filter: {
        startDate,
        endDate,
      },
    };
  }
}
