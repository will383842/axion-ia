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
  /**
   * Sprint Final P1-12 (2026-05-22) — opt-out de l'émission du JSON-LD
   * BreadcrumbList inline. Permet aux pages qui consolident leurs schemas
   * dans un seul `@graph` (ex. `/implantations/[region]/[ville]`) d'inclure
   * BreadcrumbList dans leur graph sans dupliquer le script. Default = true
   * pour préserver le comportement historique sur les ~94 pages consommatrices.
   */
  emitJsonLd?: boolean;
  /**
   * `v1` (défaut) : rendu historique, inchangé. `v2` (gabarits d'articles) : une ligne,
   * page courante tronquée par « … », cibles de 44 px (`.bande-ariane`/`.fil-ariane` du
   * socle, feuille chargée par la seule route d'article).
   */
  variante?: "v1" | "v2";
}

// Visible visually + Schema.org BreadcrumbList JSON-LD (axionia-seo-aeo).
// Caller passes the path tail (without home). JSON-LD délégué à la factory
// `lib/seo.ts` pour rester cohérent avec les autres pages qui l'utilisent.
export async function Breadcrumbs({ items, emitJsonLd = true, variante = "v1" }: BreadcrumbsProps) {
  const t = await getTranslations("breadcrumb");
  const locale = (await getLocale()) as Locale;
  const homeLabel = t("home");

  const fullItems: ReadonlyArray<BreadcrumbItem> = [{ href: "/", label: homeLabel }, ...items];

  const jsonLd = emitJsonLd
    ? buildBreadcrumbJsonLd({
        locale,
        items: fullItems.map((item) => ({ name: item.label, href: item.href })),
      })
    : null;

  if (variante === "v2") {
    return (
      <>
        <div className="bande-ariane">
          <div className="conteneur">
            <nav aria-label={t("ariaLabel")} className="fil-ariane">
              <ol>
                {fullItems.map((item, idx) =>
                  idx === fullItems.length - 1 ? (
                    <li key={`${item.href}-${idx}`} aria-current="page">
                      {item.label}
                    </li>
                  ) : (
                    <li key={`${item.href}-${idx}`}>
                      <Link href={item.href as never}>{item.label}</Link>
                    </li>
                  ),
                )}
              </ol>
            </nav>
          </div>
        </div>
        {jsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        ) : null}
      </>
    );
  }

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
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
    </>
  );
}
