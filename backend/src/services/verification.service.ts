import { prisma } from "../utils/prisma.util";
import { ParsedEmailData } from "../utils/parser.util";
import { orderEventEmitter } from "../routes/api";

export async function processPaymentEmail(data: ParsedEmailData) {
  try {
    // 1. Check if UTR already exists in DB
    const existingTransaction = await prisma.transaction.findUnique({
      where: { utr: data.utr }
    });

    if (existingTransaction) {
      console.log(`[Verification] Duplicate UTR detected in email: ${data.utr}. Ignoring.`);
      return false; // Already processed
    }

    // 2. Save the Transaction unconditionally
    const transaction = await prisma.transaction.create({
      data: {
        utr: data.utr,
        amount: data.amount,
        transactionId: data.transactionId,
        sender: data.sender,
        date: data.date,
      }
    });

    // 3. Find Pending order that submitted this exact UTR
    const pendingOrder = await prisma.order.findFirst({
      where: {
        submittedUtr: data.utr,
        status: "PENDING",
      }
    });

    if (!pendingOrder) {
      console.log(`[Verification] No pending order has claimed UTR: ${data.utr} yet. Saved transaction for future matching.`);
      return true; // Return true because email was parsed and saved successfully
    }

    if (pendingOrder.amount !== data.amount) {
      console.log(`[Verification] Amount mismatch for order ${pendingOrder.id}. Expected ${pendingOrder.amount}, got ${data.amount}`);
      return false;
    }

    // 4. Payment Success - Match found
    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { orderId: pendingOrder.id }
      });

      await tx.order.update({
        where: { id: pendingOrder.id },
        data: { status: "PAID" }
      });
    });

    orderEventEmitter.emit("statusChanged", pendingOrder.id, "PAID");
    console.log(`[Verification] Successfully verified payment for order ${pendingOrder.id} with UTR ${data.utr}`);
    return true;
  } catch (error) {
    console.error("[Verification Error]", error);
    return false;
  }
}
