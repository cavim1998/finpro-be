import multer from "multer";
import { ApiError } from "../utils/api-error.js";

export class UploaderMiddleware {
  upload = () => {
    const storage = multer.memoryStorage();

    const limits = { fileSize: 1 * 1024 * 1024 }; // 1MB

    const fileFilter = (
      req: Express.Request,
      file: Express.Multer.File,
      cb: multer.FileFilterCallback,
    ) => {
      const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif"];
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];

      const ext = file.originalname
        .substring(file.originalname.lastIndexOf("."))
        .toLowerCase();

      if (
        allowedExtensions.includes(ext) &&
        allowedMimeTypes.includes(file.mimetype)
      ) {
        cb(null, true);
      } else {
        cb(
          new ApiError(
            "Invalid file type. Only .jpg, .jpeg, .png, and .gif are allowed",
            400,
          ) as any,
        );
      }
    };

    return multer({ storage, limits, fileFilter });
  };
}
