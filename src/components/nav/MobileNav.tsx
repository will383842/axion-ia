"use client";
// use-client: Sheet (Radix Dialog) needs portals + focus trap + animation
// states. Refactored from a custom div drawer per A11Y-003 / NAV-008
// (focus trap absent + backdrop click no-op).

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { BRAND } from "@/lib/brand";

interface MobileNavProps {
  children: React.ReactNode;
}

// Mobile drawer = Radix Sheet (right-side). Inherits focus trap, Escape,
// click-outside dismissal, and reduced-motion compliance from Radix.
export function MobileNav({ children }: MobileNavProps) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={t("openMenu")}
          className="text-fg hover:bg-border/50 focus-visible:ring-primary inline-flex h-11 w-11 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none xl:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm sm:max-w-sm">
        <SheetTitle className="sr-only">{t("openMenu")}</SheetTitle>
        <SheetDescription className="sr-only">{`${BRAND.name} navigation`}</SheetDescription>
        <div className="-m-6 flex h-full flex-col overflow-y-auto p-6">
          <span className="text-fg mb-6 text-sm font-semibold tracking-tight">{BRAND.name}</span>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
