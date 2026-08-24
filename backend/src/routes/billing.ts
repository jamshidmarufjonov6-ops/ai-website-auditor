import { Router } from "express";
import { ObjectId } from "mongodb";
import Stripe from "stripe";
import { config } from "../config.js";
import { collections } from "../db.js";
import { asyncHandler, optionalAuth, requiredAuth, type AuthRequest } from "../middleware/auth.js";

export const billingRouter = Router();

billingRouter.use(optionalAuth);

class BillingNotConfigured extends Error {}

function stripe(): Stripe {
  if (!config.stripeSecretKey || !config.stripeCreditPackPriceId) {
    throw new BillingNotConfigured("Payments are not configured in this environment.");
  }
  return new Stripe(config.stripeSecretKey, { apiVersion: "2024-06-20" });
}

billingRouter.get(
  "/credits",
  requiredAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const user = req.user!;
    res.json({
      credits: user.credits ?? config.freeCredits,
      payments_configured: Boolean(config.stripeSecretKey && config.stripeCreditPackPriceId),
      pack: {
        size: config.creditPackSize,
        price_usd: config.creditPackPriceUsd,
        price_id: config.stripeCreditPackPriceId,
      },
    });
  })
);

billingRouter.post(
  "/checkout",
  requiredAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    try {
      const client = stripe();
      const user = req.user!;
      const session = await client.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price: config.stripeCreditPackPriceId,
            quantity: 1,
          },
        ],
        success_url: config.stripeSuccessUrl,
        cancel_url: config.stripeCancelUrl,
        metadata: { user_id: user._id.toString() },
        client_reference_id: user._id.toString(),
        customer_email: user.email,
      });
      res.json({ url: session.url || "" });
    } catch (err) {
      if (err instanceof BillingNotConfigured) {
        res.status(503).json({ detail: err.message });
        return;
      }
      throw err;
    }
  })
);

billingRouter.post(
  "/webhook",
  asyncHandler(async (req: AuthRequest, res) => {
    if (!config.stripeWebhookSecret || !config.stripeSecretKey) {
      res.status(503).json({ detail: "Payments are not configured in this environment." });
      return;
    }
    const client = stripe();
    const signature = req.headers["stripe-signature"] as string;
    let event;
    try {
      event = client.webhooks.constructEvent(
        JSON.stringify(req.body),
        signature,
        config.stripeWebhookSecret
      );
    } catch {
      res.status(400).json({ detail: "Invalid webhook payload or signature." });
      return;
    }

    const eventId = event.id;
    const existing = await collections().webhookEvents.findOne({ eventId });
    if (existing) {
      res.json({ received: true, idempotent: true, event: eventId });
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id || session.client_reference_id || undefined;
      if (userId) {
        const quantity = 1; // one credit pack per checkout
        const creditsToAdd = config.creditPackSize * quantity;
        await collections().users.updateOne(
          { _id: new ObjectId(userId) },
          {
            $inc: { credits: creditsToAdd },
            $set: { stripeCustomerId: typeof session.customer === "string" ? session.customer : null },
          }
        );
      }
    }

    try {
      await collections().webhookEvents.insertOne({
        _id: new ObjectId(),
        eventId,
        eventType: event.type,
        processedAt: new Date(),
      });
    } catch {
      // Already processed concurrently — ignore.
    }
    res.json({ received: true, idempotent: false, event: eventId });
  })
);
