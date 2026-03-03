/**
 * Unit tests for GET /api/health
 */

import { GET } from "../route";

describe("GET /api/health", () => {
  it("returns 200 with status ok and timestamp", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
    expect(typeof body.timestamp).toBe("string");
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });
});
