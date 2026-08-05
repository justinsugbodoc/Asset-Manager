import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import {
  db,
  messageConversationsTable,
  messagesTable,
  usersTable,
} from "@workspace/db";
import { getUserFromRequest, isAdminUser, type AuthUser } from "../lib/sugbodoc-auth";
import { z } from "zod";

const router = Router();

const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

async function ensureConversation(patientId: string) {
  const existing = await db.select().from(messageConversationsTable)
    .where(eq(messageConversationsTable.patientId, patientId))
    .limit(1);
  if (existing[0]) return existing[0];
  try {
    const [created] = await db.insert(messageConversationsTable).values({
      id: `conversation_${patientId}`,
      patientId,
    }).returning();
    return created;
  } catch (error: any) {
    if (error?.code !== "23505") throw error;
    const [created] = await db.select().from(messageConversationsTable)
      .where(eq(messageConversationsTable.patientId, patientId))
      .limit(1);
    return created;
  }
}

async function canAccessConversation(user: AuthUser, conversationId: string) {
  const rows = await db.select().from(messageConversationsTable)
    .where(eq(messageConversationsTable.id, conversationId))
    .limit(1);
  const conversation = rows[0];
  if (!conversation) return null;
  if (!isAdminUser(user) && conversation.patientId !== user.id) return null;
  return conversation;
}

function publicMessage(message: typeof messagesTable.$inferSelect, sender?: AuthUser | { name: string; initials: string; role: string }) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderName: sender?.name ?? "SugboDoc user",
    senderInitials: sender?.initials ?? "SD",
    senderRole: sender?.role ?? "Patient",
    body: message.body,
    readAt: message.readAt,
    createdAt: message.createdAt,
  };
}

async function requireUser(req: Request, res: Response) {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in." });
    return null;
  }
  return user;
}

router.get("/messages", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const patients = isAdminUser(user)
    ? await db.select({ id: usersTable.id, name: usersTable.name, initials: usersTable.initials, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.role, "Patient"))
    : [{ id: user.id, name: user.name, initials: user.initials, email: user.email }];

  const conversations = [];
  for (const patient of patients) {
    const conversation = await ensureConversation(patient.id);
    conversations.push({ conversation, patient });
  }

  const allMessages = await db.select().from(messagesTable)
    .orderBy(desc(messagesTable.createdAt));
  const senders = await db.select({ id: usersTable.id, name: usersTable.name, initials: usersTable.initials, role: usersTable.role })
    .from(usersTable);
  const senderMap = new Map(senders.map(sender => [sender.id, sender]));

  res.json({
    conversations: conversations.map(({ conversation, patient }) => {
      const threadMessages = allMessages.filter(message => message.conversationId === conversation.id);
      const latest = threadMessages[0];
      return {
        id: conversation.id,
        patientId: patient.id,
        patientName: patient.name,
        patientInitials: patient.initials,
        patientEmail: patient.email,
        updatedAt: latest?.createdAt ?? conversation.updatedAt,
        unreadCount: threadMessages.filter(message => message.senderId !== user.id && !message.readAt).length,
        lastMessage: latest ? publicMessage(latest, senderMap.get(latest.senderId)) : null,
      };
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
  });
});

router.get("/messages/:conversationId", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const conversation = await canAccessConversation(user, req.params.conversationId);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  const rows = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, conversation.id))
    .orderBy(asc(messagesTable.createdAt));
  const senders = await db.select({ id: usersTable.id, name: usersTable.name, initials: usersTable.initials, role: usersTable.role })
    .from(usersTable);
  const senderMap = new Map(senders.map(sender => [sender.id, sender]));
  const patient = await db.select({ id: usersTable.id, name: usersTable.name, initials: usersTable.initials, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, conversation.patientId))
    .limit(1);
  res.json({
    conversation: {
      id: conversation.id,
      patientId: patient[0]?.id ?? conversation.patientId,
      patientName: patient[0]?.name ?? "Patient",
      patientInitials: patient[0]?.initials ?? "PT",
      patientEmail: patient[0]?.email ?? "",
    },
    messages: rows.map(message => publicMessage(message, senderMap.get(message.senderId))),
  });
});

router.post("/messages/:conversationId", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const conversation = await canAccessConversation(user, req.params.conversationId);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Message text is required and must be 4,000 characters or fewer." });
    return;
  }
  const [message] = await db.insert(messagesTable).values({
    id: `message_${randomUUID()}`,
    conversationId: conversation.id,
    senderId: user.id,
    body: parsed.data.body,
  }).returning();
  await db.update(messageConversationsTable).set({ updatedAt: new Date() })
    .where(eq(messageConversationsTable.id, conversation.id));
  res.status(201).json({ message: publicMessage(message, user) });
});

router.patch("/messages/:conversationId/read", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const conversation = await canAccessConversation(user, req.params.conversationId);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  await db.update(messagesTable).set({ readAt: new Date() })
    .where(and(
      eq(messagesTable.conversationId, conversation.id),
      ne(messagesTable.senderId, user.id),
    ));
  res.json({ success: true });
});

export default router;