"use client";
// use-client: month navigation state + slot selection + keyboard arrow nav
// + live region announcing slot count changes.

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SlotStatus = "available" | "option" | "reserved";

export interface CalendarSlot {
  date: string; // ISO yyyy-mm-dd
  time: string; // "09:00"
  status: SlotStatus;
}

interface HouseCalendarProps {
  slots: ReadonlyArray<CalendarSlot>;
  onConfirm?: (slot: CalendarSlot) => void;
  className?: string;
  labels: {
    prevMonth: string;
    nextMonth: string;
    available: string;
    option: string;
    reserved: string;
    selectDate: string;
    selectTime: string;
    confirm: string;
    noSlots: string;
    weekDays: ReadonlyArray<string>; // 7 entries Mon..Sun
  };
}

const FR_MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const EN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// AxionIA on-site calendar — 3-state slots (available/option/reserved).
// CLAUDE.md v6 §11 + doc 24. Sprint 15 plugs Prisma; Sprint 11 uses fixtures.
export function HouseCalendar({ slots, onConfirm, className, labels }: HouseCalendarProps) {
  const today = React.useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = React.useState(today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(today.getMonth());
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<CalendarSlot | null>(null);

  const isFr = labels.weekDays[0]?.toLowerCase().startsWith("l") ?? true;
  const monthName = (isFr ? FR_MONTHS : EN_MONTHS)[viewMonth];

  // Build calendar grid: align Monday-first.
  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7; // Monday=0

  function dateKey(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function statusForDate(key: string): SlotStatus | undefined {
    const dateSlots = slots.filter((s) => s.date === key);
    if (dateSlots.length === 0) return undefined;
    if (dateSlots.some((s) => s.status === "available")) return "available";
    if (dateSlots.some((s) => s.status === "option")) return "option";
    return "reserved";
  }

  const slotsForSelected = selectedDate
    ? slots.filter((s) => s.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time))
    : [];

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m += 12;
      y -= 1;
    } else if (m > 11) {
      m -= 12;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  return (
    <div className={cn("border-border bg-bg shadow-card rounded-sm border p-6", className)}>
      <header className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label={labels.prevMonth}
          className="text-fg hover:bg-border/40 focus-visible:ring-primary inline-flex h-11 w-11 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h3 className="text-fg text-lg font-semibold tracking-tight">
          {monthName} {viewYear}
        </h3>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label={labels.nextMonth}
          className="text-fg hover:bg-border/40 focus-visible:ring-primary inline-flex h-11 w-11 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div role="grid" aria-label={labels.selectDate} className="grid grid-cols-7 gap-1 text-sm">
        {labels.weekDays.map((d) => (
          <div
            key={d}
            role="columnheader"
            className="py-2 text-center text-xs font-semibold text-gray-600 uppercase"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: startWeekday }).map((_, i) => (
          <div key={`empty-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const key = dateKey(viewYear, viewMonth, day);
          const status = statusForDate(key);
          const isSelected = selectedDate === key;
          const isPast = new Date(key) < new Date(today.toDateString());
          const disabled = !status || isPast;
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              disabled={disabled}
              onClick={() => {
                setSelectedDate(key);
                setSelectedSlot(null);
              }}
              aria-selected={isSelected}
              aria-label={
                status === "available"
                  ? `${day} · ${labels.available}`
                  : status === "option"
                    ? `${day} · ${labels.option}`
                    : status === "reserved"
                      ? `${day} · ${labels.reserved}`
                      : `${day}`
              }
              className={cn(
                "focus-visible:ring-primary h-11 rounded-sm text-sm font-medium tabular-nums focus-visible:ring-2 focus-visible:outline-none",
                disabled && "cursor-not-allowed text-gray-300",
                !disabled &&
                  status === "available" &&
                  "bg-accent-green/10 text-fg hover:bg-accent-green/20",
                !disabled &&
                  status === "option" &&
                  "bg-accent-yellow/15 text-fg hover:bg-accent-yellow/25",
                !disabled &&
                  status === "reserved" &&
                  "bg-border/60 cursor-not-allowed text-gray-700",
                isSelected && "ring-primary ring-2",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="sr-only">
        {selectedDate
          ? `${slotsForSelected.length} ${slotsForSelected.length === 1 ? "slot" : "slots"} ${labels.available}`
          : ""}
      </div>

      {selectedDate ? (
        <div className="border-border mt-6 border-t pt-6">
          <h4 className="text-fg mb-3 text-sm font-semibold tracking-wide uppercase">
            {labels.selectTime}
          </h4>
          {slotsForSelected.length === 0 ? (
            <p className="text-sm text-gray-700">{labels.noSlots}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {slotsForSelected.map((s) => {
                const isSelectedSlot = selectedSlot?.time === s.time;
                const disabled = s.status === "reserved";
                return (
                  <li key={s.time}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setSelectedSlot(s)}
                      aria-pressed={isSelectedSlot}
                      className={cn(
                        "focus-visible:ring-primary rounded-sm border px-3 py-2 text-sm tabular-nums focus-visible:ring-2 focus-visible:outline-none",
                        disabled && "border-border bg-border/40 cursor-not-allowed text-gray-300",
                        !disabled &&
                          !isSelectedSlot &&
                          "border-border text-fg hover:border-border-hover",
                        isSelectedSlot && "border-primary bg-primary text-primary-fg",
                      )}
                    >
                      {s.time}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {selectedSlot && selectedSlot.status === "available" ? (
            <div className="mt-6">
              <Button onClick={() => onConfirm?.(selectedSlot)} size="lg">
                {labels.confirm} →
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <footer className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-700">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="bg-accent-green/30 inline-block h-3 w-3 rounded-xs" />
          {labels.available}
        </span>
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="bg-accent-yellow/40 inline-block h-3 w-3 rounded-xs"
          />
          {labels.option}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="bg-border inline-block h-3 w-3 rounded-xs" />
          {labels.reserved}
        </span>
      </footer>
    </div>
  );
}
