# 🎨 Prompt untuk AI - Membuat Frontend Authentication

## 📋 Overview

Buatkan frontend Next.js 14 (App Router) untuk sistem autentikasi lengkap dengan fitur register, login, email verification, forgot password, dan homepage setelah login.

---

## 🎯 Requirements

### Tech Stack:

- **Framework**: Next.js 14 dengan App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks (useState, useEffect)
- **Routing**: Next.js Navigation (useRouter, useSearchParams)

### Design:

- Modern & Clean UI
- Gradient background: purple to indigo (`from-purple-500 to-indigo-600`)
- Responsive design (mobile-first)
- Loading states untuk semua async operations
- Error handling dengan error messages yang jelas
- Success messages dengan icon checkmark
- Smooth transitions dan hover effects

---

## 📁 Struktur Folder yang Dibutuhkan

```
src/app/
├── page.tsx                                    # Homepage (Protected)
├── signin/
│   └── page.tsx                                # Login page
├── signup/
│   ├── page.tsx                                # Register page
│   ├── check-email/
│   │   └── page.tsx                            # "Check your email" page
│   ├── verify-email/
│   │   └── page.tsx                            # Email verification handler
│   └── resend-verification/
│       └── page.tsx                            # Resend verification email
└── forgot-password/
    ├── page.tsx                                # Forgot password request
    └── reset/
        └── page.tsx                            # Reset password with token
```

---

## 🔗 Backend API Endpoints

**Base URL**: `http://localhost:8000/api/auth`

### 1. Register

- **Endpoint**: `POST /register`
- **Body**: FormData
  - `email` (string, required)
  - `password` (string, required, min 6 chars)
  - `fullName` (string, required)
  - `photo` (file, optional) - upload profile photo
- **Response**:
  ```json
  {
    "success": true,
    "message": "Registration successful. Please verify your email.",
    "data": {
      "id": "user-id",
      "email": "user@example.com",
      "role": "CUSTOMER",
      "profile": {
        "fullName": "John Doe",
        "photoUrl": "https://cloudinary.com/..."
      }
    }
  }
  ```

### 2. Login

- **Endpoint**: `POST /login`
- **Body**: JSON
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "id": "user-id",
      "email": "user@example.com",
      "role": "CUSTOMER",
      "status": "ACTIVE",
      "isEmailVerified": true,
      "profile": {
        "fullName": "John Doe",
        "photoUrl": "https://..."
      }
    },
    "token": "jwt-token-here"
  }
  ```
- **Error jika belum verify**:
  ```json
  {
    "message": "Email not verified. Please verify your email to login."
  }
  ```

### 3. Verify Email

- **Endpoint**: `POST /verify-email`
- **Body**: JSON
  ```json
  {
    "token": "verification-token-from-url"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Email verified successfully"
  }
  ```
- **Note**: Setelah verifikasi berhasil, backend otomatis mengirim **Welcome Email** 🎉

### 4. Resend Verification

- **Endpoint**: `POST /resend-verification`
- **Body**: JSON
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Verification email sent"
  }
  ```

### 5. Forgot Password

- **Endpoint**: `POST /forgot-password`
- **Body**: JSON
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Reset link sent to your email"
  }
  ```

### 6. Reset Password

- **Endpoint**: `POST /reset-password`
- **Body**: JSON
  ```json
  {
    "token": "reset-token-from-url",
    "newPassword": "newpassword123"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Password reset successful"
  }
  ```

---

## 🚀 User Flow Journey

### Flow 1: Register → Verify → Login

```
1. User buka /signup
2. User isi form (email, password, fullName, optional photo)
3. Submit → API call POST /register
4. Redirect ke /signup/check-email
5. User buka email → klik link verifikasi
6. Browser buka /signup/verify-email?token=xxx
7. Auto call API POST /verify-email
8. Success → Welcome email terkirim otomatis 🎉
9. Auto redirect ke /signin (3 detik)
10. User login → redirect ke / (homepage)
```

### Flow 2: Login (belum verify)

```
1. User buka /signin
2. User isi email & password
3. Submit → API call POST /login
4. Error: "Email not verified"
5. Tampilkan link "Resend verification email"
6. User klik link → redirect ke /signup/resend-verification
```

### Flow 3: Forgot Password

```
1. User buka /signin
2. User klik "Forgot password?"
3. Redirect ke /forgot-password
4. User isi email → submit
5. API call POST /forgot-password
6. User buka email → klik link reset
7. Browser buka /forgot-password/reset?token=xxx
8. User isi new password & confirm password
9. Submit → API call POST /reset-password
10. Success → auto redirect ke /signin (3 detik)
```

---

## 📧 Email yang User Terima

### 1. Verification Email (saat register)

- Subject: "Verify Your Email Address"
- Content: Link verifikasi dengan format `{FRONTEND_URL}/signup/verify-email?token={token}`
- Expiry: 24 jam

### 2. Welcome Email (setelah verify) 🎉

- Subject: "Welcome to Our Platform! 🎉"
- Content: Welcome message dengan tombol "Go to Dashboard"
- **Auto terkirim oleh backend setelah verifikasi sukses**

### 3. Reset Password Email

- Subject: "Reset Your Password"
- Content: Link reset dengan format `{FRONTEND_URL}/forgot-password/reset?token={token}`
- Expiry: 1 jam

---

## 📝 Detail Spesifikasi per Halaman

### 1. `/signup` - Register Page

**Components:**

- Form dengan fields:
  - Full Name (text input, required)
  - Email (email input, required)
  - Password (password input, required, min 6 chars)
  - Profile Photo (file input, optional, accept image/\*)
- Submit button dengan loading state
- Link ke "Already have an account? Sign In"

**Logic:**

- Handle file upload dengan FormData
- Show success message setelah register berhasil
- Auto redirect ke `/signup/check-email` setelah 2 detik
- Handle error (email sudah terdaftar, dll)

**UI Elements:**

- Card putih dengan shadow
- Gradient background
- Error alert (red background)
- Success alert (green background)

---

### 2. `/signup/check-email` - Check Email Page

**Components:**

- Icon email besar di tengah
- Heading: "Check Your Email"
- Text: "We've sent a verification link to your email address..."
- Tip box: "If you don't see the email, check your spam folder"
- Button: "Resend Verification Email" → link ke `/signup/resend-verification`
- Button: "Back to Sign In" → link ke `/signin`

**Logic:**

- Static page (no API call)
- Hanya informasi & navigasi

---

### 3. `/signup/verify-email` - Email Verification Handler

**Components:**

- Loading state (spinner + "Verifying Your Email...")
- Success state (checkmark + "Email Verified! 🎉" + redirect countdown)
- Error state (X icon + error message + button resend)

**Logic:**

- Get token dari URL query param: `searchParams.get('token')`
- useEffect → auto call API `POST /verify-email` dengan token
- Jika success: show success message + auto redirect ke `/signin` setelah 3 detik
- Jika error: show error + button ke `/signup/resend-verification`

**Success Message:**

```
"Email verified successfully! You will receive a welcome email shortly."
```

---

### 4. `/signup/resend-verification` - Resend Verification

**Components:**

- Icon email di tengah
- Heading: "Resend Verification"
- Form dengan field email
- Submit button dengan loading state
- Link "Back to Sign In"

**Logic:**

- Submit → API call `POST /resend-verification`
- Show success message: "Verification email sent! Please check your inbox."
- Clear form setelah sukses

---

### 5. `/signin` - Login Page

**Components:**

- Form dengan fields:
  - Email (email input, required)
  - Password (password input, required)
  - Remember me (checkbox, optional)
  - "Forgot password?" link
- Submit button dengan loading state
- Link ke "Don't have an account? Sign Up"

**Logic:**

- Submit → API call `POST /login`
- Jika success:
  - Save token ke `localStorage.setItem('token', data.token)`
  - Save user ke `localStorage.setItem('user', JSON.stringify(data.data))`
  - Redirect ke `/` (homepage)
- Jika error "Email not verified":
  - Show error message
  - Show link: "Didn't receive email? Resend verification" → `/signup/resend-verification`

---

### 6. `/forgot-password` - Forgot Password Request

**Components:**

- Icon key di tengah
- Heading: "Forgot Password?"
- Subheading: "Enter your email and we'll send you reset instructions"
- Form dengan field email
- Submit button dengan loading state
- Link "← Back to Sign In"

**Logic:**

- Submit → API call `POST /forgot-password`
- Show success message: "Email sent! Check your inbox for password reset instructions."
- Clear form setelah sukses

---

### 7. `/forgot-password/reset` - Reset Password

**Components:**

- Icon key di tengah
- Heading: "Reset Password"
- Form dengan fields:
  - New Password (password input, required, min 6 chars)
  - Confirm Password (password input, required)
- Submit button dengan loading state
- Success state (checkmark + "Password Reset!" + redirect countdown)
- Link "← Back to Sign In"

**Logic:**

- Get token dari URL query param: `searchParams.get('token')`
- Validasi: new password === confirm password
- Validasi: password min 6 characters
- Submit → API call `POST /reset-password` dengan token + newPassword
- Jika success: show success + auto redirect ke `/signin` setelah 3 detik
- Jika token invalid/expired: show error + button ke `/forgot-password` untuk request new link

---

### 8. `/` - Homepage (Protected Route)

**Components:**

- Navigation bar:
  - Logo/Brand name di kiri
  - User info di kanan (photo + name)
  - Logout button
- Hero section dengan gradient background:
  - Heading: "Welcome Back, {firstName}! 👋"
  - Subheading: "Great to see you again. Here's what's happening today."
- Success alert:
  - Icon checkmark green
  - "Email Verified - Your account is fully activated and ready to use!"
- Feature cards (3 columns):
  - Card 1: Your Profile (icon user + description)
  - Card 2: Dashboard (icon chart + description)
  - Card 3: Settings (icon gear + description)
- Account Information card:
  - Full Name
  - Email
  - Role (badge)
  - Status (badge)

**Logic:**

- useEffect → check if token exists in localStorage
- Jika tidak ada token → redirect ke `/signin`
- Jika ada token → load user data dari localStorage
- Logout button → clear localStorage + redirect ke `/signin`

---

## 🎨 Tailwind CSS Classes untuk Konsistensi

### Gradient Background:

```tsx
className = "min-h-screen bg-gradient-to-br from-purple-500 to-indigo-600";
```

### Card Container:

```tsx
className = "bg-white rounded-lg shadow-xl p-8 max-w-md w-full";
```

### Button Primary:

```tsx
className =
  "w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed";
```

### Button Secondary (Outline):

```tsx
className =
  "w-full border-2 border-purple-600 text-purple-600 py-3 rounded-lg font-semibold hover:bg-purple-50 transition";
```

### Input Field:

```tsx
className =
  "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent";
```

### Error Alert:

```tsx
className = "mb-6 p-4 bg-red-100 text-red-700 rounded-lg";
```

### Success Alert:

```tsx
className = "mb-6 p-4 bg-green-100 text-green-700 rounded-lg";
```

### Loading Spinner:

```tsx
className =
  "w-20 h-20 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto";
```

---

## 🔐 Token Management

### Simpan Token setelah Login:

```typescript
localStorage.setItem("token", data.token);
localStorage.setItem("user", JSON.stringify(data.data));
```

### Get Token untuk API Calls:

```typescript
const token = localStorage.getItem("token");
```

### Clear Token saat Logout:

```typescript
localStorage.removeItem("token");
localStorage.removeItem("user");
router.push("/signin");
```

### Protected Route Check:

```typescript
useEffect(() => {
  const token = localStorage.getItem("token");
  if (!token) {
    router.push("/signin");
  }
}, []);
```

---

## 🧪 Testing Checklist

### Register Flow:

- [ ] Form validation berfungsi
- [ ] File upload berfungsi (optional field)
- [ ] Error handling untuk email duplikat
- [ ] Success message muncul
- [ ] Redirect ke check-email page

### Verify Email Flow:

- [ ] Loading state muncul saat verifying
- [ ] Success state dengan countdown redirect
- [ ] Error state untuk token invalid/expired
- [ ] Welcome email terkirim setelah verify

### Login Flow:

- [ ] Login berhasil dengan credentials valid
- [ ] Token & user data tersimpan di localStorage
- [ ] Redirect ke homepage setelah login
- [ ] Error message untuk email belum verified
- [ ] Link resend verification muncul jika belum verify

### Forgot Password Flow:

- [ ] Email sent success message
- [ ] Reset email diterima
- [ ] Reset page load dengan token dari URL
- [ ] Password validation (match & min length)
- [ ] Success redirect ke signin

### Homepage:

- [ ] Protected route berfungsi (redirect jika no token)
- [ ] User data ditampilkan dengan benar
- [ ] Logout berfungsi & clear localStorage

---

## 💡 Tips untuk AI

1. **Gunakan `'use client'`** di semua component karena butuh useState & useEffect
2. **TypeScript types** untuk API responses agar type-safe
3. **Error handling** yang proper dengan try-catch
4. **Loading states** untuk semua async operations
5. **Auto redirect** dengan setTimeout untuk UX yang lebih baik
6. **Responsive design** dengan Tailwind breakpoints (sm:, md:, lg:)
7. **Accessibility** - gunakan proper semantic HTML & labels
8. **Icons** - gunakan SVG inline atau library seperti Heroicons
9. **Form validation** - client-side validation sebelum submit
10. **API URL** - gunakan environment variable `process.env.NEXT_PUBLIC_API_URL`

---

## 📦 Installation Commands

```bash
# Create Next.js project
npx create-next-app@latest my-app --typescript --tailwind --app

# Or install dependencies
npm install next react react-dom
npm install -D tailwindcss postcss autoprefixer typescript @types/react @types/node

# Initialize Tailwind
npx tailwindcss init -p
```

---

## 🎯 Expected Output

Setelah selesai, user harus bisa:

1. ✅ Register dengan/tanpa photo
2. ✅ Terima email verification
3. ✅ Verify email & otomatis terima welcome email 🎉
4. ✅ Login dengan akun terverifikasi
5. ✅ Masuk ke homepage yang protected
6. ✅ Forgot & reset password
7. ✅ Resend verification jika perlu
8. ✅ Logout dengan aman

---

**Selamat coding! 🚀**
