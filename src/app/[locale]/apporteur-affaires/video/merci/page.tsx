// Page MERCI de la page VSL apporteurs — `/fr/apporteur-affaires/video/merci`.
//
// La personne vient de laisser son e-mail, son téléphone et sa réponse : elle est
// au maximum de son attention, et l'étape utile est UNE : choisir son créneau de
// 15 minutes (décision du plan 03 : « Calendly tout de suite après l'étape 2 »,
// jamais après la seule étape 1).
//
// ── La réservation du SITE, plus la page Calendly (Will, 2026-10-07) ────────
// « Le parcours apporteur doit avoir le même design que le parcours client. »
// Les créneaux sont ceux de `/fr/appel/apporteur` — le MÊME composant
// (`CalendlyInlineWidget` → `CalendlySlotPicker`, HTML rendu côté serveur, aucun
// JavaScript), le même formulaire (`/fr/appel/reserver`) et la même page de fin
// (`/fr/appel/confirme`). Plus aucun lien vers calendly.com sur cette page :
//   · créneaux lisibles et réservation directe allumée → la grille, ici ;
//   · sinon → un gros bouton « Choisir mon créneau » vers `/fr/appel/apporteur`,
//     qui porte ses propres replis.
//
// ── Ce qui suit la personne jusqu'à la réservation ──────────────────────────
//   · `depuis=vsl-apporteur` : le BOUTON, dans son propre paramètre ;
//   · `utm_content` = l'ANNONCE d'origine (2026-10-10) — celle de la fiche, sinon
//     celle du cookie d'arrivée ; le marqueur du bouton (`apporteur:vsl-apporteur`)
//     ne la remplace plus et ne sert qu'à défaut. La réservation maison, elle,
//     relit l'annonce sur la fiche à son rattachement (`attribution-fiche-video.ts`) ;
//   · les UTM d'arrivée (adresse, sinon cookie) : recopiés dans chaque créneau,
//     puis en champs cachés du formulaire → colonne « Provenance » de la fiche ;
//   · le jeton `?j=` de l'étape 1 : recopié dans chaque créneau, il permet au
//     formulaire de proposer le prénom et l'e-mail déjà donnés
//     (`identite-reservation-vsl.ts`) — le même e-mail rattache la réservation à
//     la fiche. Seul le jeton voyage, jamais l'adresse.
//
// ── Personne DÉJÀ CONNUE (2026-10-10, R3) ───────────────────────────────────
// Le jeton désigne alors sa fiche existante (pas un lead vidéo) : aucun e-mail
// ne lui part, la page ne lui en promet donc pas (« C'est noté. Choisissez votre
// créneau ci-dessous. »). Le calendrier reste, SANS préremplissage : le prénom et
// l'adresse d'une fiche existante ne s'affichent jamais à qui a tapé l'adresse.
// Le `Schedule` Meta et le `Call Booked` Plausible de la réservation partent du
// serveur (`server/calendly/enrich.ts`) — `Call Booked` seulement pour une
// réservation rattachée à une fiche née de la page vidéo (2026-10-10), avec
// l'annonce d'origine ; l'étape « Call Booking Viewed » de l'entonnoir reste
// tirée ici (`VslMerciMesure`).
//
// ── DYNAMIQUE, et c'est voulu ───────────────────────────────────────────────
// L'adresse Calendly du type (`CALENDLY_APPORTEUR_URL`) et le drapeau
// `RESERVATION_DIRECTE_ACTIVE` sont des variables d'EXÉCUTION, absentes au build
// GitHub Actions : une page statique les figerait. `force-dynamic`.
//
// ⛔ Aucun numéro de téléphone, aucun délai de réponse chiffré.
// `noindex` : fin de tunnel, rien à indexer. Hérite du pixel Meta par son chemin
// (`/apporteur-affaires/…`), sans modifier `isRouteTunnelFacebook`.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { BookOpen, CalendarCheck, MailCheck } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CalendlyInlineWidget } from "@/components/booking/CalendlyInlineWidget";
import { TunnelFacebookShell } from "@/components/recrutement/TunnelFacebookShell";
import { VslMerciMesure } from "@/components/recrutement/VslMerciMesure";
import { VSL_MERCI, VSL_SLUG } from "@/content/recrutement/vsl-apporteur";
import { liensKitApporteur } from "@/lib/commercial-application/kit-apporteur";
import { UTM_COOKIE_NAME, deserializeUtmCookie } from "@/lib/utm";
import { reservationDirecteActive } from "@/server/calendly/formulaire-reservation";
import {
  lienDuCalendrier,
  lireSuiviArrivee,
  parametresDuChoix,
  resoudreChoix,
  utmContentDuChoix,
  type SuiviArrivee,
} from "@/server/calendly/choix-rendez-vous";
import {
  ficheDuJetonVsl,
  jetonVslValide,
  PARAM_JETON_VSL,
} from "@/features/commercial-application/identite-reservation-vsl";

export const dynamic = "force-dynamic";

/** Le rendez-vous réservé depuis cette page. */
const CHOIX = "apporteur" as const;
/** L'emplacement du bouton (`?depuis=`) : `utm_content` = `apporteur:vsl-apporteur`. */
const DEPUIS_MERCI_VSL = "vsl-apporteur";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return {
    title: { absolute: `${VSL_MERCI.title} — Axion-IA` },
    description: VSL_MERCI.description,
    robots: { index: false, follow: false },
  };
}

/** Le gros bouton « Choisir mon créneau » : un lien simple vers la page de réservation du site. */
function BoutonCreneau({ href }: { href: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <a
        href={href}
        data-cta="vsl-merci-creneau"
        className="bg-terracotta text-paper hover:bg-terracotta-deep focus-visible:ring-terracotta-deep flex min-h-[64px] w-full items-center justify-center gap-2.5 rounded-full px-8 text-center text-lg font-bold tracking-tight transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto"
      >
        <CalendarCheck aria-hidden="true" className="h-5 w-5 shrink-0" />
        {VSL_MERCI.cta}
      </a>
      <p className="text-fg-muted text-center text-sm">{VSL_MERCI.ctaMicro}</p>
    </div>
  );
}

export default async function Page({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as Locale);

  // Attribution : les UTM de l'adresse d'abord, sinon ceux du cookie posé à l'arrivée.
  const sp = await searchParams;
  let suivi: SuiviArrivee = lireSuiviArrivee(sp);
  const cookie = (await cookies()).get(UTM_COOKIE_NAME)?.value;
  const annonceDuCookie = cookie ? (deserializeUtmCookie(cookie).utm_content ?? null) : null;
  if (!suivi.utm_source && !suivi.utm_medium && !suivi.utm_campaign) {
    if (cookie) {
      const utm = deserializeUtmCookie(cookie);
      suivi = {
        ...(utm.utm_source ? { utm_source: utm.utm_source } : {}),
        ...(utm.utm_medium ? { utm_medium: utm.utm_medium } : {}),
        ...(utm.utm_campaign ? { utm_campaign: utm.utm_campaign } : {}),
      };
    }
  }

  // Le jeton n'est recopié que s'il est VALIDE : une adresse trafiquée ne se
  // propage pas dans les liens de la page.
  const jeton = jetonVslValide(sp[PARAM_JETON_VSL]);
  const fiche = jeton ? await ficheDuJetonVsl(jeton) : null;
  const connu = fiche?.genre === "connu";
  // L'annonce d'ORIGINE, jamais remplacée par le marqueur du bouton (2026-10-10).
  const annonce = fiche?.annonce ?? annonceDuCookie ?? utmContentDuChoix(CHOIX, DEPUIS_MERCI_VSL);
  const parametres =
    parametresDuChoix(CHOIX, DEPUIS_MERCI_VSL, suivi) +
    (jeton ? `&${PARAM_JETON_VSL}=${encodeURIComponent(jeton)}` : "");
  const bouton = <BoutonCreneau href={lienDuCalendrier(locale, CHOIX, DEPUIS_MERCI_VSL, suivi)} />;

  // La grille seulement si un créneau mène à NOTRE formulaire : drapeau éteint, les
  // créneaux pointeraient chez Calendly — on renvoie alors à la page du site.
  const resolu = reservationDirecteActive() ? await resoudreChoix(CHOIX) : null;

  const kit = liensKitApporteur("fr");

  return (
    <TunnelFacebookShell sousTitre="Apporteurs d'affaires">
      <VslMerciMesure landing={VSL_SLUG} />
      <Section tone="halo-warm" className="pt-10 pb-10 sm:pt-14 sm:pb-12 lg:pt-14 lg:pb-14">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="display-editorial text-fg text-balance">{VSL_MERCI.title}</h1>
          <p className="text-fg-soft mt-4 mb-8 text-lg leading-relaxed">
            {connu ? VSL_MERCI.texteConnu : VSL_MERCI.texte}
          </p>
        </div>

        {resolu ? (
          <div className="mx-auto max-w-4xl">
            <h2 className="sr-only">Calendrier de réservation</h2>
            <div className="bg-paper ring-border shadow-terracotta/10 rounded-3xl p-1.5 shadow-2xl ring-1">
              <CalendlyInlineWidget
                calendlyUrl={resolu.url}
                isFr
                height={720}
                reservationDirecte
                locale={locale}
                utmContent={annonce}
                parametresDuChoix={parametres}
                suivi={suivi}
                repli={<div className="px-4 py-8">{bouton}</div>}
              />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">{bouton}</div>
        )}

        {connu ? null : (
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-fg-soft bg-paper border-border mx-auto mt-8 inline-flex items-start gap-2.5 rounded-xl border px-4 py-3 text-left text-sm leading-relaxed">
              <MailCheck aria-hidden="true" className="text-sage mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {VSL_MERCI.email} {VSL_MERCI.aucunCreneau}
              </span>
            </p>
          </div>
        )}
      </Section>

      {/* Le kit : découvrir ce qu'on recommandera. Secondaire : l'action est le créneau. */}
      <Section className="py-10 sm:py-12 lg:py-14">
        <div className="mx-auto flex max-w-xl items-start gap-3">
          <span
            aria-hidden="true"
            className="bg-terracotta-soft text-terracotta-deep flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          >
            <BookOpen className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-fg font-serif text-xl leading-tight font-semibold sm:text-2xl">
              {VSL_MERCI.kitTitre}
            </h2>
            <div className="mt-4">
              <Cta
                href={kit.catalogueUrl}
                size="lg"
                variant="outline"
                external
                track="vsl-merci-catalogue"
                className="w-full justify-center sm:w-auto"
              >
                {VSL_MERCI.kitCatalogue} →
              </Cta>
            </div>
          </div>
        </div>
      </Section>
    </TunnelFacebookShell>
  );
}
