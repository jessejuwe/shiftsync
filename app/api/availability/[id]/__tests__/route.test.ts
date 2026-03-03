/**
 * Unit tests for PATCH and DELETE /api/availability/[id]
 */

import { NextRequest } from "next/server";
import { PATCH, DELETE } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("PATCH /api/availability/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/availability/w1", {
      method: "PATCH",
      body: JSON.stringify({
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "w1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when window not found", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.availabilityWindow.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/availability/w1", {
      method: "PATCH",
      body: JSON.stringify({
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "w1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns 403 when staff tries to edit another user's window", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1", role: "STAFF" },
    });
    (prisma.availabilityWindow.findUnique as jest.Mock).mockResolvedValue({
      id: "w1",
      userId: "u2",
      location: { timezone: "America/New_York" },
      isRecurring: true,
    });

    const req = new NextRequest("http://localhost/api/availability/w1", {
      method: "PATCH",
      body: JSON.stringify({
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "w1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
  });
});

describe("DELETE /api/availability/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/availability/w1", {
      method: "DELETE",
    });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "w1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when window not found", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.availabilityWindow.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/availability/w1", {
      method: "DELETE",
    });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "w1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("deletes own window", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.availabilityWindow.findUnique as jest.Mock).mockResolvedValue({
      id: "w1",
      userId: "u1",
    });

    const req = new NextRequest("http://localhost/api/availability/w1", {
      method: "DELETE",
    });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "w1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.availabilityWindow.delete).toHaveBeenCalledWith({
      where: { id: "w1" },
    });
  });
});
