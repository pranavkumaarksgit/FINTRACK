import nodemailer from "nodemailer";
import dotenv from "dotenv";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure backend .env and root .env are loaded
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

function getSmtpConfig() {
  // Reload environment variables so updates to backend/.env are picked up immediately
  dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: true });
  dotenv.config({ path: path.resolve(__dirname, "../../../.env"), override: true });

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUsername = process.env.SMTP_USERNAME;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM_EMAIL || smtpUsername;

  const isPlaceholderUser = smtpUsername === 'your-email@gmail.com';
  const isPlaceholderPass = smtpPassword === 'your-16-character-app-password';
  const isConfigured = Boolean(
    smtpHost &&
    smtpUsername &&
    smtpPassword &&
    fromEmail &&
    !isPlaceholderUser &&
    !isPlaceholderPass
  );

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUsername,
      pass: smtpPassword,
    },
  });

  return {
    smtpHost,
    smtpPort,
    smtpUsername,
    smtpPassword,
    fromEmail,
    isPlaceholderUser,
    isPlaceholderPass,
    isConfigured,
    transporter
  };
}

export async function verifyEmailConnection(): Promise<boolean> {
  const config = getSmtpConfig();

  if (!config.smtpHost || !config.smtpUsername || !config.smtpPassword) {
    console.warn("[SMTP Warning]: Missing SMTP configuration fields in backend/.env.");
    return false;
  }

  if (config.isPlaceholderUser || config.isPlaceholderPass) {
    console.warn(
      `[SMTP Notice]: Default placeholders detected on disk in backend/.env (Username: "${config.smtpUsername}", Password placeholder: ${config.isPlaceholderPass ? 'yes' : 'no'}). Make sure to save (Ctrl+S) backend/.env.`
    );
    return false;
  }

  try {
    console.log(`[SMTP]: Testing connection to ${config.smtpHost}:${config.smtpPort} as ${config.smtpUsername}...`);
    await config.transporter.verify();
    console.log("✓ SMTP connection successful. Ready to send emails.");
    return true;
  } catch (error: any) {
    console.error("✗ SMTP connection failed:", error?.message || error);
    return false;
  }
}

export function validateRecipientEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new Error('Email recipient is required and must be a valid string.');
  }

  const trimmed = email.trim().toLowerCase();

  // Guard against internal identifiers accidentally being passed as recipient
  if (/^(corp|usr|tkt|tx|ntf)_[a-zA-Z0-9]+$/i.test(trimmed)) {
    throw new Error(`Refusing to send email to internal identifier: "${trimmed}". Recipient must be a customer email address.`);
  }

  // General email format validation (RFC-compliant standard syntax)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    throw new Error(`Invalid recipient email address format: "${trimmed}".`);
  }

  return trimmed;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}) {
  const recipient = validateRecipientEmail(options.to);
  const config = getSmtpConfig();

  if (!config.isConfigured) {
    throw new Error("SMTP is not configured.");
  }

  // Safe sandbox for synthetic non-routable test domains to prevent upstream SMTP bounces (e.g. Google NXDOMAIN bounces)
  const nonRoutableDomains = ['@fintrack.io', '@example.com', '@test.com', '@localhost'];
  const isNonRoutableDomain = nonRoutableDomains.some(d => recipient.endsWith(d));

  if (isNonRoutableDomain) {
    console.log(`[SMTP Sandbox]: Intercepted non-routable domain recipient "${recipient}" — skipping remote MX socket to avoid NXDOMAIN bounce.`);
    return {
      accepted: [recipient],
      rejected: [],
      messageId: `<sandbox-${Date.now()}@fintrack.local>`,
      response: '250 Sandbox OK'
    };
  }

  // Safe development logging without exposing sensitive tokens or secrets
  console.log(`[SMTP]: Dispatching email to verified recipient: ${recipient}`);

  return config.transporter.sendMail({
    from: `"FINTRACK" <${config.fromEmail}>`,
    to: recipient,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
) {
  const frontendUrl =
    process.env.FRONTEND_URL || "http://localhost:5173";

  const resetUrl =
    `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

  return sendEmail({
    to: email,
    subject: "Reset your FINTRACK password",

    text: `
Hello,

We received a request to reset your FINTRACK password.

Reset your password here:

${resetUrl}

This link will expire soon and can only be used once.

If you did not request a password reset, you can safely ignore this email.

Regards,
FINTRACK Team
`,

    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Reset your FINTRACK password</title>
</head>

<body style="font-family: Arial, sans-serif; background:#f5f7fa; padding:40px;">

  <div style="
    max-width:600px;
    margin:auto;
    background:white;
    padding:32px;
    border-radius:12px;
  ">

    <h1 style="margin-bottom:8px;">
      FINTRACK
    </h1>

    <h2>Reset your password</h2>

    <p>
      We received a request to reset your FINTRACK password.
    </p>

    <p>
      Click the button below to create a new password.
    </p>

    <p style="margin:30px 0;">
      <a
        href="${resetUrl}"
        style="
          background:#0f766e;
          color:white;
          padding:12px 20px;
          text-decoration:none;
          border-radius:8px;
          display:inline-block;
        "
      >
        Reset Password
      </a>
    </p>

    <p>
      This link will expire soon and can only be used once.
    </p>

    <p>
      If you did not request a password reset,
      you can safely ignore this email.
    </p>

    <hr />

    <p style="color:#777;font-size:13px;">
      FINTRACK — Track. Analyze. Grow.
    </p>

  </div>

</body>
</html>
`,
  });
}

export async function sendVerificationEmail(
  email: string,
  verificationToken: string
) {
  const frontendUrl =
    process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:5173";

  const verificationUrl =
    `${frontendUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;

  return sendEmail({
    to: email,
    subject: "Verify your FINTRACK account",

    text: `
Hello,

Welcome to FINTRACK! Thank you for establishing your financial workspace.

Please verify your email address by visiting this link:

${verificationUrl}

This verification link will expire in 60 minutes.

If you did not create a FINTRACK account, you can safely ignore this email.

Regards,
FINTRACK Team
`,

    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Verify your FINTRACK account</title>
</head>

<body style="font-family: Arial, sans-serif; background:#0b132b; padding:40px; color:#e2e8f0;">

  <div style="
    max-width:600px;
    margin:auto;
    background:#0f172a;
    padding:36px;
    border-radius:16px;
    border:1px solid #1e293b;
  ">

    <h1 style="color:#10b981; margin:0 0 16px 0; font-size:24px; font-weight:bold;">
      FINTRACK
    </h1>

    <h2 style="color:#ffffff; font-size:18px; margin:0 0 12px 0;">
      Verify your email address
    </h2>

    <p style="color:#94a3b8; font-size:14px; line-height:1.6; margin-bottom:24px;">
      Welcome to FINTRACK! Please confirm your email address to complete your registration and activate your financial workspace.
    </p>

    <div style="margin:28px 0;">
      <a
        href="${verificationUrl}"
        style="
          background:#059669;
          color:#ffffff;
          padding:12px 24px;
          text-decoration:none;
          border-radius:8px;
          font-weight:bold;
          font-size:14px;
          display:inline-block;
        "
      >
        Verify Email Address
      </a>
    </div>

    <p style="color:#64748b; font-size:13px; line-height:1.5;">
      Button not working? Copy and paste this link into your browser:<br />
      <a href="${verificationUrl}" style="color:#38bdf8; word-break:break-all;">${verificationUrl}</a>
    </p>

    <p style="color:#94a3b8; font-size:13px; margin-top:20px;">
      This link will expire in <strong>60 minutes</strong> and can only be used once.
    </p>

    <p style="color:#64748b; font-size:12px; margin-top:16px;">
      If you did not request this account, you can safely ignore this email.
    </p>

    <hr style="border:none; border-top:1px solid #1e293b; margin:24px 0;" />

    <p style="color:#475569; font-size:12px; margin:0;">
      FINTRACK — Track. Analyze. Grow.
    </p>

  </div>

</body>
</html>
`,
  });
}

export const transporter = getSmtpConfig().transporter;
