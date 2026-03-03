/**
 * Unit tests for ManagerSwapApprovalsPanel component.
 */

import { render, screen, fireEvent, waitFor } from "@/components/features/__tests__/test-utils";
import { ManagerSwapApprovalsPanel } from "../manager-swap-approvals-panel";

describe("ManagerSwapApprovalsPanel", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  it("does not render panel content when loading", async () => {
    let resolveFetch!: (value: unknown) => void;
    mockFetch.mockReturnValue(
      new Promise<unknown>((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<ManagerSwapApprovalsPanel currentUserId="manager1" />);

    expect(screen.queryByText("Pending swap approvals")).not.toBeInTheDocument();

    resolveFetch({
      ok: true,
      json: async () => ({ swapRequests: [] }),
    });
  });

  it("does not render panel when no pending swaps", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ swapRequests: [] }),
    });

    render(<ManagerSwapApprovalsPanel currentUserId="manager1" />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(screen.queryByText("Pending swap approvals")).not.toBeInTheDocument();
  });

  it("renders pending swap approvals when data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        swapRequests: [
          {
            id: "sr1",
            status: "PENDING_MANAGER",
            message: "Please approve",
            createdAt: "2025-01-15T10:00:00.000Z",
            initiator: { id: "u1", name: "Alice", email: "alice@x.com" },
            receiver: { id: "u2", name: "Bob", email: "bob@x.com" },
            initiatorShift: {
              shift: {
                startsAt: "2025-01-20T14:00:00.000Z",
                endsAt: "2025-01-20T22:00:00.000Z",
                location: { name: "Downtown Bar" },
              },
            },
          },
        ],
      }),
    });

    render(<ManagerSwapApprovalsPanel currentUserId="manager1" />);

    await waitFor(() => {
      expect(screen.getByText("Pending swap approvals")).toBeInTheDocument();
      expect(screen.getByText(/Alice ↔ Bob/)).toBeInTheDocument();
      expect(screen.getByText(/Downtown Bar/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
    });
  });

  it("calls approve API when Approve clicked", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          swapRequests: [
            {
              id: "sr1",
              status: "PENDING_MANAGER",
              message: null,
              createdAt: "2025-01-15T10:00:00.000Z",
              initiator: { id: "u1", name: "Alice", email: "alice@x.com" },
              receiver: { id: "u2", name: "Bob", email: "bob@x.com" },
              initiatorShift: {
                shift: {
                  startsAt: "2025-01-20T14:00:00.000Z",
                  endsAt: "2025-01-20T22:00:00.000Z",
                  location: { name: "Downtown Bar" },
                },
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    render(<ManagerSwapApprovalsPanel currentUserId="manager1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/swaps/approve",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("sr1"),
        })
      );
    });
  });
});
