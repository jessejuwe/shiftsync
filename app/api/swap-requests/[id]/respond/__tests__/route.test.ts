/**
 * Unit tests for POST /api/swap-requests/[id]/respond
 */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");
jest.mock("@/lib/pusher-events", () => ({
  broadcastSwapApproved: jest.fn(),
  broadcastShiftAssigned: jest.fn(),
}));

describe("POST /api/swap-requests/[id]/respond", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when missing action or actorId", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });

    const req = new NextRequest("http://localhost/api/swap-requests/sr1/respond", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, {
      params: Promise.resolve({ id: "sr1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_FIELDS");
  });

  it("returns 403 when actorId does not match session", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });

    const req = new NextRequest("http://localhost/api/swap-requests/sr1/respond", {
      method: "POST",
      body: JSON.stringify({ action: "accept", actorId: "u2" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, {
      params: Promise.resolve({ id: "sr1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });
});
