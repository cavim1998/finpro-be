import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { FE_URL, GOOGLE_CLIENT_ID, JWT_SECRET } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { MailService } from "../mail/mail.service.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { LoginDTO } from "./dto/login.dto.js";
import { RegisterDTO } from "./dto/register.dto.js";
import { ForgotPasswordDTO } from "./dto/forgot-password.dto.js";
import { ResetPasswordDTO } from "./dto/reset-password.dto.js";
import { VerifyEmailDTO } from "./dto/verify-email.dto.js";
import { ResendVerificationDTO } from "./dto/resend-verification.dto.js";
import { GoogleLoginDTO } from "./dto/google-login.dto.js";

export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaClient,
    private cloudinaryService: CloudinaryService,
    private mailService: MailService,
  ) {
    this.googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  }

  private generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  private verifyGoogleIdToken = async (idToken: string) => {
    if (!this.googleClient) {
      this.googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
    }

    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    return ticket.getPayload();
  };

  private buildAuthData = (
    user: {
      id: string;
      email: string | null;
      isEmailVerified: boolean;
      profile?: { fullName?: string | null; photoUrl?: string | null } | null;
    },
    accessToken: string,
  ) => {
    return {
      user: {
        id: user.id,
        name: user.profile?.fullName || "",
        email: user.email || "",
        verified: user.isEmailVerified,
        profileImage: user.profile?.photoUrl || undefined,
      },
      accessToken,
      expiresIn: 7200,
    };
  };

  private buildAuthResponse = (
    user: {
      id: string;
      email: string | null;
      isEmailVerified: boolean;
      profile?: { fullName?: string | null; photoUrl?: string | null } | null;
    },
    accessToken: string,
  ) => {
    return {
      status: "success",
      message: "Login successful",
      data: this.buildAuthData(user, accessToken),
    };
  };

  register = async (data: RegisterDTO) => {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ApiError(
        "Email already registered",
        409,
        "EMAIL_ALREADY_EXISTS",
      );
    }

    // Create user with profile
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: null,
        role: "CUSTOMER",
        profile: {
          create: {
            fullName: data.name,
          },
        },
        identities: {
          create: {
            provider: "EMAIL",
            providerUserId: data.email,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    // Generate verification code (6-digit)
    const verificationCode = this.generateVerificationCode();

    // Save verification token with 1 hour expiry
    const expiresAt = new Date(Date.now() + 3600000);
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verificationCode,
        expiresAt,
      },
    });

    // Send verification email
    const verifyLink = `${FE_URL}/verify-email?email=${encodeURIComponent(
      data.email,
    )}`;
    await this.mailService.sendVerificationEmail(
      data.email,
      data.name,
      verifyLink,
      verificationCode,
    );

    return {
      status: "success",
      message: "Registration successful. Please check your email to verify.",
      data: {
        id: user.id,
        email: user.email,
        name: user.profile?.fullName || "",
        verificationSent: true,
        expiresAt,
      },
    };
  };

  login = async (data: LoginDTO) => {
    // Find user by email
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

    // Verify password
    const isMatch = await comparePassword(data.password, user.passwordHash!);
    if (!isMatch) {
      throw new ApiError(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    // Check user status
    if (user.status !== "ACTIVE") {
      throw new ApiError("Account is not active", 403, "ACCOUNT_NOT_ACTIVE");
    }

    // Check if email verified
    if (!user.isEmailVerified) {
      throw new ApiError(
        "Email not verified. Please verify your email first.",
        403,
        "EMAIL_NOT_VERIFIED",
        { email: user.email },
      );
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        outletId:
          user.outletStaff.length !== 0 ? user.outletStaff[0].outletId : 0,
      },
      JWT_SECRET,
      {
        expiresIn: "2h",
      },
    );

    return this.buildAuthResponse(user, token);
  };

  forgotPassword = async (data: ForgotPasswordDTO) => {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: { profile: true },
    });

    if (!user) {
      throw new ApiError("Email not found", 404, "EMAIL_NOT_FOUND");
    }

    if (!user.passwordHash) {
      throw new ApiError(
        "This account uses social login. Password reset not available.",
        400,
        "SOCIAL_LOGIN_USER",
      );
    }

    // Generate reset token
    const token = randomBytes(32).toString("hex");

    const expiresAt = new Date(Date.now() + 3600000);

    // Delete previous reset tokens
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Save reset token with 1 hour expiry
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Send email with reset link
    const resetLink = `${FE_URL}/confirm-reset-password?token=${token}`;
    await this.mailService.sendResetPasswordEmail(
      data.email,
      resetLink,
      user.profile?.fullName || "User",
    );

    return {
      status: "success",
      message: "Password reset link has been sent to your email",
      data: {
        email: data.email,
        expiresAt,
      },
    };
  };

  resetPassword = async (data: ResetPasswordDTO) => {
    // Find reset token
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: data.token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new ApiError("Reset token expired", 400, "TOKEN_EXPIRED");
    }

    if (resetToken.usedAt) {
      throw new ApiError("Reset token expired", 400, "TOKEN_EXPIRED");
    }

    // Check if token expired
    if (resetToken.expiresAt < new Date()) {
      throw new ApiError("Reset token expired", 400, "TOKEN_EXPIRED");
    }

    if (!resetToken.user.passwordHash) {
      throw new ApiError(
        "This account uses social login. Password reset not available.",
        400,
        "SOCIAL_LOGIN_USER",
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(data.password);

    // Update user password
    await this.prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    // Mark token used
    await this.prisma.passwordResetToken.update({
      where: { token: data.token },
      data: { usedAt: new Date() },
    });

    return {
      status: "success",
      message:
        "Password reset successful. Please login with your new password.",
      data: {
        email: resetToken.user.email,
      },
    };
  };

  verifyEmail = async (data: VerifyEmailDTO) => {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: { profile: true },
    });

    if (!user) {
      throw new ApiError(
        "Verification code expired or invalid",
        400,
        "VERIFICATION_FAILED",
      );
    }

    if (user.isEmailVerified) {
      throw new ApiError("Email already verified", 400, "ALREADY_VERIFIED");
    }

    // Find verification token
    const verifyToken = await this.prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        token: data.verificationCode,
      },
    });

    if (!verifyToken || verifyToken.usedAt) {
      throw new ApiError(
        "Verification code expired or invalid",
        400,
        "VERIFICATION_FAILED",
      );
    }

    // Check if token expired
    if (verifyToken.expiresAt < new Date()) {
      throw new ApiError(
        "Verification code expired or invalid",
        400,
        "VERIFICATION_FAILED",
      );
    }

    // Hash password and verify email
    const passwordHash = await hashPassword(data.password);
    await this.prisma.user.update({
      where: { id: verifyToken.userId },
      data: { isEmailVerified: true, passwordHash },
    });

    // Mark token used
    await this.prisma.emailVerificationToken.update({
      where: { token: verifyToken.token },
      data: { usedAt: new Date() },
    });

    // Send welcome email
    const dashboardLink = `${FE_URL}/dashboard`;
    await this.mailService.sendWelcomeEmail(
      user.email || "",
      user.profile?.fullName || "User",
      dashboardLink,
    );

    return {
      status: "success",
      message: "Email verified successfully. Please login.",
      data: {
        id: user.id,
        email: user.email,
        verified: true,
      },
    };
  };

  resendVerificationEmail = async (data: ResendVerificationDTO) => {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: { profile: true },
    });

    if (!user) {
      throw new ApiError("Email not found", 404, "EMAIL_NOT_FOUND");
    }

    if (user.isEmailVerified) {
      throw new ApiError("Email already verified", 400, "ALREADY_VERIFIED");
    }

    // Generate new verification token
    const token = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 3600000);

    // Delete old tokens
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });

    // Create new verification token
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Send verification email
    const verifyLink = `${FE_URL}/verify-email?email=${encodeURIComponent(
      user.email || "",
    )}`;
    await this.mailService.sendVerificationEmail(
      data.email,
      user.profile?.fullName || "User",
      verifyLink,
      token,
    );

    return {
      status: "success",
      message: "Verification email sent",
      data: {
        email: data.email,
        expiresAt,
      },
    };
  };

  googleLogin = async (data: GoogleLoginDTO) => {
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

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      {
        expiresIn: "2h",
      },
    );

    return this.buildAuthResponse(user, token);
  };

  googleSignup = async (data: GoogleLoginDTO) => {
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

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      {
        expiresIn: "2h",
      },
    );

    return {
      status: "success",
      message: "Account created successfully",
      data: this.buildAuthData(user, token),
    };
  };

  logout = async () => {
    return {
      status: "success",
      message: "Logged out successfully",
    };
  };
}
