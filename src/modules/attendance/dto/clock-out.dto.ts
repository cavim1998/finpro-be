import { IsOptional, IsString } from "class-validator";

export class ClockOutDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
