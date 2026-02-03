import { PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { CreateOutletDto } from "./dto/create-outlet.dto.js";
import { UpdateOutletDto } from "./dto/update-outlet.dto.js";

export class OutletService {
  constructor(private prisma: PrismaClient) {}

  getAllOutlets = async () => {
    return await this.prisma.outlet.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      include: {
        _count: { select: { staff: true } },
      },
    });
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
