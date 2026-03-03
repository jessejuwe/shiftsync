/**
 * Unit tests for PATCH /api/notifications/[id]
 */

import { NextRequest } from "next/server";
import { PATCH } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("PATCH /api/notifications/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/notifications/n1", {
      method: "PATCH",
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "n1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when notification not found", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.notification.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/notifications/n1", {
      method: "PATCH",
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "n1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns 404 when notification belongs to another user", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.notification.findUnique as jest.Mock).mockResolvedValue({
      id: "n1",
      userId: "u2",
      readAt: null,
    });

    const req = new NextRequest("http://localhost/api/notifications/n1", {
      method: "PATCH",
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "n1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("marks notification as read", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.notification.findUnique as jest.Mock).mockResolvedValue({
      id: "n1",
      userId: "u1",
      readAt: null,
    });
    (prisma.notification.update as jest.Mock).mockResolvedValue({
      id: "n1",
      readAt: new Date(),
    });

    const req = new NextRequest("http://localhost/api/notifications/n1", {
      method: "PATCH",
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "n1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notification.id).toBe("n1");
    expect(body.notification.readAt).toBeDefined();
    expect(prisma.notification.update).toHaveBeenCalled();
  });
});
