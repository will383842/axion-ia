import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buildBreadcrumbJsonLd } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";

interface BreadcrumbItem {
  href: string;
  label: string;
}

interface BreadcrumbsProps {
  items: ReadonlyArray<BreadcrumbItem>;
}

// Visible visually + Schema.org BreadcrumbList JSON-LD (axionia-seo-aeo).
// Caller passes the path tail (without home). JSON-LD délégué à la factory
// `lib/seo.ts` pour rester cohérent avec les autres pages qui l'utilisent.
export async function Breadcrumbs({ items }: BreadcrumbsProps) {
  const t = await getTranslations("breadcrumb");
  const locale = (await getLocale()) as Locale;
  const homeLabel = t("home");

  const fullItems: ReadonlyArray<BreadcrumbItem> = [{ href: "/", label: homeLabel }, ...items];

  const jsonLd = buildBreadcrumbJsonLd({
    locale,
    items: fullItems.map((item) => ({ name: item.label, href: item.href })),
  });

  return (
    <>
      <nav aria-label={t("ariaLabel")} className="text-fg-muted text-xs">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {fullItems.map((item, idx) => {
            const isLast = idx === fullItems.length - 1;
            return (
              <li key={`${item.href}-${idx}`} className="flex items-center gap-2">
                {isLast ? (
                  <span aria-current="page" className="text-fg">
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href as never} className="hover:text-fg">
                    {item.label}
                  </Link>
                )}
                {!isLast ? <span aria-hidden="true">/</span> : null}
              </li>
            );
          })}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
