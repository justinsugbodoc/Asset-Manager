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
  insuranceCoverageAmount: z.number().finite().min(0).optional().default(0),
  patientEmail: z.string().email().optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const medicationCatalog = [
  { id: "med-001", name: "Biogesic", dosage: "500mg", form: "Tablet", price: 7.5, stock: 150 },
  { id: "med-002", name: "Neozep Forte", dosage: "10mg/2mg/500mg", form: "Tablet", price: 8.25, stock: 200 },
  { id: "med-003", name: "Alaxan FR", dosage: "200mg/325mg", form: "Capsule", price: 12, stock: 85 },
  { id: "med-004", name: "Solmux", dosage: "500mg", form: "Capsule", price: 15.5, stock: 120 },
  { id: "med-005", name: "Amoxil", dosage: "500mg", form: "Capsule", price: 22, stock: 40 },
  { id: "med-006", name: "Diatabs", dosage: "2mg", form: "Capsule", price: 10, stock: 0 },
  { id: "med-007", name: "Kremil-S", dosage: "178mg/233mg/30mg", form: "Tablet", price: 11.5, stock: 95 },
  { id: "med-008", name: "Ascorbic Acid", dosage: "500mg", form: "Tablet", price: 5, stock: 500 },
  { id: "med-009", name: "Losartan", dosage: "50mg", form: "Tablet", price: 18, stock: 65 },
  { id: "sup-001", name: "Disposable Syringes", dosage: "5mL", form: "Supply", price: 12, stock: 240 },
  { id: "sup-002", name: "Sterile Gauze Pads", dosage: "4x4 in", form: "Supply", price: 35, stock: 90 },
  { id: "sup-003", name: "Nitrile Examination Gloves", dosage: "Medium, 100 pcs", form: "Box", price: 320, stock: 45 },
  { id: "sup-004", name: "Surgical Face Masks", dosage: "50 pcs", form: "Box", price: 180, stock: 75 },
  { id: "sup-005", name: "70% Isopropyl Alcohol", dosage: "500mL", form: "Bottle", price: 95, stock: 65 },
  { id: "sup-006", name: "Adhesive Bandages", dosage: "25 pcs", form: "Box", price: 85, stock: 110 },
] as const;

const medicationItemSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().int().positive().max(100),
});

const medicationCheckoutSchema = z.object({
  cartItems: z.array(medicationItemSchema).min(1).max(50),
  insuranceCoverageAmount: z.number().finite().min(0).optional().default(0),
  fulfillmentDetails: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("delivery"),
      recipientName: z.string().trim().min(1).max(120),
      phone: z.string().trim().min(5).max(30),
      address: z.string().trim().min(10).max(500),
    }),
    z.object({
      mode: z.literal("pickup"),
      location: z.string().trim().min(1).max(160),
    }),
  ]),
  patientEmail: z.string().email().optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

router.post("/stripe/create-medication-checkout-session", async (req, res) => {
  const parsed = medicationCheckoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid medication checkout request",
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const data = parsed.data;
    const catalogById = new Map<string, (typeof medicationCatalog)[number]>(
      medicationCatalog.map((medication) => [medication.id, medication]),
    );
    const items = data.cartItems.map((cartItem) => {
      const medication = catalogById.get(cartItem.id);
      if (!medication) {
        throw new Error(`Medication ${cartItem.id} is unavailable`);
      }
      if (cartItem.quantity > medication.stock) {
        throw new Error(`${medication.name} does not have enough stock`);
      }
      return { ...medication, quantity: cartItem.quantity };
    });
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const insuranceCoverageAmount = Math.min(
      subtotal,
      Math.max(0, data.insuranceCoverageAmount),
    );
    const patientMedicationBalance = subtotal - insuranceCoverageAmount;
    const deliveryFee = data.fulfillmentDetails.mode === "delivery" ? 99 : 0;
    const total = patientMedicationBalance + deliveryFee;

    // Stripe requires a minimum charge of ~$0.50 USD. At current PHP/USD rates
    // that is approximately ₱28. We enforce ₱50 to give a comfortable buffer.
    const MINIMUM_ORDER_PHP = 50;
    if (total < MINIMUM_ORDER_PHP) {
      res.status(400).json({
        error: `Minimum order amount is ₱${MINIMUM_ORDER_PHP.toFixed(2)}. Your total is ₱${total.toFixed(2)}.`,
      });
      return;
    }

    const orderId = `med_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        ...(patientMedicationBalance > 0
          ? [{
              price_data: {
                currency: "php",
                product_data: { name: "Pharmacy balance after estimated insurance" },
                unit_amount: Math.round(patientMedicationBalance * 100),
              },
              quantity: 1,
            }]
          : []),
        ...(deliveryFee > 0
          ? [{
              price_data: {
                currency: "php",
                product_data: { name: "Pharmacy delivery fee" },
                unit_amount: deliveryFee * 100,
              },
              quantity: 1,
            }]
          : []),
      ],
      customer_email: data.patientEmail,
      client_reference_id: orderId,
      metadata: {
        orderType: "pharmacy",
        medicationOrderId: orderId,
        fulfillmentMode: data.fulfillmentDetails.mode,
        subtotal: subtotal.toFixed(2),
        insuranceCoverageAmount: insuranceCoverageAmount.toFixed(2),
        patientMedicationBalance: patientMedicationBalance.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        total: total.toFixed(2),
      },
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
    });

    if (!session.url) {
      res.status(502).json({ error: "Stripe did not return a checkout URL" });
      return;
    }

    res.json({ checkoutUrl: session.url, sessionId: session.id, orderId, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create medication checkout session";
    res.status(400).json({ error: message });
  }
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
       metadata: {
         billId: data.billId,
         insuranceCoverageAmount: data.insuranceCoverageAmount.toFixed(2),
       },
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
      orderType: session.metadata?.orderType,
      medicationOrderId: session.metadata?.medicationOrderId,
      amountTotal: session.amount_total,
      currency: session.currency,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve checkout session";
    res.status(502).json({ error: message });
  }
});

export default router;