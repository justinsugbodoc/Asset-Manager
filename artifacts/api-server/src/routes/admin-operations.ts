import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { adminSchedulesTable, auditEventsTable, db } from "@workspace/db";
import { getUserFromRequest, isAdminUser } from "../lib/sugbodoc-auth";

const router = Router();

const scheduleSchema = z.object({
  id: z.string().min(1),
  doctorId: z.string().min(1),
  doctorName: z.string().min(1),
  specialty: z.string().min(1),
  clinic: z.string().min(1),
  day: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  slots: z.number().int().min(0),
  enabled: z.boolean(),
});

const defaultSchedules = [
  ["dr_1", "Dr. Maria Santos", "Internal Medicine", "Cebu Doctors' University Hospital", "Monday"],
  ["dr_2", "Dr. Jose Reyes", "Cardiology", "Chong Hua Hospital", "Tuesday"],
  ["dr_3", "Dr. Ana Villanueva", "OB-GYN", "Perpetual Succour Hospital", "Wednesday"],
  ["dr_4", "Dr. Carlo Mendoza", "Dermatology", "Vicente Sotto Memorial Medical Center", "Thursday"],
  ["dr_5", "Dr. Lea Fernandez", "Pediatrics", "Cebu Doctors' University Hospital", "Friday"],
] as const;

async function requireAdmin(req: Request, res: Response) {
  const user = await getUserFromRequest(req);
  if (!isAdminUser(user)) {
    res.status(user ? 403 : 401).json({ error: "Admin access required." });
    return null;
  }
  return user;
}

router.get("/admin/schedules", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  let rows = await db.select().from(adminSchedulesTable).orderBy(asc(adminSchedulesTable.doctorName));
  if (!rows.length) {
    await db.insert(adminSchedulesTable).values(defaultSchedules.map(([doctorId, doctorName, specialty, clinic, day], index) => ({
      id: `schedule_${doctorId}`,
      doctorId,
      doctorName,
      specialty,
      clinic,
      day,
      startTime: "09:00",
      endTime: "17:00",
      slots: 8,
      enabled: true,
    })));
    rows = await db.select().from(adminSchedulesTable).orderBy(asc(adminSchedulesTable.doctorName));
  }
  res.json({ schedules: rows });
});

router.put("/admin/schedules", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const parsed = z.array(scheduleSchema).safeParse(req.body?.schedules);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid schedule data." });
    return;
  }
  await db.transaction(async tx => {
    await tx.delete(adminSchedulesTable);
    if (parsed.data.length) await tx.insert(adminSchedulesTable).values(parsed.data);
  });
  res.json({ schedules: await db.select().from(adminSchedulesTable).orderBy(asc(adminSchedulesTable.doctorName)) });
});

router.get("/admin/audit-events", async (req, res) => {
  if (!await requireAdmin(req, res)) return;
  const events = await db.select().from(auditEventsTable).orderBy(desc(auditEventsTable.timestamp)).limit(100);
  res.json({ events });
});

router.post("/admin/audit-events", async (req, res) => {
  const user = await requireAdmin(req, res);
  if (!user) return;
  const parsed = z.object({
    action: z.string().trim().min(1).max(200),
    target: z.string().trim().min(1).max(300),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid audit event." });
    return;
  }
  const [event] = await db.insert(auditEventsTable).values({
    id: `audit_${randomUUID()}`,
    actor: user.name,
    action: parsed.data.action,
    target: parsed.data.target,
  }).returning();
  res.status(201).json({ event });
});

export default router;