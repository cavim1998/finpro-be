import { Prisma } from "../../../generated/prisma/client.js";

export type OrderForPayment = Prisma.OrderGetPayload<{
  include: {
    payments: true;
    items: { include: { item: true } };
    customer: {
      select: {
        id: true;
        email: true;
        profile: { select: { fullName: true; phone: true } };
      };
    };
  };
}>;

export type MidtransSnapResponse = {
  token: string;
  redirect_url: string;
};

export type MidtransItemDetail = {
  id: string;
  name: string;
  quantity: number;
  price: number;
};

export type WebhookPayload = {
  order_id?: string;
  transaction_status?: string;
  transaction_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
};
