/**
 * Unit tests for AvailabilityManager component.
 */

import { render, screen, waitFor } from "@/components/features/__tests__/test-utils";
import { AvailabilityManager } from "../availability-manager";

jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { role: "STAFF" } }, status: "authenticated" }),
}));

describe("AvailabilityManager", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  it("shows My Availability for STAFF role", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/availability"))
        return Promise.resolve({ ok: true, json: async () => ({ windows: [] }) });
      if (url.includes("/api/settings/desired-hours"))
        return Promise.resolve({ ok: true, json: async () => ({ desiredHoursPerWeek: null }) });
      if (url.includes("/api/availability/certified-locations"))
        return Promise.resolve({ ok: true, json: async () => ({ locations: [] }) });
      return Promise.reject(new Error("Unknown"));
    });

    render(<AvailabilityManager />);

    await waitFor(() => {
      expect(screen.getByText("My Availability")).toBeInTheDocument();
    });
  });
});
