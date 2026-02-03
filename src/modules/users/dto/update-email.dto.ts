import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class UpdateEmailDTO {
  @IsNotEmpty()
  @IsEmail()
  newEmail!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;
}
