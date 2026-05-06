import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

// Editorial v3 — pill style mocha-aware. Auto-adapte aux conteneurs sombres
// via descendant selectors `[data-tone='dark']`. Active = bg ivoire + text mocha
// pour gros contraste, inactive = ivoire/60 hover ivoire.
export async function LocaleSwitcher() {
  const current = await getLocale();
  const t = await getTranslations("common");

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
            href="/"
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
