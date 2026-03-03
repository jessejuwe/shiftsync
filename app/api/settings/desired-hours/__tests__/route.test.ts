/**
 * Unit tests for GET and PATCH /api/settings/desired-hours
 */

import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("GET /api/settings/desired-hours", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns desired hours when authenticated", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      desiredHoursPerWeek: 40,
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.desiredHoursPerWeek).toBe(40);
  });
});

describe("PATCH /api/settings/desired-hours", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/settings/desired-hours", {
      method: "PATCH",
      body: JSON.stringify({ desiredHoursPerWeek: 40 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when desiredHoursPerWeek out of range", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });

    const req = new NextRequest("http://localhost/api/settings/desired-hours", {
      method: "PATCH",
      body: JSON.stringify({ desiredHoursPerWeek: 100 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_VALUE");
  });

  it("updates desired hours when valid", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.user.update as jest.Mock).mockResolvedValue({
      desiredHoursPerWeek: 35,
    });

    const req = new NextRequest("http://localhost/api/settings/desired-hours", {
      method: "PATCH",
      body: JSON.stringify({ desiredHoursPerWeek: 35 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.desiredHoursPerWeek).toBe(35);
  });
});
