import { NextRequest, NextResponse } from "next/server";
import { addYears } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/staff/[userId]/certifications
 * Certify a staff member at a location. Admin and Manager only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Sign in required" },
      { status: 401 }
    );
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Admin or manager access required" },
      { status: 403 }
    );
  }

  const { userId } = await params;
  let body: { locationId: string; name?: string; expiresAt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid request body" },
      { status: 400 }
    );
  }

  const { locationId, name = "Location cert", expiresAt } = body;
  if (!locationId) {
    return NextResponse.json(
      { code: "MISSING_FIELDS", message: "locationId is required" },
      { status: 400 }
    );
  }

  const [user, location] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.location.findUnique({ where: { id: locationId } }),
  ]);

  if (!user) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "User not found" },
      { status: 404 }
    );
  }

  if (!location) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Location not found" },
      { status: 404 }
    );
  }

  const existingValid = await prisma.certification.findFirst({
    where: {
      userId,
      locationId,
      expiresAt: { gt: new Date() },
    },
  });
  if (existingValid) {
    return NextResponse.json(
      {
        code: "ALREADY_CERTIFIED",
        message: "User is already certified at this location",
      },
      { status: 400 }
    );
  }

  const issuedAt = new Date();
  const certExpiresAt = expiresAt ? new Date(expiresAt) : addYears(issuedAt, 1);

  const certification = await prisma.certification.create({
    data: {
      userId,
      locationId,
      name,
      issuedAt,
      expiresAt: certExpiresAt,
    },
    include: {
      location: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    certification: {
      id: certification.id,
      locationId: certification.locationId,
      locationName: certification.location.name,
      name: certification.name,
      issuedAt: certification.issuedAt.toISOString(),
      expiresAt: certification.expiresAt.toISOString(),
    },
  });
}
