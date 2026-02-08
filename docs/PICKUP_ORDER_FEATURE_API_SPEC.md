# Pickup Order Feature - API Specification for Frontend Team

**Version:** 1.0  
**Date:** February 2026  
**Status:** Ready for Frontend Implementation

---

## 📋 Table of Contents

1. [Feature Overview](#feature-overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Data Models & Enums](#data-models--enums)
5. [DTOs & Validation Rules](#dtos--validation-rules)
6. [Business Logic & Rules](#business-logic--rules)
7. [Status Flow Diagrams](#status-flow-diagrams)
8. [Error Handling](#error-handling)
9. [Example Workflows](#example-workflows)
10. [Testing Guide](#testing-guide)

---

## 🎯 Feature Overview

### Purpose

Memungkinkan customer untuk membuat permintaan pickup laundry, melacak order produksi, dan melakukan pembayaran.

### User Journey

```
Customer → Buat Pickup Request → Tunggu Tiba di Outlet → Admin Buat Order
→ Customer Lihat Order Status → Bayar → Tunggu Selesai → Konfirmasi Terima
```

### Key Features

- 📍 **Pencarian Outlet Terdekat**: Sistem otomatis mencari outlet terdekat dalam radius layanan
- 📦 **Order Tracking**: Real-time status order dari penerimaan hingga siap pengiriman
- 💳 **Payment Options**: QRIS
- 🚚 **Pickup Management**: Track pickup request dan status kedatangan ke outlet

---

## 🔐 Authentication

### Requirements

- **Semua endpoint kecuali Auth** memerlukan JWT Bearer token
- Token diperoleh dari Auth module (Login endpoint)
- Token dikirim di header: `Authorization: Bearer <token>`

### Token Structure

```
Header: {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Token Expiry

- Token berlaku sesuai yang dikonfigurasi di auth module
- Respons 401 Unauthorized jika token tidak valid atau expired
- Frontend harus handle token refresh menggunakan refresh token

---

## 🔌 API Endpoints

### Base URL

```
http://localhost:8000
```

---

### 1. PICKUP REQUEST ENDPOINTS

#### **POST /pickup-requests**

Membuat permintaan pickup laundry baru.

**Required Auth:** Yes (Customer)

**Request Body:**

```json
{
  "addressId": 1,
  "scheduledPickupAt": "2026-02-15T14:00:00Z",
  "notes": "Ada barang sensitif, mohon hati-hati"
}
```

**Response (201 Created):**

```json
{
  "status": "success",
  "message": "Pickup request created successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "customerId": 1,
    "outletId": 5,
    "outletName": "Outlet Jakarta Pusat",
    "addressId": 1,
    "pickupLocation": {
      "latitude": -6.2088,
      "longitude": 106.8456
    },
    "outletLocation": {
      "latitude": -6.1944,
      "longitude": 106.8296
    },
    "distanceKm": 2.15,
    "status": "WAITING_DRIVER",
    "scheduledPickupAt": "2026-02-15T14:00:00Z",
    "notes": "Ada barang sensitif, mohon hati-hati",
    "createdAt": "2026-02-07T10:30:00Z"
  }
}
```

**Error Responses (400, 404, 500):**

```json
{
  "status": "error",
  "message": "Outlet tidak tersedia dalam radius 5km dari alamat Anda",
  "code": "OUTLET_NOT_FOUND"
}
```

---

#### **GET /pickup-requests**

Mendapatkan list semua pickup request milik customer.

**Required Auth:** Yes (Customer)

**Query Parameters:**

```
status=WAITING_DRIVER (optional: WAITING_DRIVER, ARRIVED_OUTLET, CANCELED)
```

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Pickup requests retrieved successfully",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "customerId": 1,
      "outletId": 5,
      "outletName": "Outlet Jakarta Pusat",
      "distanceKm": 2.15,
      "status": "WAITING_DRIVER",
      "scheduledPickupAt": "2026-02-15T14:00:00Z",
      "notes": "Ada barang sensitif",
      "createdAt": "2026-02-07T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 10,
    "offset": 0
  }
}
```

---

#### **GET /pickup-requests/:pickupRequestId**

Mendapatkan detail pickup request spesifik.

**Required Auth:** Yes (Customer)

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Pickup request retrieved successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "customerId": 1,
    "outletId": 5,
    "outletName": "Outlet Jakarta Pusat",
    "outletPhone": "+62212345678",
    "outletAddress": "Jl. Merdeka No. 123, Jakarta Pusat",
    "addressId": 1,
    "pickupLocation": {
      "latitude": -6.2088,
      "longitude": 106.8456,
      "address": "Apartemen XYZ, Pondok Indah"
    },
    "outletLocation": {
      "latitude": -6.1944,
      "longitude": 106.8296
    },
    "distanceKm": 2.15,
    "status": "ARRIVED_OUTLET",
    "scheduledPickupAt": "2026-02-15T14:00:00Z",
    "arrivedAt": "2026-02-15T14:15:00Z",
    "notes": "Ada barang sensitif",
    "createdAt": "2026-02-07T10:30:00Z",
    "updatedAt": "2026-02-15T14:15:00Z"
  }
}
```

---

#### **PATCH /pickup-requests/:pickupRequestId/arrived**

Konfirmasi bahwa pickup sudah tiba di outlet (dipanggil oleh Outlet Staff).

**Required Auth:** Yes (Outlet Staff)

**Request Body:**

```json
{}
```

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Pickup request marked as arrived",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "ARRIVED_OUTLET",
    "arrivedAt": "2026-02-15T14:15:00Z"
  }
}
```

---

#### **PATCH /pickup-requests/:pickupRequestId/cancel**

Customer membatalkan pickup request (hanya saat masih menunggu driver).

**Required Auth:** Yes (Customer)

**Request Body:**

```json
{}
```

**Rules:**

- Hanya bisa cancel jika status masih `WAITING_DRIVER`
- Jika sudah `DRIVER_ASSIGNED` atau lebih lanjut, cancel ditolak

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Pickup request cancelled",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "CANCELED",
    "cancelledAt": "2026-02-15T12:00:00Z"
  }
}
```

**Error Response (400):**

```json
{
  "status": "error",
  "message": "Pickup request tidak bisa dibatalkan. Status saat ini: DRIVER_ASSIGNED",
  "code": "INVALID_PICKUP_STATUS"
}
```

---

#### **GET /pickup-requests/arrived/outlet**

Mendapatkan list pickup requests yang sudah tiba di outlet (untuk Outlet Staff).

**Required Auth:** Yes (Outlet Staff)

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Arrived pickup requests retrieved successfully",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "customerId": 1,
      "customerName": "John Doe",
      "customerPhone": "+6282123456789",
      "status": "ARRIVED_OUTLET",
      "scheduledPickupAt": "2026-02-15T14:00:00Z",
      "arrivedAt": "2026-02-15T14:15:00Z",
      "notes": "Ada barang sensitif",
      "createdAt": "2026-02-07T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 10,
    "offset": 0
  }
}
```

---

### 2. ORDER ENDPOINTS

#### **POST /orders**

Membuat order dari pickup request yang sudah arrived. Hanya bisa dilakukan oleh Outlet Admin.

**Required Auth:** Yes (Outlet Admin)

**Request Body:**

```json
{
  "pickupRequestId": "550e8400-e29b-41d4-a716-446655440000",
  "totalWeightKg": 5.5,
  "deliveryFee": 25000,
  "items": [
    {
      "itemId": 1,
      "quantity": 3
    },
    {
      "itemId": 2,
      "quantity": 2
    }
  ]
}
```

**Field Descriptions:**

- `pickupRequestId`: ID dari pickup request yang status-nya ARRIVED_OUTLET
- `totalWeightKg`: Total berat laundry dalam kg (decimal, max 2 decimal places)
- `deliveryFee`: Biaya pengiriman dalam Rupiah (decimal)
- `items`: Array berisi laundry items dan jumlahnya
  - `itemId`: ID dari laundry item (tipe: int)
  - `quantity`: Jumlah item (tipe: int, min: 1)

**Response (201 Created):**

```json
{
  "status": "success",
  "message": "Order created successfully",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "orderNumber": "INV-20260207-00001",
    "customerId": 1,
    "customerName": "John Doe",
    "outletId": 5,
    "outletName": "Outlet Jakarta Pusat",
    "status": "ARRIVED_AT_OUTLET",
    "totalWeight": 5.5,
    "itemsCount": 5,
    "items": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "name": "Kaos",
        "quantity": 3,
        "unitPrice": 15000,
        "subtotal": 45000
      },
      {
        "id": "770e8400-e29b-41d4-a716-446655440003",
        "name": "Celana Panjang",
        "quantity": 2,
        "unitPrice": 25000,
        "subtotal": 50000
      }
    ],
    "subtotal": 95000,
    "deliveryFee": 25000,
    "totalAmount": 120000,
    "stations": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440004",
        "stationName": "Washing",
        "status": "PENDING",
        "order": 1
      },
      {
        "id": "880e8400-e29b-41d4-a716-446655440005",
        "stationName": "Ironing",
        "status": "PENDING",
        "order": 2
      },
      {
        "id": "880e8400-e29b-41d4-a716-446655440006",
        "stationName": "Packing",
        "status": "PENDING",
        "order": 3
      }
    ],
    "createdAt": "2026-02-07T10:45:00Z"
  }
}
```

---

#### **GET /orders**

Mendapatkan list orders (untuk customer atau outlet staff).

**Required Auth:** Yes

**Query Parameters:**

```
status=ARRIVED_AT_OUTLET (optional: WAITING_DRIVER_PICKUP, ON_THE_WAY_TO_OUTLET, ARRIVED_AT_OUTLET, WASHING, IRONING, PACKING, WAITING_PAYMENT, READY_TO_DELIVER, DELIVERING_TO_CUSTOMER, RECEIVED_BY_CUSTOMER, CANCELED)
fromDate=2026-02-01T00:00:00Z (optional: ISO format)
toDate=2026-02-28T23:59:59Z (optional: ISO format)
search=INV-20260207 (optional: search by order number)
page=1 (optional: default 1)
limit=10 (optional: default 10)
```

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Orders retrieved successfully",
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "orderNumber": "INV-20260207-00001",
      "customerId": 1,
      "customerName": "John Doe",
      "outletId": 5,
      "outletName": "Outlet Jakarta Pusat",
      "status": "WAITING_PAYMENT",
      "totalWeight": 5.5,
      "itemsCount": 5,
      "subtotal": 95000,
      "deliveryFee": 25000,
      "totalAmount": 120000,
      "createdAt": "2026-02-07T10:45:00Z"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 10,
    "totalPages": 2
  }
}
```

---

#### **GET /orders/:orderId**

Mendapatkan detail order lengkap.

**Required Auth:** Yes

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Order retrieved successfully",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "orderNumber": "INV-20260207-00001",
    "customerId": 1,
    "customerName": "John Doe",
    "customerPhone": "+6282123456789",
    "customerEmail": "john@example.com",
    "outletId": 5,
    "outletName": "Outlet Jakarta Pusat",
    "outletPhone": "+62212345678",
    "outletAddress": "Jl. Merdeka No. 123, Jakarta Pusat",
    "status": "WASHING",
    "totalWeight": 5.5,
    "itemsCount": 5,
    "items": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "name": "Kaos",
        "quantity": 3,
        "unitPrice": 15000,
        "subtotal": 45000
      },
      {
        "id": "770e8400-e29b-41d4-a716-446655440003",
        "name": "Celana Panjang",
        "quantity": 2,
        "unitPrice": 25000,
        "subtotal": 50000
      }
    ],
    "subtotal": 95000,
    "deliveryFee": 25000,
    "totalAmount": 120000,
    "stations": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440004",
        "stationName": "Washing",
        "status": "IN_PROGRESS",
        "order": 1,
        "startedAt": "2026-02-07T11:00:00Z"
      },
      {
        "id": "880e8400-e29b-41d4-a716-446655440005",
        "stationName": "Ironing",
        "status": "PENDING",
        "order": 2
      },
      {
        "id": "880e8400-e29b-41d4-a716-446655440006",
        "stationName": "Packing",
        "status": "PENDING",
        "order": 3
      }
    ],
    "createdAt": "2026-02-07T10:45:00Z",
    "updatedAt": "2026-02-07T11:00:00Z"
  }
}
```

---

#### **PATCH /orders/:orderId/confirm-receipt**

Customer konfirmasi telah menerima laundry (ubah status ke RECEIVED_BY_CUSTOMER).

**Required Auth:** Yes (Customer yang membuat order)

**Request Body:**

```json
{}
```

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Order receipt confirmed",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "status": "RECEIVED_BY_CUSTOMER",
    "receivedConfirmedAt": "2026-02-10T16:30:00Z"
  }
}
```

---

### 3. PAYMENT ENDPOINTS

#### **POST /payments**

Membuat payment request untuk order.

**Required Auth:** Yes (Customer)

**Request Body:**

```json
{
  "orderId": "660e8400-e29b-41d4-a716-446655440001",
  "provider": "qris"
}
```

**Provider Options:**

- `qris` - QRIS payment method

**Response (201 Created):**

```json
{
  "status": "success",
  "message": "Payment created successfully",
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440007",
    "orderId": "660e8400-e29b-41d4-a716-446655440001",
    "orderNumber": "INV-20260207-00001",
    "amount": 120000,
    "currency": "IDR",
    "provider": "qris",
    "status": "PENDING",
    "snapToken": "802fee257def5a4f06e82d00831b5a2c",
    "redirectUrl": "https://app.qris.com/payment/802fee257def5a4f06e82d00831b5a2c",
    "externalId": "PAY-20260207-00001",
    "createdAt": "2026-02-07T14:00:00Z",
    "expiresAt": "2026-02-07T14:30:00Z"
  }
}
```

**Frontend Integration untuk QRIS:**

```javascript
// 1. Ambil snapToken / redirectUrl dari response
const { snapToken, redirectUrl } = paymentResponse.data;

// 2. Render QR code menggunakan redirectUrl
// Contoh: pakai library QR code di frontend
renderQrCode(redirectUrl);

// 3. Polling status payment atau refresh order setelah callback webhook
```

**Error Response (400):**

```json
{
  "status": "error",
  "message": "Order status tidak bisa dibayar. Status saat ini: RECEIVED_BY_CUSTOMER",
  "code": "INVALID_ORDER_STATUS"
}
```

---

#### **POST /payments/:paymentId/upload-proof**

Upload bukti pembayaran (foto QRIS atau transfer).

**Required Auth:** Yes (Customer)

**Request Body:**

```
Form-data:
- Key: "proof" (type: File)
- Value: Image file (.jpg, .jpeg, .png, .gif, max 1MB)
```

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Bukti pembayaran berhasil diupload",
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440007",
    "orderId": "660e8400-e29b-41d4-a716-446655440001",
    "amount": 120000,
    "provider": "qris",
    "status": "PAID",
    "proofUrl": "https://res.cloudinary.com/..../payment_proof_123.jpg",
    "paidAt": "2026-02-09T10:30:00Z",
    "createdAt": "2026-02-07T14:00:00Z"
  }
}
```

**Error Response (400):**

```json
{
  "status": "error",
  "message": "File bukti pembayaran tidak diterima",
  "code": "INVALID_FILE"
}
```

**Error Response (403):**

```json
{
  "status": "error",
  "message": "Unauthorized",
  "code": "FORBIDDEN"
}
```

---

#### **GET /payments/:paymentId**

Mendapatkan detail payment.

**Required Auth:** Yes

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Payment retrieved successfully",
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440007",
    "orderId": "660e8400-e29b-41d4-a716-446655440001",
    "orderNumber": "INV-20260207-00001",
    "amount": 120000,
    "currency": "IDR",
    "provider": "qris",
    "status": "PAID",
    "snapToken": "802fee257def5a4f06e82d00831b5a2c",
    "externalId": "PAY-20260207-00001",
    "transactionId": "20260207-1400-123456",
    "paidAt": "2026-02-07T14:15:00Z",
    "createdAt": "2026-02-07T14:00:00Z"
  }
}
```

---

#### **GET /payments**

Mendapatkan list payments milik customer.

**Required Auth:** Yes

**Query Parameters:**

```
status=PAID (optional: PENDING, PAID, FAILED, EXPIRED, REFUNDED)
orderId=660e8400-e29b-41d4-a716-446655440001 (optional)
page=1 (optional)
limit=10 (optional)
```

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Payments retrieved successfully",
  "data": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440007",
      "orderId": "660e8400-e29b-41d4-a716-446655440001",
      "orderNumber": "INV-20260207-00001",
      "amount": 120000,
      "provider": "qris",
      "status": "PAID",
      "paidAt": "2026-02-07T14:15:00Z",
      "createdAt": "2026-02-07T14:00:00Z"
    }
  ],
  "pagination": {
    "total": 8,
    "page": 1,
    "limit": 10
  }
}
```

---

#### **POST /payments/mock-success** _(TESTING ONLY)_

Untuk testing: simulasi pembayaran berhasil tanpa menggunakan payment gateway.

**Required Auth:** Yes

**Request Body:**

```json
{
  "paymentId": "990e8400-e29b-41d4-a716-446655440007"
}
```

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Payment status updated to PAID (mock success)",
  "data": {
    "paymentId": "990e8400-e29b-41d4-a716-446655440007",
    "status": "PAID",
    "transactionId": "MOCK-20260207-123456"
  }
}
```

---

## 📊 Data Models & Enums

### Order Status Enum

```typescript
enum OrderStatus {
  WAITING_DRIVER_PICKUP = "WAITING_DRIVER_PICKUP", // Menunggu driver pickup (initial)
  ON_THE_WAY_TO_OUTLET = "ON_THE_WAY_TO_OUTLET", // Driver dalam perjalanan ke outlet
  ARRIVED_AT_OUTLET = "ARRIVED_AT_OUTLET", // Laundry tiba di outlet
  WASHING = "WASHING", // Sedang dicuci
  IRONING = "IRONING", // Sedang disetrika
  PACKING = "PACKING", // Sedang dikemas
  WAITING_PAYMENT = "WAITING_PAYMENT", // Menunggu pembayaran
  READY_TO_DELIVER = "READY_TO_DELIVER", // Siap dikirim ke customer
  DELIVERING_TO_CUSTOMER = "DELIVERING_TO_CUSTOMER", // Sedang dikirim ke customer
  RECEIVED_BY_CUSTOMER = "RECEIVED_BY_CUSTOMER", // Diterima customer
  CANCELED = "CANCELED", // Dibatalkan
}
```

### Pickup Request Status Enum

```typescript
enum PickupRequestStatus {
  WAITING_DRIVER = "WAITING_DRIVER", // Menunggu driver
  ARRIVED_OUTLET = "ARRIVED_OUTLET", // Sudah tiba di outlet
  CANCELED = "CANCELED", // Dibatalkan
}
```

### Payment Status Enum

```typescript
enum PaymentStatus {
  PENDING = "PENDING", // Menunggu pembayaran
  PAID = "PAID", // Sudah dibayar
  FAILED = "FAILED", // Pembayaran gagal
  EXPIRED = "EXPIRED", // Token/payment expired
  REFUNDED = "REFUNDED", // Pembayaran di-refund
}
```

---

## 📝 DTOs & Validation Rules

### CreatePickupRequestDTO

| Field               | Type         | Required | Validation       | Example                  |
| ------------------- | ------------ | -------- | ---------------- | ------------------------ |
| `addressId`         | integer      | ✅       | Min: 1           | `1`                      |
| `scheduledPickupAt` | ISO DateTime | ✅       | Harus masa depan | `"2026-02-15T14:00:00Z"` |
| `notes`             | string       | ❌       | Max: 500 chars   | `"Ada barang sensitif"`  |

### GetPickupRequestsDTO

| Field    | Type | Required | Validation                                   | Example            |
| -------- | ---- | -------- | -------------------------------------------- | ------------------ |
| `status` | enum | ❌       | WAITING_DRIVER \| ARRIVED_OUTLET \| CANCELED | `"WAITING_DRIVER"` |

### CreateOrderDTO

| Field              | Type    | Required | Validation                | Example                |
| ------------------ | ------- | -------- | ------------------------- | ---------------------- |
| `pickupRequestId`  | UUID    | ✅       | Valid UUID format         | `"550e8400-e29b-41d4"` |
| `totalWeightKg`    | decimal | ✅       | Min: 0.1, Max: 2 decimals | `5.50`                 |
| `deliveryFee`      | decimal | ✅       | Min: 0, Max: 2 decimals   | `25000.00`             |
| `items`            | array   | ✅       | Min 1 item                | `[{...}]`              |
| `items[].itemId`   | integer | ✅       | Min: 1                    | `1`                    |
| `items[].quantity` | integer | ✅       | Min: 1                    | `3`                    |

### CreatePaymentDTO

| Field      | Type | Required | Validation     | Values            |
| ---------- | ---- | -------- | -------------- | ----------------- |
| `orderId`  | UUID | ✅       | Valid UUID     | `"660e8400-e29b"` |
| `provider` | enum | ✅       | See list below | See list below    |

**Provider Enum Values:**

- `qris` - QRIS scan

---

## 🎭 Business Logic & Rules

### Pickup Request Creation

```
Rules:
1. Customer harus terdaftar dan login
2. Customer harus punya minimal 1 default address
3. Sistem otomatis mencari outlet terdekat
4. Outlet harus dalam radius layanan (maksimal 5km)
5. scheduledPickupAt harus masa depan
6. Status awal: WAITING_DRIVER

Response Error:
- 404 jika tidak ada outlet dalam radius
- 400 jika tanggal pickup tidak valid
- 401 jika tidak terautentikasi
```

### Pickup Request Cancellation

```
Rules:
1. Customer hanya bisa cancel saat status masih WAITING_DRIVER
2. Jika sudah DRIVER_ASSIGNED atau lebih lanjut, cancel ditolak
3. Status berubah ke CANCELED

Response Error:
- 400 jika status bukan WAITING_DRIVER
- 401 jika tidak terautentikasi
```

### Order Creation

```
Rules:
1. Pickup request harus status ARRIVED_AT_OUTLET
2. Hanya Outlet Staff/Admin yang bisa buat order
3. totalWeightKg harus > 0
4. Minimal 1 item dengan quantity > 0
5. Laundry items harus exist di database
6. Order awal status: ARRIVED_AT_OUTLET
7. 3 station otomatis dibuat: Washing, Ironing, Packing (status: PENDING)
8. Order number format: INV-YYYYMMDD-XXXXX (auto-generated)

Pricing:
- Subtotal = SUM(item.price * quantity)
- Total = Subtotal + DeliveryFee
- Diskon (jika ada) dikurangi dari total

Response Error:
- 400 jika pickup request status bukan ARRIVED_OUTLET
- 400 jika pickup request tidak exist
- 400 jika ada item yang tidak exist
```

### Order Status Flow

```
Full Journey:
WAITING_DRIVER_PICKUP (created)
  ↓
ON_THE_WAY_TO_OUTLET (driver picked up items)
  ↓
ARRIVED_AT_OUTLET (arrived at outlet/admin create order)
  ↓
WASHING (workers process)
  ↓
IRONING
  ↓
PACKING
  ↓
WAITING_PAYMENT → (Customer bayar)
  ↓
READY_TO_DELIVER (siap dikirim)
  ↓
DELIVERING_TO_CUSTOMER (driver deliver)
  ↓
RECEIVED_BY_CUSTOMER (customer confirm terima)

Validasi Status:
- Hanya bisa bayar di status: ARRIVED_AT_OUTLET, WASHING, IRONING, PACKING, WAITING_PAYMENT
- Hanya customer bisa confirm receipt di status DELIVERING_TO_CUSTOMER
- Confirm receipt ubah status DELIVERING_TO_CUSTOMER → RECEIVED_BY_CUSTOMER
```

### Payment Creation

```
Rules:
1. Order harus exist dan milik customer
2. Order harus status yang bisa dibayar: ARRIVED_AT_OUTLET, WASHING, IRONING, PACKING, WAITING_PAYMENT
3. Belum ada payment dengan status PAID untuk order ini
4. Provider harus valid enum value
5. Payment status awal: PENDING
6. Generate QR token dan redirectUrl untuk QRIS

Untuk QRIS:
- Token/QR berlaku 30 menit
- externalId format: PAY-YYYYMMDD-XXXXX (unique)
```

### Payment Webhook Handling (Backend)

```
Saat payment gateway kirim webhook payment.pdf-success:
1. Backend verifikasi signature & status
2. Update Payment status → PAID
3. Update Order status → READY_TO_DELIVER
4. Buat DriverTask (untuk team driver)
5. Kirim notifikasi ke customer

Frontend tidak perlu handle webhook.
```

---

## 📈 Status Flow Diagrams

### Customer Pickup to Completion Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    PICKUP ORDER FLOW                        │
└─────────────────────────────────────────────────────────────┘

1. CUSTOMER CREATE PICKUP REQUEST
   POST /pickup-requests
   ↓
  Status: WAITING_DRIVER
   ↓ (Kurir pickup)

2. OUTLET STAFF CONFIRM ARRIVED
   PATCH /pickup-requests/:id/arrived
   ↓
   Status: ARRIVED_OUTLET
   ↓ (Admin buat order)

3. OUTLET ADMIN CREATE ORDER
   POST /orders
   ↓
   Status: ARRIVED_AT_OUTLET
   ↓ (Workers process)

4. WORKERS PROCESS LAUNDRY
   3 Stations: Washing → Ironing → Packing
   (Station status: IN_PROGRESS → COMPLETED)
   Order status: WASHING → IRONING → PACKING
   ↓
   Status: PACKING → WAITING_PAYMENT

5. CUSTOMER PAY
   POST /payments
   → Get QR token/redirectUrl
   → Display QR code di frontend
   ↓
   Customer scan & perform payment
   ↓
   POST /payments/:paymentId/upload-proof (upload receiving proof)
   → Upload foto bukti pembayaran ke Cloudinary
   → Backend update Payment.proofUrl + status=PAID
   ↓
   Order Status: READY_TO_DELIVER
   ↓ (Driver pickup)

6. DRIVER PICKUP
   PATCH /driver-tasks/:id/start
   ↓
   Order Status: ON_THE_WAY_TO_OUTLET
   ↓ (Driver dalam perjalanan)

7. DRIVER DELIVER
   PATCH /driver-tasks/:id/complete
   ↓
   Order Status: DELIVERING_TO_CUSTOMER
   ↓ (Delivery in progress)

8. CUSTOMER CONFIRM RECEIPT
   PATCH /orders/:id/confirm-receipt
   ↓
   Order Status: RECEIVED_BY_CUSTOMER

┌──────────────────────┐
│   STATUS DURATION    │
├──────────────────────┤
│ WAITING_DRIVER: 0-24 jam │
│ ARRIVED: 0-1 jam     │
│ PROCESSING: 1-3 hari │
│ PAYMENT: instant     │
│ DELIVERY: 1-2 hari   │
└──────────────────────┘
```

---

## ⚠️ Error Handling

### Standard Error Response Format

```json
{
  "status": "error",
  "message": "Human readable error message",
  "code": "ERROR_CODE",
  "timestamp": "2026-02-07T14:00:00Z",
  "details": {
    "field": "additional error info"
  }
}
```

### Common HTTP Status Codes

| Code | Meaning      | Example                             |
| ---- | ------------ | ----------------------------------- |
| 400  | Bad Request  | Validation error, invalid input     |
| 401  | Unauthorized | Missing/invalid JWT token           |
| 403  | Forbidden    | User tidak punya akses (wrong role) |
| 404  | Not Found    | Resource tidak exist                |
| 409  | Conflict     | Duplicate/conflicting request       |
| 500  | Server Error | Backend error                       |

### Common Error Codes

| Code                     | Message                            | Solution                           |
| ------------------------ | ---------------------------------- | ---------------------------------- |
| `OUTLET_NOT_FOUND`       | Outlet tidak tersedia dalam radius | Ubah alamat atau pilih outlet lain |
| `INVALID_ORDER_STATUS`   | Order status tidak bisa dibayar    | Tunggu order diproses dulu         |
| `DUPLICATE_PAYMENT`      | Payment sudah ada untuk order ini  | Gunakan payment yang sudah dibuat  |
| `INVALID_JWT`            | Token tidak valid atau expired     | Login ulang                        |
| `FORBIDDEN`              | User tidak punya akses             | Cek role/permission                |
| `LAUNDRY_ITEM_NOT_FOUND` | Item laundry tidak exist           | Pilih item yang valid              |

---

## 🧪 Example Workflows

### Complete Flow: Customer Membuat Pickup & Bayar

#### Step 1: Login (dari Auth module)

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}

Response:
{
  "status": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "...",
    "user": {
      "id": 1,
      "email": "john@example.com",
      "role": "CUSTOMER"
    }
  }
}
```

#### Step 2: Create Pickup Request

```bash
POST /pickup-requests
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "addressId": 1,
  "scheduledPickupAt": "2026-02-15T14:00:00Z",
  "notes": "Ada barang sensitif"
}

Response:
{
  "status": "success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "WAITING_DRIVER",
    "outletId": 5,
    "outletName": "Outlet Jakarta Pusat",
    "distanceKm": 2.15,
    "createdAt": "2026-02-07T10:30:00Z"
  }
}
```

#### Step 3: Check Pickup Status (Customer pangkat kurir)

```bash
GET /pickup-requests/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <accessToken>

Response:
{
  "status": "success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "ARRIVED_OUTLET",  // Status berubah setelah kurir pickup
    "arrivedAt": "2026-02-15T14:15:00Z"
  }
}
```

#### Step 4: Get Order (Admin buat order, customer lihat)

```bash
GET /orders?status=ARRIVED_AT_OUTLET
Authorization: Bearer <accessToken>

Response:
{
  "status": "success",
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "orderNumber": "INV-20260207-00001",
      "status": "ARRIVED_AT_OUTLET",
      "totalAmount": 120000
    }
  ]
}
```

#### Step 5: Create Payment

```bash
POST /payments
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "orderId": "660e8400-e29b-41d4-a716-446655440001",
  "provider": "qris"
}

Response:
{
  "status": "success",
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440007",
    "snapToken": "802fee257def5a4f06e82d00831b5a2c",
    "redirectUrl": "https://app.qris.com/payment/802fee257def5a4f06e82d00831b5a2c",
    "amount": 120000,
    "status": "PENDING"
  }
}
```

#### Step 6: Pay with QRIS (Frontend)

```javascript
// Render QR code untuk customer scan
renderQrCode("https://app.qris.com/payment/802fee257def5a4f06e82d00831b5a2c");
```

#### Step 7: Upload Payment Proof (Customer)

```bash
POST /payments/990e8400-e29b-41d4-a716-446655440007/upload-proof
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

Form-data:
- proof: <image file from camera or upload>

Response:
{
  "status": "success",
  "message": "Bukti pembayaran berhasil diupload",
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440007",
    "status": "PAID",
    "proofUrl": "https://res.cloudinary.com/..../payment_proof.jpg",
    "amount": 120000,
    "paidAt": "2026-02-09T10:30:00Z"
  }
}
```

#### Step 8: Check Payment Status

```bash
GET /payments/990e8400-e29b-41d4-a716-446655440007
Authorization: Bearer <accessToken>

Response:
{
  "status": "success",
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440007",
    "status": "PAID",
    "amount": 120000,
    "proofUrl": "https://res.cloudinary.com/..../payment_proof.jpg",
    "paidAt": "2026-02-09T10:30:00Z"
  }
}
```

#### Step 9: Check Order Status (Updated ke READY_TO_DELIVER)

```bash
GET /orders/660e8400-e29b-41d4-a716-446655440001
Authorization: Bearer <accessToken>

Response:
{
  "status": "success",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "status": "READY_TO_DELIVER",  // Status auto-updated setelah upload proof
    "totalAmount": 120000
  }
}
```

#### Step 10: Driver Start Delivery (handled by driver module)

```bash
# Driver module will GET assigned tasks and PATCH /driver-tasks/:taskId/start
# Order status updates: READY_TO_DELIVER → ON_THE_WAY_TO_OUTLET
```

#### Step 11: Check Order Status (In Delivery)

```bash
GET /orders/660e8400-e29b-41d4-a716-446655440001
Authorization: Bearer <accessToken>

Response:
{
  "status": "success",
  "data": {
    "status": "ON_THE_WAY_TO_OUTLET"  // Changed by driver module
  }
}
```

#### Step 12: Driver Complete Delivery (handled by driver module)

```bash
# Driver module PATCH /driver-tasks/:taskId/complete after delivery
# Order status updates: ON_THE_WAY_TO_OUTLET → DELIVERING_TO_CUSTOMER
```

#### Step 12: Confirm Receipt

```bash
PATCH /orders/660e8400-e29b-41d4-a716-446655440001/confirm-receipt
Authorization: Bearer <accessToken>

Response:
{
  "status": "success",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "status": "RECEIVED_BY_CUSTOMER",
    "receivedConfirmedAt": "2026-02-10T16:30:00Z"
    "completedAt": "2026-02-10T16:30:00Z"
  }
}
```

---

### Testing Flow dengan File Upload Payment Proof

```bash
# 1. Create Order (admin)
POST /orders
Authorization: Bearer <admin_token>

# 2. Create Payment
POST /payments
Authorization: Bearer <customer_token>
{
  "orderId": "...",
  "provider": "qris"
}

# 3. Upload Payment Proof (CUSTOMER)
POST /payments/:paymentId/upload-proof
Authorization: Bearer <customer_token>
Content-Type: multipart/form-data

Form-data:
- proof: <image file>

# 4. Check Order Status (should be READY_TO_DELIVER)
GET /orders/660e8400-e29b-41d4-a716-446655440001
Authorization: Bearer <customer_token>
```

---

## 🚀 Testing Guide

### Prerequisites

1. **API Server Running**: `npm run dev` di port 8000
2. **Database**: PostgreSQL dengan schema sudah migrated
3. **API Client**: Postman, Insomnia, atau cURL

### Test Data Setup

#### 1. Create Test User (Customer)

```bash
# Login atau signup user sebagai CUSTOMER
# Pastikan punya address sudah create
```

#### 2. Create Test Address

```bash
# Via existing Address module
POST /users/profile/addresses
{
  "street": "Jl. Test No. 123",
  "district": "Jakarta Pusat",
  "city": "Jakarta",
  "province": "DKI Jakarta",
  "postalCode": "12160",
  "latitude": -6.2088,
  "longitude": 106.8456,
  "isDefault": true
}
```

#### 3. Ensure Outlet Exists

```bash
# Outlet harus exist dan dalam radius 5km dari address
# Contoh: Outlet Jakarta Pusat di -6.1944, 106.8296
# Distance dari address customer: ~2.15 km ✓
```

#### 4. Create Laundry Items (Admin)

```bash
POST /laundry-items
Authorization: Bearer <admin_token>
{
  "name": "Kaos",
  "category": "CLOTHING",
  "basePrice": 15000,
  "description": "Kaos katun"
}
```

### Postman Test Cases

#### Test Case 1: Create Pickup Request

```
Name: [Pickup] Create Pickup Request
Method: POST
URL: http://localhost:8000/pickup-requests
Auth: Bearer <customer_token>

Body (raw JSON):
{
  "addressId": 1,
  "scheduledPickupAt": "2026-02-20T14:00:00Z",
  "notes": "Hati-hati barang sensitif"
}

Expected:
✓ Status 201
✓ data.status = "WAITING_DRIVER"
✓ data.outletId exists
✓ data.distanceKm < 5
```

#### Test Case 2: Get Pickup Details

```
Name: [Pickup] Get Pickup Details
Method: GET
URL: http://localhost:8000/pickup-requests/<pickupId>
Auth: Bearer <customer_token>

Expected:
✓ Status 200
✓ data.status = "WAITING_DRIVER" atau "ARRIVED_OUTLET"
```

#### Test Case 3: Create Order (Outlet Admin)

```
Name: [Order] Create Order
Method: POST
URL: http://localhost:8000/orders
Auth: Bearer <outlet_admin_token>

Body (raw JSON):
{
  "pickupRequestId": "<pickupId>",
  "totalWeightKg": 5.5,
  "deliveryFee": 25000,
  "items": [
    {
      "itemId": 1,
      "quantity": 3
    }
  ]
}

Expected:
✓ Status 201
✓ data.orderNumber starts with "INV-"
✓ data.status = "ARRIVED_AT_OUTLET"
✓ data.stations.length = 3
```

#### Test Case 4: Create Payment

```
Name: [Payment] Create Payment
Method: POST
URL: http://localhost:8000/payments
Auth: Bearer <customer_token>

Body (raw JSON):
{
  "orderId": "<orderId>",
  "provider": "qris"
}

Expected:
✓ Status 201
✓ data.snapToken exists
✓ data.status = "PENDING"
✓ data.expiresAt is 30 min from now
```

#### Test Case 5: Upload Payment Proof

```
Name: [Payment] Upload Payment Proof
Method: POST
URL: http://localhost:8000/payments/<paymentId>/upload-proof
Auth: Bearer <customer_token>
Content-Type: multipart/form-data

Body:
- Key: "proof"
- Value: Image file (.jpg, .png, etc)

Expected:
✓ Status 200
✓ data.status = "PAID"
✓ data.proofUrl contains valid Cloudinary URL
✓ data.paidAt is set to current timestamp
```

#### Test Case 6: Confirm Order Receipt

```
Name: [Order] Confirm Receipt
Method: PATCH
URL: http://localhost:8000/orders/<orderId>/confirm-receipt
Auth: Bearer <customer_token>

Body: {}

Expected:
✓ Status 200
✓ data.status = "RECEIVED_BY_CUSTOMER"
```

---

## 📱 Frontend Integration Checklist

### Pages/Screens to Build

- [ ] **Pickup Request List** - List semua pickup requests customer
  - Status filter (Waiting Driver, Arrived Outlet, Canceled)
  - Card view: order no, status, outlet, created date
  - Action: Create new, View detail, Cancel

- [ ] **Create Pickup Request** - Form input pickup
  - Select address (dropdown atau map)
  - Date/time picker untuk scheduled pickup
  - Notes textarea
  - Validation: outlet harus available

- [ ] **Pickup Request Detail** - View detail 1 pickup
  - Outlet info (name, phone, address, location map)
  - Distance calculation
  - Status timeline: WAITING_DRIVER → ARRIVED_OUTLET
  - Real-time updates (polling atau websocket)

- [ ] **Order List** - List orders customer
  - Status filter/tabs
  - Search by order number
  - Date range filter
  - Cards: order no, status, total amount, dates

- [ ] **Order Detail** - View order lengkap
  - Order info (number, status, dates)
  - Items list dengan quantity & price
  - 3-stage workflow visualization (Washing → Ironing → Packing)
  - Payment info (if paid)
  - Action buttons: Pay (if not paid), Confirm receipt (if delivered)

- [ ] **Payment Flow** - Integrate QRIS
  - Button: "Bayar Sekarang"
  - Render QR code dari `redirectUrl`
  - Handle payment success/failure
  - Update order status setelah payment
  - Payment history list

- [ ] **Admin: Outlet Dashboard** - Untuk outlet staff
  - Widget: Total orders today, pending payment, ready to deliver
  - Arrived pickups list (buat order dari sini)
  - Recent orders dengan status filter

- [ ] **Admin: Create Order** - Form buat order
  - Select pickup request dari arrived list
  - Input weight & delivery fee
  - Select laundry items dengan quantity
  - Auto-calculate total
  - Validation: all required fields filled

### Key Features to Implement

1. **Real-time Status Updates**
   - Polling: GET /orders/:id setiap 10 detik
   - WebSocket (future): untuk live updates

2. **Payment Integration**

- Render QR code dari `redirectUrl`
- QR scan instructions
- Success/error callbacks
- Payment verification

3. **Location/Map**
   - Show outlet location
   - Calculate distance display
   - Map view (optional)

4. **Forms & Validation**
   - Client-side validation
   - Error messages display
   - Loading states
   - Success notifications

5. **Offline Handling**
   - Cache last order status
   - Retry logic for failed requests
   - Graceful error messages

---

## 🔗 Related Modules

- **Auth Module**: Login/register, token management
- **User Module**: User profile, addresses, identities
- **Laundry Item Module**: Item management (price, category)
- **Outlet Module**: Outlet information, staff management
- **Employee Module**: Staff assignment ke outlets
- **Driver Module** (TBD): Pickup & delivery tracking by driver
- **Notification Module** (TBD): Send SMS/email notifications

---

## 📞 Support & Questions

- **Backend Contact**: Dev Team
- **API Base URL**: http://localhost:8000
- **Docs Location**: `/docs`
- **Postman Collection**: Import dari `postman_collection.json`

---

## 📝 Changelog

| Version | Date        | Change                    |
| ------- | ----------- | ------------------------- |
| 1.0     | Feb 7, 2026 | Initial API specification |

---

**Generated for Frontend Team - Use as Development Guide**
