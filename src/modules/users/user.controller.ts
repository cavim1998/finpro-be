import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../utils/api-error.js";
import { UserService } from "./user.service.js";

export class UserController {
  constructor(private userService: UserService) {}

  getUsers = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const data = await this.userService.getUser(parseInt(authUser.sub, 10));
      res.status(200).send({ status: "success", data });
    } catch (err) {
      next(err);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      if (authUser.sub !== req.params.id) {
        throw new ApiError("Forbidden", 403);
      }

      const data = await this.userService.getUser(parseInt(req.params.id, 10));
      res.status(200).send({ status: "success", data });
    } catch (err) {
      next(err);
    }
  };

  getProfile = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const data = await this.userService.getProfile(
        parseInt(authUser.sub, 10),
      );
      res.status(200).send({ status: "success", data });
    } catch (err) {
      next(err);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const data = await this.userService.updateProfile(
        parseInt(authUser.sub, 10),
        req.body,
      );
      res.status(200).send({
        status: "success",
        message: "Profile updated successfully",
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  uploadProfilePhoto = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const data = await this.userService.updateProfilePhoto(
        parseInt(authUser.sub, 10),
        req.file,
      );
      res.status(200).send({
        status: "success",
        message: "Profile photo uploaded successfully",
        data,
      });
    } catch (err) {
      next(err);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const result = await this.userService.changePassword(
        parseInt(authUser.sub, 10),
        req.body,
      );
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  };

  updateEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const result = await this.userService.updateEmail(
        parseInt(authUser.sub, 10),
        req.body,
      );
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  };

  requestEmailVerification = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const result = await this.userService.requestEmailVerification(
        parseInt(authUser.sub, 10),
      );
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * =========================
   * USER ADDRESS MANAGEMENT
   * =========================
   */

  getAddresses = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const addresses = await this.userService.getAddresses(
        parseInt(authUser.sub, 10),
      );
      res.status(200).send({ status: "success", data: addresses });
    } catch (err) {
      next(err);
    }
  };

  createAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const address = await this.userService.createAddress(
        parseInt(authUser.sub, 10),
        req.body,
      );
      res.status(201).send({
        status: "success",
        message: "Address created successfully",
        data: address,
      });
    } catch (err) {
      next(err);
    }
  };

  updateAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const addressId = parseInt(req.params.id, 10);
      if (isNaN(addressId)) {
        throw new ApiError("Invalid address ID", 400, "INVALID_ADDRESS_ID");
      }

      const address = await this.userService.updateAddress(
        parseInt(authUser.sub, 10),
        addressId,
        req.body,
      );
      res.status(200).send({
        status: "success",
        message: "Address updated successfully",
        data: address,
      });
    } catch (err) {
      next(err);
    }
  };

  deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const addressId = parseInt(req.params.id, 10);
      if (isNaN(addressId)) {
        throw new ApiError("Invalid address ID", 400, "INVALID_ADDRESS_ID");
      }

      const result = await this.userService.deleteAddress(
        parseInt(authUser.sub, 10),
        addressId,
      );
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  };

  setPrimaryAddress = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const addressId = parseInt(_req.params.id, 10);
      if (isNaN(addressId)) {
        throw new ApiError("Invalid address ID", 400, "INVALID_ADDRESS_ID");
      }

      const address = await this.userService.setPrimaryAddress(
        parseInt(authUser.sub, 10),
        addressId,
      );
      res.status(200).send({
        success: true,
        data: address,
      });
    } catch (err) {
      next(err);
    }
  };
}
