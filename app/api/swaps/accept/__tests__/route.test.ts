/**
 * Unit tests for POST /api/swaps/accept
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

describe("POST /api/swaps/accept", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/swaps/accept", {
      method: "POST",
      body: JSON.stringify({ swapRequestId: "sr1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when swapRequestId missing", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });

    const req = new NextRequest("http://localhost/api/swaps/accept", {
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
