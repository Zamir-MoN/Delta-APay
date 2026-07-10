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
      console.log(`[Verification] Duplicate UTR detected: ${data.utr}. Ignoring.`);
      return false; // Already processed
    }

    // 2. Find Pending order with exact Purpose and Amount
    const pendingOrder = await prisma.order.findFirst({
      where: {
        purpose: data.purpose,
        status: "PENDING",
      }
    });

    if (!pendingOrder) {
      console.log(`[Verification] No pending order found for purpose: ${data.purpose}`);
      return false;
    }

    if (pendingOrder.amount !== data.amount) {
      console.log(`[Verification] Amount mismatch for order ${pendingOrder.id}. Expected ${pendingOrder.amount}, got ${data.amount}`);
      return false;
    }

    const now = new Date();
    if (now > pendingOrder.expiresAt) {
      console.log(`[Verification] Order ${pendingOrder.id} has expired.`);
      await prisma.order.update({
        where: { id: pendingOrder.id },
        data: { status: "EXPIRED" }
      });
      orderEventEmitter.emit("statusChanged", pendingOrder.id, "EXPIRED");
      return false;
    }

    // 3. Payment Success - Transaction complete
    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          utr: data.utr,
          amount: data.amount,
          transactionId: data.transactionId,
          sender: data.sender,
          date: data.date,
          orderId: pendingOrder.id,
        }
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
