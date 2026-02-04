# Panduan FE: Endpoint Outlet

Dokumen ini menjelaskan cara memanggil API **Outlet** dari sisi Frontend.

## Base URL

- Local dev (default): `http://localhost:8000`
- Gunakan nilai dari ENV `PORT` bila berbeda.

> API outlet tersedia di dua prefix: **/outlet** dan **/outlets**. Keduanya mengarah ke router yang sama.

## Ringkasan Endpoint

| Method | Path         | Deskripsi                   |
| ------ | ------------ | --------------------------- |
| GET    | /outlets     | Ambil semua outlet aktif    |
| GET    | /outlets/:id | Ambil outlet berdasarkan ID |
| POST   | /outlets     | Buat outlet baru            |
| PATCH  | /outlets/:id | Update outlet               |
| DELETE | /outlets/:id | Hapus outlet                |

## Detail Endpoint

### 1) GET /outlets

Mengembalikan daftar outlet aktif. Response menambahkan `staffCount` dari relasi staff.

**Response 200** (contoh):

```json
[
  {
    "id": 1,
    "name": "Outlet Central",
    "addressText": "Jl. Sudirman No. 1",
    "latitude": -6.2001,
    "longitude": 106.8166,
    "serviceRadiusKm": "5.00",
    "isActive": true,
    "createdAt": "2026-02-04T08:00:00.000Z",
    "updatedAt": "2026-02-04T08:00:00.000Z",
    "staffCount": 3
  }
]
```

### 2) GET /outlets/:id

Mengembalikan detail outlet termasuk daftar `staff`.

**Response 200** (contoh):

```json
{
  "id": 1,
  "name": "Outlet Central",
  "addressText": "Jl. Sudirman No. 1",
  "latitude": -6.2001,
  "longitude": 106.8166,
  "serviceRadiusKm": "5.00",
  "isActive": true,
  "createdAt": "2026-02-04T08:00:00.000Z",
  "updatedAt": "2026-02-04T08:00:00.000Z",
  "staff": [
    {
      "id": 10,
      "outletId": 1,
      "userId": "2ed8d0d2-9f1a-4aab-9aa2-2b1fd0a1b1a1",
      "workerStation": "WASHING",
      "isActive": true,
      "createdAt": "2026-02-04T08:00:00.000Z"
    }
  ]
}
```

**Response 404** (contoh):

```json
{
  "error": "Outlet not found"
}
```

### 3) POST /outlets

Membuat outlet baru.

**Request body**

```json
{
  "name": "Outlet Central",
  "addressText": "Jl. Sudirman No. 1",
  "latitude": -6.2001,
  "longitude": 106.8166
}
```

**Validasi**

- `name`: wajib, string
- `addressText`: wajib, string
- `latitude`: opsional, number, latitude valid
- `longitude`: opsional, number, longitude valid

**Response 201** (contoh):

```json
{
  "id": 1,
  "name": "Outlet Central",
  "addressText": "Jl. Sudirman No. 1",
  "latitude": -6.2001,
  "longitude": 106.8166,
  "serviceRadiusKm": "5.00",
  "isActive": true,
  "createdAt": "2026-02-04T08:00:00.000Z",
  "updatedAt": "2026-02-04T08:00:00.000Z"
}
```

**Response 400** (contoh validasi):

```json
{
  "status": "error",
  "message": "name should not be empty, addressText should not be empty",
  "code": null,
  "data": null
}
```

### 4) PATCH /outlets/:id

Update outlet berdasarkan ID.

**Request body** (partial):

```json
{
  "name": "Outlet Central 2",
  "latitude": -6.2002
}
```

**Validasi**

- Semua field opsional, tipe sama seperti create.

**Response 200** (contoh):

```json
{
  "id": 1,
  "name": "Outlet Central 2",
  "addressText": "Jl. Sudirman No. 1",
  "latitude": -6.2002,
  "longitude": 106.8166,
  "serviceRadiusKm": "5.00",
  "isActive": true,
  "createdAt": "2026-02-04T08:00:00.000Z",
  "updatedAt": "2026-02-04T09:00:00.000Z"
}
```

### 5) DELETE /outlets/:id

Menghapus outlet berdasarkan ID.

**Response 200**

```json
{
  "message": "Outlet deleted successfully"
}
```

**Response 400** (jika outlet masih punya staff):

```json
{
  "status": "error",
  "message": "The outlet still has employees",
  "code": null,
  "data": null
}
```

## Contoh pemakaian di FE (fetch)

```ts
const baseUrl = "http://localhost:8000";

// GET all outlets
const outlets = await fetch(`${baseUrl}/outlets`).then((r) => r.json());

// GET outlet by id
const outlet = await fetch(`${baseUrl}/outlets/1`).then((r) => r.json());

// CREATE outlet
const created = await fetch(`${baseUrl}/outlets`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Outlet Central",
    addressText: "Jl. Sudirman No. 1",
    latitude: -6.2001,
    longitude: 106.8166,
  }),
}).then((r) => r.json());

// UPDATE outlet
const updated = await fetch(`${baseUrl}/outlets/1`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Outlet Central 2" }),
}).then((r) => r.json());

// DELETE outlet
await fetch(`${baseUrl}/outlets/1`, { method: "DELETE" });
```
