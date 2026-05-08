"use client";
// use-client: Radix Checkbox manages indicator state via JS.

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// WCAG 2.5.8 AA Target Size : minimum 24×24 CSS px pour les pointer-targets.
// Visuel reste 18×18 (h-4.5 w-4.5) — la zone cliquable est étendue via padding
// invisible sur la Root (24×24 effectif). Click + check sont sémantiquement
// liés au Root, pas au visuel, donc Radix gère le hit-test correctement.
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...rest }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        // Zone tap 24×24 px (WCAG 2.5.8) — padding invisible autour du visuel.
        "relative grid h-6 w-6 shrink-0 place-items-center",
        // Visuel 18×18 px via pseudo-content sur Root (border + état coché).
        "before:absolute before:inset-1 before:rounded-xs before:border before:border-border before:transition",
        "data-[state=checked]:before:bg-primary data-[state=checked]:before:border-primary",
        "focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none rounded-xs",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "peer",
        className,
      )}
      {...rest}
    >
      <CheckboxPrimitive.Indicator className="relative z-[1] flex items-center justify-center text-primary-fg">
        <Check className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.5} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
