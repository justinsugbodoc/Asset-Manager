import { Resend } from "resend";
import { logger } from "../lib/logger";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
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
  const fromAddress = process.env["EMAIL_FROM"] ?? "noreply@sugbodoc.com";

  try {
    const client = getResendClient();
    const { data, error } = await client.emails.send({
      from: fromAddress,
      to: [payload.to],
      subject: `SugboDoc Appointment Confirmation — ${payload.appointmentReference}`,
      html: payload.htmlBody,
    });

    if (error) {
      logger.error({ error, ref: payload.appointmentReference }, "Resend API returned error");
      return { success: false, error: error.message };
    }

    logger.info(
      { messageId: data?.id, ref: payload.appointmentReference },
      "Appointment confirmation email sent",
    );
    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    logger.error({ err: message, ref: payload.appointmentReference }, "Failed to send email");
    return { success: false, error: message };
  }
}
