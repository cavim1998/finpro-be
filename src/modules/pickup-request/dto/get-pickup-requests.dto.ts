import { IsEnum, IsOptional } from "class-validator";

export class GetPickupRequestsDTO {
  @IsOptional()
  @IsEnum([
    "WAITING_DRIVER",
    "DRIVER_ASSIGNED",
    "PICKED_UP",
    "ARRIVED_OUTLET",
    "CANCELED",
  ])
  status?: string;
}
