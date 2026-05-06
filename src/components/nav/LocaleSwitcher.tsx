import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

// Server Component — no JS shipped. Toggles between FR ↔ EN keeping the
// current pathname (next-intl/navigation handles the locale rewrite).
// Editorial v3 — pill style, active = bg sand + fg.
export async function LocaleSwitcher() {
  const current = await getLocale();
  const t = await getTranslations("common");

  return (
    <nav
      aria-label={t("switchLanguage")}
      className="border-border inline-flex items-center gap-0.5 rounded-full border p-0.5"
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
              active ? "bg-sand text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {locale}
          </Link>
        );
      })}
    </nav>
  );
}
