import { Router } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, appointmentsTable, usersTable } from "@workspace/db";
import { getUserFromRequest, isAdminUser } from "../lib/sugbodoc-auth";

const router = Router();

const appointmentSchema = z.object({
  date: z.string().min(1),
  time: z.string().min(1),
  doctor: z.record(z.string(), z.unknown()),
  billing: z.record(z.string(), z.unknown()).optional(),
});

function toAppointment(row: typeof appointmentsTable.$inferSelect) {
  return {
    ...(row.data as Record<string, unknown>),
    id: row.id,
    reference: row.reference,
    date: row.date,
    time: row.time,
    status: row.status,
  };
}

function reference() {
  return `APT-${Math.floor(10000 + Math.random() * 90000)}`;
}

router.get("/appointments", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const rows = await db.select().from(appointmentsTable).where(eq(appointmentsTable.userId, user.id)).orderBy(desc(appointmentsTable.createdAt));
  res.json({ appointments: rows.map(toAppointment) });
});

router.post("/appointments", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const parsed = appointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid appointment details", details: parsed.error.flatten() });
    return;
  }
  const id = `apt_${randomUUID()}`;
  const appointmentReference = reference();
  const [row] = await db.insert(appointmentsTable).values({
    id,
    userId: user.id,
    reference: appointmentReference,
    date: parsed.data.date,
    time: parsed.data.time,
    status: "Pending",
    data: {
      doctor: parsed.data.doctor,
      billing: parsed.data.billing,
      emailStatus: "pending",
    },
  }).returning();
  res.status(201).json({ appointment: toAppointment(row) });
});

router.patch("/appointments/:id/status", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const status = z.object({ status: z.enum(["Pending", "Confirmed", "Completed", "Cancelled", "Rescheduled"]) }).safeParse(req.body);
  if (!status.success) {
    res.status(400).json({ error: "Invalid appointment status." });
    return;
  }
  const existing = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, req.params.id)).limit(1);
  if (!existing[0] || (!isAdminUser(user) && existing[0].userId !== user.id)) {
    res.status(404).json({ error: "Appointment not found." });
    return;
  }
  const [updated] = await db.update(appointmentsTable)
    .set({ status: status.data.status, updatedAt: new Date() })
    .where(
      isAdminUser(user)
        ? eq(appointmentsTable.id, req.params.id)
        : and(eq(appointmentsTable.id, req.params.id), eq(appointmentsTable.userId, user.id)),
    )
    .returning();
  res.json({ appointment: toAppointment(updated) });
});

router.get("/admin/patients", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!isAdminUser(user)) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  const patients = await db.select().from(usersTable).where(eq(usersTable.role, "Patient"));
  const appointments = await db.select().from(appointmentsTable).orderBy(desc(appointmentsTable.createdAt));
  const appointmentsByUser = new Map<string, typeof appointments>();
  for (const appointment of appointments) {
    const current = appointmentsByUser.get(appointment.userId) ?? [];
    current.push(appointment);
    appointmentsByUser.set(appointment.userId, current);
  }
  res.json({
    patients: patients.map(patient => ({
      id: patient.id,
      name: patient.name,
      initials: patient.initials,
      email: patient.email,
      phone: patient.phone,
      birthday: patient.birthday,
      gender: patient.gender,
      bloodType: patient.bloodType,
      role: patient.role,
      status: patient.status,
      clinicalEditingPermission: patient.clinicalEditingPermission === "true",
      lastActive: patient.updatedAt,
      appointments: (appointmentsByUser.get(patient.id) ?? []).map(toAppointment),
    })),
  });
});

export default router;