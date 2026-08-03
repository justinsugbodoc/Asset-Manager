import { Router } from "express";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import Stripe from "stripe";
import { z } from "zod";
import {
  db,
  clinicalRecordsTable,
  encountersTable,
  pharmacyMedicationsTable,
  pharmacyOrdersTable,
  pharmacyBillsTable,
  pharmacyPaymentsTable,
  usersTable,
} from "@workspace/db";
import { getUserFromRequest, isAdminUser } from "../lib/sugbodoc-auth";

const router = Router();

function getStripe(): Stripe {
  const secretKey = process.env["STRIPE_SECRET_KEY"];
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  return new Stripe(secretKey);
}

const medicationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(160),
  description: z.string().max(500).default(""),
  genericName: z.string().max(200).default(""),
  dosage: z.string().max(100).default(""),
  dosageForm: z.string().max(100).default(""),
  form: z.string().max(100).default(""),
  category: z.string().max(100).default(""),
  price: z.number().finite().nonnegative(),
  stock: z.number().int().nonnegative(),
  enabled: z.boolean().default(true),
  partnerLocations: z.array(z.string().max(160)).default([]),
});

const statuses = ["Pending", "Processing", "Ready for Pickup", "Out for Delivery", "Delivered", "Received", "Cancelled"] as const;
const statusSchema = z.enum(statuses);
const checkoutSchema = z.object({
  cartItems: z.array(z.object({ id: z.string().min(1), quantity: z.number().int().positive().max(100) })).min(1).max(50),
  encounterId: z.string().min(1).optional(),
  insuranceCoverageAmount: z.number().finite().min(0).default(0),
  fulfillmentDetails: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("delivery"),
      recipientName: z.string().trim().min(1).max(120),
      phone: z.string().trim().min(5).max(30),
      address: z.string().trim().min(10).max(500),
    }),
    z.object({ mode: z.literal("pickup"), location: z.string().trim().min(1).max(160) }),
  ]),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const defaultCatalog = [
  ["med-001", "Biogesic", "Paracetamol for pain and fever relief.", "Paracetamol", "500mg", "Tablet", "Pain Relief", 7.5, 150],
  ["med-002", "Neozep Forte", "Multi-symptom cold and flu relief.", "Phenylephrine HCl + Chlorphenamine Maleate + Paracetamol", "10mg/2mg/500mg", "Tablet", "Cold & Flu", 8.25, 200],
  ["med-003", "Alaxan FR", "Combination analgesic for muscle pain.", "Ibuprofen + Paracetamol", "200mg/325mg", "Capsule", "Pain Relief", 12, 85],
  ["med-004", "Solmux", "Mucolytic for productive cough.", "Carbocisteine", "500mg", "Capsule", "Cough", 15.5, 120],
  ["med-005", "Amoxil", "Prescription antibiotic.", "Amoxicillin", "500mg", "Capsule", "Antibiotics", 22, 40],
  ["med-006", "Diatabs", "Relief for occasional diarrhea.", "Loperamide", "2mg", "Capsule", "Digestion", 10, 0],
  ["med-007", "Kremil-S", "Antacid for heartburn and indigestion.", "Aluminum Hydroxide + Magnesium Hydroxide + Simeticone", "178mg/233mg/30mg", "Tablet", "Digestion", 11.5, 95],
  ["med-008", "Ascorbic Acid", "Vitamin C supplement.", "Vitamin C", "500mg", "Tablet", "Vitamins", 5, 500],
  ["med-009", "Losartan", "Maintenance medicine for blood pressure.", "Losartan Potassium", "50mg", "Tablet", "Heart Health", 18, 65],
  ["sup-001", "Disposable Syringes", "Sterile single-use syringes.", "Medical supply", "5mL", "Supply", "Syringes", 12, 240],
  ["sup-002", "Sterile Gauze Pads", "Soft sterile gauze pads.", "Medical supply", "4x4 in", "Supply", "Wound Care", 35, 90],
  ["sup-003", "Nitrile Examination Gloves", "Powder-free disposable gloves.", "Medical supply", "Medium, 100 pcs", "Box", "Protective Equipment", 320, 45],
  ["sup-004", "Surgical Face Masks", "Disposable 3-ply masks.", "Medical supply", "50 pcs", "Box", "Protective Equipment", 180, 75],
  ["sup-005", "70% Isopropyl Alcohol", "Antiseptic alcohol.", "Medical supply", "500mL", "Bottle", "First Aid", 95, 65],
  ["sup-006", "Adhesive Bandages", "Flexible adhesive strips.", "Medical supply", "25 pcs", "Box", "Wound Care", 85, 110],
] as const;

function publicMedication(row: typeof pharmacyMedicationsTable.$inferSelect) {
  return {
    ...row,
    price: Number(row.price),
    enabled: row.enabled === "true",
  };
}

function pharmacyBillId(reference: string) {
  return `pharmacy_bill_${reference}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function pharmacyPaymentId(reference: string) {
  return `pharmacy_payment_${reference}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function paymentReference(sessionId: string) {
  return `STRIPE-${sessionId.slice(-8).toUpperCase()}`;
}

async function ensurePharmacyFinancialRecords(
  tx: any,
  order: typeof pharmacyOrdersTable.$inferSelect,
  payment: {
    amount: number;
    paidAt: Date;
    stripeSessionId: string | null;
    reference: string;
  },
) {
  const orderData = order.data as Record<string, any>;
  const billId = order.billId ?? pharmacyBillId(order.reference);
  const amount = Number(payment.amount.toFixed(2));
  await tx.insert(pharmacyBillsTable).values({
    id: billId,
    patientId: order.patientId,
    orderReference: order.reference,
    description: `Pharmacy order ${order.reference}`,
    amount: amount.toFixed(2),
    status: "Paid",
    billDate: order.createdAt,
    paidAt: payment.paidAt,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: pharmacyBillsTable.id,
    set: {
      patientId: order.patientId,
      amount: amount.toFixed(2),
      status: "Paid",
      paidAt: payment.paidAt,
      updatedAt: new Date(),
    },
  });
  await tx.insert(pharmacyPaymentsTable).values({
    id: pharmacyPaymentId(order.reference),
    patientId: order.patientId,
    orderReference: order.reference,
    billId,
    amount: amount.toFixed(2),
    status: "Paid",
    paymentDate: payment.paidAt,
    reference: payment.reference,
    stripeSessionId: payment.stripeSessionId,
    fulfillmentStatus: order.status,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: pharmacyPaymentsTable.id,
    set: {
      patientId: order.patientId,
      billId,
      amount: amount.toFixed(2),
      status: "Paid",
      paymentDate: payment.paidAt,
      reference: payment.reference,
      stripeSessionId: payment.stripeSessionId,
      fulfillmentStatus: order.status,
      updatedAt: new Date(),
    },
  });
  await tx.update(pharmacyOrdersTable).set({
    billId,
    data: { ...orderData, billId, paymentReference: payment.reference, paymentDate: payment.paidAt.toISOString() },
    updatedAt: new Date(),
  }).where(eq(pharmacyOrdersTable.reference, order.reference));
  return billId;
}

async function ensureCatalog() {
  const existing = await db.select().from(pharmacyMedicationsTable).orderBy(asc(pharmacyMedicationsTable.name));
  if (existing.length) return existing;
  for (const [id, name, description, genericName, dosage, form, category, price, stock] of defaultCatalog) {
    await db.insert(pharmacyMedicationsTable).values({
      id,
      name,
      description,
      genericName,
      dosage,
      dosageForm: form,
      form,
      category,
      price: String(price),
      stock,
      enabled: stock > 0 ? "true" : "false",
      partnerLocations: ["Sugbo Pharmacy Escario", "Chong Hua Hospital Pharmacy"],
    });
  }
  return db.select().from(pharmacyMedicationsTable).orderBy(asc(pharmacyMedicationsTable.name));
}

async function updateEncounterOrder(order: Record<string, any>) {
  if (!order.encounterId) return;
  const records = await db.select().from(clinicalRecordsTable).where(eq(clinicalRecordsTable.encounterId, order.encounterId));
  const record = records.find(item => item.recordType === "pharmacyOrders" && (item.data as any)?.reference === order.reference);
  if (record) {
    await db.update(clinicalRecordsTable).set({
      data: { ...(record.data as any), ...order },
      updatedAt: new Date(),
    }).where(eq(clinicalRecordsTable.id, record.id));
  } else {
    await db.insert(clinicalRecordsTable).values({
      id: `cr_${order.encounterId}_pharmacyOrders_${order.reference}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
      patientId: order.patientId,
      encounterId: order.encounterId,
      recordType: "pharmacyOrders",
      data: order,
    }).onConflictDoUpdate({
      target: clinicalRecordsTable.id,
      set: { data: order, updatedAt: new Date() },
    });
  }
}

async function ensureOrdersFromClinicalRecords() {
  const existing = await db.select({ reference: pharmacyOrdersTable.reference }).from(pharmacyOrdersTable);
  const existingReferences = new Set(existing.map(item => item.reference));
  const records = await db.select({
    patientId: clinicalRecordsTable.patientId,
    encounterId: clinicalRecordsTable.encounterId,
    data: clinicalRecordsTable.data,
  }).from(clinicalRecordsTable).where(eq(clinicalRecordsTable.recordType, "pharmacyOrders"));
  for (const record of records) {
    const order = record.data as Record<string, any>;
    if (!order.reference || existingReferences.has(String(order.reference))) continue;
    await db.insert(pharmacyOrdersTable).values({
      reference: String(order.reference),
      patientId: record.patientId,
      encounterId: record.encounterId,
      status: String(order.status ?? "Pending"),
      paymentStatus: String(order.paymentStatus ?? "pending"),
      billId: typeof order.billId === "string" ? order.billId : null,
      data: { ...order, patientId: record.patientId, encounterId: record.encounterId },
      receivedAt: typeof order.receivedAt === "string" ? new Date(order.receivedAt) : null,
    }).onConflictDoNothing();
  }
}

async function ensureFinancialRecordsForPaidOrders() {
  const paidOrders = await db.select().from(pharmacyOrdersTable)
    .where(eq(pharmacyOrdersTable.paymentStatus, "paid"));
  for (const order of paidOrders) {
    const existing = await db.select({ id: pharmacyBillsTable.id })
      .from(pharmacyBillsTable)
      .where(eq(pharmacyBillsTable.orderReference, order.reference))
      .limit(1);
    if (existing[0]) continue;
    const data = order.data as any;
    await db.transaction(async tx => {
      await ensurePharmacyFinancialRecords(tx, order, {
        amount: Number(data.paidAmount ?? data.totals?.total ?? 0),
        paidAt: new Date(data.paymentDate ?? order.updatedAt),
        stripeSessionId: data.paymentSessionId ?? null,
        reference: data.paymentReference ?? `LEGACY-${order.reference}`,
      });
    });
  }
}

router.get("/pharmacy/catalog", async (_req, res) => {
  res.json({ medications: (await ensureCatalog()).map(publicMedication) });
});

router.post("/pharmacy/create-checkout-session", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user || isAdminUser(user)) {
    res.status(403).json({ error: "A patient account is required to place a pharmacy order." });
    return;
  }
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid pharmacy checkout request.", details: parsed.error.flatten() });
    return;
  }
  const catalog = await ensureCatalog();
  if (parsed.data.encounterId) {
    const encounter = await db.select({ id: encountersTable.id })
      .from(encountersTable)
      .where(and(eq(encountersTable.id, parsed.data.encounterId), eq(encountersTable.patientId, user.id)))
      .limit(1);
    if (!encounter[0]) {
      res.status(403).json({ error: "The selected clinical encounter does not belong to this patient." });
      return;
    }
  }
  const catalogById = new Map(catalog.map(item => [item.id, item]));
  const items = parsed.data.cartItems.map(cartItem => {
    const medication = catalogById.get(cartItem.id);
    if (!medication || medication.enabled !== "true") throw new Error(`Medication ${cartItem.id} is unavailable.`);
    if (cartItem.quantity > medication.stock) throw new Error(`${medication.name} does not have enough stock.`);
    return { ...publicMedication(medication), quantity: cartItem.quantity };
  });
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const insuranceCoverageAmount = Math.min(subtotal, parsed.data.insuranceCoverageAmount);
  const patientMedicationBalance = subtotal - insuranceCoverageAmount;
  const deliveryFee = parsed.data.fulfillmentDetails.mode === "delivery" ? 99 : 0;
  const total = patientMedicationBalance + deliveryFee;
  if (total < 50) {
    res.status(400).json({ error: `Minimum order amount is ₱50.00. Your total is ₱${total.toFixed(2)}.` });
    return;
  }
  const reference = `med_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const order = {
    reference,
    patientId: user.id,
    encounterId: parsed.data.encounterId,
    fulfillmentDetails: parsed.data.fulfillmentDetails,
    items,
    totals: { subtotal, estimatedInsuranceCoverage: insuranceCoverageAmount, patientMedicationBalance, deliveryFee, total },
    status: "Pending",
    paymentStatus: "pending",
    createdAt: new Date().toISOString(),
  };
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      ...(patientMedicationBalance > 0 ? [{
        price_data: { currency: "php", product_data: { name: "Pharmacy balance after estimated insurance" }, unit_amount: Math.round(patientMedicationBalance * 100) },
        quantity: 1,
      }] : []),
      ...(deliveryFee > 0 ? [{
        price_data: { currency: "php", product_data: { name: "Pharmacy delivery fee" }, unit_amount: deliveryFee * 100 },
        quantity: 1,
      }] : []),
    ],
    customer_email: user.email,
    client_reference_id: reference,
    metadata: { orderType: "pharmacy", medicationOrderId: reference },
    success_url: parsed.data.successUrl,
    cancel_url: parsed.data.cancelUrl,
  });
  if (!session.url) {
    res.status(502).json({ error: "Stripe did not return a checkout URL." });
    return;
  }
  await db.insert(pharmacyOrdersTable).values({
    reference,
    patientId: user.id,
    encounterId: parsed.data.encounterId,
    status: "Pending",
    paymentStatus: "pending",
    data: order,
  });
  res.json({ checkoutUrl: session.url, sessionId: session.id, orderId: reference, total });
});

router.put("/pharmacy/catalog/:id", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: "Authorized pharmacy staff are required to update inventory." });
    return;
  }
  const parsed = medicationSchema.safeParse({ ...req.body, id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid medication inventory record.", details: parsed.error.flatten() });
    return;
  }
  const item = parsed.data;
  const [saved] = await db.insert(pharmacyMedicationsTable).values({
    ...item,
    price: item.price.toFixed(2),
    stock: item.stock,
    enabled: item.enabled ? "true" : "false",
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: pharmacyMedicationsTable.id,
    set: {
      name: item.name,
      description: item.description,
      genericName: item.genericName,
      dosage: item.dosage,
      dosageForm: item.dosageForm,
      form: item.form,
      category: item.category,
      price: item.price.toFixed(2),
      stock: item.stock,
      enabled: item.enabled ? "true" : "false",
      partnerLocations: item.partnerLocations,
      updatedAt: new Date(),
    },
  }).returning();
  res.json({ medication: publicMedication(saved) });
});

router.delete("/pharmacy/catalog/:id", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: "Authorized pharmacy staff are required to remove inventory." });
    return;
  }
  const deleted = await db.delete(pharmacyMedicationsTable)
    .where(eq(pharmacyMedicationsTable.id, req.params.id))
    .returning({ id: pharmacyMedicationsTable.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Medication not found." });
    return;
  }
  res.json({ deleted: true });
});

router.get("/pharmacy/orders", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  await ensureOrdersFromClinicalRecords();
  await ensureFinancialRecordsForPaidOrders();
  const rows = isAdminUser(user)
    ? await db.select({ order: pharmacyOrdersTable, patientName: usersTable.name })
      .from(pharmacyOrdersTable).innerJoin(usersTable, eq(pharmacyOrdersTable.patientId, usersTable.id))
    : await db.select({ order: pharmacyOrdersTable, patientName: usersTable.name })
      .from(pharmacyOrdersTable).innerJoin(usersTable, eq(pharmacyOrdersTable.patientId, usersTable.id))
      .where(eq(pharmacyOrdersTable.patientId, user.id));
  const paymentRows = await db.select().from(pharmacyPaymentsTable);
  const billRows = await db.select().from(pharmacyBillsTable);
  res.json({
    orders: rows.map(({ order, patientName }) => {
      const payment = paymentRows.find(item => item.orderReference === order.reference);
      const bill = billRows.find(item => item.orderReference === order.reference);
      const data = order.data as any;
      return {
        ...data,
        reference: order.reference,
        patientId: order.patientId,
        patientName,
        encounterId: order.encounterId,
        billId: order.billId ?? bill?.id ?? data.billId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        receivedAt: order.receivedAt?.toISOString() ?? data.receivedAt,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        billReference: bill?.id,
        billStatus: bill?.status,
        paymentAmount: payment ? Number(payment.amount) : undefined,
        paymentDate: payment?.paymentDate.toISOString(),
        paymentReference: payment?.reference,
        stripeSessionId: payment?.stripeSessionId,
        fulfillmentStatus: payment?.fulfillmentStatus ?? order.status,
      };
    }),
  });
});

router.post("/pharmacy/orders/:reference/confirm-payment", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const sessionId = z.string().regex(/^cs_[A-Za-z0-9_]+$/).safeParse(req.body?.sessionId);
  if (!sessionId.success) {
    res.status(400).json({ error: "A valid Stripe checkout session is required." });
    return;
  }
  const session = await getStripe().checkout.sessions.retrieve(sessionId.data);
  if (session.payment_status !== "paid" || session.metadata?.medicationOrderId !== req.params.reference) {
    res.status(400).json({ error: "Payment has not been confirmed for this pharmacy order." });
    return;
  }
  const rows = await db.select().from(pharmacyOrdersTable)
    .where(and(eq(pharmacyOrdersTable.reference, req.params.reference), eq(pharmacyOrdersTable.patientId, user.id))).limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "Pharmacy order not found." });
    return;
  }
  const current = rows[0];
  if (current.paymentStatus !== "paid") {
    await db.transaction(async (tx) => {
      const lockedRows = await tx.select().from(pharmacyOrdersTable)
        .where(eq(pharmacyOrdersTable.reference, current.reference))
        .for("update")
        .limit(1);
      const lockedOrder = lockedRows[0];
      if (!lockedOrder) throw new Error("Pharmacy order not found.");
      if (lockedOrder.paymentStatus === "paid") return;
      const orderData = lockedOrder.data as any;
      const items = Array.isArray(orderData.items) ? orderData.items : [];
      for (const item of items) {
        const quantity = Number(item.quantity);
        const changed = await tx.update(pharmacyMedicationsTable)
          .set({ stock: sql`${pharmacyMedicationsTable.stock} - ${quantity}` })
          .where(and(eq(pharmacyMedicationsTable.id, String(item.id)), gte(pharmacyMedicationsTable.stock, quantity)))
          .returning({ id: pharmacyMedicationsTable.id });
        if (!changed[0] || !Number.isInteger(quantity) || quantity <= 0) {
          throw new Error(`Unable to reserve stock for ${String(item.name ?? item.id)}`);
        }
      }
      const paidAt = new Date();
      await ensurePharmacyFinancialRecords(tx, lockedOrder, {
        amount: (session.amount_total ?? 0) / 100,
        paidAt,
        stripeSessionId: session.id,
        reference: paymentReference(session.id),
      });
      const updatedData = {
        ...orderData,
        status: lockedOrder.status === "Pending" ? "Processing" : lockedOrder.status,
        paymentStatus: "paid",
        paidAmount: (session.amount_total ?? 0) / 100,
        paymentSessionId: session.id,
        paymentReference: paymentReference(session.id),
        paymentDate: paidAt.toISOString(),
      };
      await tx.update(pharmacyOrdersTable).set({
        status: updatedData.status,
        paymentStatus: "paid",
        data: updatedData,
        updatedAt: paidAt,
      }).where(eq(pharmacyOrdersTable.reference, lockedOrder.reference));
    });
  } else if (!current.billId) {
    await db.transaction(async tx => {
      await ensurePharmacyFinancialRecords(tx, current, {
        amount: Number((current.data as any).paidAmount ?? (current.data as any).totals?.total ?? 0),
        paidAt: new Date((current.data as any).paymentDate ?? current.updatedAt),
        stripeSessionId: String((current.data as any).paymentSessionId ?? session.id),
        reference: String((current.data as any).paymentReference ?? paymentReference(session.id)),
      });
    });
  }
  const latestRows = await db.select().from(pharmacyOrdersTable)
    .where(and(eq(pharmacyOrdersTable.reference, current.reference), eq(pharmacyOrdersTable.patientId, user.id)))
    .limit(1);
  const latest = latestRows[0] ?? current;
  const orderData = latest.data as any;
  const updatedOrder = {
    ...orderData,
    reference: latest.reference,
    patientId: latest.patientId,
    encounterId: latest.encounterId,
    status: latest.status,
    paymentStatus: latest.paymentStatus,
  };
  await db.update(pharmacyPaymentsTable).set({ fulfillmentStatus: latest.status, updatedAt: new Date() })
    .where(eq(pharmacyPaymentsTable.orderReference, latest.reference));
  await updateEncounterOrder(updatedOrder);
  res.json({ order: updatedOrder });
});

router.patch("/pharmacy/orders/:reference/status", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: "Authorized pharmacy staff are required to update order status." });
    return;
  }
  const parsed = statusSchema.safeParse(req.body.status);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid pharmacy order status." });
    return;
  }
  const rows = await db.select().from(pharmacyOrdersTable).where(eq(pharmacyOrdersTable.reference, req.params.reference)).limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "Pharmacy order not found." });
    return;
  }
  const current = rows[0];
  if (parsed.data === "Received") {
    res.status(400).json({ error: "Patients must confirm receipt from the Patient portal after delivery or pickup readiness." });
    return;
  }
  const updatedOrder = { ...(current.data as any), status: parsed.data, updatedAt: new Date().toISOString() };
  await db.update(pharmacyOrdersTable).set({ status: parsed.data, data: updatedOrder, updatedAt: new Date() })
    .where(eq(pharmacyOrdersTable.reference, req.params.reference));
  await updateEncounterOrder({ ...updatedOrder, reference: current.reference, encounterId: current.encounterId });
  await db.update(pharmacyPaymentsTable).set({ fulfillmentStatus: parsed.data, updatedAt: new Date() })
    .where(eq(pharmacyPaymentsTable.orderReference, current.reference));
  res.json({ order: { ...updatedOrder, reference: current.reference, status: parsed.data, receivedAt: current.receivedAt?.toISOString() } });
});

router.patch("/pharmacy/orders/:reference/received", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const rows = await db.select().from(pharmacyOrdersTable)
    .where(and(eq(pharmacyOrdersTable.reference, req.params.reference), eq(pharmacyOrdersTable.patientId, user.id))).limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "Pharmacy order not found." });
    return;
  }
  const current = rows[0];
  if (current.status === "Received" || current.receivedAt) {
    res.status(409).json({ error: "This pharmacy order has already been marked as received." });
    return;
  }
  if (!["Delivered", "Ready for Pickup"].includes(current.status)) {
    res.status(409).json({ error: "Receipt can only be confirmed after delivery or when the order is ready for pickup." });
    return;
  }
  const receivedAt = new Date();
  const updatedOrder = { ...(current.data as any), status: "Received", receivedAt: receivedAt.toISOString() };
  const changed = await db.update(pharmacyOrdersTable)
    .set({ status: "Received", receivedAt, data: updatedOrder, updatedAt: receivedAt })
    .where(and(eq(pharmacyOrdersTable.reference, req.params.reference), eq(pharmacyOrdersTable.status, current.status)))
    .returning({ reference: pharmacyOrdersTable.reference });
  if (!changed.length) {
    res.status(409).json({ error: "This pharmacy order has already been marked as received." });
    return;
  }
  await db.update(pharmacyPaymentsTable).set({ fulfillmentStatus: "Received", updatedAt: receivedAt })
    .where(eq(pharmacyPaymentsTable.orderReference, current.reference));
  await updateEncounterOrder({ ...updatedOrder, reference: current.reference, encounterId: current.encounterId });
  res.json({ order: { ...updatedOrder, reference: current.reference, status: "Received", receivedAt: receivedAt.toISOString() } });
});

export default router;