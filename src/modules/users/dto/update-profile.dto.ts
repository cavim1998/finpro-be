import { IsNotEmpty, IsString, MinLength, IsOptional } from "class-validator";

export class UpdateProfileDTO {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
