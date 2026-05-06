import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

interface BreadcrumbItem {
  href: string;
  label: string;
}

interface BreadcrumbsProps {
  items: ReadonlyArray<BreadcrumbItem>;
}

// Visible visually + Schema.org BreadcrumbList JSON-LD (axionia-seo-aeo).
// Caller passes the path tail (without home).
export async function Breadcrumbs({ items }: BreadcrumbsProps) {
  const t = await getTranslations("breadcrumb");
  const locale = await getLocale();
  const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";
  const homeLabel = t("home");

  const fullItems: ReadonlyArray<BreadcrumbItem> = [{ href: "/", label: homeLabel }, ...items];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: fullItems.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.label,
      item: `${SITE_URL}/${locale}${item.href === "/" ? "" : item.href}`,
    })),
  } as const;

  return (
    <>
      <nav aria-label="breadcrumb" className="text-xs text-gray-600">
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
