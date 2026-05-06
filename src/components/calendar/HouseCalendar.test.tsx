import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HouseCalendar, type CalendarSlot } from "./HouseCalendar";

const FR_LABELS = {
  prevMonth: "Mois précédent",
  nextMonth: "Mois suivant",
  available: "Disponible",
  option: "Option",
  reserved: "Réservé",
  selectDate: "Sélectionnez une date",
  selectTime: "Choisir un créneau",
  confirm: "Confirmer",
  noSlots: "Aucun créneau ce jour.",
  weekDays: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const,
};

function buildSlot(offsetDays: number, time: string, status: CalendarSlot["status"]): CalendarSlot {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return { date: d.toISOString().slice(0, 10), time, status };
}

describe("<HouseCalendar>", () => {
  it("renders the prev/next month controls and weekday header", () => {
    render(<HouseCalendar slots={[]} labels={FR_LABELS} />);
    expect(screen.getByLabelText(FR_LABELS.prevMonth)).toBeInTheDocument();
    expect(screen.getByLabelText(FR_LABELS.nextMonth)).toBeInTheDocument();
    // Mon = first weekday
    expect(screen.getByText("Lun")).toBeInTheDocument();
  });

  it("shows a friendly empty state when no slots are passed", () => {
    render(<HouseCalendar slots={[]} labels={FR_LABELS} />);
    // No slot block is shown until a date is clicked, so the empty state
    // is the legend only — sanity-check by checking the legend caption.
    expect(screen.getByText(FR_LABELS.available)).toBeInTheDocument();
  });

  it("shifts the visible month forward when next is clicked", () => {
    render(<HouseCalendar slots={[]} labels={FR_LABELS} />);
    const next = screen.getByLabelText(FR_LABELS.nextMonth);
    const before = screen.getByRole("heading", { level: 3 }).textContent;
    fireEvent.click(next);
    const after = screen.getByRole("heading", { level: 3 }).textContent;
    expect(after).not.toBe(before);
  });

  it("invokes onConfirm with the picked slot once date + time are selected", () => {
    const onConfirm = vi.fn();
    const slot = buildSlot(2, "09:00", "available");
    render(<HouseCalendar slots={[slot]} labels={FR_LABELS} onConfirm={onConfirm} />);

    // Pick the date — its accessible label embeds the available status keyword.
    const dayBtn = screen.getByLabelText(new RegExp(`· ${FR_LABELS.available}`));
    fireEvent.click(dayBtn);

    // Pick the time slot.
    const timeBtn = screen.getByRole("button", { name: "09:00" });
    fireEvent.click(timeBtn);

    // Confirm.
    const confirmBtn = screen.getByRole("button", { name: new RegExp(FR_LABELS.confirm) });
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm.mock.calls[0]?.[0]).toMatchObject({ time: "09:00", status: "available" });
  });
});
