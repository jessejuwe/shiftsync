/**
 * Unit tests for POST /api/swaps/reject
 */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("POST /api/swaps/reject", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when not admin or manager", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "STAFF" },
    });

    const req = new NextRequest("http://localhost/api/swaps/reject", {
      method: "POST",
      body: JSON.stringify({ swapRequestId: "sr1", actorId: "u1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns 400 when missing swapRequestId or actorId", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "m1", role: "MANAGER" },
    });

    const req = new NextRequest("http://localhost/api/swaps/reject", {
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
