/**
 * Unit tests for NotificationPreferencesForm component.
 */

import { render, screen, fireEvent, waitFor } from "@/components/features/__tests__/test-utils";
import { NotificationPreferencesForm } from "../notification-preferences-form";

describe("NotificationPreferencesForm", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  it("shows Loading when fetching", async () => {
    let resolveFetch!: (value: unknown) => void;
    mockFetch.mockReturnValue(
      new Promise<unknown>((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<NotificationPreferencesForm />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    resolveFetch({
      ok: true,
      json: async () => ({ notificationPreference: "IN_APP_ONLY" }),
    });
  });

  it("renders In-app only and In-app + email options", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ notificationPreference: "IN_APP_ONLY" }),
    });

    render(<NotificationPreferencesForm />);

    await waitFor(() => {
      expect(screen.getByText("In-app only")).toBeInTheDocument();
      expect(screen.getByText("In-app + email")).toBeInTheDocument();
    });
  });

  it("calls PATCH when selecting different preference", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notificationPreference: "IN_APP_ONLY" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notificationPreference: "IN_APP_AND_EMAIL" }),
      });

    render(<NotificationPreferencesForm />);

    await waitFor(() => {
      expect(screen.getByLabelText(/in-app \+ email/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/in-app \+ email/i));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/settings/notifications",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ notificationPreference: "IN_APP_AND_EMAIL" }),
        })
      );
    });
  });
});
