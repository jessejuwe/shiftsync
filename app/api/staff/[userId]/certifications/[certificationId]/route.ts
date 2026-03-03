import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/staff/[userId]/certifications/[certificationId]
 * De-certify a staff member from a location (remove certification). Admin and Manager only.
 */
export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ userId: string; certificationId: string }> }
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

  const { userId, certificationId } = await params;

  const certification = await prisma.certification.findFirst({
    where: { id: certificationId, userId },
  });

  if (!certification) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Certification not found" },
      { status: 404 }
    );
  }

  await prisma.certification.delete({
    where: { id: certificationId },
  });

  return NextResponse.json({ success: true });
}
