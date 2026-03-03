/**
 * Unit tests for FairnessDashboard component.
 */

import { render, screen, waitFor } from "@/components/features/__tests__/test-utils";
import { FairnessDashboard } from "../fairness-dashboard";

jest.mock("@/hooks/use-realtime-schedule", () => ({
  useRealtimeSchedule: () => {},
}));

describe("FairnessDashboard", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  it("shows Loading when fetching", async () => {
    let resolveLocations!: (value: unknown) => void;
    let resolveFairness!: (value: unknown) => void;

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/locations"))
        return new Promise<unknown>((r) => { resolveLocations = r; });
      if (url.includes("/api/fairness"))
        return new Promise<unknown>((r) => { resolveFairness = r; });
      return Promise.reject(new Error("Unknown"));
    });

    render(<FairnessDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    resolveLocations({ ok: true, json: async () => ({ locations: [] }) });
    resolveFairness({
      ok: true,
      json: async () => ({
        weekStart: "2025-01-13",
        weekEnd: "2025-01-19",
        locationId: null,
        targetHours: 40,
        staff: [],
      }),
    });
  });

  it("shows No staff when empty", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/locations"))
        return Promise.resolve({ ok: true, json: async () => ({ locations: [] }) });
      if (url.includes("/api/fairness"))
        return Promise.resolve({
          ok: true,
          json: async () => ({
            weekStart: "2025-01-13",
            weekEnd: "2025-01-19",
            locationId: null,
            targetHours: 40,
            staff: [],
          }),
        });
      return Promise.reject(new Error("Unknown"));
    });

    render(<FairnessDashboard />);

    await waitFor(() => {
      expect(screen.getByText("No staff with assignments this week.")).toBeInTheDocument();
    });
  });

  it("renders Fairness Analytics title", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/locations"))
        return Promise.resolve({ ok: true, json: async () => ({ locations: [] }) });
      if (url.includes("/api/fairness"))
        return Promise.resolve({
          ok: true,
          json: async () => ({
            weekStart: "2025-01-13",
            weekEnd: "2025-01-19",
            locationId: null,
            targetHours: 40,
            staff: [
              {
                userId: "u1",
                name: "Alice Smith",
                email: "alice@x.com",
                totalHours: 40,
                premiumShifts: 1,
                hoursDelta: 0,
                equityScore: 85,
                isOverScheduled: false,
                isUnderScheduled: false,
              },
            ],
          }),
        });
      return Promise.reject(new Error("Unknown"));
    });

    render(<FairnessDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Fairness Analytics")).toBeInTheDocument();
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
  });
});
