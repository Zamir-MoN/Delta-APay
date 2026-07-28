# Delta APay - System Architecture & Knowledge Base

This document outlines the full system structure, how the instant verification engine works, and acts as a log of known bugs, problems, and their solutions.

---

## 1. System Structure

Delta APay is a hybrid payment gateway that bridges the gap between personal UPI apps (like FamApp, Google Pay, PhonePe) and automated merchant systems. It consists of three primary layers:

### A. The Next.js Frontend (`/frontend`)
- **Role**: Provides the modern, glassmorphic checkout UI for end-users.
- **Features**:
  - Displays dynamic QR codes.
  - Automatically detects mobile devices to display deep-link intent buttons (GPay, PhonePe, Paytm).
  - Listens to Server-Sent Events (SSE) to instantly update the UI when a payment is verified, redirecting the user automatically.

### B. The Node.js Express Backend (`/backend/src/routes`)
- **Role**: API Gateway & Webhook Manager.
- **Features**:
  - Exposes endpoints to create checkout sessions securely using an `x-api-key`.
  - Serves SSE streams to the frontend.
  - Processes UTR submission limits and validates input.
  - Triggers HMAC-signed webhooks to the merchant's external server upon payment verification.

### C. The Core Engine: Gmail Polling (`/backend/src/services/gmail.service.ts`)
- **Role**: The heart of the instant verification system.
- **How it Works**:
  1. A `node-cron` job runs every 20 seconds.
  2. It authenticates with the Google Gmail API using OAuth2 credentials.
  3. It searches for `is:unread from:no-reply@famapp.in newer_than:1d subject:"Money Received"`.
  4. It fetches the email body, decodes the Base64 HTML, strips the HTML tags, and passes the clean text to the Regex Parser.
  5. The parser extracts the **Amount**, **UTR**, and **Purpose** (Transaction Note).
  6. It saves this into the `Transaction` database table.
  7. If a matching `PENDING` order exists with the same Purpose/UTR, it marks the order as `PAID` and fires the webhook.

---

## 2. Known Bugs, Problems, and Solutions

### Bug 1: FamApp HTML Base64 Encoding
**Problem**: The Gmail parser was failing to read emails because FamApp sends receipts as deeply nested, Base64-encoded `text/html` multipart payloads. The regex could not read the tags or the encoding.
**Solution**: Modified `gmail.service.ts` to recursively find the `text/html` part, decode it from Base64 (`Buffer.from(data, 'base64').toString('utf-8')`), and use a regex to strip all HTML tags (`/<[^>]*>?/gm`) into clean newlines before passing it to the parser.

### Bug 2: The "Missing Transaction Note" (UPI Bug)
**Problem**: When users pay via Google Pay to the FamApp UPI ID, Google Pay routinely drops the custom Transaction Note (`tn=DX-12345`) and replaces it with the generic word "UPI". This caused the verification engine to fail to link the transaction to the correct order.
**Solution**: 
1. We updated the generator to include `&tr=${purpose}&cu=INR` to force standard compliance.
2. We built a **Fallback Matcher** in `verification.service.ts`. If the parsed purpose is literally "UPI", the engine searches for the oldest unexpired `PENDING` order that matches the **exact amount**. 

### Bug 3: Ghost Orders & Ghost Emails
**Problem**: The cron job was picking up 6-month-old "Money Received" emails, and the Fallback Matcher was verifying old, expired orders that the user generated but never paid for.
**Solution**: 
1. Updated the Gmail query to explicitly include `newer_than:1d`.
2. Updated the Prisma query in the Fallback Matcher to strictly require `expiresAt: { gt: new Date() }`.

### Bug 4: Mobile Logo Visibility
**Problem**: The large, static image showing supported UPI apps looked redundant on mobile devices directly above the functional intent buttons.
**Solution**: Applied responsive Tailwind classes (`hidden md:flex`) to the static image container, hiding it purely on mobile devices while keeping the interactive grid.

### Bug 5: Double-Spending Vulnerability
**Problem**: The backend allowed a single UTR to be submitted multiple times for different orders.
**Solution**: Implemented a strict database check on the `orders/:id/confirm` route. If a `Transaction` row is already linked to an `orderId`, it rejects the request.

### Bug 6: UTR Brute-Force Vulnerability
**Problem**: Attackers could spam the confirmation endpoint with random 12-digit numbers to guess UTRs.
**Solution**: Added `express-rate-limit` specifically to the confirmation endpoint, restricting it to 5 attempts per IP every 15 minutes, and enforced strict regex `/^\d{12}$/` validation.

---

## 3. Database Schema Overview
- **User**: Stores merchant data and the `apiKey` used for webhook signing.
- **Order**: Represents a checkout session. Contains `purpose` (e.g. DX-ABCD123), `amount`, `status`, and `webhookUrl`.
- **Transaction**: Represents a verified payment scraped from Gmail. Contains `utr`, `amount`, and links to an `orderId` if matched.
- **ParsedEmail**: Keeps track of processed Gmail `messageId`s so the same email isn't parsed twice.
