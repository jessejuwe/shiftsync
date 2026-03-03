import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/audit?locationId=...&dateFrom=...&dateTo=...
 * Returns audit logs with filters. Admin only.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Admin or Manager access required" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const shiftId = searchParams.get("shiftId");

  const where: {
    locationId?: string | null;
    createdAt?: { gte?: Date; lte?: Date };
    OR?: Array<Record<string, unknown>>;
  } = {};

  if (locationId) {
    where.locationId = locationId;
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      where.createdAt.gte = new Date(dateFrom);
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setUTCHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  if (shiftId) {
    const shiftOrConditions = [
      { entityType: "Shift", entityId: shiftId },
      {
        entityType: "ShiftAssignment",
        changes: {
          path: ["after", "shiftId"],
          equals: shiftId,
        },
      },
      {
        entityType: "ShiftAssignment",
        changes: {
          path: ["before", "shiftId"],
          equals: shiftId,
        },
      },
    ];
    // When locationId is also set, include it in each OR branch so the shift filter is scoped to the selected location
    where.OR =
      locationId != null
        ? shiftOrConditions.map((c) => ({ ...c, locationId }))
        : shiftOrConditions;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      location: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const entries = logs.map((log) => ({
    id: log.id,
    actorId: log.userId,
    actorName: log.user?.name ?? null,
    actorEmail: log.user?.email ?? null,
    entityType: log.entityType,
    entityId: log.entityId,
    action: log.action,
    before: (log.changes as { before?: unknown } | null)?.before ?? null,
    after: (log.changes as { after?: unknown } | null)?.after ?? null,
    changes: log.changes,
    locationId: log.locationId,
    locationName: log.location?.name ?? null,
    timestamp: log.createdAt.toISOString(),
  }));

  return NextResponse.json({ entries });
}
