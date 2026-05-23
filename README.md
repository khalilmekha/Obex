# OBEX — Encrypted Cloud Storage Platform

> **Zero-knowledge cloud storage with hybrid RSA/AES encryption**  
> University project — USTHB, Faculty of Computer Science  
> Specialization: Information Systems Security | 2025/2026

---

## Overview

OBEX is a prototype cloud storage platform where **only the user can decrypt their files**. All cryptographic operations happen client-side; the server stores only ciphertext and never sees private keys or plaintext data.

### Key security properties

- **Hybrid encryption**: files are encrypted with AES-256-GCM, the AES key is itself encrypted with the user's RSA-4096 public key (OAEP/SHA-256)
- **Zero-knowledge architecture**: the server never receives private keys or plaintext
- **Integrity verification**: RSA-PSS digital signatures + GCM authentication tags detect any tampering
- **Multi-factor authentication**: password (bcrypt), facial recognition with liveness detection (EAR), and fingerprint
- **Storage quotas**: atomic MongoDB transactions prevent race conditions on concurrent uploads

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5+ |
| Backend | Node.js + Express 5 |
| Frontend | React 18 + Vite + Wouter + shadcn/ui + Tailwind CSS |
| Database | MongoDB (metadata) + filesystem (encrypted `.enc` files) |
| Cryptography | `node-forge` + Node.js `crypto` |
| Biometrics | WebAuthn / FIDO2 (`navigator.credentials`) |
| Password hashing | bcrypt (cost factor 12) |
| Auth tokens | JWT (HS256, 1h expiry) |

---

## Features

- 🔐 **RSA-4096 key generation** at registration, stored in a local PBKDF2-protected keystore
- 📁 **Encrypted file upload/download** — drag & drop interface with quota indicator
- 🧬 **Facial authentication** with anti-spoofing (Eye Aspect Ratio blink detection)
- 👁 **Fingerprint authentication** via WebAuthn
- 🛡 **Admin panel** — manage users, quotas, and audit logs
- 🚦 **Rate limiting** — blocks IPs after 5 failed auth attempts in 5 minutes
- 📋 **Audit logging** — all sensitive operations logged with timestamp and IP

---

## Project Structure

```
obex/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── components/      # UI components (Navbar, FileTable, UploadArea…)
│       ├── pages/           # Login, Register, Dashboard, Profile, Admin
│       ├── hooks/           # useAuth, useFiles, useMobile
│       └── lib/             # Crypto helpers, query client, WebAuthn
├── server/                  # Node.js + Express backend
│   ├── routes.ts            # API endpoints
│   ├── storage.ts           # File & user storage logic
│   ├── rsa.ts               # RSA helpers
│   └── db.ts                # MongoDB connection
├── shared/                  # Shared types & schema
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- MongoDB running locally or a connection string
- npm or yarn

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/obex.git
cd obex
npm install
```

### Environment variables

Copy `.env.example` to `.env` and fill in:

```env
MONGO_URL=mongodb://localhost:27017/obex_db
JWT_SECRET_KEY=your_secret_key_here
```

### Run in development

```bash
npm run dev
```

### Build for production

```bash
npm run build
npm start
```

---

## Cryptographic Design

### File upload flow

1. Generate random AES-256 key + 96-bit IV (CSPRNG)
2. Encrypt file with AES-256-GCM → `ciphertext + GCM tag`
3. Encrypt AES key with user's RSA-4096 public key (OAEP/SHA-256)
4. Sign ciphertext with RSA-PSS
5. Upload bundle: `{encrypted_content, encrypted_aes_key, iv, gcm_tag, signature}`

### File download flow

1. Download encrypted bundle
2. Verify RSA-PSS signature — abort if invalid
3. Decrypt AES key using local private key (RSA-OAEP)
4. Decrypt file with AES-256-GCM — abort if GCM tag invalid
5. Save plaintext locally

### Keystore protection

The RSA private key is stored locally as a JSON keystore:
```json
{ "salt": "...", "iv": "...", "encrypted_key": "..." }
```
The encryption key is derived from the user's password via PBKDF2-HMAC-SHA256 (310,000 iterations). The server never sees the private key.

---

## Security Test Results

| ID | Category | Test | Result |
|---|---|---|---|
| T-SEC-01 | SQL Injection | OR/DROP payloads | ✅ Blocked (422) |
| T-SEC-02 | Brute force | 1000 login attempts | ✅ Rate-limited after 5 |
| T-SEC-03 | JWT replay | Expired token reuse | ✅ Rejected (401) |
| T-SEC-04 | JWT cross-user | User A's token on B's files | ✅ Rejected (403) |
| T-SEC-05 | Face spoofing | Static photo | ✅ EAR liveness fails |
| T-SEC-07 | Quota race | 10 concurrent uploads | ✅ Atomic enforcement |
| T-SEC-08 | File tampering | Modified `.enc` byte | ✅ InvalidTag detected |
| T-SEC-09 | Unauthorized access | Direct `.enc` access | ✅ Files unreadable |



## License

This project was developed for academic purposes at USTHB. All rights reserved.
