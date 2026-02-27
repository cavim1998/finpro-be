import jwt from "jsonwebtoken";
import { PrismaClient, RoleCode } from "../../../generated/prisma/client.js";
import { JWT_SECRET } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { comparePassword } from "../../utils/password.js";
import { LoginDTO } from "./dto/login.dto.js";

type AuthUser = {
  id: number;
  email: string | null;
  role: RoleCode;
  isEmailVerified: boolean;
  profile?: { fullName?: string | null; photoUrl?: string | null } | null;
};

export class AuthSessionService {
  constructor(private prisma: PrismaClient) {}

  private async resolveUserStation(userId: number, role: RoleCode) {
    if (role !== "WORKER") return null;

    const staff = await this.prisma.outletStaff.findFirst({
      where: {
        userId,
        isActive: true,
        workerStation: { not: null },
      },
      select: { workerStation: true },
      orderBy: { id: "desc" },
    });

    return staff?.workerStation ?? null;
  }

  private async buildAuthData(user: AuthUser, accessToken: string) {
    const station = await this.resolveUserStation(user.id, user.role);

    return {
      user: {
        id: user.id,
        name: user.profile?.fullName || "",
        email: user.email || "",
        role: user.role,
        roleCode: user.role,
        station,
        verified: user.isEmailVerified,
        profileImage: user.profile?.photoUrl || undefined,
      },
      accessToken,
      expiresIn: 7200,
    };
  }

  async buildAuthResponse(user: AuthUser, accessToken: string) {
    return {
      status: "success",
      message: "Login successful",
      data: await this.buildAuthData(user, accessToken),
    };
  }

  signUserToken(params: {
    sub: number;
    email: string | null;
    role: RoleCode;
    outletId?: number;
  }) {
    return jwt.sign(
      {
        sub: params.sub,
        email: params.email,
        role: params.role,
        outletId: params.outletId ?? 0,
      },
      JWT_SECRET,
      { expiresIn: "2h" },
    );
  }

  async login(data: LoginDTO) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: {
        profile: true,
        outletStaff: true,
      },
    });

    if (!user) {
      throw new ApiError(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    if (!user.passwordHash) {
      throw new ApiError(
        "This account uses social login. Please sign in with Google.",
        400,
        "SOCIAL_LOGIN_USER",
      );
    }

    const isMatch = await comparePassword(data.password, user.passwordHash);
    if (!isMatch) {
      throw new ApiError(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    if (user.status !== "ACTIVE") {
      throw new ApiError("Account is not active", 403, "ACCOUNT_NOT_ACTIVE");
    }

    if (!user.isEmailVerified) {
      throw new ApiError(
        "Email not verified. Please verify your email first.",
        403,
        "EMAIL_NOT_VERIFIED",
        { email: user.email },
      );
    }

    const token = this.signUserToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      outletId:
        user.outletStaff.length !== 0 ? user.outletStaff[0].outletId : 0,
    });

    return this.buildAuthResponse(user, token);
  }

  async logout() {
    return {
      status: "success",
      message: "Logged out successfully",
    };
  }
}
