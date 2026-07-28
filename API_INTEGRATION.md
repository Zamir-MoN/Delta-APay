# Delta APay - API Integration Guide

This guide explains how to integrate the Delta APay payment system into your website, application, or Discord bot.

## 1. Authentication

To use the API, you must include your `x-api-key` in the header of your requests. You can find your API key in the `User` table of your database (the `apiKey` field for the `OWNER` role).

**Header Example:**
```http
x-api-key: your-secret-api-key-here
```

## 2. Create a Checkout Session

When a user wants to buy something on your website, you must call the `/v1/checkout/sessions` endpoint from your server to generate a checkout URL.

**Endpoint:** `POST /api/v1/checkout/sessions`

**Request Body (JSON):**
```json
{
  "amount": 499,
  "redirectUrl": "https://yourwebsite.com/success",
  "webhookUrl": "https://yourwebsite.com/api/webhooks/delta",
  "metadata": "user_id_12345"
}
```
- `amount`: (Required) The amount to charge in INR. Must be a number.
- `redirectUrl`: (Optional) Where the user will be sent after a successful payment.
- `webhookUrl`: (Optional) The URL on your server that Delta APay will ping when the payment is confirmed.
- `metadata`: (Optional) Any custom string you want to pass (like a user ID or cart ID). It will be returned in the webhook.

**Response:**
```json
{
  "success": true,
  "checkoutUrl": "https://your-delta-domain.com/pay/order-id-here",
  "orderId": "order-id-here",
  "amount": 499,
  "expiresAt": "2026-07-28T10:00:00.000Z"
}
```

**Action:** Redirect your user to the `checkoutUrl` provided in the response.

## 3. Webhook Handling (Listening for Payment Success)

If you provided a `webhookUrl` when creating the session, Delta APay will send a `POST` request to that URL the moment the payment is verified.

**Incoming Webhook Payload:**
```json
{
  "orderId": "order-id-here",
  "status": "PAID",
  "amount": 499,
  "metadata": "user_id_12345"
}
```

### Security: Verifying the Webhook Signature

To prevent malicious users from sending fake webhooks to your server, Delta APay signs the webhook payload using your API key. You **MUST** verify this signature.

The signature is sent in the `x-webhook-signature` header.

**Node.js / Express Example for Webhook Verification:**
```javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

const DELTA_API_KEY = "your-secret-api-key-here";

app.post('/api/webhooks/delta', express.json(), (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  
  // 1. Re-create the hash using your API key
  const payloadString = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', DELTA_API_KEY)
    .update(payloadString)
    .digest('hex');

  // 2. Compare signatures securely
  if (signature !== expectedSignature) {
    console.error("Invalid Webhook Signature!");
    return res.status(401).send("Unauthorized");
  }

  // 3. Process the payment
  const { orderId, status, metadata } = req.body;
  if (status === 'PAID') {
    console.log(`Payment successful for user ${metadata}!`);
    // Unlock premium features, send product, etc.
  }

  res.status(200).send("OK");
});
```

## 4. Get Order Status (Optional)

If you don't want to use Webhooks, you can manually check the status of an order using its ID.

**Endpoint:** `GET /api/orders/:id`

**Response:**
```json
{
  "status": "PAID",
  "amount": 499,
  "purpose": "DX-ABCD1234EF",
  "qrCode": "data:image/png;base64,...",
  "upiUri": "upi://pay?pa=...",
  "redirectUrl": "https://yourwebsite.com/success"
}
```
