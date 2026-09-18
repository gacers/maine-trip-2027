import { Resend } from "resend";

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  return new Resend(apiKey);
}

function fromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    throw new Error(
      "RESEND_FROM_EMAIL is not set — use a verified domain address like 'Trip Planner <invites@yourdomain.com>'",
    );
  }
  return from;
}

export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  // Local fallback so invite links still work in `next dev` before
  // NEXT_PUBLIC_SITE_URL is pointed at production.
  return "http://localhost:3000";
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function buildInviteUrl(tripSlug: string, token: string, email: string): string {
  const url = new URL(`/${tripSlug}`, `${siteOrigin()}/`);
  url.searchParams.set("invite", token);
  url.searchParams.set("email", email.trim());
  return url.toString();
}

export interface SendInviteEmailArgs {
  to: string;
  tripName: string;
  inviteUrl: string;
}

// Sends the invite via Resend. Callers must already have authorized the
// request (admin / write access) — this helper only talks to Resend.
export async function sendInviteEmail({ to, tripName, inviteUrl }: SendInviteEmailArgs): Promise<void> {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: fromAddress(),
    to: [to.trim()],
    subject: `Invite to ${tripName}`,
    html: inviteEmailHtml({ tripName, inviteUrl }),
    text: inviteEmailText({ tripName, inviteUrl }),
  });
  if (error) {
    throw new Error(error.message || "Failed to send invite email");
  }
}

function inviteEmailText({ tripName, inviteUrl }: { tripName: string; inviteUrl: string }): string {
  return [
    `You're invited to help plan ${tripName}.`,
    "",
    "Open this link to get access (works in this browser; you can create a permanent login once you're in):",
    inviteUrl,
    "",
  ].join("\n");
}

function inviteEmailHtml({ tripName, inviteUrl }: { tripName: string; inviteUrl: string }): string {
  const safeName = escapeHtml(tripName);
  const safeUrl = escapeHtml(inviteUrl);
  return `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #18181b; padding: 24px;">
    <p style="margin: 0 0 16px;">You're invited to help plan <strong>${safeName}</strong>.</p>
    <p style="margin: 0 0 16px;">Open this link to get access (works in this browser; you can create a permanent login once you're in):</p>
    <p style="margin: 0 0 24px;">
      <a href="${safeUrl}" style="display: inline-block; background: #18181b; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 6px; font-weight: 600;">
        Open invite
      </a>
    </p>
    <p style="margin: 0; font-size: 13px; color: #71717a; word-break: break-all;">
      Or paste this URL:<br />${safeUrl}
    </p>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
