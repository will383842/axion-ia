"use client";
// use-client: `usePathname()` from next-intl needs the client runtime to
// know which page is currently displayed (so we can preserve it when
// the user toggles language).

import { Link, usePathname } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

// Editorial v3 — pill style mocha-aware. Auto-adapte aux conteneurs sombres
// via descendant selectors `[data-tone='dark']`. Active = bg ivoire + text mocha
// pour gros contraste, inactive = ivoire/60 hover ivoire.
//
// Comportement : le toggle FR/EN garde l'utilisateur sur la même page, en
// traduisant le pathname (ex `/fr/interventions/essentielle` ↔
// `/en/interventions/essential`). next-intl utilise les `pathnames` typés de
// `routing.ts` pour la traduction. Pour les routes dynamiques (`[slug]`),
// `useParams` fournit les valeurs courantes au Link.
export function LocaleSwitcher() {
  const current = useLocale();
  const pathname = usePathname();
  const params = useParams();
  const t = useTranslations("common");

  return (
    <nav
      aria-label={t("switchLanguage")}
      className={cn(
        "border-border inline-flex items-center gap-0.5 rounded-full border p-0.5",
        // Adaptation sur fond mocha (footer) ou terracotta (header)
        "[[data-tone=dark]_&]:border-border-on-mocha",
        "[[data-tone=terracotta]_&]:border-mocha/30",
      )}
    >
      {routing.locales.map((locale) => {
        const active = locale === current;
        return (
          <Link
            key={locale}
            // `pathname` est le path canonique (sans préfixe de langue) ;
            // `params` est nécessaire pour les routes dynamiques type [slug].
            // next-intl re-préfixe automatiquement avec la `locale` cible.
            href={{ pathname, params } as never}
            locale={locale}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase transition",
              active
                ? "bg-sand text-fg [[data-tone=dark]_&]:bg-mocha-fg [[data-tone=dark]_&]:text-mocha [[data-tone=terracotta]_&]:bg-mocha-fg [[data-tone=terracotta]_&]:text-terracotta"
                : "text-fg-muted hover:text-fg [[data-tone=dark]_&]:text-mocha-fg/70 [[data-tone=dark]_&]:hover:text-mocha-fg [[data-tone=terracotta]_&]:text-mocha-fg/75 [[data-tone=terracotta]_&]:hover:text-mocha-fg",
            )}
          >
            {locale}
          </Link>
        );
      })}
    </nav>
  );
}
