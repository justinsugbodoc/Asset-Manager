import { Router } from "express";
import { z } from "zod";
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

export default router;