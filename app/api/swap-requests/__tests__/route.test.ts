/**
 * Unit tests for GET and POST /api/swap-requests
 */

import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");
jest.mock("@/lib/pusher-events", () => ({
  broadcastSwapRequested: jest.fn(),
}));

describe("GET /api/swap-requests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/swap-requests");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns swap requests when authenticated", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "STAFF" },
    });
    (prisma.swapRequest.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/swap-requests");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.swapRequests).toEqual([]);
  });
});

describe("POST /api/swap-requests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/swap-requests", {
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

    const req = new NextRequest("http://localhost/api/swap-requests", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("MISSING_FIELDS");
  });

  it("returns 403 when staff tries to create swap for another user", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });

    const req = new NextRequest("http://localhost/api/swap-requests", {
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
