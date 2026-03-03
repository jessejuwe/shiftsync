import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/availability/certified-locations
 * Returns locations the current user is certified at (for creating availability).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Sign in required" },
      { status: 401 }
    );
  }

  const certs = await prisma.certification.findMany({
    where: {
      userId: session.user.id,
      expiresAt: { gt: new Date() },
    },
    include: {
      location: { select: { id: true, name: true, timezone: true } },
    },
  });

  const locations = certs.map((c) => ({
    id: c.location.id,
    name: c.location.name,
    timezone: c.location.timezone,
  }));

  return NextResponse.json({ locations });
}
