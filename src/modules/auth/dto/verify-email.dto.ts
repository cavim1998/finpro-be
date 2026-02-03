import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class VerifyEmailDTO {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  verificationCode!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password!: string;
}
