import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { LegalPageTemplate } from "@/components/sections/LegalPageTemplate";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { getLegal } from "@/content/legal";
import { buildProductMetadata } from "@/lib/seo";
import { buildDeclarationActiviteSection } from "@/components/qualiopi/certifications-section";

interface Props {
  params: Promise<{ locale: string }>;
}

const SLUG = "conditions-generales" as const;
// ISR — 2026-08-17. La page était intégralement figée au build. Elle porte
// désormais la section « Déclaration d'activité », dont le numéro est lu au
// runtime : sans revalidation, la mention serait absente du HTML jusqu'au
// déploiement suivant (au build, la base est le stub `stub.invalid` et le
// drapeau de divulgation n'est pas un build-arg). Même valeur et même motif que
// `/mentions-legales`.
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
const LAST_UPDATED_ISO = "2026-08-17";

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
  // Section « Déclaration d'activité » — le NDA est une mention due sur les
  // documents contractuels et publicitaires (art. L.6352-4), et les CGV sont les
  // deux à la fois. Ajoutée en fin de sections plutôt qu'insérée dans le corps
  // de « Dispositions propres à la formation professionnelle » : y injecter du
  // texte de configuration mêlerait une donnée runtime à une clause figée, et la
  // clause resterait juste à sa place. `null` si le numéro n'est pas disponible.
  const declaration = await buildDeclarationActiviteSection(isFr);
  const sections = [...copy.sections, ...(declaration ? [declaration] : [])];
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
        lastUpdated={isFr ? "17 août 2026" : "August 17, 2026"}
        lastUpdatedIso={LAST_UPDATED_ISO}
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
