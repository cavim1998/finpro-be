import { IsNotEmpty, IsString } from "class-validator";

export class VerifyEmailDTO {
  @IsNotEmpty()
  @IsString()
  token!: string;
}
