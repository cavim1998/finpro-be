import { PartialType } from "@nestjs/mapped-types";
import {
  IsString,
  IsOptional,
  IsNumber,
  IsLatitude,
  IsLongitude,
} from "class-validator";
import { Type } from "class-transformer";

export class UpdateOutletDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  addressText?: string;

  @IsOptional()
  @IsNumber()
  @IsLatitude()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @IsLongitude()
  @Type(() => Number)
  longitude?: number;
}
