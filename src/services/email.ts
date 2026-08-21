import nodemailer, {type SendMailOptions,type Transporter,} from "nodemailer";
import { randomUUID } from "node:crypto";
import type {EmailDraft,EmailDraftPurpose,} from "../agents/types";

export interface MailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
}

export type SendMailFunction = (
  payload: MailPayload
) => Promise<void>;

let testTransport: SendMailFunction | null = null;

function createTransporter(): Transporter {
  const user = process.env.EMAIL_USER;
  const password = process.env.EMAIL_PASSWORD;

  if (!user || !password) {
    throw new Error(
      "EMAIL_USER and EMAIL_PASSWORD must be configured."
    );
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass: password,
    },
  });
}

function getRealSendFunction(): SendMailFunction {
  return async (payload: MailPayload) => {
    const transporter = createTransporter();

    const options: SendMailOptions = {
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    };

    await transporter.sendMail(options);
  };
}

/**
 * Test-only dependency injection.
 *
 * Production code never calls this.
 */
export function setTestEmailTransport(
  transport: SendMailFunction | null
): void {
  testTransport = transport;
}

function getSendFunction(): SendMailFunction {
  return testTransport ?? getRealSendFunction();
}

function validateRecipient(to: string): void {
  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(to)) {
    throw new Error(
      "A valid recipient email address is required."
    );
  }
}

function validateDraft(draft: EmailDraft): void {
  if (!draft.id) {
    throw new Error("Email draft is missing an ID.");
  }

  if (!draft.to) {
    throw new Error(
      "Email draft is missing a recipient."
    );
  }

  validateRecipient(draft.to);

  if (!draft.subject.trim()) {
    throw new Error(
      "Email draft is missing a subject."
    );
  }

  if (!draft.html.trim()) {
    throw new Error(
      "Email draft is missing email content."
    );
  }
}

export async function draftEmail(input: {
  to: string;
  subject: string;
  body: string;
  html: string;
  purpose: EmailDraftPurpose;
}): Promise<EmailDraft> {
  validateRecipient(input.to);

  return {
    id: randomUUID(),
    to: input.to,
    subject: input.subject,
    body: input.body,
    html: input.html,
    purpose: input.purpose,
    status: "pending_approval",
    createdAt: Date.now(),
  };
}

/**
 * HARD SAFETY GATE
 *
 * This function refuses to send anything unless the
 * draft has already been explicitly approved.
 */
export async function sendApprovedEmail(
  draft: EmailDraft
): Promise<void> {
  validateDraft(draft);

  if (draft.status !== "approved") {
    throw new Error(
      "Safety gate blocked email send: explicit approval is required."
    );
  }

  const sender = process.env.EMAIL_USER;

  if (!sender) {
    throw new Error(
      "EMAIL_USER must be configured."
    );
  }

  const sendFunction = getSendFunction();

  await sendFunction({
    from: sender,
    to: draft.to,
    subject: draft.subject,
    html: draft.html,
  });
}