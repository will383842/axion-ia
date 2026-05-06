import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

// Server Component — no JS shipped. Toggles between FR ↔ EN keeping the
// current pathname (next-intl/navigation handles the locale rewrite).
export async function LocaleSwitcher() {
  const current = await getLocale();
  const t = await getTranslations("common");

  return (
    <nav aria-label={t("switchLanguage")} className="flex items-center gap-1 text-xs">
      {routing.locales.map((locale, idx) => {
        const active = locale === current;
        return (
          <span key={locale} className="contents">
            {idx > 0 ? <span className="text-gray-300">·</span> : null}
            <Link
              href="/"
              locale={locale}
              aria-current={active ? "true" : undefined}
              className={cn(
                "rounded-xs px-1.5 py-1 font-medium tracking-wide uppercase",
                active ? "text-fg" : "hover:text-fg text-gray-600",
              )}
            >
              {locale}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
