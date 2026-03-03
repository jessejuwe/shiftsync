/**
 * Unit tests for NotificationCenter component.
 */

import { render, screen, fireEvent, waitFor } from "@/components/features/__tests__/test-utils";
import { NotificationCenter } from "../notification-center";

describe("NotificationCenter", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  it("renders notifications button", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ notifications: [], unreadCount: 0 }),
    });

    render(<NotificationCenter />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
    });
  });

  it("shows unread badge when unreadCount > 0", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        notifications: [
          {
            id: "n1",
            type: "SHIFT_ASSIGNED",
            title: "Shift assigned",
            body: "You were assigned to a shift",
            data: null,
            readAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
        unreadCount: 1,
      }),
    });

    render(<NotificationCenter />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  it("shows Loading in popover when fetching", async () => {
    let resolveFetch!: (value: unknown) => void;
    mockFetch.mockReturnValue(
      new Promise<unknown>((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<NotificationCenter />);

    const btn = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(btn);

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    resolveFetch({
      ok: true,
      json: async () => ({ notifications: [], unreadCount: 0 }),
    });
  });

  it("shows No notifications when empty", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ notifications: [], unreadCount: 0 }),
    });

    render(<NotificationCenter />);

    await waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("No notifications")).toBeInTheDocument();
    });
  });
});
