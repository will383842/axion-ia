import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { LegalPageTemplate } from "@/components/sections/LegalPageTemplate";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { getLegal } from "@/content/legal";
import { CGV_DATE_ISO, CGV_VERSION_LIBELLE, CGV_VERSION_LIBELLE_EN } from "@/content/cgv-version";
import { buildProductMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

const SLUG = "conditions-generales" as const;
// ISR conservé (2026-08-17 : la page lisait alors le numéro de déclaration d'activité en base ;
// depuis la v3, l'article 1.2 le porte en dur). Même valeur que `/mentions-legales`.
export const revalidate = 3600;
// Date de dernière révision de FOND de cette page — à tenir à jour, les CGV
// renvoyant elles-mêmes à cette date pour déterminer la version applicable.
// Label affiché localisé ; `lastUpdatedIso` alimente <time dateTime>.
//
// 2026-07-30 : révision du paragraphe « médiation de la consommation ». La
// valeur précédente était calquée sur la déclaration d'accessibilité ; les
// deux pages évoluent séparément, elles ne sont plus liées.
//
// 2026-08-14 : ajout des clauses limitatives manquantes (services et
// fournisseurs tiers, sauvegarde et sécurité des systèmes du Client, nature
// probabiliste de l'IA, garantie PI du Client, plafond borné à 12 mois,
// forclusion 90 jours) + verrou « clauses non opposables au consommateur ».
// 🔴 Cette date fait foi : l'intro des CGV renvoie à elle pour déterminer la
// version applicable. La modifier SANS toucher au texte antidate une version.
//
// 2026-08-17 : ajout de la section « Déclaration d'activité » — numéro de
// déclaration obtenu le jour même (récépissé DREETS Auvergne-Rhône-Alpes) et
// mention obligatoire « ne vaut pas agrément de l'État » (art. L.6352-12
// C. trav.). Le texte rendu change réellement, la date suit.
//
// 2026-10-04 : ajout de l'article « Financement par un opérateur de
// compétences (OPCO) » (FR + EN) — dépôt de la demande, subrogation, refus,
// heures d'absence, non-paiement par l'OPCO. Le texte rendu change, la date suit.
//
// 2026-11-20 : CGV v3 (60 articles, annexes) en remplacement du texte du 18 novembre 2026,
// archivé. Les passages relatifs au financement et à la certification restent cachés tant que
// `QUALIOPI_CERTIFICATION_OBTENUE` n'est pas « true » (`@/content/cgv-passages-financement`).
// La date elle-même vit dans `@/content/cgv-version` (source unique, enregistrée à la signature).

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const p = getLegal(SLUG);
  const c = p[locale];
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? p.pathFr : p.pathEn,
    title: c.metaSeo.title,
    description: c.metaSeo.description,
    alternates: { fr: p.pathFr, en: p.pathEn },
  });
}

export default async function ConditionsGenerales({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const p = getLegal(SLUG);
  const copy = p[loc];
  // La déclaration d'activité figure à l'article 1.2 : plus de section ajoutée au runtime.
  const sections = copy.sections;
  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: isFr ? p.pathFr : p.pathEn, label: copy.title }];
  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <LegalPageTemplate
        isFr={isFr}
        locale={loc}
        canonicalPath={isFr ? p.pathFr : p.pathEn}
        title={copy.title}
        {...(copy.titleEm !== undefined ? { titleEm: copy.titleEm } : {})}
        intro={copy.intro}
        sections={sections}
        lastUpdated={isFr ? CGV_VERSION_LIBELLE : CGV_VERSION_LIBELLE_EN}
        lastUpdatedIso={CGV_DATE_ISO}
        preserveLineBreaks
        relatedLinks={[
          { href: "/mentions-legales", label: isFr ? "Mentions légales" : "Legal notice" },
          {
            href: "/politique-confidentialite",
            label: isFr ? "Politique de confidentialité" : "Privacy policy",
          },
        ]}
      />
    </>
  );
}
