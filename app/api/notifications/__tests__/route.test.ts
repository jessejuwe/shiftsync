/**
 * Unit tests for GET /api/notifications
 */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("GET /api/notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/notifications");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns notifications when authenticated", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.notification.count as jest.Mock).mockResolvedValue(0);

    const req = new NextRequest("http://localhost/api/notifications");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notifications).toEqual([]);
    expect(body.unreadCount).toBe(0);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1" },
      })
    );
  });

  it("filters unread when unreadOnly=true", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.notification.count as jest.Mock).mockResolvedValue(0);

    const req = new NextRequest(
      "http://localhost/api/notifications?unreadOnly=true"
    );
    await GET(req);

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", readAt: null },
      })
    );
  });
});
