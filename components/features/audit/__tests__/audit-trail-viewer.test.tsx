/**
 * Unit tests for AuditTrailViewer component.
 */

import { render, screen, fireEvent, waitFor } from "@/components/features/__tests__/test-utils";
import { AuditTrailViewer } from "../audit-trail-viewer";

describe("AuditTrailViewer", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  it("shows Admin access required when fetch returns 403", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/audit"))
        return Promise.resolve({ status: 403 });
      if (url.includes("/api/locations"))
        return Promise.resolve({ ok: true, json: async () => ({ locations: [] }) });
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<AuditTrailViewer />);

    await waitFor(() => {
      expect(screen.getByText("Admin access required")).toBeInTheDocument();
    });
  });

  it("shows Audit Trail title and Filters when access granted", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locations: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entries: [] }),
      });

    render(<AuditTrailViewer />);

    await waitFor(() => {
      expect(screen.getByText("Audit Trail")).toBeInTheDocument();
      expect(screen.getByText("Filters")).toBeInTheDocument();
    });
  });

  it("shows Loading when fetching audit data", async () => {
    let resolveAudit!: (value: unknown) => void;
    const auditPromise = new Promise<unknown>((resolve) => {
      resolveAudit = resolve;
    });

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locations: [] }) })
      .mockReturnValueOnce(auditPromise);

    render(<AuditTrailViewer />);

    await waitFor(() => {
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    resolveAudit({ ok: true, json: async () => ({ entries: [] }) });
  });

  it("shows No audit entries when empty", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locations: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [] }) });

    render(<AuditTrailViewer />);

    await waitFor(() => {
      expect(screen.getByText("No audit entries for the selected filters.")).toBeInTheDocument();
    });
  });

  it("renders audit entries when data returned", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locations: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: [
            {
              id: "e1",
              actorId: "u1",
              actorName: "Alice",
              actorEmail: "alice@x.com",
              entityType: "Shift",
              entityId: "shift-123",
              action: "CREATE",
              before: null,
              after: null,
              changes: null,
              locationId: "loc1",
              locationName: "Downtown",
              timestamp: "2025-01-15T10:00:00.000Z",
            },
          ],
        }),
      });

    render(<AuditTrailViewer />);

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("CREATE")).toBeInTheDocument();
      expect(screen.getByText("Downtown")).toBeInTheDocument();
    });
  });

  it("has Export JSON button", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ locations: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [] }) });

    render(<AuditTrailViewer />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /export json/i })).toBeInTheDocument();
    });
  });
});
