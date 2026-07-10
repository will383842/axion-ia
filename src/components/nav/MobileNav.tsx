"use client";
// use-client: Sheet (Radix Dialog) needs portals + focus trap + animation
// states. Refactored from a custom div drawer per A11Y-003 / NAV-008
// (focus trap absent + backdrop click no-op).

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
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
  const pathname = usePathname();

  // Fermeture automatique du drawer dès qu'on sélectionne un lien : quand la
  // navigation aboutit, `pathname` change → on referme le Sheet. Corrige le
  // comportement « le menu reste ouvert après un clic » (Will 2026-07-10).
  // Les enfants (liens) sont rendus côté serveur : impossible d'y brancher un
  // onClick depuis ce wrapper client — surveiller le pathname est la voie sûre.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
      {/* Drawer 2026 : dégradé chaud paper→sand, coins gauche arrondis, bandeau
          de marque en tête, corps scrollable. p-0/gap-0 annulent le padding du
          variant Sheet pour piloter la mise en page ici. */}
      <SheetContent
        side="right"
        className="from-paper to-sand/40 flex w-full max-w-sm flex-col gap-0 overflow-hidden rounded-l-3xl border-l-0 bg-gradient-to-b p-0 sm:max-w-sm"
      >
        <SheetTitle className="sr-only">{t("openMenu")}</SheetTitle>
        <SheetDescription className="sr-only">{`${BRAND.name} navigation`}</SheetDescription>
        {/* Bandeau de marque — `pr-14` réserve la place du bouton fermeture (X)
            positionné en absolu par SheetContent en haut à droite. */}
        <div className="border-border/60 flex items-center border-b px-5 py-4 pr-14">
          <span
            className="text-fg text-lg font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Axion
            <span aria-hidden="true" className="text-fg/40 mx-0.5">
              -
            </span>
            <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
              IA
            </span>
          </span>
        </div>
        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-8">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
