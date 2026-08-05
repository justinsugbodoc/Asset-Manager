import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  appointmentsTable,
  auditEventsTable,
  db,
  encountersTable,
  messageConversationsTable,
  messagesTable,
  usersTable,
} from "@workspace/db";
import { doctorCanAccessPatient, getUserFromRequest, isDoctorUser } from "../lib/sugbodoc-auth";
import { encounterSchema, loadPatientEncounters, upsertEncounter } from "./clinical-records";

const router = Router();

async function requireDoctor(req: Request, res: Response) {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return null;
  }
  if (!isDoctorUser(user)) {
    res.status(403).json({ error: "Doctor access required." });
    return null;
  }
  return user;
}

async function assignedAppointments(doctorId: string) {
  const rows = await db.select().from(appointmentsTable).orderBy(desc(appointmentsTable.date), desc(appointmentsTable.time));
  return rows.filter(row => (row.data as Record<string, any>).doctor?.id === doctorId);
}

function toAppointment(row: typeof appointmentsTable.$inferSelect, patient?: { name: string; initials: string; email: string }) {
  return {
    ...(row.data as Record<string, unknown>),
    id: row.id,
    reference: row.reference,
    date: row.date,
    time: row.time,
    status: row.status,
    ...(patient ? { patientName: patient.name, patientInitials: patient.initials, patientEmail: patient.email } : {}),
  };
}

function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(date);
}

async function recordAudit(actor: string, action: string, target: string) {
  await db.insert(auditEventsTable).values({ id: `audit_${randomUUID()}`, actor, action, target });
}

async function ensureAppointmentEncounter(
  appointment: typeof appointmentsTable.$inferSelect,
  patient: typeof usersTable.$inferSelect,
  doctor: Awaited<ReturnType<typeof getUserFromRequest>> & { providerId?: string | null },
  status: string,
) {
  const existing = await db.select().from(encountersTable)
    .where(and(eq(encountersTable.appointmentId, appointment.id), eq(encountersTable.patientId, patient.id)))
    .limit(1);
  const appointmentDetails = {
    ...((existing[0]?.data as Record<string, unknown> | undefined)?.appointmentDetails as Record<string, unknown> | undefined),
    date: appointment.date,
    time: appointment.time,
    status,
    reference: appointment.reference,
  };

  if (existing[0]) {
    await db.update(encountersTable).set({
      data: {
        ...(existing[0].data as Record<string, unknown>),
        patientName: patient.name,
        date: appointment.date,
        doctorId: doctor.providerId,
        doctor: doctor.name,
        specialty: doctor.specialty,
        clinic: doctor.clinic,
        appointmentDetails,
      },
      updatedAt: new Date(),
    }).where(eq(encountersTable.id, existing[0].id));
    return (await loadPatientEncounters(patient.id)).find(item => item.id === existing[0].id) ?? null;
  }

  const id = `enc_${appointment.id}`;
  const created = await upsertEncounter(patient.id, {
    id,
    encounterReference: `ENC-${appointment.reference}`,
    appointmentId: appointment.id,
    patientId: patient.id,
    patientName: patient.name,
    encounterDate: new Date().toISOString(),
    date: appointment.date,
    doctorId: doctor.providerId,
    doctor: doctor.name,
    specialty: doctor.specialty,
    clinic: doctor.clinic,
    chiefComplaint: (appointment.data as Record<string, any>).reason ?? "Consultation",
    appointmentDetails,
    clinicalSummary: "",
    billing: {
      consultationFee: Number((appointment.data as Record<string, any>).billing?.originalAmount ?? 0),
      laboratoryCharges: 0,
      imagingCharges: 0,
      pharmacyCharges: 0,
      insuranceCoverage: Number((appointment.data as Record<string, any>).billing?.estimatedInsuranceCoverage ?? 0),
      payments: [],
      relatedBillIds: [],
    },
    soapNotes: [],
    diagnoses: [],
    prescriptions: [],
    medications: [],
    pharmacyOrders: [],
    vitals: [],
    laboratoryResults: [],
    imaging: [],
    bills: [],
    payments: [],
    insurance: patient.insuranceData,
    claims: patient.claimsData ?? [],
  });
  return created ? (await loadPatientEncounters(patient.id)).find(item => item.id === id) ?? null : null;
}

async function patientSummary(patientId: string, doctorId: string) {
  const patient = await db.select().from(usersTable).where(and(eq(usersTable.id, patientId), eq(usersTable.role, "Patient"))).limit(1);
  if (!patient[0] || !(await doctorCanAccessPatient({ role: "Doctor", providerId: doctorId } as any, patientId))) return null;
  const appointments = (await assignedAppointments(doctorId)).filter(row => row.userId === patientId);
  const encounters = await loadPatientEncounters(patientId);
  return {
    id: patient[0].id,
    name: patient[0].name,
    initials: patient[0].initials,
    email: patient[0].email,
    phone: patient[0].phone,
    birthday: patient[0].birthday,
    gender: patient[0].gender,
    bloodType: patient[0].bloodType,
    allergies: patient[0].allergies ?? [],
    emergencyContact: patient[0].emergencyContact,
    insurance: patient[0].insuranceData,
    appointments: appointments.map(row => toAppointment(row, { name: patient[0].name, initials: patient[0].initials, email: patient[0].email })),
    encounters,
  };
}

router.get("/doctor/dashboard", async (req, res): Promise<void> => {
  const doctor = await requireDoctor(req, res);
  if (!doctor) return;
  const appointments = await assignedAppointments(doctor.providerId!);
  const patients = await db.select().from(usersTable).where(eq(usersTable.role, "Patient"));
  const assignedPatients = patients.filter(patient => appointments.some(appointment => appointment.userId === patient.id));
  const encounters = await Promise.all(assignedPatients.map(patient => loadPatientEncounters(patient.id)));
  const assignedPatientIds = new Set(assignedPatients.map(patient => patient.id));
  const conversations = await db.select().from(messageConversationsTable);
  const assignedConversationIds = new Set(conversations.filter(conversation => assignedPatientIds.has(conversation.patientId)).map(conversation => conversation.id));
  const messages = await db.select().from(messagesTable);
  const unreadMessages = messages.filter(message => assignedConversationIds.has(message.conversationId) && !message.readAt && message.senderId !== doctor.id).length;
  res.json({
    doctor: { id: doctor.id, providerId: doctor.providerId, name: doctor.name, initials: doctor.initials, specialty: doctor.specialty, clinic: doctor.clinic },
    appointments: appointments.map(row => {
      const patient = assignedPatients.find(item => item.id === row.userId);
      return toAppointment(row, patient ? { name: patient.name, initials: patient.initials, email: patient.email } : undefined);
    }),
    patients: assignedPatients.map(patient => ({
      id: patient.id, name: patient.name, initials: patient.initials, email: patient.email,
      allergies: patient.allergies ?? [], bloodType: patient.bloodType, insurance: patient.insuranceData,
      appointments: appointments.filter(appointment => appointment.userId === patient.id).map(row => toAppointment(row, {
        name: patient.name,
        initials: patient.initials,
        email: patient.email,
      })),
      encounters: encounters[assignedPatients.indexOf(patient)],
    })),
    stats: {
      todayAppointments: appointments.filter(appointment => appointment.date === dateKey() || appointment.date === new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })).length,
      pendingSoapNotes: appointments.filter(appointment => appointment.status === "Completed").filter(appointment => !encounters.flat().some(encounter => encounter.appointmentId === appointment.id && (((encounter as any).soapNotes?.length ?? 0) > 0))).length,
      followUps: appointments.filter(appointment => String((appointment.data as any)?.visitType ?? "").toLowerCase().includes("follow")).length,
      unreadMessages,
    },
  });
});

router.get("/doctor/patients/:patientId", async (req, res): Promise<void> => {
  const doctor = await requireDoctor(req, res);
  if (!doctor) return;
  const patient = await patientSummary(req.params.patientId, doctor.providerId!);
  if (!patient) {
    res.status(404).json({ error: "Patient is not assigned to this doctor." });
    return;
  }
  await recordAudit(doctor.name, "Viewed patient record", `${patient.name} (${patient.id})`);
  res.json({ patient });
});

router.patch("/doctor/appointments/:id/status", async (req, res): Promise<void> => {
  const doctor = await requireDoctor(req, res);
  if (!doctor) return;
  const parsed = z.object({ status: z.enum(["In Progress", "Completed", "No Show", "Cancelled"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a valid appointment status." });
    return;
  }
  const existing = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, req.params.id)).limit(1);
  if (!existing[0] || (existing[0].data as Record<string, any>).doctor?.id !== doctor.providerId) {
    res.status(404).json({ error: "Assigned appointment not found." });
    return;
  }
  const [patient] = await db.select().from(usersTable).where(eq(usersTable.id, existing[0].userId)).limit(1);
  if (!patient) {
    res.status(404).json({ error: "Patient not found." });
    return;
  }
  const [updated] = await db.update(appointmentsTable).set({
    status: parsed.data.status,
    updatedAt: new Date(),
    data: { ...(existing[0].data as Record<string, unknown>), smsStatus: "mock-pending", doctorUpdatedAt: new Date().toISOString() },
  }).where(eq(appointmentsTable.id, existing[0].id)).returning();
  let encounter = null;
  if (parsed.data.status === "In Progress" || parsed.data.status === "Completed") {
    encounter = await ensureAppointmentEncounter(updated, patient, doctor, parsed.data.status);
  }
  await recordAudit(doctor.name, `Marked appointment ${parsed.data.status.toLowerCase()}`, updated.reference);
  res.json({ appointment: toAppointment(updated), encounter });
});

router.put("/doctor/encounters/:encounterId", async (req, res): Promise<void> => {
  const doctor = await requireDoctor(req, res);
  if (!doctor) return;
  const parsed = encounterSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.id !== req.params.encounterId) {
    res.status(400).json({ error: "Complete encounter details are required.", details: parsed.success ? undefined : parsed.error.flatten() });
    return;
  }
  if (parsed.data.doctorId !== doctor.providerId || !(await doctorCanAccessPatient(doctor, parsed.data.patientId))) {
    res.status(403).json({ error: "You are not authorized to edit this encounter." });
    return;
  }
  const existing = await db.select().from(encountersTable).where(and(eq(encountersTable.id, parsed.data.id), eq(encountersTable.patientId, parsed.data.patientId))).limit(1);
  if (!existing[0]) {
    res.status(404).json({ error: "Encounter not found." });
    return;
  }
  const appointmentId = parsed.data.appointmentId || existing[0].appointmentId;
  const appointment = appointmentId
    ? await db.select().from(appointmentsTable).where(and(eq(appointmentsTable.id, appointmentId), eq(appointmentsTable.userId, parsed.data.patientId))).limit(1)
    : [];
  if (appointmentId && (!appointment[0] || (appointment[0].data as Record<string, any>).doctor?.id !== doctor.providerId)) {
    res.status(403).json({ error: "You are not authorized to update this appointment." });
    return;
  }
  const savedAppointment = appointment[0];
  const syncedEncounter = { ...parsed.data, appointmentId: savedAppointment?.id ?? null };
  await db.delete((await import("@workspace/db")).clinicalRecordsTable).where(eq((await import("@workspace/db")).clinicalRecordsTable.encounterId, parsed.data.id));
  await upsertEncounter(parsed.data.patientId, syncedEncounter);
  let updatedAppointment = null;
  if (savedAppointment) {
    const nextStatus = ["Completed", "No Show", "Cancelled"].includes(savedAppointment.status)
      ? savedAppointment.status
      : "In Progress";
    const [updated] = await db.update(appointmentsTable).set({
      status: nextStatus,
      updatedAt: new Date(),
      data: {
        ...(savedAppointment.data as Record<string, unknown>),
        clinicalEncounterId: parsed.data.id,
        clinicalRecordsSavedAt: new Date().toISOString(),
      },
    }).where(eq(appointmentsTable.id, savedAppointment.id)).returning();
    updatedAppointment = updated;
  }
  const encounter = (await loadPatientEncounters(parsed.data.patientId)).find(item => item.id === parsed.data.id);
  await recordAudit(doctor.name, "Updated clinical encounter", parsed.data.encounterReference);
  res.json({ encounter, appointment: updatedAppointment ? toAppointment(updatedAppointment) : null });
});

router.post("/doctor/patients/:patientId/follow-ups", async (req, res): Promise<void> => {
  const doctor = await requireDoctor(req, res);
  if (!doctor) return;
  const patient = await patientSummary(req.params.patientId, doctor.providerId!);
  if (!patient) {
    res.status(404).json({ error: "Patient is not assigned to this doctor." });
    return;
  }
  const parsed = z.object({ date: z.string().min(1), time: z.string().min(1), reason: z.string().trim().min(2).max(300) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Follow-up date, time, and reason are required." });
    return;
  }
  const id = `apt_${randomUUID()}`;
  const [appointment] = await db.insert(appointmentsTable).values({
    id,
    userId: patient.id,
    reference: `APT-${Math.floor(10000 + Math.random() * 90000)}`,
    date: parsed.data.date,
    time: parsed.data.time,
    status: "Pending",
    data: { doctor: { id: doctor.providerId, name: doctor.name, initials: doctor.initials, specialty: doctor.specialty, clinic: doctor.clinic }, reason: parsed.data.reason, visitType: "Follow-up consultation", emailStatus: "pending", smsStatus: "mock-pending" },
  }).returning();
  await recordAudit(doctor.name, "Created patient follow-up appointment", `${patient.name} (${appointment.reference})`);
  res.status(201).json({ appointment: toAppointment(appointment) });
});

export default router;