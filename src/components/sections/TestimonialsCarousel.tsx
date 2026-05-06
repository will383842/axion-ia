"use client";
// use-client: keyboard arrow controls + scroll-snap programmatic scrolling.

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TestimonialCard } from "@/components/marketing/TestimonialCard";
import { cn } from "@/lib/utils";

interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role?: string;
  company?: string;
}

interface TestimonialsCarouselProps {
  items: ReadonlyArray<Testimonial>;
  className?: string;
}

// CSS scroll-snap carousel — no embla dep needed. Keyboard arrows + buttons
// programmatically scroll one card at a time. Respects prefers-reduced-motion
// via globals.css (transition disabled there).
export function TestimonialsCarousel({ items, className }: TestimonialsCarouselProps) {
  const trackRef = React.useRef<HTMLOListElement>(null);

  const scrollBy = React.useCallback((direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector("li");
    const step = card ? (card as HTMLElement).offsetWidth + 16 : 320;
    track.scrollBy({ left: step * direction, behavior: "smooth" });
  }, []);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLOListElement>) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollBy(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollBy(-1);
      }
    },
    [scrollBy],
  );

  return (
    <div className={cn("relative", className)}>
      <ol
        ref={trackRef}
        tabIndex={0}
        aria-label="Testimonials carousel"
        onKeyDown={onKeyDown}
        className="focus-visible:ring-primary -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 py-2 focus-visible:rounded-md focus-visible:ring-2 focus-visible:outline-none"
      >
        {items.map((item) => (
          <li key={item.id} className="w-[85%] shrink-0 snap-start sm:w-[60%] lg:w-[33%]">
            <TestimonialCard
              quote={item.quote}
              author={item.author}
              {...(item.role !== undefined ? { role: item.role } : {})}
              {...(item.company !== undefined ? { company: item.company } : {})}
            />
          </li>
        ))}
      </ol>
      <div className="mt-8 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Previous testimonial"
          className="text-fg-soft hover:bg-sand border-border-strong focus-visible:ring-primary inline-flex h-11 w-11 items-center justify-center rounded-full border focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Next testimonial"
          className="text-fg-soft hover:bg-sand border-border-strong focus-visible:ring-primary inline-flex h-11 w-11 items-center justify-center rounded-full border focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
