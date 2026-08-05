import { createHash, randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { appointmentsTable, db, sessionsTable, usersTable, type PublicUser, type User } from "@workspace/db";
import type { Request } from "express";

const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 30;

export type AuthUser = Omit<PublicUser, "clinicalEditingPermission" | "insuranceData" | "claimsData"> & {
  clinicalEditingPermission: boolean;
  insurance: Record<string, unknown> | null;
  claims: Record<string, unknown>[];
  providerId: string | null;
  specialty: string;
  clinic: string;
  allergies: string[];
};

function toPublicUser(user: User): AuthUser {
  return {
    id: user.id,
    name: user.name,
    initials: user.initials,
    email: user.email,
    phone: user.phone,
    birthday: user.birthday,
    gender: user.gender,
    bloodType: user.bloodType,
    emergencyContact: user.emergencyContact,
    role: user.role as AuthUser["role"],
    providerId: user.providerId,
    specialty: user.specialty,
    clinic: user.clinic,
    allergies: user.allergies ?? [],
    status: user.status as AuthUser["status"],
    clinicalEditingPermission: user.clinicalEditingPermission === "true",
    insurance: user.insuranceData,
    claims: user.claimsData ?? [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.trim().slice(0, 2).toUpperCase();
}

async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [salt] = encoded.split(":");
  if (!salt) return false;
  return (await hashPassword(password, salt)) === encoded;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(user: User) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({
    id: randomUUID(),
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt,
  });
  return { token, user: toPublicUser(user) };
}

export async function getUserFromRequest(req: Request): Promise<AuthUser | null> {
  const authorization = req.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;

  const rows = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(and(eq(sessionsTable.tokenHash, hashToken(token)), gt(sessionsTable.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ? toPublicUser(rows[0].user) : null;
}

export async function registerUser(input: {
  name: string;
  email: string;
  phone: string;
  birthday: string;
  gender: string;
  password: string;
}) {
  const [user] = await db
    .insert(usersTable)
    .values({
      id: `usr_${randomUUID()}`,
      name: input.name.trim(),
      initials: getInitials(input.name),
      email: normalizeEmail(input.email),
      passwordHash: await hashPassword(input.password),
      phone: input.phone.trim(),
      birthday: input.birthday,
      gender: input.gender,
      bloodType: "",
      role: "Patient",
      status: "Active",
      clinicalEditingPermission: "false",
    })
    .returning();
  return user;
}

export async function loginUser(email: string, password: string) {
  const rows = await db.select().from(usersTable).where(eq(usersTable.email, normalizeEmail(email))).limit(1);
  const user = rows[0];
  if (!user || user.status === "Inactive" || !(await verifyPassword(password, user.passwordHash))) {
    return null;
  }
  return user;
}

export async function ensureDemoAdmin() {
  const email = "admin@sugbodoc.test";
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  await ensureDemoPatient();
  if (existing[0]) return existing[0];
  const [user] = await db.insert(usersTable).values({
    id: `usr_${randomUUID()}`,
    name: "SugboDoc Administrator",
    initials: "SA",
    email,
    passwordHash: await hashPassword("admin123"),
    phone: "+63 900 000 0000",
    birthday: "1988-01-01",
    gender: "Prefer not to say",
    bloodType: "",
    role: "Admin",
    status: "Active",
    clinicalEditingPermission: "false",
    insuranceData: null,
    claimsData: [],
  }).returning();
  return user;
}

export async function ensureDemoDoctor() {
  const email = "doctor@sugbodoc.test";
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing[0]) return existing[0];
  const [user] = await db.insert(usersTable).values({
    id: "doctor_dr_2",
    name: "Dr. Jose Reyes",
    initials: "JR",
    email,
    passwordHash: await hashPassword("doctor123"),
    phone: "+63 917 000 0002",
    birthday: "1982-06-18",
    gender: "Male",
    bloodType: "",
    role: "Doctor",
    providerId: "dr_2",
    specialty: "Cardiology",
    clinic: "Chong Hua Hospital",
    allergies: [],
    status: "Active",
    clinicalEditingPermission: "true",
    insuranceData: null,
    claimsData: [],
  }).returning();
  return user;
}

export async function ensureDemoPatient() {
  const email = "juan@example.com";
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing[0]) return existing[0];
  const [user] = await db.insert(usersTable).values({
    id: "pt_123",
    name: "Juan dela Cruz",
    initials: "JD",
    email,
    passwordHash: await hashPassword("juan123"),
    phone: "+63 912 345 6789",
    birthday: "1991-03-15",
    gender: "Male",
    bloodType: "O+",
    role: "Patient",
    status: "Active",
    clinicalEditingPermission: "false",
  }).returning();
  return user;
}

export function isAdminUser(user: AuthUser | null) {
  return user?.role === "Admin" || user?.role === "Clinician";
}

export function isDoctorUser(user: AuthUser | null) {
  return user?.role === "Doctor" && Boolean(user.providerId);
}

export async function doctorCanAccessPatient(user: AuthUser | null, patientId: string) {
  if (!user || user.role !== "Doctor" || !user.providerId) return false;
  const providerId = user.providerId;
  const appointments = await db.select({ data: appointmentsTable.data }).from(appointmentsTable)
    .where(eq(appointmentsTable.userId, patientId));
  return appointments.some(appointment => {
    const doctor = (appointment.data as Record<string, any>).doctor;
    return doctor?.id === providerId;
  });
}