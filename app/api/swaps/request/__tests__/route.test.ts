/**
 * Unit tests for POST /api/swaps/request
 */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");
jest.mock("@/lib/pusher-events", () => ({
  broadcastSwapRequested: jest.fn(),
}));

describe("POST /api/swaps/request", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/swaps/request", {
      method: "POST",
      body: JSON.stringify({
        initiatorId: "u1",
        receiverId: "u2",
        initiatorShiftId: "a1",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when missing required fields", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });

    const req = new NextRequest("http://localhost/api/swaps/request", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_FIELDS");
  });

  it("returns 403 when initiatorId does not match session", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });

    const req = new NextRequest("http://localhost/api/swaps/request", {
      method: "POST",
      body: JSON.stringify({
        initiatorId: "u2",
        receiverId: "u1",
        initiatorShiftId: "a1",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });
});
