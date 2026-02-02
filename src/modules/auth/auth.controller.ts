import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service.js";

export class AuthController {
  constructor(private authService: AuthService) {}

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.register(req.body);
      res.status(201).send(result);
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.login(req.body);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  googleLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.googleLogin(req.body);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  googleSignup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.googleSignup(req.body);
      res.status(201).send(result);
    } catch (error) {
      next(error);
    }
  };

  logout = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.logout();
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.forgotPassword(req.body);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.resetPassword(req.body);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.verifyEmail(req.body);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  resendVerificationEmail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.authService.resendVerificationEmail(req.body);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };
}
