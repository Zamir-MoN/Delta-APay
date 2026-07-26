# Delta APay - Project Context for AI

**Dear Future AI Assistant,**
If you are reading this, the user has started a new chat session. Please read this entire document to instantly understand the state of the project, the architecture, and the bugs we recently fixed. This will save you time and the user's credits.

## 1. Project Overview
Delta APay is a custom UPI payment gateway system.
- **Frontend**: Next.js. Generates dynamic UPI QR codes and checks payment status via Server-Sent Events (SSE).
- **Backend**: Node.js, Express, Prisma (PostgreSQL).
- **Core Engine (Instant Verification)**: A Node-cron job runs every 20 seconds to read the user's Gmail using the Google Gmail API. It searches for "Money Received" receipts from `no-reply@famapp.in`, parses the UTR, Amount, and Purpose, and updates the pending order status in the database.

## 2. Recent Critical Fixes (Already Applied!)
We encountered several severe bugs with FamApp's email system and fixed them perfectly on the VPS:

1. **HTML Email Parsing Bug**: FamApp's email bodies are nested HTML (Base64 encoded). We updated `src/services/gmail.service.ts` to recursively extract the `text/html` part, decode it from base64, and strip the HTML tags (`/<[^>]*>?/gm`) into clean newlines so our Regex parser (`src/utils/parser.util.ts`) could read the UTR and Amount.
2. **Missing Purpose (Transaction Note) Bug**: FamApp routinely strips the `tn` (Transaction Note) from incoming Google Pay transactions and replaces it with the word "UPI". 
   - *Fix 1*: We added a **Fallback Matcher** in `src/services/verification.service.ts`. If an order's purpose is "UPI", it ignores the purpose code and matches the oldest active `PENDING` order by **Exact Amount** instead.
   - *Fix 2*: We added the `tr` (Transaction Reference) and `cu=INR` parameters to the UPI string generator in `src/routes/api.ts` (`upi://pay?pa=...&tn=${purpose}&tr=${purpose}&cu=INR`) to force FamApp to acknowledge the note.
3. **Ghost Orders & Ghost Emails**: 
   - The cron job was reading 6-month-old emails from January 2026. We fixed this by updating the Gmail query to strictly `q: 'is:unread from:no-reply@famapp.in newer_than:1d subject:"Money Received"'`.
   - The Fallback Matcher was mistakenly verifying old expired "ghost" orders that the user generated but never paid for. We fixed the Prisma query to only match non-expired orders: `expiresAt: { gt: new Date() }`.

## 3. VPS Deployment Workflow (IMPORTANT)
The user hosts the backend on an Ubuntu VPS. **DO NOT give the user multi-line bash scripts with `cat << EOF` or special bash characters like `!`**. Their terminal emulator frequently corrupts multi-line pastes and crashes.

**If you need to update a file on their VPS, ALWAYS compile the file into a Base64 string locally, and give them a 1-liner like this:**
```bash
echo "BASE64_STRING_HERE" | base64 -d > src/path/to/file.ts
npm run build && pm2 restart delta-apay-backend --update-env
pm2 flush
```
*Note: `pm2 flush` is required to wipe old logs, otherwise `pm2 logs` will confuse the user by displaying old errors.*

## 4. Current Status
The Instant Verification Engine is 100% functional. The backend successfully parses FamApp emails, bypasses missing purpose notes via amount-matching, and successfully transitions the Next.js frontend to the "Payment Successful" screen.
