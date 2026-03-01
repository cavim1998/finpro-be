import { ApiError } from "../../utils/api-error.js";
import {
  FE_URL,
  MIDTRANS_IS_PRODUCTION,
  MIDTRANS_SERVER_KEY,
} from "../../config/env.js";
import {
  MidtransItemDetail,
  MidtransSnapResponse,
  OrderForPayment,
} from "./payment.types.js";

export class PaymentMidtransService {
  private getMidtransBaseUrl() {
    return MIDTRANS_IS_PRODUCTION
      ? "https://app.midtrans.com"
      : "https://app.sandbox.midtrans.com";
  }

  buildGatewayRef(orderNo: string, attempts: number) {
    return attempts > 1 ? `${orderNo}-${attempts}` : orderNo;
  }

  private buildCustomerDetails(order: OrderForPayment) {
    return {
      first_name: order.customer.profile?.fullName || "Customer",
      email: order.customer.email || undefined,
      phone: order.customer.profile?.phone || undefined,
    };
  }

  private buildCallbacks(orderId: string) {
    return {
      finish: `${FE_URL}/payments/finish?orderId=${orderId}`,
    };
  }

  private buildBaseItemDetails(order: OrderForPayment): MidtransItemDetail[] {
    return order.items.map((orderItem) => ({
      id: String(orderItem.itemId),
      name: orderItem.item.name,
      quantity: Math.max(1, orderItem.qty),
      price: Math.max(1, Math.round(Number(orderItem.item.price))),
    }));
  }

  private appendPremiumFeeItem(
    itemDetails: MidtransItemDetail[],
    order: OrderForPayment,
  ) {
    const premiumFee =
      Number(order.totalAmount) -
      Number(order.subtotalAmount) -
      Number(order.deliveryFee);

    if (premiumFee <= 0) {
      return;
    }

    itemDetails.push({
      id: "PREMIUM_FEE",
      name: "Premium Service Fee",
      quantity: 1,
      price: Math.max(1, Math.round(premiumFee)),
    });
  }

  private appendDeliveryFeeItem(
    itemDetails: MidtransItemDetail[],
    order: OrderForPayment,
  ) {
    if (Number(order.deliveryFee) <= 0) {
      return;
    }

    itemDetails.push({
      id: "DELIVERY_FEE",
      name: "Delivery Fee",
      quantity: 1,
      price: Math.max(1, Math.round(Number(order.deliveryFee))),
    });
  }

  buildItemDetails(order: OrderForPayment) {
    const itemDetails = this.buildBaseItemDetails(order);
    this.appendPremiumFeeItem(itemDetails, order);
    this.appendDeliveryFeeItem(itemDetails, order);
    return itemDetails;
  }

  calculateGrossAmount(itemDetails: MidtransItemDetail[]) {
    return itemDetails.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
  }

  buildPayload(
    order: OrderForPayment,
    gatewayRef: string,
    grossAmount: number,
    itemDetails: MidtransItemDetail[],
  ) {
    return {
      transaction_details: {
        order_id: gatewayRef,
        gross_amount: grossAmount,
      },
      customer_details: this.buildCustomerDetails(order),
      item_details: itemDetails,
      credit_card: { secure: true },
      custom_field1: order.id,
      custom_field2: String(order.customerId),
      callbacks: this.buildCallbacks(order.id),
    };
  }

  private buildSnapRequestInit(payload: unknown) {
    const auth = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString("base64");

    return {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    };
  }

  private async throwSnapError(response: Response) {
    const errorText = await response.text();
    throw new ApiError("Gagal membuat transaksi Midtrans", 502, "MIDTRANS", {
      status: response.status,
      body: errorText,
    });
  }

  async createSnap(payload: unknown) {
    const url = `${this.getMidtransBaseUrl()}/snap/v1/transactions`;
    const response = await fetch(url, this.buildSnapRequestInit(payload));

    if (!response.ok) {
      await this.throwSnapError(response);
    }

    return (await response.json()) as MidtransSnapResponse;
  }
}
