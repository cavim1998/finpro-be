import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class ResetPasswordDTO {
  @IsNotEmpty()
  @IsString()
  token!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password!: string;
}
