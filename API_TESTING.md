# API Testing Documentation

## Base URL

```
http://localhost:8000
```

## Authentication Flow Testing

### 1. Register User

**Endpoint:** `POST /auth/register`

**Test Case 1: Successful Registration**

```bash
# With photo
curl -X POST http://localhost:8000/auth/register \
  -F "email=test@example.com" \
  -F "password=password123" \
  -F "fullName=John Doe" \
  -F "profileImage=@/path/to/photo.jpg"
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "data": {
    "id": "user-id",
    "email": "test@example.com",
    "role": "CUSTOMER",
    "status": "ACTIVE",
    "isEmailVerified": false,
    "profile": {
      "fullName": "John Doe",
      "photoUrl": "https://cloudinary.com/..."
    }
  }
}
```

**Expected:** Email verifikasi terkirim, expire dalam **1 jam**.

**Test Case 2: Duplicate Email**

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "fullName": "Jane Doe"
  }'
```

**Expected Response:** `400 - Email already registered`

**Test Case 3: Invalid File Type**

```bash
curl -X POST http://localhost:8000/auth/register \
  -F "email=test2@example.com" \
  -F "password=password123" \
  -F "fullName=John Doe" \
  -F "profileImage=@/path/to/document.pdf"
```

**Expected Response:** `400 - Invalid file type. Only .jpg, .jpeg, .png, and .gif are allowed`

**Test Case 4: File Size Exceeds 1MB**

```bash
curl -X POST http://localhost:8000/auth/register \
  -F "email=test3@example.com" \
  -F "password=password123" \
  -F "fullName=John Doe" \
  -F "profileImage=@/path/to/large-image.jpg"
```

**Expected Response:** `400 - File too large`

---

### 2. Verify Email

**Endpoint:** `POST /auth/verify-email`

**Test Case 1: Valid Token**

```bash
curl -X POST http://localhost:8000/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "token": "valid-token-from-email"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

**Expected:**

- User `isEmailVerified` = true
- Welcome email terkirim otomatis 🎉

**Test Case 2: Invalid Token**

```bash
curl -X POST http://localhost:8000/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "token": "invalid-token"
  }'
```

**Expected Response:** `400 - Invalid verification token`

**Test Case 3: Expired Token (after 1 hour)**

```bash
curl -X POST http://localhost:8000/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "token": "expired-token"
  }'
```

**Expected Response:** `400 - Verification token expired`

---

### 3. Resend Verification Email

**Endpoint:** `POST /auth/resend-verification`

**Test Case 1: Valid Email**

```bash
curl -X POST http://localhost:8000/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Verification email sent"
}
```

**Expected:** New token generated, expire dalam **1 jam**.

**Test Case 2: Already Verified**

```bash
curl -X POST http://localhost:8000/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{
    "email": "verified@example.com"
  }'
```

**Expected Response:** `400 - Email already verified`

---

### 4. Login

**Endpoint:** `POST /auth/login`

**Test Case 1: Successful Login (Verified User)**

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "id": "user-id",
    "email": "test@example.com",
    "role": "CUSTOMER",
    "isEmailVerified": true,
    "profile": {...}
  },
  "token": "jwt-token"
}
```

**Test Case 2: Login Without Verification**

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "unverified@example.com",
    "password": "password123"
  }'
```

**Expected Response:** `400 - Email not verified. Please verify your email to login.`

**Test Case 3: Wrong Password**

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "wrongpassword"
  }'
```

**Expected Response:** `400 - Invalid email or password`

---

### 5. Forgot Password

**Endpoint:** `POST /auth/forgot-password`

**Test Case 1: Valid Email**

```bash
curl -X POST http://localhost:8000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Reset link sent to your email"
}
```

**Expected:** Reset token expire dalam **1 jam**.

**Test Case 2: Email Not Found**

```bash
curl -X POST http://localhost:8000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "notfound@example.com"
  }'
```

**Expected Response:** `400 - Email not found`

---

### 6. Reset Password

**Endpoint:** `POST /auth/reset-password`

**Test Case 1: Valid Token**

```bash
curl -X POST http://localhost:8000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "valid-reset-token",
    "newPassword": "newpassword123"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Password reset successful"
}
```

**Test Case 2: Invalid/Expired Token**

```bash
curl -X POST http://localhost:8000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "invalid-token",
    "newPassword": "newpassword123"
  }'
```

**Expected Response:** `400 - Invalid reset token` or `400 - Reset token expired`

---

## User Profile Testing

### 7. Get Profile

**Endpoint:** `GET /users/profile/me`

**Test Case 1: Get Own Profile**

```bash
curl -X GET http://localhost:8000/users/profile/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "test@example.com",
    "role": "CUSTOMER",
    "isEmailVerified": true,
    "profile": {
      "fullName": "John Doe",
      "phoneNumber": "08123456789",
      "photoUrl": "https://..."
    }
  }
}
```

**Test Case 2: Without Token**

```bash
curl -X GET http://localhost:8000/users/profile/me
```

**Expected Response:** `401 - No token provided`

---

### 8. Update Profile

**Endpoint:** `PUT /users/profile/me`

**Test Case 1: Update Profile with New Photo**

```bash
curl -X PUT http://localhost:8000/users/profile/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "fullName=John Doe Updated" \
  -F "phoneNumber=08987654321" \
  -F "photo=@/path/to/new-photo.jpg"
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "test@example.com",
    "profile": {
      "fullName": "John Doe Updated",
      "phoneNumber": "08987654321",
      "photoUrl": "https://new-cloudinary-url..."
    }
  }
}
```

**Expected:** Old photo deleted from Cloudinary, new photo uploaded.

**Test Case 2: Update Without Photo**

```bash
curl -X PUT http://localhost:8000/users/profile/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe v2",
    "phoneNumber": "08111222333"
  }'
```

**Expected:** Photo tidak berubah, data lain updated.

**Test Case 3: Invalid Photo Extension**

```bash
curl -X PUT http://localhost:8000/users/profile/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "fullName=John Doe" \
  -F "photo=@/path/to/file.txt"
```

**Expected Response:** `400 - Invalid file type. Only .jpg, .jpeg, .png, and .gif are allowed`

**Test Case 4: Photo Size > 1MB**

```bash
curl -X PUT http://localhost:8000/users/profile/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "fullName=John Doe" \
  -F "photo=@/path/to/large-photo.jpg"
```

**Expected Response:** `400 - File too large`

---

### 9. Change Password

**Endpoint:** `PUT /users/profile/change-password`

**Test Case 1: Valid Current Password**

```bash
curl -X PUT http://localhost:8000/users/profile/change-password \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "password123",
    "newPassword": "newpassword123"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Test Case 2: Wrong Current Password**

```bash
curl -X PUT http://localhost:8000/users/profile/change-password \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "wrongpassword",
    "newPassword": "newpassword123"
  }'
```

**Expected Response:** `400 - Current password is incorrect`

**Test Case 3: New Password Too Short**

```bash
curl -X PUT http://localhost:8000/users/profile/change-password \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "password123",
    "newPassword": "123"
  }'
```

**Expected Response:** `400 - Validation error: newPassword must be at least 6 characters`

---

### 10. Update Email

**Endpoint:** `PUT /users/profile/update-email`

**Test Case 1: Valid New Email**

```bash
curl -X PUT http://localhost:8000/users/profile/update-email \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newEmail": "newemail@example.com"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Email updated. Please verify your new email address."
}
```

**Expected:**

- Email updated ke `newemail@example.com`
- `isEmailVerified` = false
- Verification email terkirim ke email baru
- Token expire dalam **1 jam**

**Test Case 2: Email Already in Use**

```bash
curl -X PUT http://localhost:8000/users/profile/update-email \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newEmail": "existing@example.com"
  }'
```

**Expected Response:** `400 - Email already in use`

---

### 11. Request Email Verification

**Endpoint:** `POST /users/profile/request-verification`

**Test Case 1: Request for Unverified Email**

```bash
curl -X POST http://localhost:8000/users/profile/request-verification \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Verification email sent"
}
```

**Expected:** New token generated, expire dalam **1 jam**.

**Test Case 2: Email Already Verified**

```bash
curl -X POST http://localhost:8000/users/profile/request-verification \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:** `400 - Email is already verified`

---

## Guard/Middleware Testing

### 12. Protected Routes (Require Authentication)

**Test Case 1: Access Protected Route Without Token**

```bash
curl -X GET http://localhost:8000/users/profile/me
```

**Expected Response:** `401 - No token provided`

**Test Case 2: Access Protected Route With Invalid Token**

```bash
curl -X GET http://localhost:8000/users/profile/me \
  -H "Authorization: Bearer invalid-token"
```

**Expected Response:** `401 - Invalid token / token expired`

**Test Case 3: Access Protected Route With Valid Token**

```bash
curl -X GET http://localhost:8000/users/profile/me \
  -H "Authorization: Bearer VALID_JWT_TOKEN"
```

**Expected Response:** `200 - Profile data returned`

---

## Frontend Integration Testing

### User Flow 1: Registration → Verification → Login

1. ✅ Register user baru
2. ✅ Check email, dapat verification link (expire 1 jam)
3. ✅ Klik link verifikasi
4. ✅ Email verified + welcome email terkirim
5. ✅ Login berhasil
6. ✅ Access protected routes

### User Flow 2: Update Email → Re-verification

1. ✅ Login sebagai verified user
2. ✅ Update email
3. ✅ Email berubah, `isEmailVerified` = false
4. ✅ User tidak bisa akses fitur yang butuh verified email
5. ✅ Request verification
6. ✅ Verify email baru
7. ✅ `isEmailVerified` = true lagi

### User Flow 3: Forgot Password → Reset

1. ✅ Request reset password
2. ✅ Check email, dapat reset link (expire 1 jam)
3. ✅ Klik link reset
4. ✅ Input new password
5. ✅ Password berhasil direset
6. ✅ Login dengan password baru

### User Flow 4: Upload Profile Photo

1. ✅ Upload foto dengan extension valid (.jpg, .jpeg, .png, .gif)
2. ✅ Ukuran max 1MB
3. ✅ Foto lama dihapus dari Cloudinary
4. ✅ Foto baru diupload

---

## Summary Checklist

### ✅ Fitur Selesai:

- [x] Batas verifikasi email: **1 jam** (bukan 24 jam)
- [x] Upload foto validasi: extension (.jpg, .jpeg, .png, .gif) & max **1MB**
- [x] Get profile
- [x] Update profile (name, phone, photo)
- [x] Change password
- [x] Update email (wajib re-verifikasi)
- [x] Request email verification (untuk yang belum verified)
- [x] Middleware guard (verifyToken)
- [x] Welcome email otomatis setelah verifikasi

### 🔧 Frontend Tasks (not backend):

- [ ] Disable fitur untuk user belum verified
- [ ] Show notifikasi "Please verify your email"
- [ ] Redirect ke homepage jika akses halaman terlarang
- [ ] Handle "user belum verified tidak bisa order"

---

## Notes:

1. Semua token (verification & reset password) expire dalam **1 jam**
2. Foto profile max **1MB** dan hanya `.jpg, .jpeg, .png, .gif`
3. Update email otomatis set `isEmailVerified` = false dan kirim verification email
4. Welcome email otomatis terkirim setelah email verification sukses
5. Old photo dihapus dari Cloudinary saat upload photo baru
