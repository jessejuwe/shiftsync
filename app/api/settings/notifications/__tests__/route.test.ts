/**
 * Unit tests for GET and PATCH /api/settings/notifications
 */

import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma");

describe("GET /api/settings/notifications", () => {
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

  it("returns notification preference when authenticated", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      notificationPreference: "IN_APP_ONLY",
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notificationPreference).toBe("IN_APP_ONLY");
  });
});

describe("PATCH /api/settings/notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify({ notificationPreference: "IN_APP_AND_EMAIL" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 when invalid preference", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });

    const req = new NextRequest("http://localhost/api/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify({ notificationPreference: "INVALID" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_VALUE");
  });

  it("updates preference when valid", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "u1" },
    });
    (prisma.user.update as jest.Mock).mockResolvedValue({
      notificationPreference: "IN_APP_AND_EMAIL",
    });

    const req = new NextRequest("http://localhost/api/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify({ notificationPreference: "IN_APP_AND_EMAIL" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notificationPreference).toBe("IN_APP_AND_EMAIL");
  });
});
