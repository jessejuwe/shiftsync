/**
 * Unit tests for ValidationDisplay component.
 */

import { render, screen, fireEvent } from "@/components/features/__tests__/test-utils";
import { ValidationDisplay } from "../validation-display";

describe("ValidationDisplay", () => {
  it("returns null when no blocks, warnings, or suggestions", () => {
    render(<ValidationDisplay blocks={[]} warnings={[]} />);
    // ValidationDisplay returns null, so no alerts should be present
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders blocking issues when blocks provided", () => {
    render(
      <ValidationDisplay
        blocks={[
          {
            type: "block",
            code: "DOUBLE_BOOKING",
            message: "User is already assigned to overlapping shift(s).",
          },
        ]}
        warnings={[]}
      />
    );
    expect(screen.getByText("Blocking issues")).toBeInTheDocument();
    expect(screen.getByText("Double booking")).toBeInTheDocument();
    expect(screen.getByText(/User is already assigned/)).toBeInTheDocument();
  });

  it("renders warnings when warnings provided", () => {
    render(
      <ValidationDisplay
        blocks={[]}
        warnings={[
          {
            type: "warning",
            code: "AVAILABILITY_VIOLATION",
            message: "Shift falls outside user's declared availability.",
          },
        ]}
      />
    );
    expect(screen.getByText("Warnings")).toBeInTheDocument();
    expect(screen.getByText("Outside availability")).toBeInTheDocument();
    expect(screen.getByText(/Shift falls outside/)).toBeInTheDocument();
  });

  it("renders suggested alternatives when suggestions provided", () => {
    render(
      <ValidationDisplay
        blocks={[
          {
            type: "block",
            code: "SKILL_MISMATCH",
            message: "User is missing required skills.",
            suggestions: [
              { id: "u1", name: "Alice", email: "alice@x.com" },
              { id: "u2", name: "Bob", email: "bob@x.com" },
            ],
          },
        ]}
        warnings={[]}
        onAssignSuggestion={jest.fn()}
      />
    );
    expect(screen.getByText("Suggested alternatives")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Assign instead/i })).toHaveLength(2);
  });

  it("calls onAssignSuggestion when Assign instead clicked", () => {
    const onAssignSuggestion = jest.fn();
    render(
      <ValidationDisplay
        blocks={[
          {
            type: "block",
            code: "SKILL_MISMATCH",
            message: "Missing skills.",
            suggestions: [{ id: "u1", name: "Alice", email: "a@x.com" }],
          },
        ]}
        warnings={[]}
        onAssignSuggestion={onAssignSuggestion}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Assign instead/i }));
    expect(onAssignSuggestion).toHaveBeenCalledWith("u1");
  });

  it("deduplicates suggestions from blocks and warnings", () => {
    const sharedSuggestion = { id: "u1", name: "Alice", email: "a@x.com" };
    render(
      <ValidationDisplay
        blocks={[
          {
            type: "block",
            code: "SKILL_MISMATCH",
            message: "Block.",
            suggestions: [sharedSuggestion],
          },
        ]}
        warnings={[
          {
            type: "warning",
            code: "AVAILABILITY_VIOLATION",
            message: "Warn.",
            suggestions: [sharedSuggestion],
          },
        ]}
      />
    );
    expect(screen.getAllByText("Alice")).toHaveLength(1);
  });

  it("uses validation code as fallback when label not in VALIDATION_LABELS", () => {
    render(
      <ValidationDisplay
        blocks={[
          {
            type: "block",
            code: "UNKNOWN_CODE" as any,
            message: "Custom message.",
          },
        ]}
        warnings={[]}
      />
    );
    expect(screen.getByText("UNKNOWN_CODE")).toBeInTheDocument();
  });
});
