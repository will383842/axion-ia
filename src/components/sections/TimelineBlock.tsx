import * as React from "react";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  date: string; // ISO date or "2025"
  title: string;
  description?: string;
}

interface TimelineBlockProps {
  events: ReadonlyArray<TimelineEvent>;
  className?: string;
}

// Editorial v3 — vertical timeline avec connector terracotta + dates serif.
export function TimelineBlock({ events, className }: TimelineBlockProps) {
  return (
    <ol className={cn("border-border-strong relative ml-4 border-l", className)}>
      {events.map((event) => (
        <li key={event.id} className="relative pb-12 pl-8 last:pb-0">
          <span
            aria-hidden="true"
            className="bg-terracotta ring-bg absolute top-2 -left-[7px] inline-block h-3 w-3 rounded-full ring-4"
          />
          <time
            dateTime={event.date}
            className="text-terracotta text-2xl font-medium tabular-nums"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {event.date}
          </time>
          <h3 className="text-fg mt-2 text-lg leading-tight font-semibold tracking-tight">
            {event.title}
          </h3>
          {event.description ? (
            <p className="text-fg-soft mt-2 text-base leading-relaxed">{event.description}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
