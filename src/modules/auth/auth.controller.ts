import { Request, Response } from "express";
import { AuthService } from "./auth.service.js";

export class AuthController {
  constructor(private authService: AuthService) {}

  register = async (req: Request, res: Response) => {
    const result = await this.authService.register(req.body);
    res.status(201).send(result);
  };

  login = async (req: Request, res: Response) => {
    const result = await this.authService.login(req.body);
    res.status(200).send(result);
  };

  googleLogin = async (req: Request, res: Response) => {
    const result = await this.authService.googleLogin(req.body);
    res.status(200).send(result);
  };

  googleSignup = async (req: Request, res: Response) => {
    const result = await this.authService.googleSignup(req.body);
    res.status(201).send(result);
  };

  logout = async (_req: Request, res: Response) => {
    const result = await this.authService.logout();
    res.status(200).send(result);
  };

  forgotPassword = async (req: Request, res: Response) => {
    const result = await this.authService.forgotPassword(req.body);
    res.status(200).send(result);
  };

  resetPassword = async (req: Request, res: Response) => {
    const result = await this.authService.resetPassword(req.body);
    res.status(200).send(result);
  };

  verifyEmail = async (req: Request, res: Response) => {
    const result = await this.authService.verifyEmail(req.body);
    res.status(200).send(result);
  };

  resendVerificationEmail = async (req: Request, res: Response) => {
    const result = await this.authService.resendVerificationEmail(req.body);
    res.status(200).send(result);
  };
}
