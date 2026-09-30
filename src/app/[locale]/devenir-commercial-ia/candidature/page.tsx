// Page candidature commercial — INDEXABLE (intention « devenir commercial » +
// destination des CTA des pages France/memo-isere). Le formulaire est un îlot
// client unique (CommercialApplicationWizard) ; la coquille reste
// server-rendered.
//
// Contenu FR au vouvoiement uniquement (décision Will du 29/09/2026) : le locale EN est 301 → FR au runtime
// (cf. AGENTS.md), les métadonnées EN restent pour le jour du re-enable.
//
// ── Refonte MOBILE-FIRST 2026-08-18 ────────────────────────────────────────
// La coquille ne contenait qu'un `<Container>` et le wizard. Trois conséquences
// qui se corrigent ensemble ici :
//
//   1. AUCUN CONTENU SERVEUR sur une page déclarée indexable — le seul texte
//      durable était l'écran 0 du wizard, qui DISPARAÎT dès la première
//      question. La page perdait donc aussi son `h1` à partir de l'étape 1 :
//      le `h1` vit maintenant dans la coquille, les étapes restent en `h2`.
//   2. RIEN NE RASSURE le candidat pendant qu'il remplit : ce qui se passe
//      après l'envoi n'apparaissait qu'une fois le formulaire soumis. La
//      colonne « Et après ? » le dit avant.
//   3. DESKTOP EN COLONNE UNIQUE de 576 px au milieu d'un écran vide. La page
//      passe en deux colonnes dès `lg` (rail éditorial à gauche, formulaire à
//      droite) — sur mobile, l'ordre du DOM reste : accroche → formulaire →
//      réassurance, le formulaire à un demi-écran du haut.
//
// 📷 Photo : Unsplash curée pour cette page (planche-contact relue) et servie
// en AVIF local depuis `/public/illustrations/memo-isere` — crédit photographe
// rendu sous la photo (CGU Unsplash §9).

import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Clock, FileX2, MapPin, PhoneCall, Rocket, Save, ShieldCheck } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { CommercialApplicationWizard } from "@/components/forms/commercial-application/CommercialApplicationWizard";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { COMMISSION_FORMATION_PAR_JOURNEE_EUR } from "@/content/pricing";
import { buildCommercialKeywords } from "@/content/recrutement/commercial-offer";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import { memoPhoto } from "@/content/recrutement/memo-isere-photos";
import { MEMO_ZONE_CLUSTERS, MEMO_ZONE_TOTAL } from "@/content/recrutement/memo-isere-zone";
import { buildProductMetadata } from "@/lib/seo";

export const revalidate = 3600;

/** Rémunération d'un apporteur — commission de recrutement, pas un tarif client.
 *  Le montant vient de `pricing.ts` et se dit indicatif (JUR-T29, 2026-09-29) :
 *  la grille d'un contrat peut descendre sous la grille publiée. */
const PROMESSE = `${COMMISSION_FORMATION_PAR_JOURNEE_EUR} € par journée de formation vendue, à titre indicatif`;

/** Ce que le candidat n'aura PAS à faire — l'argument n°1 du tunnel sans CV. */
const ATOUTS = [
  { Icon: FileX2, title: "Zéro CV", text: "Un message libre remplace la lettre de motivation." },
  { Icon: Clock, title: "3 minutes", text: "Une question par écran, à portée de pouce." },
  {
    Icon: Save,
    title: "Reprise possible",
    text: "Vos réponses restent sur votre appareil : fermez, revenez, vous reprenez où vous en étiez.",
  },
] as const;

/** Ce qui se passe APRÈS l'envoi. Aligné sur l'écran de confirmation du
 *  wizard — jamais un délai inventé. L'invitation à réserver l'échange part
 *  seule ~15 min après un dossier complet (`invitation-auto.ts`), d'où « dans
 *  les minutes qui suivent ».
 *
 *  ⚖️ Vocabulaire neutre d'apporteur INDÉPENDANT : pas de formation imposée,
 *  pas de zone ni de secteur attribués, pas d'objectifs (risque de
 *  requalification en agent commercial ou en salariat). */
const APRES = [
  {
    Icon: PhoneCall,
    title: "Un e-mail, puis une invitation",
    text: "Vous recevez un e-mail de confirmation, puis, dans les minutes qui suivent, une invitation à réserver un échange de 15 minutes en visio.",
  },
  {
    Icon: ShieldCheck,
    title: "Un échange en visio",
    text: "15 minutes pour faire connaissance et répondre à vos questions.",
  },
  {
    Icon: Rocket,
    title: "Vous recommandez, à votre rythme",
    text: "Nous vous présentons l'offre (produits, argumentaires) et vous recommandez Axion-IA auprès des entreprises que vous connaissez, en toute indépendance.",
  },
] as const;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const title = isFr
    ? "Candidature commercial Axion-IA · 3 minutes, sans CV"
    : "Axion-IA sales rep application · 3 minutes, no resume";
  return {
    ...(await buildProductMetadata({
      locale,
      path: "/devenir-commercial-ia/candidature",
      title,
      description: isFr
        ? `Candidatez en 3 minutes, sans CV : à titre indicatif, ${COMMISSION_FORMATION_PAR_JOURNEE_EUR} € pour vous par journée de formation IA vendue. L'AI Act crée des obligations pour les entreprises qui utilisent l'IA.`
        : `Apply in 3 minutes, no resume: as a guide, €${COMMISSION_FORMATION_PAR_JOURNEE_EUR} for you per AI training day sold. The AI Act sets obligations for companies that use AI.`,
    })),
    title: { absolute: title },
    keywords: buildCommercialKeywords({ financementAffichable: isQualiopiCertificationObtenue() }),
  };
}

export default async function CommercialApplicationPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";
  const photo = memoPhoto("candidature");

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs
          items={[
            { href: "/devenir-commercial-ia", label: isFr ? "Devenir commercial" : "Become a rep" },
            {
              href: "/devenir-commercial-ia/candidature",
              label: isFr ? "Candidature" : "Application",
            },
          ]}
        />
      </Container>

      <div className="bg-halo-warm">
        <Container className="py-8 sm:py-12 lg:py-16">
          {/* Grille explicite : sur mobile l'ordre du DOM (accroche → formulaire
              → réassurance) est aussi l'ordre visuel ; dès `lg`, le formulaire
              saute dans la colonne de droite et occupe les deux rangées. */}
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-start lg:gap-14">
            {/* ── 1. Accroche ─────────────────────────────────────────────── */}
            <header className="lg:col-start-1 lg:row-start-1">
              <p className="border-terracotta/30 bg-paper/70 inline-flex items-center gap-2 rounded-full border px-4 py-1.5">
                <span
                  aria-hidden="true"
                  className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
                />
                <span className="text-terracotta-deep text-sm font-semibold">
                  Candidatures ouvertes
                </span>
              </p>
              <h1 className="text-fg mt-5 text-[32px] leading-[1.08] font-bold tracking-tight text-balance sm:text-[40px] lg:text-[44px]">
                Devenez commercial IA indépendant{" "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  à votre rythme
                </span>
              </h1>
              <p className="text-fg-soft mt-5 text-lg leading-relaxed text-pretty">
                Pas de CV. Pas de lettre de motivation. Quelques questions essentielles, une par
                écran — et nous vous répondons.
              </p>

              <ul
                className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-1"
                role="list"
              >
                {ATOUTS.map((a) => (
                  <li
                    key={a.title}
                    className="border-border bg-paper/80 shadow-subtle flex items-start gap-3 rounded-2xl border p-3.5 sm:flex-col sm:gap-0 sm:p-4 lg:flex-row lg:gap-3"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-terracotta-soft text-terracotta-deep inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:mb-2.5 lg:mb-0"
                    >
                      <a.Icon className="h-4.5 w-4.5" strokeWidth={2} />
                    </span>
                    <span className="min-w-0">
                      <span className="text-fg block font-serif text-base leading-snug font-semibold">
                        {a.title}
                      </span>
                      <span className="text-fg-soft mt-0.5 block text-[13px] leading-snug">
                        {a.text}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </header>

            {/* ── 2. Le formulaire ────────────────────────────────────────── */}
            {/* Volontairement NON `sticky` : une étape haute (le parcours peut
                porter 8 expériences) dépasserait la fenêtre et son bouton
                d'envoi deviendrait inatteignable. */}
            <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <div className="border-border bg-paper shadow-card -mx-4 rounded-none border-x-0 border-y p-5 sm:mx-0 sm:rounded-3xl sm:border-x sm:p-7 lg:p-8">
                <CommercialApplicationWizard />
              </div>
            </div>

            {/* ── 3. Réassurance — sous le formulaire sur mobile ──────────── */}
            <div className="lg:col-start-1 lg:row-start-2">
              <div className="border-terracotta/30 bg-terracotta-soft/40 rounded-2xl border px-5 py-4">
                <p className="text-terracotta-deep font-serif text-xl leading-snug font-semibold">
                  {PROMESSE}
                </p>
                <p className="text-fg-soft mt-1 text-sm leading-relaxed">
                  Commission à l&apos;encaissement, statut indépendant, en toute liberté.
                </p>
              </div>

              <h2 className="text-fg mt-8 font-serif text-2xl leading-snug font-semibold">
                Et après, il se passe quoi ?
              </h2>
              <ol className="mt-4 space-y-3">
                {APRES.map((s, i) => (
                  <li
                    key={s.title}
                    className="border-border bg-paper/80 shadow-subtle flex items-start gap-3.5 rounded-2xl border p-4"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-mocha text-mocha-fg inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-serif text-base font-semibold"
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="text-fg flex items-center gap-2 font-semibold">
                        <s.Icon aria-hidden="true" className="text-terracotta h-4 w-4 shrink-0" />
                        {s.title}
                      </span>
                      <span className="text-fg-soft mt-1 block text-sm leading-relaxed">
                        {s.text}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>

              <figure className="mt-8">
                <div className="border-border shadow-card relative aspect-[4/3] overflow-hidden rounded-3xl border">
                  <Image
                    src={photo.src}
                    alt="Un homme sourit devant son téléphone, une vallée en arrière-plan : la candidature se remplit en 3 minutes, d'où que vous soyez."
                    fill
                    sizes="(max-width: 1024px) 100vw, 42vw"
                    className="object-cover"
                  />
                </div>
                <figcaption>
                  <UnsplashCredit
                    photographerName={photo.photographer}
                    photographerUrl={photo.photographerUrl}
                    className="text-right"
                  />
                </figcaption>
              </figure>

              <p className="text-fg-soft mt-6 text-sm leading-relaxed">
                <MapPin aria-hidden="true" className="text-terracotta mr-1.5 inline h-4 w-4" />
                {MEMO_ZONE_TOTAL} communes réparties en {MEMO_ZONE_CLUSTERS.length} secteurs, de
                Grenoble à Valence, Die et Lyon — et Axion-IA intervient partout en France.{" "}
                {/* Ancre HTML brute, pas le `Link` typé de next-intl :
                    `/memo-isere` n'est PAS déclarée dans `routing.pathnames`
                    (page presse hors arborescence), donc le type de `href` la
                    refuse. Un cast `as never` masquerait le fait, pas le
                    problème. */}
                <a
                  href={`/${locale}/memo-isere`}
                  className="text-terracotta-deep font-semibold underline underline-offset-2"
                >
                  Voir le détail de l’offre et des secteurs
                </a>
                .
              </p>
            </div>
          </div>
        </Container>
      </div>
    </>
  );
}
