import {
  IsString,
  IsOptional,
  IsNumber,
  IsLatitude,
  IsLongitude,
  IsBoolean,
} from "class-validator";
import { Type } from "class-transformer";

export class UpdateAddressDTO {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  receiverName?: string;

  @IsOptional()
  @IsString()
  receiverPhone?: string;

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

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPrimary?: boolean;
}
