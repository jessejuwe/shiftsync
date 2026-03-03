/**
 * Unit tests for ShiftCreateForm component.
 */

import { render, screen, fireEvent, waitFor } from "@/components/features/__tests__/test-utils";
import { ShiftCreateForm } from "../shift-create-form";

const locations = [
  { id: "loc1", name: "Downtown Bar", address: null, timezone: "America/New_York" },
];
const skills = [
  { id: "s1", name: "Bartender", description: null },
  { id: "s2", name: "Server", description: null },
];

describe("ShiftCreateForm", () => {
  const onSubmit = jest.fn();
  const onSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
  });

  it("renders form fields", () => {
    render(
      <ShiftCreateForm
        locations={locations}
        skills={skills}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/headcount/i)).toBeInTheDocument();
    expect(screen.getByText("Bartender")).toBeInTheDocument();
    expect(screen.getByText("Server")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create shift/i })).toBeInTheDocument();
  });

  it("shows Creating... when isPending", () => {
    render(
      <ShiftCreateForm
        locations={locations}
        skills={skills}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
        isPending={true}
      />
    );
    expect(screen.getByRole("button", { name: /creating/i })).toBeInTheDocument();
  });

  it("calls onSubmit with values when form submitted", async () => {
    render(
      <ShiftCreateForm
        locations={locations}
        skills={skills}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Downtown Bar" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: "Downtown Bar" }));

    const startInput = screen.getByLabelText(/start time/i);
    const endInput = screen.getByLabelText(/end time/i);
    fireEvent.change(startInput, { target: { value: "2025-06-15T14:00" } });
    fireEvent.change(endInput, { target: { value: "2025-06-15T22:00" } });

    fireEvent.click(screen.getByRole("button", { name: /create shift/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          locationId: "loc1",
          startsAt: "2025-06-15T14:00",
          endsAt: "2025-06-15T22:00",
          headcount: 1,
        })
      );
    });
    expect(onSuccess).toHaveBeenCalled();
  });
});
