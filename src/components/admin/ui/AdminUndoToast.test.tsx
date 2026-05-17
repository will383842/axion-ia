import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AdminUndoToast } from "./AdminUndoToast";

describe("AdminUndoToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders label and triggers onUndo on click", () => {
    const onUndo = vi.fn();
    render(<AdminUndoToast label="Article archivé" onUndo={onUndo} />);
    expect(screen.getByText("Article archivé")).toBeDefined();
    fireEvent.click(screen.getByText("Annuler"));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("calls onExpired after timeoutMs and auto-unmounts", () => {
    const onUndo = vi.fn();
    const onExpired = vi.fn();
    render(
      <AdminUndoToast
        label="Article archivé"
        onUndo={onUndo}
        onExpired={onExpired}
        timeoutMs={1000}
      />,
    );
    expect(screen.getByText("Article archivé")).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(onUndo).not.toHaveBeenCalled();
    expect(screen.queryByText("Article archivé")).toBeNull();
  });

  it("does not call onExpired if undo clicked before timeout", () => {
    const onUndo = vi.fn();
    const onExpired = vi.fn();
    render(
      <AdminUndoToast
        label="Article archivé"
        onUndo={onUndo}
        onExpired={onExpired}
        timeoutMs={1000}
      />,
    );
    fireEvent.click(screen.getByText("Annuler"));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onExpired).not.toHaveBeenCalled();
  });
});
