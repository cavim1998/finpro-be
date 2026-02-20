import { PrismaClient, Prisma } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { CreateOutletDto } from "./dto/create-outlet.dto.js";
import { UpdateOutletDto } from "./dto/update-outlet.dto.js";

export class OutletService {
  constructor(private prisma: PrismaClient) {}

  getAllOutlets = async (params: {
    page: number;
    limit: number;
    search?: string;
    sortBy: string;
    sortOrder: "asc" | "desc";
  }) => {
    const skip = (params.page - 1) * params.limit;

    const where: Prisma.OutletWhereInput = params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" } },
            { addressText: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : {};

    const data = await this.prisma.outlet.findMany({
      where,
      skip,
      take: params.limit,
      orderBy: { [params.sortBy]: params.sortOrder },
      include: {
        _count: {
          select: { staff: true },
        },
      },
    });

    const total = await this.prisma.outlet.count({ where });

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

  getOutletById = async (id: number) => {
    const getOutlet = this.prisma.outlet.findUnique({
      where: { id },
      include: {
        staff: true,
      },
    });

    if (!getOutlet) throw new ApiError("Outlet not found", 404);

    return getOutlet;
  };

  createOutlet = async (body: CreateOutletDto) => {
    return await this.prisma.outlet.create({
      data: {
        name: body.name,
        addressText: body.addressText,
        latitude: body.latitude,
        longitude: body.longitude,
      },
    });
  };

  updateOutlet = async (id: number, body: UpdateOutletDto) => {
    await this.getOutletById(id);
    return await this.prisma.outlet.update({
      where: { id },
      data: body,
    });
  };

  deleteOutlet = async (id: number) => {
    const outlet = await this.getOutletById(id);

    if (outlet?.staff.length !== 0)
      throw new ApiError("The outlet still has employees", 400);

    return await this.prisma.outlet.delete({
      where: { id },
    });
  };
}
