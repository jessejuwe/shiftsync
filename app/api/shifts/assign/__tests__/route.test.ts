/**
 * Unit tests for POST /api/shifts/assign
 */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");
jest.mock("@/lib/pusher-events", () => ({
  broadcastAssignmentConflict: jest.fn(),
  broadcastShiftAssigned: jest.fn(),
}));
jest.mock("@/lib/email-simulator", () => ({
  maybeSimulateNotificationEmail: jest.fn(),
}));

describe("POST /api/shifts/assign", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/shifts/assign", {
      method: "POST",
      body: JSON.stringify({ shiftId: "s1", userId: "u1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when shiftId or userId missing", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "m1", role: "MANAGER" },
    });

    const req = new NextRequest("http://localhost/api/shifts/assign", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_FIELDS");
  });
});
