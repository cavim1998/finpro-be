import { PrismaClient, Prisma } from "../../../generated/prisma/client.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { ApiError } from "../../utils/api-error.js";
import { CreateOutletDto } from "./dto/create-outlet.dto.js";
import { UpdateOutletDto } from "./dto/update-outlet.dto.js";

export class OutletService {
  constructor(
    private prisma: PrismaClient,
    private cloudinaryService: CloudinaryService,
  ) {}

  getAllOutlets = async (params: {
    page: number;
    limit: number;
    search?: string;
    locationCategory?: string;
    sortBy: string;
    sortOrder: "asc" | "desc";
  }) => {
    const skip = (params.page - 1) * params.limit;

    const where: Prisma.OutletWhereInput = {};

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { addressText: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params.locationCategory) {
      where.location_category = {
        equals: params.locationCategory,
        mode: "insensitive",
      };
    }

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
      data: data.map((outlet) => ({
        ...outlet,
        locationCategory: outlet.location_category ?? undefined,
        location_category: undefined,
      })),
      meta: {
        page: params.page,
        take: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  };

  getOutletById = async (id: number) => {
    const getOutlet = await this.prisma.outlet.findUnique({
      where: { id },
      include: {
        staff: true,
      },
    });

    if (!getOutlet) throw new ApiError("Outlet not found", 404);

    return {
      ...getOutlet,
      locationCategory: getOutlet.location_category ?? undefined,
      location_category: undefined,
    };
  };

  createOutlet = async (body: CreateOutletDto) => {
    return await this.prisma.outlet.create({
      data: {
        name: body.name,
        addressText: body.addressText,
        latitude: body.latitude,
        longitude: body.longitude,
        location_category: body.locationCategory,
      },
    });
  };

  updateOutlet = async (id: number, body: UpdateOutletDto) => {
    await this.getOutletById(id);
    return await this.prisma.outlet.update({
      where: { id },
      data: {
        name: body.name,
        addressText: body.addressText,
        latitude: body.latitude,
        longitude: body.longitude,
        location_category: body.locationCategory,
      },
    });
  };

  updateOutletPhoto = async (id: number, file?: Express.Multer.File) => {
    if (!file) {
      throw new ApiError("Invalid file type or size", 400, "INVALID_FILE");
    }

    const outlet = await this.getOutletById(id);

    if (outlet?.photoUrl) {
      await this.cloudinaryService.remove(outlet.photoUrl);
    }

    const uploadResult = await this.cloudinaryService.upload(file);

    await this.prisma.outlet.update({
      where: { id },
      data: { photoUrl: uploadResult.secure_url },
    });

    return { url: uploadResult.secure_url };
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
