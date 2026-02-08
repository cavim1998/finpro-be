import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class CreatePickupRequestDTO {
  @IsNotEmpty()
  @IsInt()
  addressId!: number;

  @IsNotEmpty()
  @IsDateString()
  scheduledPickupAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
