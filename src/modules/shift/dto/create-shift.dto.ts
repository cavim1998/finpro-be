import { IsString, IsNotEmpty, IsNumber, Matches } from "class-validator";

export class CreateShiftDTO {
  @IsNumber()
  @IsNotEmpty()
  outletId!: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Format jam harus HH:mm",
  })
  startTime!: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Format jam harus HH:mm",
  })
  endTime!: string;
}
