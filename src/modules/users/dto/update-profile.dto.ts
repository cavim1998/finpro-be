import { IsNotEmpty, IsString, IsOptional } from "class-validator";

export class UpdateProfileDTO {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
