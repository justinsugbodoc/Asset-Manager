import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const usersTable = pgTable("sugbodoc_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  initials: text("initials").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone").notNull().default(""),
  birthday: text("birthday").notNull().default(""),
  gender: text("gender").notNull().default(""),
  bloodType: text("blood_type").notNull().default(""),
  emergencyContact: jsonb("emergency_contact").$type<{ name: string; number: string } | null>(),
  role: text("role").notNull().default("Patient"),
  status: text("status").notNull().default("Active"),
  clinicalEditingPermission: text("clinical_editing_permission").notNull().default("false"),
  insuranceData: jsonb("insurance_data").$type<Record<string, unknown> | null>(),
  claimsData: jsonb("claims_data").$type<Record<string, unknown>[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsTable = pgTable("sugbodoc_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appointmentsTable = pgTable("sugbodoc_appointments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  reference: text("reference").notNull().unique(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  status: text("status").notNull().default("Pending"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const encountersTable = pgTable("sugbodoc_encounters", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  appointmentId: text("appointment_id").references(() => appointmentsTable.id, { onDelete: "set null" }),
  reference: text("reference").notNull().unique(),
  encounterDate: text("encounter_date").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clinicalRecordsTable = pgTable("sugbodoc_clinical_records", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  encounterId: text("encounter_id").notNull().references(() => encountersTable.id, { onDelete: "cascade" }),
  recordType: text("record_type").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pharmacyMedicationsTable = pgTable("sugbodoc_pharmacy_medications", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  genericName: text("generic_name").notNull().default(""),
  dosage: text("dosage").notNull().default(""),
  dosageForm: text("dosage_form").notNull().default(""),
  form: text("form").notNull().default(""),
  category: text("category").notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
  enabled: text("enabled").notNull().default("true"),
  partnerLocations: jsonb("partner_locations").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pharmacyOrdersTable = pgTable("sugbodoc_pharmacy_orders", {
  reference: text("reference").primaryKey(),
  patientId: text("patient_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  encounterId: text("encounter_id").references(() => encountersTable.id, { onDelete: "set null" }),
  billId: text("bill_id"),
  status: text("status").notNull().default("Pending"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pharmacyBillsTable = pgTable("sugbodoc_pharmacy_bills", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  orderReference: text("order_reference").notNull().references(() => pharmacyOrdersTable.reference, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("Pending"),
  billDate: timestamp("bill_date", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderReferenceUnique: uniqueIndex("sugbodoc_pharmacy_bills_order_reference_idx").on(table.orderReference),
}));

export const pharmacyPaymentsTable = pgTable("sugbodoc_pharmacy_payments", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  orderReference: text("order_reference").notNull().references(() => pharmacyOrdersTable.reference, { onDelete: "cascade" }),
  billId: text("bill_id").notNull().references(() => pharmacyBillsTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("Paid"),
  paymentDate: timestamp("payment_date", { withTimezone: true }).notNull().defaultNow(),
  reference: text("reference").notNull(),
  stripeSessionId: text("stripe_session_id"),
  fulfillmentStatus: text("fulfillment_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderReferenceUnique: uniqueIndex("sugbodoc_pharmacy_payments_order_reference_idx").on(table.orderReference),
  stripeSessionUnique: uniqueIndex("sugbodoc_pharmacy_payments_stripe_session_idx").on(table.stripeSessionId),
}));

export const adminSchedulesTable = pgTable("sugbodoc_admin_schedules", {
  id: text("id").primaryKey(),
  doctorId: text("doctor_id").notNull(),
  doctorName: text("doctor_name").notNull(),
  specialty: text("specialty").notNull(),
  clinic: text("clinic").notNull(),
  day: text("day").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  slots: integer("slots").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEventsTable = pgTable("sugbodoc_audit_events", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const messageConversationsTable = pgTable("sugbodoc_message_conversations", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messagesTable = pgTable("sugbodoc_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => messageConversationsTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  createdAt: true,
});
export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertEncounterSchema = createInsertSchema(encountersTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type User = typeof usersTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;
export type Appointment = typeof appointmentsTable.$inferSelect;
export type Encounter = typeof encountersTable.$inferSelect;
export type ClinicalRecord = typeof clinicalRecordsTable.$inferSelect;
export type PharmacyMedication = typeof pharmacyMedicationsTable.$inferSelect;
export type PharmacyOrder = typeof pharmacyOrdersTable.$inferSelect;
export type PharmacyBill = typeof pharmacyBillsTable.$inferSelect;
export type PharmacyPayment = typeof pharmacyPaymentsTable.$inferSelect;
export type AdminSchedule = typeof adminSchedulesTable.$inferSelect;
export type AuditEvent = typeof auditEventsTable.$inferSelect;
export type MessageConversation = typeof messageConversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type PublicUser = Omit<User, "passwordHash">;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type InsertEncounter = z.infer<typeof insertEncounterSchema>;