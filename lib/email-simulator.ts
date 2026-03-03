import { prisma } from "@/lib/prisma";

/**
 * Email simulator for notification preference IN_APP_AND_EMAIL.
 * When a user has opted for email, we simulate sending by logging.
 * In production, this would integrate with a real email provider (Resend, SendGrid, etc.).
 */
export function simulateEmail(params: {
  to: string;
  subject: string;
  body: string;
  userId: string;
  type: string;
}): void {
  // eslint-disable-next-line no-console
  console.log("[EMAIL SIMULATION]", {
    to: params.to,
    subject: params.subject,
    body: params.body,
    userId: params.userId,
    type: params.type,
    timestamp: new Date().toISOString(),
  });
}

/**
 * After creating a notification, simulate email if user prefers IN_APP_AND_EMAIL.
 * Call this after notification.create() in API routes (can be outside transaction).
 */
export async function maybeSimulateNotificationEmail(params: {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true, notificationPreference: true },
  });
  if (user?.notificationPreference === "IN_APP_AND_EMAIL") {
    simulateEmail({
      to: user.email,
      subject: params.title,
      body: params.body ?? "",
      userId: params.userId,
      type: params.type,
    });
  }
}
