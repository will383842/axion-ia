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

// Vertical timeline for the About page. Mobile-first; the connector line is
// a CSS pseudo-border on the wrapper.
export function TimelineBlock({ events, className }: TimelineBlockProps) {
  return (
    <ol className={cn("border-border relative ml-4 border-l", className)}>
      {events.map((event) => (
        <li key={event.id} className="relative pb-10 pl-6 last:pb-0">
          <span
            aria-hidden="true"
            className="bg-primary absolute top-1.5 -left-[7px] inline-block h-3 w-3 rounded-full"
          />
          <time
            dateTime={event.date}
            className="font-mono text-xs tracking-wide text-gray-600 uppercase"
          >
            {event.date}
          </time>
          <h3 className="text-fg mt-1 text-lg leading-tight font-semibold tracking-tight">
            {event.title}
          </h3>
          {event.description ? (
            <p className="mt-2 text-base leading-relaxed text-gray-700">{event.description}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
