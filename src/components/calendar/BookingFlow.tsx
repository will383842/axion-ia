"use client";
// use-client: orchestrates a 2-step interactive flow (calendar → form) with
// shared selection state. Server component pages pass labels in.

import * as React from "react";
import { HouseCalendar, type CalendarSlot } from "@/components/calendar/HouseCalendar";
import { BookingForm } from "@/components/forms/BookingForm";

interface BookingFlowProps {
  slots: ReadonlyArray<CalendarSlot>;
  calendarLabels: React.ComponentProps<typeof HouseCalendar>["labels"];
  formLabels: React.ComponentProps<typeof BookingForm>["labels"];
}

export function BookingFlow({ slots, calendarLabels, formLabels }: BookingFlowProps) {
  const [confirmed, setConfirmed] = React.useState<CalendarSlot | null>(null);

  if (confirmed) {
    return (
      <BookingForm
        date={confirmed.date}
        time={confirmed.time}
        onCancel={() => setConfirmed(null)}
        labels={formLabels}
      />
    );
  }

  return (
    <HouseCalendar slots={slots} labels={calendarLabels} onConfirm={(slot) => setConfirmed(slot)} />
  );
}
