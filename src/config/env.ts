import "dotenv/config";

export const PORT = process.env.PORT;

export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY!;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET!;
export const JWT_SECRET = process.env.JWT_SECRET!;
export const MAIL_USER = process.env.MAIL_USER!;
export const MAIL_PASS = process.env.MAIL_PASS!;
export const FE_URL = process.env.FE_URL || "http://localhost:3000";
