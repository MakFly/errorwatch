import { Resend } from "resend";
import logger from "../logger";
import type { ErrorAlertEmailData, ThresholdAlertEmailData, InvitationEmailData, CronAlertEmailData } from "../types/services";

// Lazy initialization - only create Resend instance when needed
let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = process.env.EMAIL_FROM || "ErrorWatch <alerts@errorwatch.io>";

export async function sendErrorAlertEmail(data: ErrorAlertEmailData): Promise<{ success: boolean; error?: string }> {
  const client = getResend();
  if (!client) {
    logger.warn("RESEND_API_KEY not configured, skipping email");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const { error } = await client.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: `[${data.projectName}] Error Alert: ${data.errorMessage.slice(0, 50)}${data.errorMessage.length > 50 ? "..." : ""}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0b; color: #e4e4e7; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 12px 20px; border-radius: 12px;">
        <span style="font-size: 20px; font-weight: bold; color: white;">ErrorWatch</span>
      </div>
    </div>

    <!-- Alert Badge -->
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="display: inline-block; background-color: rgba(239, 68, 68, 0.15); color: #f87171; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid rgba(239, 68, 68, 0.3);">
        New Error Detected
      </span>
    </div>

    <!-- Main Content -->
    <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
      <!-- Error Message -->
      <div style="margin-bottom: 20px;">
        <p style="color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px 0;">Error Message</p>
        <p style="font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 14px; color: #f87171; margin: 0; word-break: break-word;">${escapeHtml(data.errorMessage)}</p>
      </div>

      <!-- File Location -->
      <div style="margin-bottom: 20px;">
        <p style="color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px 0;">Location</p>
        <p style="font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 13px; margin: 0;">
          <span style="color: #a78bfa;">${escapeHtml(data.errorFile)}</span><span style="color: #52525b;">:</span><span style="color: #fbbf24;">${data.errorLine}</span>
        </p>
      </div>

      <!-- Stats Row -->
      <div style="display: flex; gap: 16px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 100px; background-color: #09090b; border-radius: 8px; padding: 12px;">
          <p style="color: #a1a1aa; font-size: 11px; text-transform: uppercase; margin: 0 0 4px 0;">Events</p>
          <p style="font-size: 20px; font-weight: bold; color: white; margin: 0;">${data.eventCount}</p>
        </div>
        <div style="flex: 1; min-width: 100px; background-color: #09090b; border-radius: 8px; padding: 12px;">
          <p style="color: #a1a1aa; font-size: 11px; text-transform: uppercase; margin: 0 0 4px 0;">Project</p>
          <p style="font-size: 14px; font-weight: 500; color: white; margin: 0;">${escapeHtml(data.projectName)}</p>
        </div>
        ${data.environment ? `
        <div style="flex: 1; min-width: 100px; background-color: #09090b; border-radius: 8px; padding: 12px;">
          <p style="color: #a1a1aa; font-size: 11px; text-transform: uppercase; margin: 0 0 4px 0;">Environment</p>
          <p style="font-size: 14px; font-weight: 500; color: ${data.environment === 'prod' || data.environment === 'production' ? '#f87171' : '#fbbf24'}; margin: 0;">${escapeHtml(data.environment)}</p>
        </div>
        ` : ""}
      </div>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${data.dashboardUrl}/dashboard/issues/${data.fingerprint}"
         style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 14px;">
        View Issue Details
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; border-top: 1px solid #27272a; padding-top: 24px;">
      <p style="color: #52525b; font-size: 12px; margin: 0;">
        Sent by <a href="${data.dashboardUrl}" style="color: #a78bfa; text-decoration: none;">ErrorWatch</a>
      </p>
      <p style="color: #3f3f46; font-size: 11px; margin: 8px 0 0 0;">
        You're receiving this because you have alerts enabled for this project.
      </p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (error) {
      logger.error("Failed to send email via Resend", { error: error.message, to: data.to });
      return { success: false, error: error.message };
    }

    logger.info("Email sent successfully", { to: data.to, fingerprint: data.fingerprint });
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    logger.error("Email sending exception", { error: message, to: data.to });
    return { success: false, error: message };
  }
}


export async function sendThresholdAlertEmail(data: ThresholdAlertEmailData): Promise<{ success: boolean; error?: string }> {
  const client = getResend();
  if (!client) {
    logger.warn("RESEND_API_KEY not configured, skipping email");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const { error } = await client.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: `[${data.projectName}] Alert: ${data.eventCount} errors in ${data.windowMinutes} minutes`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0b; color: #e4e4e7; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 12px 20px; border-radius: 12px;">
        <span style="font-size: 20px; font-weight: bold; color: white;">ErrorWatch</span>
      </div>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <span style="display: inline-block; background-color: rgba(251, 191, 36, 0.15); color: #fbbf24; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; border: 1px solid rgba(251, 191, 36, 0.3);">
        Threshold Exceeded
      </span>
    </div>

    <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 24px; margin-bottom: 24px; text-align: center;">
      <p style="font-size: 48px; font-weight: bold; color: #fbbf24; margin: 0;">${data.eventCount}</p>
      <p style="color: #a1a1aa; font-size: 14px; margin: 8px 0 0 0;">
        errors in the last ${data.windowMinutes} minutes
      </p>
      <p style="color: #52525b; font-size: 12px; margin: 16px 0 0 0;">
        Threshold: ${data.threshold} events
      </p>
    </div>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${data.dashboardUrl}/dashboard/issues"
         style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 14px;">
        View Dashboard
      </a>
    </div>

    <div style="text-align: center; border-top: 1px solid #27272a; padding-top: 24px;">
      <p style="color: #52525b; font-size: 12px; margin: 0;">
        Sent by <a href="${data.dashboardUrl}" style="color: #a78bfa; text-decoration: none;">ErrorWatch</a>
      </p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (error) {
      logger.error("Failed to send threshold email", { error: error.message });
      return { success: false, error: error.message };
    }

    logger.info("Threshold alert email sent", { to: data.to, eventCount: data.eventCount });
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    logger.error("Threshold email exception", { error: message });
    return { success: false, error: message };
  }
}


export async function sendInvitationEmail(data: InvitationEmailData): Promise<{ success: boolean; error?: string }> {
  const client = getResend();
  if (!client) {
    logger.warn("RESEND_API_KEY not configured, skipping email");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const { error } = await client.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: `You've been invited to join ${data.organizationName} on ErrorWatch`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0b; color: #e4e4e7; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 12px 20px; border-radius: 12px;">
        <span style="font-size: 20px; font-weight: bold; color: white;">ErrorWatch</span>
      </div>
    </div>

    <!-- Main Content -->
    <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; margin-bottom: 24px; text-align: center;">
      <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); border-radius: 16px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 28px;">✉️</span>
      </div>

      <h1 style="font-size: 24px; font-weight: bold; color: white; margin: 0 0 16px 0;">
        You're Invited!
      </h1>

      <p style="color: #a1a1aa; font-size: 16px; line-height: 1.6; margin: 0 0 8px 0;">
        <strong style="color: white;">${escapeHtml(data.inviterName)}</strong> has invited you to join
      </p>

      <p style="font-size: 20px; font-weight: 600; color: #a78bfa; margin: 0 0 24px 0;">
        ${escapeHtml(data.organizationName)}
      </p>

      <p style="color: #71717a; font-size: 14px; margin: 0 0 24px 0;">
        on ErrorWatch - Error Monitoring for Modern Applications
      </p>

      <!-- CTA Button -->
      <a href="${data.inviteUrl}"
         style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
        Accept Invitation
      </a>

      <p style="color: #52525b; font-size: 12px; margin: 24px 0 0 0;">
        This invitation expires in ${data.expiresIn}
      </p>
    </div>

    <!-- Alternative Link -->
    <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
      <p style="color: #71717a; font-size: 12px; margin: 0 0 8px 0;">
        Or copy and paste this link:
      </p>
      <p style="font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 11px; color: #a78bfa; word-break: break-all; margin: 0;">
        ${data.inviteUrl}
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; border-top: 1px solid #27272a; padding-top: 24px;">
      <p style="color: #52525b; font-size: 12px; margin: 0;">
        Sent by <a href="${process.env.DASHBOARD_URL || 'http://localhost:3001'}" style="color: #a78bfa; text-decoration: none;">ErrorWatch</a>
      </p>
      <p style="color: #3f3f46; font-size: 11px; margin: 8px 0 0 0;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (error) {
      logger.error("Failed to send invitation email", { error: error.message, to: data.to });
      return { success: false, error: error.message };
    }

    logger.info("Invitation email sent", { to: data.to, organization: data.organizationName });
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    logger.error("Invitation email exception", { error: message, to: data.to });
    return { success: false, error: message };
  }
}

export async function sendCronMissedAlertEmail(data: CronAlertEmailData): Promise<{ success: boolean; error?: string }> {
  const client = getResend();
  if (!client) {
    logger.warn("RESEND_API_KEY not configured, skipping email");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const statusLabel = data.status === "missed" ? "Missed" : "Failed";
  const badgeColor = data.status === "missed" ? "#f59e0b" : "#ef4444";
  const badgeBg = data.status === "missed" ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)";
  const badgeBorder = data.status === "missed" ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.3)";

  try {
    const { error } = await client.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: `[${data.projectName}] Cron Monitor ${statusLabel}: ${data.monitorName}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cron Monitor Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0b; color: #e4e4e7; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 12px 20px; border-radius: 12px;">
        <span style="font-size: 20px; font-weight: bold; color: white;">ErrorWatch</span>
      </div>
    </div>

    <!-- Alert Badge -->
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid ${badgeBorder};">
        Cron Monitor ${statusLabel}
      </span>
    </div>

    <!-- Main Content -->
    <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
      <div style="margin-bottom: 20px;">
        <p style="color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px 0;">Monitor</p>
        <p style="font-size: 16px; font-weight: 600; color: white; margin: 0;">${escapeHtml(data.monitorName)}</p>
      </div>

      <div style="margin-bottom: 20px;">
        <p style="color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px 0;">Slug</p>
        <p style="font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 13px; color: #a78bfa; margin: 0;">${escapeHtml(data.monitorSlug)}</p>
      </div>

      <div style="display: flex; gap: 16px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 100px; background-color: #09090b; border-radius: 8px; padding: 12px;">
          <p style="color: #a1a1aa; font-size: 11px; text-transform: uppercase; margin: 0 0 4px 0;">Project</p>
          <p style="font-size: 14px; font-weight: 500; color: white; margin: 0;">${escapeHtml(data.projectName)}</p>
        </div>
        <div style="flex: 1; min-width: 100px; background-color: #09090b; border-radius: 8px; padding: 12px;">
          <p style="color: #a1a1aa; font-size: 11px; text-transform: uppercase; margin: 0 0 4px 0;">Status</p>
          <p style="font-size: 14px; font-weight: 600; color: ${badgeColor}; margin: 0; text-transform: uppercase;">${data.status}</p>
        </div>
      </div>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${data.dashboardUrl}/dashboard"
         style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 14px;">
        View Dashboard
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; border-top: 1px solid #27272a; padding-top: 24px;">
      <p style="color: #52525b; font-size: 12px; margin: 0;">
        Sent by <a href="${data.dashboardUrl}" style="color: #a78bfa; text-decoration: none;">ErrorWatch</a>
      </p>
      <p style="color: #3f3f46; font-size: 11px; margin: 8px 0 0 0;">
        You're receiving this because you have cron monitor alerts enabled for this project.
      </p>
    </div>
  </div>
</body>
</html>
      `,
    });

    if (error) {
      logger.error("Failed to send cron alert email", { error: error.message, to: data.to });
      return { success: false, error: error.message };
    }

    logger.info("Cron alert email sent", { to: data.to, monitorSlug: data.monitorSlug, status: data.status });
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    logger.error("Cron alert email exception", { error: message, to: data.to });
    return { success: false, error: message };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
