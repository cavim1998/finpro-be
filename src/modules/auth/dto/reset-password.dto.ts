import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class ResetPasswordDTO {
  @IsNotEmpty()
  @IsString()
  token!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
