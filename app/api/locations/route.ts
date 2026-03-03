import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      timezone: l.timezone,
    })),
  });
}
