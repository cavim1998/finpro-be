import { createTransport, Transporter } from "nodemailer";
import { MAIL_PASS, MAIL_USER } from "../../config/env.js";
import { compileTemplate } from "./template.compiler.js";

type TemplateData = {
  verifyLink?: string;
  verificationCode?: string;
  resetLink?: string;
  fullName?: string;
  dashboardLink?: string;
};

export class MailService {
  transporter: Transporter;

  constructor() {
    this.transporter = createTransport({
      service: "gmail",
      auth: {
        user: MAIL_USER,
        pass: MAIL_PASS,
      },
    });
  }

  sendEmail = async (to: string, subject: string, html: string) => {
    await this.transporter.sendMail({
      to,
      subject,
      html,
    });
  };

  sendVerificationEmail = async (
    to: string,
    fullName: string,
    verifyLink: string,
    verificationCode: string,
  ) => {
    const html = compileTemplate("verification-email", {
      fullName,
      verifyLink,
      verificationCode,
    });
    await this.sendEmail(to, "Verify Your Email Address", html);
  };

  sendResetPasswordEmail = async (
    to: string,
    resetLink: string,
    fullName?: string,
  ) => {
    const html = compileTemplate("reset-password-email", {
      resetLink,
      fullName,
    });
    await this.sendEmail(to, "Reset Your Password", html);
  };

  sendWelcomeEmail = async (
    to: string,
    fullName: string,
    dashboardLink: string,
  ) => {
    const html = compileTemplate("welcome-email", {
      fullName,
      dashboardLink,
    });
    await this.sendEmail(to, "Welcome to Our Platform! 🎉", html);
  };
}
