/**
 * Unit tests for OvertimeDashboard component.
 */

import { render, screen, waitFor } from "@/components/features/__tests__/test-utils";
import { OvertimeDashboard } from "../overtime-dashboard";

jest.mock("@/hooks/use-realtime-schedule", () => ({
  useRealtimeSchedule: () => {},
}));

describe("OvertimeDashboard", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  it("shows Loading when fetching", async () => {
    let resolveLocations!: (value: unknown) => void;
    let resolveOvertime!: (value: unknown) => void;

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/locations"))
        return new Promise<unknown>((r) => { resolveLocations = r; });
      if (url.includes("/api/overtime"))
        return new Promise<unknown>((r) => { resolveOvertime = r; });
      return Promise.reject(new Error("Unknown"));
    });

    render(<OvertimeDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    resolveLocations({ ok: true, json: async () => ({ locations: [] }) });
    resolveOvertime({
      ok: true,
      json: async () => ({
        weekStart: "2025-01-13",
        weekEnd: "2025-01-19",
        locationId: null,
        staff: [],
      }),
    });
  });

  it("shows No staff when empty", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/locations"))
        return Promise.resolve({ ok: true, json: async () => ({ locations: [] }) });
      if (url.includes("/api/overtime"))
        return Promise.resolve({
          ok: true,
          json: async () => ({
            weekStart: "2025-01-13",
            weekEnd: "2025-01-19",
            locationId: null,
            staff: [],
          }),
        });
      return Promise.reject(new Error("Unknown"));
    });

    render(<OvertimeDashboard />);

    await waitFor(() => {
      expect(screen.getByText("No staff with assignments this week.")).toBeInTheDocument();
    });
  });

  it("renders Overtime title and staff table", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/locations"))
        return Promise.resolve({ ok: true, json: async () => ({ locations: [] }) });
      if (url.includes("/api/overtime"))
        return Promise.resolve({
          ok: true,
          json: async () => ({
            weekStart: "2025-01-13",
            weekEnd: "2025-01-19",
            locationId: null,
            staff: [
              {
                userId: "u1",
                name: "Alice Smith",
                email: "alice@x.com",
                hoursThisWeek: 35,
                approachingOvertime: false,
                overOvertime: false,
                consecutiveDays: 3,
                is6thConsecutiveDay: false,
                is7thOrMoreConsecutiveDay: false,
              },
            ],
          }),
        });
      return Promise.reject(new Error("Unknown"));
    });

    render(<OvertimeDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Overtime")).toBeInTheDocument();
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("35h")).toBeInTheDocument();
    });
  });
});
