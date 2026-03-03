/**
 * Unit tests for DELETE /api/shifts/assignments/[id]
 */

import { NextRequest } from "next/server";
import { DELETE } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");
jest.mock("@/lib/pusher-events", () => ({
  broadcastShiftUnassigned: jest.fn(),
}));

describe("DELETE /api/shifts/assignments/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest(
      "http://localhost/api/shifts/assignments/a1",
      { method: "DELETE" }
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "a1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when assignment not found", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "ADMIN" },
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
      const tx = {
        shiftAssignment: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };
      return fn(tx);
    });

    const req = new NextRequest(
      "http://localhost/api/shifts/assignments/bad-id",
      { method: "DELETE" }
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "bad-id" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });
});
