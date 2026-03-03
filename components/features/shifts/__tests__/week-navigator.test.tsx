/**
 * Unit tests for WeekNavigator component.
 */

import { render, screen, fireEvent } from "@/components/features/__tests__/test-utils";
import { WeekNavigator } from "../week-navigator";

describe("WeekNavigator", () => {
  const monday = new Date("2024-01-15T00:00:00.000Z");
  const sunday = new Date("2024-01-22T00:00:00.000Z"); // Sunday of same week

  it("renders week range", () => {
    render(
      <WeekNavigator
        monday={monday}
        sunday={sunday}
        weekOffset={0}
        onWeekChange={jest.fn()}
        onJumpToToday={jest.fn()}
      />
    );
    expect(screen.getByText(/Jan 15/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 22/)).toBeInTheDocument();
  });

  it("calls onWeekChange(-1) when previous week clicked", () => {
    const onWeekChange = jest.fn();
    render(
      <WeekNavigator
        monday={monday}
        sunday={sunday}
        weekOffset={0}
        onWeekChange={onWeekChange}
        onJumpToToday={jest.fn()}
      />
    );
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(onWeekChange).toHaveBeenCalledWith(-1);
  });

  it("calls onWeekChange(1) when next week clicked", () => {
    const onWeekChange = jest.fn();
    render(
      <WeekNavigator
        monday={monday}
        sunday={sunday}
        weekOffset={0}
        onWeekChange={onWeekChange}
        onJumpToToday={jest.fn()}
      />
    );
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);
    expect(onWeekChange).toHaveBeenCalledWith(1);
  });

  it("shows Today button when weekOffset is not 0", () => {
    render(
      <WeekNavigator
        monday={monday}
        sunday={sunday}
        weekOffset={1}
        onWeekChange={jest.fn()}
        onJumpToToday={jest.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /today/i })).toBeInTheDocument();
  });

  it("hides Today button when weekOffset is 0", () => {
    render(
      <WeekNavigator
        monday={monday}
        sunday={sunday}
        weekOffset={0}
        onWeekChange={jest.fn()}
        onJumpToToday={jest.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /today/i })).not.toBeInTheDocument();
  });

  it("calls onJumpToToday when Today clicked", () => {
    const onJumpToToday = jest.fn();
    render(
      <WeekNavigator
        monday={monday}
        sunday={sunday}
        weekOffset={1}
        onWeekChange={jest.fn()}
        onJumpToToday={onJumpToToday}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /today/i }));
    expect(onJumpToToday).toHaveBeenCalled();
  });
});
