import { Router } from "express";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, appointmentsTable, clinicalRecordsTable, encountersTable, usersTable } from "@workspace/db";
import { getUserFromRequest, isAdminUser } from "../lib/sugbodoc-auth";

const router = Router();
const recordTypes = [
  "soapNotes",
  "diagnoses",
  "prescriptions",
  "medications",
  "vitals",
  "laboratoryResults",
  "imaging",
  "bills",
  "payments",
  "pharmacyOrders",
  "insurance",
  "claims",
  "billing",
] as const;
type RecordType = (typeof recordTypes)[number];

export const encounterSchema = z.object({
  id: z.string().min(1),
  encounterReference: z.string().min(1),
  appointmentId: z.string().nullable().optional(),
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  encounterDate: z.string().min(1),
  date: z.string().min(1),
  doctorId: z.string().optional(),
  doctor: z.string().min(1),
  specialty: z.string().default(""),
  clinic: z.string().default(""),
  chiefComplaint: z.string().default(""),
  appointmentDetails: z.record(z.string(), z.unknown()).default({}),
  clinicalSummary: z.string().default(""),
  billing: z.record(z.string(), z.unknown()).default({}),
  soapNotes: z.array(z.unknown()).default([]),
  diagnoses: z.array(z.unknown()).default([]),
  prescriptions: z.array(z.unknown()).default([]),
  medications: z.array(z.unknown()).default([]),
  pharmacyOrders: z.array(z.unknown()).default([]),
  vitals: z.array(z.unknown()).default([]),
  laboratoryResults: z.array(z.unknown()).default([]),
  imaging: z.array(z.unknown()).default([]),
  bills: z.array(z.unknown()).default([]),
  payments: z.array(z.unknown()).default([]),
  insurance: z.unknown().nullable().default(null),
  claims: z.array(z.unknown()).default([]),
});

function isRecordType(value: string): value is RecordType {
  return (recordTypes as readonly string[]).includes(value);
}

function recordId(encounterId: string, type: string, value: unknown, index: number) {
  const id = typeof value === "object" && value !== null && "id" in value
    ? String((value as { id?: unknown }).id ?? index)
    : index;
  return `cr_${encounterId}_${type}_${id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function upsertEncounter(patientId: string, raw: unknown) {
  const parsed = encounterSchema.safeParse(raw);
  if (!parsed.success || parsed.data.patientId !== patientId) return null;
  const encounter = parsed.data;
  const baseData = {
    patientName: encounter.patientName,
    date: encounter.date,
    doctorId: encounter.doctorId,
    doctor: encounter.doctor,
    specialty: encounter.specialty,
    clinic: encounter.clinic,
    chiefComplaint: encounter.chiefComplaint,
    appointmentDetails: encounter.appointmentDetails,
    clinicalSummary: encounter.clinicalSummary,
    source: "database",
  };
  const existing = await db.select().from(encountersTable).where(eq(encountersTable.id, encounter.id)).limit(1);
  if (existing[0] && existing[0].patientId !== patientId) return null;
  const appointment = encounter.appointmentId
    ? await db.select({ id: appointmentsTable.id }).from(appointmentsTable)
      .where(and(eq(appointmentsTable.id, encounter.appointmentId), eq(appointmentsTable.userId, patientId))).limit(1)
    : [];
  let row = existing[0];
  if (row) {
    const [updated] = await db.update(encountersTable).set({
      patientId,
      appointmentId: appointment[0]?.id ?? null,
      reference: encounter.encounterReference,
      encounterDate: encounter.encounterDate,
      data: baseData,
      updatedAt: new Date(),
    }).where(eq(encountersTable.id, encounter.id)).returning();
    row = updated;
  } else {
    const [created] = await db.insert(encountersTable).values({
      id: encounter.id,
      patientId,
      appointmentId: appointment[0]?.id ?? null,
      reference: encounter.encounterReference,
      encounterDate: encounter.encounterDate,
      data: baseData,
    }).returning();
    row = created;
  }

  for (const type of recordTypes) {
    const value = encounter[type];
    const values = type === "insurance" || type === "billing"
      ? [value]
      : Array.isArray(value) ? value : [];
    for (let index = 0; index < values.length; index += 1) {
      const data = values[index];
      const id = recordId(encounter.id, type, data, index);
      await db.insert(clinicalRecordsTable).values({
        id,
        patientId,
        encounterId: encounter.id,
        appointmentId: appointment[0]?.id ?? null,
        recordType: type,
        data: (data && typeof data === "object" ? data : { value: data }) as Record<string, unknown>,
      }).onConflictDoUpdate({
        target: clinicalRecordsTable.id,
        set: { data: (data && typeof data === "object" ? data : { value: data }) as Record<string, unknown>, updatedAt: new Date() },
      });
    }
  }
  return row;
}

export async function loadPatientEncounters(patientId: string) {
  const encounters = await db.select().from(encountersTable)
    .where(eq(encountersTable.patientId, patientId))
    .orderBy(desc(encountersTable.encounterDate), desc(encountersTable.createdAt));
  const records = await db.select().from(clinicalRecordsTable)
    .where(eq(clinicalRecordsTable.patientId, patientId))
    .orderBy(asc(clinicalRecordsTable.createdAt));
  const byEncounter = new Map<string, typeof records>();
  for (const record of records) {
    const current = byEncounter.get(record.encounterId) ?? [];
    current.push(record);
    byEncounter.set(record.encounterId, current);
  }
  return encounters.map((row) => {
    const grouped: Record<string, unknown> = {
      soapNotes: [], diagnoses: [], prescriptions: [], medications: [], pharmacyOrders: [],
      vitals: [], laboratoryResults: [], imaging: [], bills: [], payments: [], claims: [],
      insurance: null, billing: {},
    };
    for (const record of byEncounter.get(row.id) ?? []) {
      if (record.recordType === "insurance" || record.recordType === "billing") {
        grouped[record.recordType] = record.data;
      } else if (isRecordType(record.recordType)) {
        (grouped[record.recordType] as unknown[]).push(record.data);
      }
    }
    return {
      ...row.data,
      ...grouped,
      id: row.id,
      patientId: row.patientId,
      appointmentId: row.appointmentId,
      encounterReference: row.reference,
      encounterDate: row.encounterDate,
    };
  });
}

router.get("/records", async (req, res) => {
  const requestedPatientId = typeof req.query.patientId === "string" ? req.query.patientId : undefined;
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  if (!isAdminUser(user) && requestedPatientId && requestedPatientId !== user.id) {
    res.status(403).json({ error: "You are not authorized to access another patient's records." });
    return;
  }
  const patientId = isAdminUser(user) ? requestedPatientId : user.id;
  if (!patientId) {
    res.status(400).json({ error: "A patientId is required for admin requests." });
    return;
  }
  const patient = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, patientId)).limit(1);
  if (!patient[0]) {
    res.status(404).json({ error: "Patient not found." });
    return;
  }
  res.json({ patientId, encounters: await loadPatientEncounters(patientId) });
});

router.post("/records/migrate", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const parsed = z.object({
    patientId: z.string().min(1),
    encounters: z.array(z.unknown()).max(100),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid records migration payload." });
    return;
  }
  if (!isAdminUser(user) && parsed.data.patientId !== user.id) {
    res.status(403).json({ error: "You are not authorized to migrate this patient." });
    return;
  }
  for (const encounter of parsed.data.encounters) await upsertEncounter(parsed.data.patientId, encounter);
  res.status(201).json({ patientId: parsed.data.patientId, encounters: await loadPatientEncounters(parsed.data.patientId) });
});

router.post("/records", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: "Authorized clinical staff are required to create clinical records." });
    return;
  }
  const parsed = encounterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid encounter record." });
    return;
  }
  const created = await upsertEncounter(parsed.data.patientId, parsed.data);
  if (!created) {
    res.status(409).json({ error: "Encounter already belongs to another patient or could not be created." });
    return;
  }
  res.status(201).json({ encounter: (await loadPatientEncounters(parsed.data.patientId)).find(item => item.id === parsed.data.id) });
});

router.patch("/records/:encounterId/patient-data", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const parsed = z.object({
    pharmacyOrders: z.array(z.unknown()).optional(),
    bills: z.array(z.unknown()).optional(),
    payments: z.array(z.unknown()).optional(),
    billing: z.record(z.string(), z.unknown()).optional(),
    claims: z.array(z.unknown()).optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid patient record update." });
    return;
  }
  const existing = await db.select().from(encountersTable)
    .where(eq(encountersTable.id, req.params.encounterId)).limit(1);
  if (!existing[0]) {
    res.status(404).json({ error: "Encounter not found." });
    return;
  }
  if (!isAdminUser(user) && existing[0].patientId !== user.id) {
    res.status(403).json({ error: "You are not authorized to update this patient's records." });
    return;
  }
  const current = (await loadPatientEncounters(existing[0].patientId))
    .find(item => item.id === req.params.encounterId);
  if (!current) {
    res.status(404).json({ error: "Encounter not found." });
    return;
  }
  const currentRecord = current as Record<string, any>;
  const updated = {
    ...currentRecord,
    ...parsed.data,
    pharmacyOrders: parsed.data.pharmacyOrders ?? currentRecord.pharmacyOrders ?? [],
    bills: parsed.data.bills ?? currentRecord.bills ?? [],
    payments: parsed.data.payments ?? currentRecord.billing?.payments ?? [],
    claims: parsed.data.claims ?? currentRecord.claims ?? [],
    billing: { ...(currentRecord.billing ?? {}), ...(parsed.data.billing ?? {}) },
  };
  await db.delete(clinicalRecordsTable).where(eq(clinicalRecordsTable.encounterId, req.params.encounterId));
  await upsertEncounter(existing[0].patientId, updated);
  res.json({
    encounter: (await loadPatientEncounters(existing[0].patientId))
      .find(item => item.id === req.params.encounterId),
  });
});

router.put("/records/:encounterId", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: "Authorized clinical staff are required to update clinical records." });
    return;
  }
  const parsed = encounterSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.id !== req.params.encounterId) {
    res.status(400).json({ error: "Invalid encounter record." });
    return;
  }
  const existing = await db.select().from(encountersTable).where(eq(encountersTable.id, req.params.encounterId)).limit(1);
  if (!existing[0] || existing[0].patientId !== parsed.data.patientId) {
    res.status(404).json({ error: "Encounter not found." });
    return;
  }
  await db.delete(clinicalRecordsTable).where(eq(clinicalRecordsTable.encounterId, req.params.encounterId));
  await upsertEncounter(parsed.data.patientId, parsed.data);
  res.json({ encounter: (await loadPatientEncounters(parsed.data.patientId)).find(item => item.id === req.params.encounterId) });
});

export default router;