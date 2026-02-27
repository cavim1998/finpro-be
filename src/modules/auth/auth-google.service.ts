import { OAuth2Client } from "google-auth-library";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { GOOGLE_CLIENT_ID } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { GoogleLoginDTO } from "./dto/google-login.dto.js";
import { AuthSessionService } from "./auth-session.service.js";

export class AuthGoogleService {
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaClient,
    private authSessionService: AuthSessionService,
  ) {
    this.googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  }

  private async verifyGoogleIdToken(idToken: string) {
    if (!this.googleClient) {
      this.googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
    }

    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    return ticket.getPayload();
  }

  async googleLogin(data: GoogleLoginDTO) {
    const payload = await this.verifyGoogleIdToken(data.idToken);

    if (!payload?.email || !payload?.sub) {
      throw new ApiError("Invalid Google token", 401, "INVALID_TOKEN");
    }

    const existingIdentity = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: "GOOGLE",
          providerUserId: payload.sub,
        },
      },
      include: { user: { include: { profile: true } } },
    });

    let user = existingIdentity?.user;

    if (!user) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: payload.email },
        include: { profile: true },
      });

      if (!existingUser) {
        throw new ApiError(
          "User not found. Please sign up first.",
          404,
          "USER_NOT_FOUND",
        );
      }

      const existingGoogleIdentity = await this.prisma.userIdentity.findFirst({
        where: { userId: existingUser.id, provider: "GOOGLE" },
      });

      if (!existingGoogleIdentity) {
        await this.prisma.userIdentity.create({
          data: {
            userId: existingUser.id,
            provider: "GOOGLE",
            providerUserId: payload.sub,
          },
        });
      }

      user = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          isEmailVerified: true,
          profile: {
            update: {
              photoUrl: existingUser.profile?.photoUrl || payload.picture,
            },
          },
        },
        include: { profile: true },
      });
    }

    const token = this.authSessionService.signUserToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return this.authSessionService.buildAuthResponse(user, token);
  }

  async googleSignup(data: GoogleLoginDTO) {
    const payload = await this.verifyGoogleIdToken(data.idToken);

    if (!payload?.email || !payload?.sub) {
      throw new ApiError("Invalid Google token", 401, "INVALID_TOKEN");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: payload.email },
      include: { profile: true },
    });

    if (existingUser) {
      throw new ApiError(
        "Email already registered. Please sign in instead.",
        409,
        "EMAIL_ALREADY_EXISTS",
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: payload.email,
        isEmailVerified: true,
        role: "CUSTOMER",
        profile: {
          create: {
            fullName: payload.name || "User",
            photoUrl: payload.picture,
          },
        },
        identities: {
          create: {
            provider: "GOOGLE",
            providerUserId: payload.sub,
          },
        },
      },
      include: { profile: true },
    });

    const token = this.authSessionService.signUserToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const authResponse = await this.authSessionService.buildAuthResponse(
      user,
      token,
    );

    return {
      status: "success",
      message: "Account created successfully",
      data: authResponse.data,
    };
  }
}
