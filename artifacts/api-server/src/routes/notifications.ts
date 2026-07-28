import { Router } from "express";
import { z } from "zod";
import { sendAppointmentEmail } from "../connectors/email-connector";
import { buildAppointmentEmailHtml } from "../templates/appointment-email";

const router = Router();

const appointmentEmailSchema = z.object({
  appointmentReference: z.string().min(1),
  patientName: z.string().min(1),
  email: z.string().email(),
  doctorName: z.string().min(1),
  specialty: z.string().min(1),
  clinicName: z.string().min(1),
  appointmentDate: z.string().min(1),
  appointmentTime: z.string().min(1),
  status: z.string().min(1),
});

router.post("/notifications/appointment-email", async (req, res) => {
  const parsed = appointmentEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const html = buildAppointmentEmailHtml(data);

  const result = await sendAppointmentEmail({
    to: data.email,
    patientName: data.patientName,
    appointmentReference: data.appointmentReference,
    doctorName: data.doctorName,
    specialty: data.specialty,
    clinicName: data.clinicName,
    appointmentDate: data.appointmentDate,
    appointmentTime: data.appointmentTime,
    status: data.status,
    htmlBody: html,
  });

  if (result.success) {
    res.status(200).json({ sent: true, messageId: result.messageId });
  } else {
    // Return 207 so the frontend knows the appointment is fine but email failed
    res.status(207).json({ sent: false, error: result.error });
  }
});

export default router;
