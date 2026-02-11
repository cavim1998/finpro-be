import { IsUUID } from "class-validator";

export class PickupIdParamDTO {
  @IsUUID()
  pickupId!: string;
}
