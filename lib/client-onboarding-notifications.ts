import "server-only";

import { NotificationType } from "@prisma/client";
import prisma from "@/lib/prisma";

const nodemailer = require("nodemailer") as any;

type NotifyPayload = {
  clientId: string;
  clientName: string;
  clientStatus?: string | null;
  startDate?: string | Date | null;
  dueDate?: string | Date | null;
  company?: string | null;
  packageName?: string | null;
  templateName?: string | null;
  createdByName?: string | null;
  createdByRole?: string | null;
  amName?: string | null;
  amEmail?: string | null;
};

const splitEmails = (value?: string | null) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const formatDateLabel = (value?: string | Date | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

function buildNotificationMessage(payload: NotifyPayload) {
  const statusLabel = String(payload.clientStatus ?? "").trim().toLowerCase() === "draft"
    ? "New draft client created"
    : "New client created";
  const bits = [
    `${statusLabel}: ${payload.clientName}`,
    payload.company ? `Company: ${payload.company}` : null,
    payload.packageName ? `Package: ${payload.packageName}` : null,
    payload.templateName ? `Template: ${payload.templateName}` : null,
    payload.amName ? `AM: ${payload.amName}` : null,
    payload.createdByName
      ? `Created by: ${payload.createdByName}${payload.createdByRole ? ` (${payload.createdByRole})` : ""}`
      : null,
  ].filter(Boolean);

  return bits.join(" | ");
}

async function sendSmtpEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string[];
  subject: string;
  text: string;
  html: string;
}) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from =
    process.env.SMTP_FROM ||
    process.env.MAIL_FROM ||
    user ||
    "no-reply@example.com";

  if (!host || !user || !pass || to.length === 0) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: to.join(", "),
    subject,
    text,
    html,
  });
}

export async function notifyDraftClientCreated(payload: NotifyPayload) {
  try {
    const configuredConversationId =
      process.env.MAIN_GROUP_CONVERSATION_ID?.trim() || undefined;
    const configuredTitle = process.env.MAIN_GROUP_TITLE?.trim() || "main";

    const mainGroup = await prisma.conversation.findFirst({
      where: configuredConversationId
        ? { id: configuredConversationId }
        : {
            type: "group",
            title: {
              contains: configuredTitle,
              mode: "insensitive",
            },
          },
      include: {
        participants: {
          select: {
            userId: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const participantUserIds = Array.from(
      new Set(mainGroup?.participants.map((p) => p.userId).filter(Boolean) ?? []),
    );

    const participantEmails = Array.from(
      new Set(
        (mainGroup?.participants ?? [])
          .map((p) => p.user?.email?.trim())
          .filter((email): email is string => Boolean(email)),
      ),
    );

    const extraEmails = splitEmails(process.env.CLIENT_DRAFT_NOTIFICATION_EMAILS);
    const emailRecipients = Array.from(
      new Set([...participantEmails, ...extraEmails]),
    );

    const message = buildNotificationMessage(payload);

    if (participantUserIds.length > 0) {
      await prisma.notification.createMany({
        data: participantUserIds.map((userId) => ({
          userId,
          type: NotificationType.general,
          message,
        })),
      });
    }

    if (mainGroup?.id) {
      await prisma.chatMessage.create({
        data: {
          conversationId: mainGroup.id,
          type: "system",
          content: message,
        },
      });
    }

    const isDraftClient =
      String(payload.clientStatus ?? "").trim().toLowerCase() === "draft";
    const subject = `${isDraftClient ? "Draft client" : "Client"} created: ${payload.clientName}`;
    const startDate = formatDateLabel(payload.startDate);
    const endDate = formatDateLabel(payload.dueDate);

    const baseUrl =
      process.env.APP_URL?.replace(/\/$/, "") ||
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";
    const clientProfileUrl = `${baseUrl}/admin/clients/${payload.clientId}`;
    const reviewUrl = `${baseUrl}/admin/clients`;
    const text = [
      `A new ${isDraftClient ? "draft " : ""}client has been created.`,
      ``,
      `Client: ${payload.clientName}`,
      payload.company ? `Company: ${payload.company}` : null,
      payload.packageName ? `Package: ${payload.packageName}` : null,
      payload.templateName ? `Template: ${payload.templateName}` : null,
      startDate ? `Start Date: ${startDate}` : null,
      endDate ? `End Date: ${endDate}` : null,
      payload.amName ? `AM: ${payload.amName}` : null,
      payload.amEmail ? `AM Email: ${payload.amEmail}` : null,
      payload.createdByName
        ? `Created By: ${payload.createdByName}${payload.createdByRole ? ` (${payload.createdByRole})` : ""}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const html = `
      <div>
        <p>A new draft client has been created.</p>
        <p>Status: ${payload.clientStatus || (isDraftClient ? "draft" : "active")}</p>
        <ul>
          <li><strong>Client:</strong> ${payload.clientName}</li>
          ${payload.company ? `<li><strong>Company:</strong> ${payload.company}</li>` : ""}
          ${payload.packageName ? `<li><strong>Package:</strong> ${payload.packageName}</li>` : ""}
          ${payload.templateName ? `<li><strong>Template:</strong> ${payload.templateName}</li>` : ""}
          ${startDate ? `<li><strong>Start Date:</strong> ${startDate}</li>` : ""}
          ${endDate ? `<li><strong>End Date:</strong> ${endDate}</li>` : ""}
          ${payload.amName ? `<li><strong>AM:</strong> ${payload.amName}</li>` : ""}
          ${payload.amEmail ? `<li><strong>AM Email:</strong> ${payload.amEmail}</li>` : ""}
          ${
            payload.createdByName
              ? `<li><strong>Created By:</strong> ${payload.createdByName}${
                  payload.createdByRole ? ` (${payload.createdByRole})` : ""
                }</li>`
              : ""
          }
        </ul>
        <div style="margin-top: 20px;">
          <a href="${clientProfileUrl}" style="display: inline-block; padding: 10px 20px; background: #0F1923; color: white; text-decoration: none; border-radius: 6px; margin-right: 10px;">View Client Profile</a>
          <a href="${reviewUrl}" style="display: inline-block; padding: 10px 20px; background: #1D9E75; color: white; text-decoration: none; border-radius: 6px;">Review & approve</a>
        </div>
      </div>
    `;

    await sendSmtpEmail({
      to: emailRecipients,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("notifyDraftClientCreated failed:", error);
  }
}