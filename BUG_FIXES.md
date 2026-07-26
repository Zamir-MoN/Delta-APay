# Delta APay - Bug Fixes & Architecture Updates

This document serves as a record of the critical bugs that were identified and resolved on the Ubuntu VPS deployment.

## 1. The Missing API Route Bug (The Root Cause)
**Symptoms:** 
- The checkout page would crash with the error: `Crash: Unexpected token '<', "<!DOCTYPE "... is not valid JSON` right after clicking "Confirm Payment".

**Root Cause:**
- When a user submitted their UTR, the server successfully updated the payment in the database.
- Immediately after, the frontend code tried to double-check the order status by making a request to `GET /api/orders/:id`.
- This route **did not exist** in the Express backend.
- Because it didn't exist, the Express server returned a default `404 Not Found` HTML page instead of JSON. 
- The Next.js frontend tried to parse this HTML page as JSON using `await res.json()`, which caused the application to crash with the `Unexpected token '<'` error.

**Solution:**
- Added the missing `router.get('/orders/:id', ...)` endpoint to `backend/src/routes/api.ts` to properly return the order status in JSON format.

---

## 2. The IPv6 Proxy Bug
**Symptoms:**
- Next.js API proxy (`/api/:path*`) randomly dropping connections to the backend on Ubuntu servers, leading to 500 Server Errors.

**Root Cause:**
- On many Linux servers, resolving `localhost` defaults to the IPv6 address `::1` instead of the IPv4 address `127.0.0.1`.
- If the Express backend is listening only on IPv4, the Next.js proxy fails to connect to it.

**Solution:**
- Updated `frontend/next.config.ts` to strictly proxy to `http://127.0.0.1:3005/api/:path*` instead of relying on `localhost`.
- Updated `backend/src/index.ts` to explicitly bind the Express server to `'0.0.0.0'` so it accepts connections from any IPv4 interface.

---

## 3. The PM2 Port Conflict
**Symptoms:**
- Rebuilding and restarting the frontend seemed to have absolutely no effect on the live website. The old code was still running.

**Root Cause:**
- The Next.js frontend was initially running on port `4005` in a detached, hidden background process.
- The default PM2 configuration for Next.js attempts to start the application on port `3000`.
- Running `pm2 restart delta-frontend` was restarting a broken instance on port 3000, while the live website on port 4005 was completely untouched and running outdated code.

**Solution:**
- Introduced a unified `ecosystem.config.js` file to centrally manage PM2 configurations.
- Explicitly locked the frontend environment to `PORT: 4005` and the backend environment to `PORT: 3005`.
- Issued `pm2 delete all` and `pm2 start ecosystem.config.js` to ensure the server ports are mapped exactly to the PM2 processes.

---

## 4. Re-enabling UTR Production Security
**Context:**
- During debugging, the UTR duplicate-check security feature was temporarily commented out to allow for rapid testing with the same UTR code.

**Action:**
- Re-enabled the security check in `backend/src/routes/api.ts` which returns a 400 Error (`This UTR has already been used for another order`) if a user attempts a replay attack using an old transaction UTR.
