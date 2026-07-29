import nodemailer from "nodemailer";
import { logger } from "../lib/logger";

let smtpTransport: nodemailer.Transporter | null = null;

function getSmtpTransport(): nodemailer.Transporter {
  if (smtpTransport) return smtpTransport;

  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  const port = Number(process.env["SMTP_PORT"] ?? "587");
  const secure = (process.env["SMTP_SECURE"] ?? "").toLowerCase() === "true" || port === 465;

  if (!host) throw new Error("SMTP_HOST environment variable is not set");
  if (!user) throw new Error("SMTP_USER environment variable is not set");
  if (!pass) throw new Error("SMTP_PASS environment variable is not set");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid port number");
  }

  smtpTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return smtpTransport;
}

export type EmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export type AppointmentEmailPayload = {
  to: string;
  patientName: string;
  appointmentReference: string;
  doctorName: string;
  specialty: string;
  clinicName: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  htmlBody: string;
};

export async function sendAppointmentEmail(
  payload: AppointmentEmailPayload,
): Promise<EmailResult> {
  const fromAddress = process.env["EMAIL_FROM"] ?? process.env["SMTP_USER"];

  try {
    if (!fromAddress) {
      throw new Error("EMAIL_FROM or SMTP_USER environment variable is required");
    }

    const info = await getSmtpTransport().sendMail({
      from: fromAddress,
      to: payload.to,
      subject: `SugboDoc Appointment Confirmation — ${payload.appointmentReference}`,
      html: payload.htmlBody,
    });

    logger.info(
      { messageId: info.messageId, ref: payload.appointmentReference },
      "Appointment confirmation email sent",
    );
    return { success: true, messageId: info.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    logger.error({ err: message, ref: payload.appointmentReference }, "Failed to send email");
    return { success: false, error: message };
  }
}
