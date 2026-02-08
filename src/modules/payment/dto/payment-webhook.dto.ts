import { IsNotEmpty, IsString } from "class-validator";

export class PaymentWebhookDTO {
  @IsNotEmpty()
  @IsString()
  order_id!: string;

  @IsNotEmpty()
  @IsString()
  transaction_status!: string;

  @IsString()
  transaction_id?: string;

  @IsString()
  gross_amount?: string;

  @IsString()
  signature_key?: string;
}
