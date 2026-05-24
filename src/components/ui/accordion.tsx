"use client";
// use-client: Radix Accordion needs animations + ARIA state managed by JS.

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(function AccordionItem({ className, ...rest }, ref) {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn("border-border border-b", className)}
      {...rest}
    />
  );
});

export const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(function AccordionTrigger({ className, children, ...rest }, ref) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          "text-fg hover:text-primary flex flex-1 items-center justify-between py-4 text-left text-base font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&[data-state=open]>svg]:rotate-180",
          className,
        )}
        data-faq-q
        itemProp="name"
        {...rest}
      >
        {children}
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform duration-200"
          aria-hidden="true"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
});

export const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(function AccordionContent({ className, children, ...rest }, ref) {
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden text-base text-fg-soft"
      {...rest}
    >
      <div className={cn("pb-4 pt-0", className)} data-faq-a itemProp="text">
        {children}
      </div>
    </AccordionPrimitive.Content>
  );
});
