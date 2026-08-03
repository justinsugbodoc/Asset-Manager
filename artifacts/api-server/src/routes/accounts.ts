import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import { createSession, ensureDemoAdmin, getUserFromRequest, loginUser, registerUser } from "../lib/sugbodoc-auth";

const router = Router();

const registrationSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().email(),
  phone: z.string().trim().min(1),
  birthday: z.string().min(1),
  gender: z.string().min(1),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/accounts/register", async (req, res) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid registration details", details: parsed.error.flatten() });
    return;
  }
  try {
    const user = await registerUser({ ...parsed.data, name: parsed.data.fullName });
    res.status(201).json(await createSession(user));
  } catch (error: any) {
    if (error?.code === "23505") {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }
    res.status(500).json({ error: "Unable to create the account." });
  }
});

router.post("/accounts/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }
  try {
    await ensureDemoAdmin();
    const user = await loginUser(parsed.data.email, parsed.data.password);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }
    res.json(await createSession(user));
  } catch {
    res.status(500).json({ error: "Unable to sign in right now." });
  }
});

router.get("/accounts/me", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Not signed in." });
      return;
    }
    res.json({ user });
  } catch {
    res.status(500).json({ error: "Unable to load the account." });
  }
});

router.patch("/accounts/me", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const parsed = z.object({
    name: z.string().trim().min(2).optional(),
    email: z.string().email().optional(),
    phone: z.string().trim().min(1).optional(),
    birthday: z.string().min(1).optional(),
    gender: z.string().min(1).optional(),
    insurance: z.record(z.string(), z.unknown()).nullable().optional(),
    claims: z.array(z.record(z.string(), z.unknown())).optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile details." });
    return;
  }
  try {
    const [updated] = await db.update(usersTable).set({
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.name ? { initials: parsed.data.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() } : {}),
      ...(parsed.data.email ? { email: parsed.data.email.trim().toLowerCase() } : {}),
      ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
      ...(parsed.data.birthday ? { birthday: parsed.data.birthday } : {}),
      ...(parsed.data.gender ? { gender: parsed.data.gender } : {}),
      ...(parsed.data.insurance !== undefined ? { insuranceData: parsed.data.insurance } : {}),
      ...(parsed.data.claims ? { claimsData: parsed.data.claims } : {}),
      updatedAt: new Date(),
    }).where(eq(usersTable.id, user.id)).returning();
    res.json({ user: updated });
  } catch (error: any) {
    if (error?.code === "23505") {
      res.status(409).json({ error: "That email address is already in use." });
      return;
    }
    res.status(500).json({ error: "Unable to update the profile." });
  }
});

export default router;