import "server-only";
import { Resend } from "resend";

type Mail = { to: string; subject: string; text: string; ics?: string };

/** Sends through Resend when RESEND_API_KEY is set; otherwise logs and skips. */
export async function sendMail(mail: Mail) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "OpenCal <onboarding@resend.dev>";
  if (!key) {
    console.log(`[opencal] email skipped (no RESEND_API_KEY): "${mail.subject}" -> ${mail.to}`);
    return;
  }
  try {
    await new Resend(key).emails.send({
      from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      attachments: mail.ics ? [{ filename: "invite.ics", content: Buffer.from(mail.ics).toString("base64") }] : undefined,
    });
  } catch (err) {
    console.error(`[opencal] email failed: ${(err as Error).message}`);
  }
}
