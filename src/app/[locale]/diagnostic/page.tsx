// Score IA TPE-PME (`/[locale]/diagnostic`) — GEO V2-10 PR-3.
//
// Cette adresse hébergeait une page d'atterrissage publicitaire (`noindex`, vidéo jamais posée).
// Elle porte désormais le Score IA TPE-PME : questionnaire de 15 écrans, score calculé dans le
// NAVIGATEUR, comparaison à des agrégats déjà présents dans la page. Rien ne part tant que la
// personne n'a pas coché la case de l'Observatoire ET pressé le bouton (cf. `AjoutObservatoire`).
//
// Server Component : écran d'accueil, formule, méthode, FAQ, `#retrait` rendus ici (indexables) ;
// seuls `ScoreFlow` et `RetraitBloc` portent du JS. Les libellés sont résolus ICI et passés en
// props : aucun JSON i18n dans le JavaScript du client.
//
// Nom public : « Score IA TPE-PME ». « Diagnostic IA » désigne l'appel gratuit (`/appel`).

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { isEnLocaleDisabled } from "@/lib/i18n/en-to-fr-redirect";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL, SITE_EDITORIAL_DATE } from "@/lib/seo";
import { resolveLegalIdentity, LEGAL_IDENTITY_DEFAULTS } from "@/lib/legal-identity";
import { prixJourneeIa } from "@/content/offre";
import { lireSnapshotScore } from "@/server/observatoire/score-snapshot";
import {
  BAREMES,
  POIDS,
  POINTS_OUTILS,
  POINTS_USAGES,
  SCORE_VERSION,
  niveauDe,
  type CritereId,
} from "@/lib/score-ia-pme/formule";
import { construireQuestions } from "@/content/score-ia-pme/questions";
import { LIBELLES_SCORE } from "@/lib/score-ia-pme/libelles";
import {
  CRITERES_LIBELLES,
  DEFINITION,
  DESCRIPTION_PAGE,
  ENGAGEMENTS,
  FAQ,
  H1,
  METHODE,
  NOM_PUBLIC,
  OBSERVATOIRE,
  RETRAIT,
  TITRE_PAGE,
  encadreInformation,
} from "@/content/score-ia-pme/textes";
import { ScoreFlow, type SnapshotComparaison } from "@/components/score-ia-pme/ScoreFlow";
import { RetraitBloc } from "@/components/score-ia-pme/RetraitBloc";

interface Props {
  params: Promise<{ locale: string }>;
}

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return {
    // `{ absolute }` : le titre porte DÉJÀ la marque (le gabarit racine ajouterait « · Axion-IA »).
    title: { absolute: TITRE_PAGE },
    description: DESCRIPTION_PAGE,
    alternates: {
      canonical: isEnLocaleDisabled() ? "/fr/diagnostic" : `/${locale}/diagnostic`,
    },
    // Un outil citable : la page est désormais INDEXÉE (elle était `noindex` en page publicitaire).
    robots: { index: true, follow: true },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function formaterDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Plages de score de chaque niveau, lues de `niveauDe` (aucune borne recopiée). */
function plagesNiveaux(): Array<{ niveau: string; de: number; a: number }> {
  const out: Array<{ niveau: string; de: number; a: number }> = [];
  for (let s = 0; s <= 100; s += 1) {
    const n = niveauDe(s);
    const dernier = out[out.length - 1];
    if (dernier && dernier.niveau === n) dernier.a = s;
    else out.push({ niveau: n, de: s, a: s });
  }
  return out;
}

function reponsesDuBareme(critere: CritereId): string {
  const libelles = LIBELLES_SCORE[critere]?.options ?? {};
  if (critere === "useCases") {
    return POINTS_USAGES.map(
      (p, i) => `${i === POINTS_USAGES.length - 1 ? `${i} et plus` : i} usage(s) : ${p}`,
    ).join(" · ");
  }
  if (critere === "tools") {
    return POINTS_OUTILS.map(
      (p, i) => `${i === POINTS_OUTILS.length - 1 ? `${i} et plus` : i} outil(s) : ${p}`,
    ).join(" · ");
  }
  const bareme = BAREMES[critere as keyof typeof BAREMES] as Record<string, number>;
  return Object.entries(bareme)
    .map(([v, p]) => `${libelles[v] ?? v} : ${p}`)
    .join(" · ");
}

export default async function ScoreIaTpePmePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [brut, identite] = await Promise.all([
    lireSnapshotScore().catch(() => null),
    resolveLegalIdentity().catch(() => LEGAL_IDENTITY_DEFAULTS),
  ]);
  const snapshot: SnapshotComparaison | null = brut
    ? {
        genereLe: brut.genereLe,
        global: brut.global,
        parTaille: brut.parTaille,
        parSecteur: brut.parSecteur,
      }
    : null;

  const questions = construireQuestions();
  const libellesTaille = LIBELLES_SCORE["companySize"]?.options ?? {};
  const encadre = encadreInformation(identite.legalName, identite.contactEmail);
  const hrefConfidentialite = `/${locale}/politique-confidentialite`;
  const dateMaj = formaterDate(SITE_EDITORIAL_DATE);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: NOM_PUBLIC,
    url: `${SITE_URL}/${locale}/diagnostic`,
    description: DESCRIPTION_PAGE,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "fr-FR",
    softwareVersion: SCORE_VERSION,
    isAccessibleForFree: true,
    provider: { "@id": `${SITE_URL}/#organization` },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <Container className="py-10 sm:py-14">
        <header className="max-w-3xl">
          <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-tight font-bold text-balance">
            {H1}
          </h1>
          <p className="mt-4 text-lg leading-relaxed">{DEFINITION}</p>
          <ul className="mt-5 space-y-2 text-sm">
            {ENGAGEMENTS.map((e) => (
              <li key={e} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </header>

        <section
          id="questionnaire"
          aria-label={NOM_PUBLIC}
          className="border-ink/15 mt-8 max-w-3xl scroll-mt-6 rounded-2xl border bg-white p-5 sm:p-8 print:border-0"
        >
          <ScoreFlow
            questions={questions}
            libellesTaille={libellesTaille}
            snapshot={snapshot}
            encadre={encadre}
            hrefConfidentialite={hrefConfidentialite}
            prixJournee={prixJourneeIa(locale === "en" ? "en" : "fr")}
          />
        </section>

        <div className="mt-12 max-w-3xl space-y-12 print:hidden">
          <section id="methode" aria-labelledby="methode-titre" className="scroll-mt-6">
            <h2 id="methode-titre" className="text-2xl font-semibold">
              {METHODE.titre}
            </h2>
            <p className="mt-3">{METHODE.mesure}</p>
            <p className="mt-3">{METHODE.conventions}</p>
            <p className="mt-3">{METHODE.taille}</p>
            <p className="mt-3">{METHODE.echantillon}</p>
            <p className="mt-3">{METHODE.officielles}</p>
            <ul className="mt-2 list-disc pl-5">
              {METHODE.liens.map((l) => (
                <li key={l.href}>
                  <a className="underline" href={l.href} rel="noopener">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-ink/70 mt-3 text-sm">{METHODE.versionLibelle(dateMaj)}</p>
          </section>

          <section id="formule" aria-labelledby="formule-titre" className="scroll-mt-6">
            <h2 id="formule-titre" className="text-2xl font-semibold">
              {METHODE.formuleTitre}
            </h2>
            <p className="mt-3">{METHODE.formuleIntro}</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-ink/20 border-b">
                    <th scope="col" className="py-2 pr-3">
                      {METHODE.colonnes.critere}
                    </th>
                    <th scope="col" className="py-2 pr-3">
                      {METHODE.colonnes.poids}
                    </th>
                    <th scope="col" className="py-2">
                      {METHODE.colonnes.reponses}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(POIDS) as CritereId[]).map((c) => (
                    <tr key={c} className="border-ink/10 border-b align-top">
                      <th scope="row" className="py-2 pr-3 font-medium">
                        {CRITERES_LIBELLES[c]}
                      </th>
                      <td className="py-2 pr-3">{POIDS[c]}</td>
                      <td className="py-2">{reponsesDuBareme(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mt-6 text-lg font-semibold">{METHODE.niveauxTitre}</h3>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {plagesNiveaux().map((n) => (
                <li key={n.niveau}>
                  {n.niveau} : de {n.de} à {n.a}
                </li>
              ))}
            </ul>
          </section>

          <section id="observatoire" aria-labelledby="observatoire-titre" className="scroll-mt-6">
            <h2 id="observatoire-titre" className="text-2xl font-semibold">
              {OBSERVATOIRE.titre}
            </h2>
            <p className="mt-3">{OBSERVATOIRE.texte}</p>
          </section>

          <section id="faq" aria-labelledby="faq-titre" className="scroll-mt-6">
            <h2 id="faq-titre" className="text-2xl font-semibold">
              Questions fréquentes
            </h2>
            <div className="mt-4 space-y-3">
              {FAQ.map((f) => (
                <details key={f.q} className="border-ink/15 rounded-lg border bg-white p-4">
                  <summary className="cursor-pointer font-medium">{f.q}</summary>
                  <p className="mt-2 text-sm">{f.r}</p>
                </details>
              ))}
            </div>
          </section>

          <section id="retrait" aria-labelledby="retrait-titre" className="scroll-mt-6">
            <h2 id="retrait-titre" className="text-2xl font-semibold">
              {RETRAIT.titre}
            </h2>
            <p className="mt-3 text-sm">{RETRAIT.intro}</p>
            <div className="mt-3">
              <RetraitBloc />
            </div>
          </section>
        </div>
      </Container>
    </>
  );
}
