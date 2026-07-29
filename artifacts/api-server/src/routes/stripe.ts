import { Router } from "express";
import Stripe from "stripe";
import { z } from "zod";

const router = Router();

function getStripe(): Stripe {
  const secretKey = process.env["STRIPE_SECRET_KEY"];
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }
  return new Stripe(secretKey);
}

const checkoutSchema = z.object({
  billId: z.string().min(1),
  description: z.string().min(1).max(200),
  amount: z.number().finite().positive().max(1_000_000),
  patientEmail: z.string().email().optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

router.post("/stripe/create-checkout-session", async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid checkout request",
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const data = parsed.data;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "php",
            product_data: { name: data.description },
            unit_amount: Math.round(data.amount * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: data.patientEmail,
      client_reference_id: data.billId,
      metadata: { billId: data.billId },
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
    });

    if (!session.url) {
      res.status(502).json({ error: "Stripe did not return a checkout URL" });
      return;
    }

    res.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create checkout session";
    res.status(502).json({ error: message });
  }
});

router.get("/stripe/checkout-session/:sessionId", async (req, res) => {
  if (!/^cs_[A-Za-z0-9_]+$/.test(req.params.sessionId)) {
    res.status(400).json({ error: "Invalid checkout session ID" });
    return;
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(req.params.sessionId);
    res.json({
      status: session.payment_status,
      billId: session.metadata?.billId ?? session.client_reference_id,
      amountTotal: session.amount_total,
      currency: session.currency,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve checkout session";
    res.status(502).json({ error: message });
  }
});

export default router;