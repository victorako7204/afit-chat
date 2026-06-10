# AFIT Chat — Auth Refactoring (JWT → httpOnly Cookies)

## What Changed

### Before
- JWT stored in `localStorage` (XSS-vulnerable)
- Single long-lived token (7 days, no rotation)
- Token sent via `Authorization: Bearer` header

### After
- **Access token** (15min): httpOnly cookie named `accessToken`
- **Refresh token** (7 days): httpOnly cookie named `refreshToken`
- Both cookies: `Secure`, `SameSite=None`, `Path=/`
- Refresh token rotation: each refresh creates a new token pair and invalidates the old one
- Reused refresh tokens → all tokens for that user are revoked (breach detection)
- Account lockout: 5 failed attempts = 15min lock
- Password changed since JWT issued → token invalidated

## Manual Testing with curl

### 1. Register

```bash
curl -X POST http://localhost:10000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"Test1234!","department":"Computer Science"}' \
  -c cookies.txt -v
```

**Expected:** `201` with `Set-Cookie` headers for `accessToken` and `refreshToken`.

### 2. Login

```bash
curl -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"Test1234!"}' \
  -c cookies.txt -v
```

**Expected:** `200` with `Set-Cookie` headers. Response body: `{"success":true,"data":{"user":{...}}}`

### 3. Access Protected Route (Me)

```bash
curl -X GET http://localhost:10000/api/v1/auth/me \
  -b cookies.txt -v
```

**Expected:** `200` with user data.

### 4. Refresh Token

```bash
curl -X POST http://localhost:10000/api/v1/auth/refresh \
  -b cookies.txt -c cookies.txt -v
```

**Expected:** `200` with new `Set-Cookie` headers (old cookies invalidated).

### 5. Logout

```bash
curl -X POST http://localhost:10000/api/v1/auth/logout \
  -b cookies.txt -c cookies.txt -v
```

**Expected:** `200`, cookies cleared (`MaxAge=0`).

### 6. Account Lockout (5 failed attempts)

```bash
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:10000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"john@example.com","password":"WrongPass1!"}' | jq .
done
```

**After 5th failure:**
```json
{"success":false,"error":{"code":"ACCOUNT_LOCKED","message":"Account locked. Try again in 15 minute(s).","details":{"remainingMinutes":15}}}
```

### 7. Rate Limiting (6 rapid requests)

```bash
for i in 1 2 3 4 5 6; do
  curl -s -X POST http://localhost:10000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"x@y.com","password":"Test1234!"}' | jq .
done
```

**6th request:**
```json
{"success":false,"error":{"code":"RATE_LIMITED","message":"Too many attempts. Please wait 15 minutes."}}
```

### 8. Expired Token (manual test)

Wait 15 minutes, or create a token with short expiry:

```javascript
// In Node console:
const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: '...' }, process.env.JWT_SECRET, { expiresIn: '1s' });
// Use this as the accessToken cookie
```

**Expected:** `401` with `{"error":{"code":"TOKEN_EXPIRED"}}`

## Running Tests

```bash
cd server
npm install           # Install new deps (zod, helmet, cookie-parser, winston, express-rate-limit)
npm test              # Run auth tests with Jest + mongodb-memory-server
```

## Environment Variables Required

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Minimum 32 chars, for access tokens |
| `JWT_REFRESH_SECRET` | Yes | Different from JWT_SECRET, for refresh tokens |
| `CLIENT_URL` | Yes | Frontend URL for CORS and reset links |
| `SMTP_USER` | For forgot-password | Gmail address |
| `SMTP_PASS` | For forgot-password | Gmail app password |

## Key Design Decisions

1. **No localStorage for tokens** — All auth state is in httpOnly cookies, immune to XSS
2. **Short-lived access tokens** — 15 minutes limits damage if stolen
3. **Refresh token rotation** — Each use creates a new pair; reuse detection revokes all tokens
4. **Password change invalidation** — `passwordChangedAt` compared with JWT `iat` to invalidate tokens issued before password change
5. **Account lockout** — 5 failed attempts = 15min lock (prevents brute force)
6. **Rate limiting** — 5 auth attempts per 15min per IP
7. **Standardized errors** — All endpoints return `{ success, data }` or `{ success, error: { code, message } }`
