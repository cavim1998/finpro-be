import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsLatitude,
  IsLongitude,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateAddressDTO {
  @IsOptional()
  @IsString()
  label?: string; // "Rumah", "Kantor", "Apartemen", "Kos", dll

  @IsOptional()
  @IsString()
  receiverName?: string;

  @IsOptional()
  @IsString()
  receiverPhone?: string;

  @IsString()
  @IsNotEmpty()
  addressText!: string; // Alamat lengkap (required)

  @IsNumber()
  @IsLatitude()
  @Type(() => Number)
  latitude!: number; // Dari map picker (required)

  @IsNumber()
  @IsLongitude()
  @Type(() => Number)
  longitude!: number; // Dari map picker (required)

  @IsOptional()
  isPrimary?: boolean; // Default false
}
