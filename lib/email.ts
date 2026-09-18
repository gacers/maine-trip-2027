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

export interface SendAccessRequestEmailArgs {
  to: string;
  tripName: string;
  tripSlug: string;
  requesterEmail: string;
  message?: string;
  sectionLabel?: string;
  pageUrl?: string;
}

// Visitor → trip owner access request (Request Access UI). Public
// callers; the route picks `to` from app settings, not the client.
export async function sendAccessRequestEmail({
  to,
  tripName,
  tripSlug,
  requesterEmail,
  message,
  sectionLabel,
  pageUrl,
}: SendAccessRequestEmailArgs): Promise<void> {
  const resend = getResend();
  const adminUrl = `${siteOrigin()}/${tripSlug}/admin/api-keys`;
  const { error } = await resend.emails.send({
    from: fromAddress(),
    to: [to.trim()],
    replyTo: requesterEmail.trim(),
    subject: `Access request: ${tripName}`,
    html: accessRequestHtml({
      tripName,
      requesterEmail,
      message,
      sectionLabel,
      pageUrl,
      adminUrl,
    }),
    text: accessRequestText({
      tripName,
      requesterEmail,
      message,
      sectionLabel,
      pageUrl,
      adminUrl,
    }),
  });
  if (error) {
    throw new Error(error.message || "Failed to send access request");
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

function accessRequestText({
  tripName,
  requesterEmail,
  message,
  sectionLabel,
  pageUrl,
  adminUrl,
}: {
  tripName: string;
  requesterEmail: string;
  message?: string;
  sectionLabel?: string;
  pageUrl?: string;
  adminUrl: string;
}): string {
  const lines = [
    sectionLabel
      ? `${requesterEmail} asked for access to "${sectionLabel}" on ${tripName}.`
      : `${requesterEmail} asked for access to ${tripName}.`,
  ];
  if (message?.trim()) {
    lines.push("", message.trim());
  }
  if (pageUrl) {
    lines.push("", `Page: ${pageUrl}`);
  }
  lines.push("", `Create an invite: ${adminUrl}`, "");
  return lines.join("\n");
}

function accessRequestHtml({
  tripName,
  requesterEmail,
  message,
  sectionLabel,
  pageUrl,
  adminUrl,
}: {
  tripName: string;
  requesterEmail: string;
  message?: string;
  sectionLabel?: string;
  pageUrl?: string;
  adminUrl: string;
}): string {
  const safeTrip = escapeHtml(tripName);
  const safeEmail = escapeHtml(requesterEmail);
  const safeSection = sectionLabel ? escapeHtml(sectionLabel) : "";
  const safeMessage = message?.trim() ? escapeHtml(message.trim()).replace(/\n/g, "<br />") : "";
  const safePage = pageUrl ? escapeHtml(pageUrl) : "";
  const safeAdmin = escapeHtml(adminUrl);
  const lead = safeSection
    ? `<strong>${safeEmail}</strong> asked for access to &ldquo;${safeSection}&rdquo; on <strong>${safeTrip}</strong>.`
    : `<strong>${safeEmail}</strong> asked for access to <strong>${safeTrip}</strong>.`;
  return `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #18181b; padding: 24px;">
    <p style="margin: 0 0 16px;">${lead}</p>
    ${safeMessage ? `<p style="margin: 0 0 16px; white-space: pre-wrap;">${safeMessage}</p>` : ""}
    ${safePage ? `<p style="margin: 0 0 16px; font-size: 13px; color: #71717a; word-break: break-all;">Page: ${safePage}</p>` : ""}
    <p style="margin: 0 0 24px;">
      <a href="${safeAdmin}" style="display: inline-block; background: #18181b; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 6px; font-weight: 600;">
        Open invite admin
      </a>
    </p>
    <p style="margin: 0; font-size: 13px; color: #71717a;">Reply to this email to write them back.</p>
  </body>
</html>`;
}
