import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata, buildServiceJsonLd, SITE_URL } from "@/lib/seo";
import { CalendlyInlineWidget } from "@/components/booking/CalendlyInlineWidget";
import { reservationDirecteActive } from "@/server/calendly/formulaire-reservation";
import { CalendlyEventCapture } from "@/components/booking/CalendlyEventCapture";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Shield,
  CheckCircle,
  Calendar,
  Compass,
  Target,
} from "lucide-react";
import {
  lireChoixRendezVous,
  lireDepuis,
  parametresDuChoix,
  resoudreLesDeuxChoix,
  utmContentDuChoix,
  PARAM_DEPUIS,
  PARAM_RDV,
  type ChoixRendezVous,
  type ChoixResolu,
} from "@/server/calendly/choix-rendez-vous";

/**
 * 15 minutes — la fraîcheur des CRÉNEAUX, pas celle du texte. Aligné sur
 * `SLOTS_REVALIDATE_SECONDS` (`src/server/calendly/availability.ts`) ; la valeur
 * doit être un littéral, Next exige qu'elle soit analysable statiquement.
 *
 * 🔴 CET EXPORT EST INERTE AUJOURD'HUI — rectifié le 2026-08-27. Le paragraphe
 * retiré raisonnait sur une page prérendue qui n'existe pas en production.
 *
 * Cette route est rendue DYNAMIQUEMENT, parce qu'elle `await` `searchParams`
 * (extraction UTM, plus bas) — une API de temps de requête, qui sort la page du
 * prérendu. Mesuré en production le 2026-08-27 :
 * `Cache-Control: private, no-cache, no-store`, `cf-cache-status: BYPASS`,
 * aucun `x-nextjs-cache`. Il n'y a donc AUCUNE entrée de page à revalider, et
 * la seule fraîcheur réelle vient du cache de données du `fetch`, piloté par
 * `CALENDLY_SLOTS_TAG` et par le chemin.
 *
 * ⚠️ ON LE GARDE QUAND MÊME, et c'est délibéré : il est inerte SOUS CONDITION.
 * Le jour où quelqu'un déplace l'extraction UTM côté client, la page redevient
 * prérendable et cet export reprend son sens — l'avoir retiré ferait alors
 * servir un repli figé.
 *
 * ⚠️ RÈGLE D'ORDRE : tout lot qui touche ce fichier rejoue la mesure
 * (`curl -I https://axion-ia.com/fr/appel`) AVANT de fusionner. La prémisse de
 * l'invalidation des créneaux repose sur elle, et un changement de rendu la
 * casserait sans qu'aucune gate ne le voie.
 */
export const revalidate = 900;

interface Props {
  params: Promise<{ locale: string }>;
  /**
   * Sprint Notif Infra 2026-05-26 / fix P1-5 audit 2026-05-27 — searchParams
   * UTM extraits côté Server Component et passés au CalendlyEventCapture
   * pour attribution analytics.
   */
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * DEUX rendez-vous au choix (chantier « Types de rendez-vous », L2, 2026-10-04).
 *
 * `?rdv=diagnostic|projet` ouvre directement le bon calendrier ; sans paramètre,
 * la page montre le choix. Les URL Calendly ne sont plus lues ici : elles
 * passent TOUTES par `server/calendly/choix-rendez-vous.ts`, qui porte aussi le
 * repli silencieux du diagnostic sur le type appel quand il est introuvable.
 * `?depuis=<emplacement>` est recopié dans `utm_content` (`diagnostic:accueil-hero`).
 *
 * Le choix est rendu CÔTÉ SERVEUR, en liens simples : aucun JavaScript ajouté,
 * aucun saut de mise en page (CLS 0).
 */

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  // Le titre reprend l'ancre nav/footer « Réserver un appel » pour aligner le
  // label sitelink sur l'intention de recherche (audit sitelinks 2026-07-06).
  const titleStr = isFr
    ? "Réserver un appel · votre projet IA · Axion-IA"
    : "Book a call · your AI project · Axion-IA";
  return {
    ...(await buildProductMetadata({
      locale,
      path: "/appel",
      title: titleStr,
      // 134 car. (2026-10-04, deux rendez-vous) — sous `META_DESCRIPTION_MAX` (158),
      // donc servie ENTIÈRE. Aucune durée : elles se lisent chez Calendly.
      // 2026-09-25 : « Sans engagement ni pression commerciale » → « Gratuit et
      // sans engagement ». Règle de Will : le diagnostic est GRATUIT, et
      // « sans engagement » seul laisse croire qu'il est payant.
      // Avant le 2026-08-31 elle en faisait 212 : la prod s'arrêtait sur
      // « …SaaS web… » et perdait la clause finale, qui est la seule promesse
      // différenciante de la page. Elle figurait à ce titre dans la `DETTE` du
      // garde-fou `meta-description-longueur.spec.ts`, d'où sa ligne a été
      // retirée en même temps que ce raccourcissement — le cliquet exige que le
      // chiffre reste exact, il rougit donc si l'un bouge sans l'autre.
      description: isFr
        ? "Deux rendez-vous en visio : un diagnostic IA pour savoir par où commencer, ou un échange sur votre projet. Gratuit et sans engagement."
        : "Deux rendez-vous en visio : un diagnostic IA pour savoir par où commencer, ou un échange sur votre projet. Gratuit et sans engagement.",
      alternates: { fr: "/appel", en: "/book-a-call" },
      // Image de partage dédiée (2026-09-27) : ce lien est épinglé dans la
      // « Sélection » du profil LinkedIn, où la vignette ne fait que ~190 px de
      // large. La carte générique `/api/og` y devenait illisible ; celle-ci est
      // calibrée pour rester lisible à cette taille. Dimensions MESURÉES.
      ogImage: `${SITE_URL}/og/pages/appel-45-min-gratuit.png`,
      ogImageWidth: 1200,
      ogImageHeight: 628,
    })),
    title: { absolute: titleStr },
  };
}

export default async function AppelPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";

  const choix = lireChoixRendezVous(sp[PARAM_RDV]);
  const depuis = lireDepuis(sp[PARAM_DEPUIS]);
  // Une seule lecture de la liste des types (en cache 24 h) pour les deux.
  const resolus = await resoudreLesDeuxChoix();

  // Sprint Notif Infra 2026-05-26 / fix P1-5 — extraction UTM côté Server.
  const trackingContext: {
    pageUrl: string;
    utmSource?: string;
    utmCampaign?: string;
    utmMedium?: string;
    utmContent?: string;
    referrer?: string;
  } = {
    pageUrl: `${SITE_URL}/${locale}/appel${choix ? `?${parametresDuChoix(choix, depuis)}` : ""}`,
  };
  if (typeof sp["utm_source"] === "string") trackingContext.utmSource = sp["utm_source"];
  if (typeof sp["utm_campaign"] === "string") trackingContext.utmCampaign = sp["utm_campaign"];
  if (typeof sp["utm_medium"] === "string") trackingContext.utmMedium = sp["utm_medium"];
  if (typeof sp["ref"] === "string") trackingContext.referrer = sp["ref"];
  if (choix) trackingContext.utmContent = utmContentDuChoix(choix, depuis);

  const jsonLd = buildServiceJsonLd({
    locale: locale as "fr" | "en",
    path: "/appel",
    name: isFr ? "Rendez-vous projet IA · Axion-IA" : "Rendez-vous projet IA · Axion-IA",
    description: isFr
      ? "Deux rendez-vous en visioconférence Google Meet avec un consultant IA Axion-IA : un diagnostic IA pour savoir par où commencer, ou un échange projet pour avancer sur un besoin précis — audit, formation, intégration et automatisation, coaching. Gratuit et sans engagement."
      : "Deux rendez-vous en visioconférence Google Meet avec un consultant IA Axion-IA : un diagnostic IA pour savoir par où commencer, ou un échange projet pour avancer sur un besoin précis — audit, formation, intégration et automatisation, coaching. Gratuit et sans engagement.",
  });

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: isFr ? "Accueil" : "Home",
        item: `${SITE_URL}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: isFr ? "Réserver un appel" : "Réserver un appel",
        item: `${SITE_URL}/${locale}/appel`,
      },
    ],
  } as const;

  return (
    <>
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {/* Le composant préfixe déjà « Accueil » (fullItems) : le repasser ici
          affichait « Accueil / Accueil / … » à l'écran. */}
      <Breadcrumbs items={[{ label: "Réserver un appel", href: "/appel" }]} emitJsonLd={false} />
      {/* GEO-123 (audit GEO/AEO 2026-08-14) — `<div>` et NON `<main>` : le
          layout `[locale]` porte deja `<main id="main">`, cible du lien
          d'evitement. Un second `<main>` imbrique rend le contenu principal
          non identifiable pour les technologies d'assistance ET pour les
          extracteurs de contenu principal des moteurs. */}
      <div>
        {choix ? (
          <Calendrier
            choix={choix}
            resolu={resolus[choix]}
            depuis={depuis}
            locale={locale}
            isFr={isFr}
            trackingContext={trackingContext}
          />
        ) : (
          <ChoixDuRendezVous resolus={resolus} depuis={depuis} locale={locale} />
        )}

        {/* CTA fallback bas de page — pour les visiteurs qui préfèrent un autre
            canal que le calendrier (ex : DSI qui veut un échange par e-mail
            avant de bloquer un créneau). */}
        <section aria-labelledby="appel-cta-h2" className="bg-terracotta py-16 sm:py-20">
          <Container>
            <div className="mx-auto max-w-2xl text-center">
              <h2
                id="appel-cta-h2"
                className="text-paper text-2xl font-semibold tracking-tight sm:text-3xl"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "Vous préférez écrire d'abord ?" : "Prefer to write first?"}
              </h2>
              <p className="text-paper mt-4 text-base leading-relaxed">
                {isFr
                  ? "Décrivez votre projet par message — nous vous répondons sous 48 h ouvrées avec une proposition de créneau ou une réponse écrite directe."
                  : "Describe your project by message — we reply within 48 working hours with a proposed slot or a direct written answer."}
              </p>
              <Link
                href={"/contact" as never}
                data-cta="appel_footer_contact"
                className="bg-paper text-terracotta hover:bg-paper/90 focus-visible:ring-paper focus-visible:ring-offset-terracotta mt-8 inline-flex h-14 items-center gap-2 rounded-full px-8 text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {isFr ? "Écrire un message" : "Send a message"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </Container>
        </section>
      </div>
      {/* Le bandeau mobile « Premier contact » a été RETIRÉ (2026-10-04) : il
          pointait vers cette même page, donc, en mode calendrier, il aurait
          ramené au choix. Le choix tient dans le premier écran ; le calendrier
          EST la page. Un composant client de moins. */}
    </>
  );
}

/** `/fr/appel?rdv=diagnostic&depuis=…` — lien simple, rendu serveur. */
function lienDuChoix(locale: string, choix: ChoixRendezVous, depuis: string | null): string {
  return `/${locale}/appel?${parametresDuChoix(choix, depuis)}`;
}

/** « 30 min », lue chez Calendly ; rien si la durée est inconnue. */
function libelleDuree(resolu: ChoixResolu): string | null {
  return resolu.dureeMinutes ? `${resolu.dureeMinutes} min` : null;
}

/**
 * L'ÉCRAN DU CHOIX — deux cartes, très peu de texte.
 *
 * 🔑 Le diagnostic est mis en avant (bordure, pastille, bouton plein) : c'est
 * l'entrée pour qui ne sait pas encore. Les durées viennent de Calendly ; si la
 * liste des types est illisible, elles disparaissent plutôt que d'être
 * inventées.
 */
function ChoixDuRendezVous({
  resolus,
  depuis,
  locale,
}: {
  resolus: Readonly<Record<ChoixRendezVous, ChoixResolu>>;
  depuis: string | null;
  locale: string;
}) {
  const dureeDiagnostic = libelleDuree(resolus.diagnostic);
  const dureeProjet = libelleDuree(resolus.projet);
  return (
    <section aria-labelledby="appel-hero-h1" className="bg-canvas pt-6 pb-12 sm:pt-10 sm:pb-16">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-terracotta mb-2 inline-flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase sm:text-xs">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            Visio Google Meet · sans engagement
          </p>
          <h1
            id="appel-hero-h1"
            className="text-fg text-[clamp(1.625rem,4vw,2.5rem)] leading-tight font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Choisissez votre rendez-vous
          </h1>
        </div>

        <ul className="mx-auto mt-6 grid max-w-4xl gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-6">
          <li className="border-terracotta bg-paper shadow-terracotta/10 relative flex flex-col rounded-3xl border-2 p-5 shadow-xl sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <span
                className="bg-terracotta text-mocha-fg flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                aria-hidden="true"
              >
                <Compass className="h-5 w-5" />
              </span>
              <span className="bg-terracotta-soft text-terracotta-deep rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase">
                Pour démarrer
              </span>
            </div>
            <h2
              className="text-fg mt-4 text-2xl font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Diagnostic IA
            </h2>
            <p className="text-terracotta-deep mt-1 text-sm font-semibold">
              Gratuit{dureeDiagnostic ? ` · ${dureeDiagnostic}` : ""}
            </p>
            <p className="text-fg mt-4 text-base font-medium">
              Vous ne savez pas encore par où commencer.
            </p>
            <p className="text-fg-soft mt-1 text-[15px] leading-relaxed">
              4 questions sur votre activité, et vous repartez avec des pistes concrètes.
            </p>
            <div className="mt-auto pt-6">
              <a
                href={lienDuChoix(locale, "diagnostic", depuis)}
                data-cta="appel_choix_diagnostic"
                className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep focus-visible:ring-terracotta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Réserver mon diagnostic
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </li>

          <li className="border-border bg-paper flex flex-col rounded-3xl border p-5 shadow-sm sm:p-7">
            <span
              className="bg-sand text-terracotta flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              aria-hidden="true"
            >
              <Target className="h-5 w-5" />
            </span>
            <h2
              className="text-fg mt-4 text-2xl font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Échange projet
            </h2>
            <p className="text-fg-soft mt-1 text-sm font-semibold">
              {dureeProjet ? `${dureeProjet} · ` : ""}Sans engagement
            </p>
            <p className="text-fg mt-4 text-base font-medium">Vous savez ce que vous voulez.</p>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Sujets possibles">
              {["Audit", "Formation", "Intégration et automatisation", "Coaching"].map((sujet) => (
                <li
                  key={sujet}
                  className="border-border text-fg-soft rounded-full border px-3 py-1 text-[13px]"
                >
                  {sujet}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-6">
              <a
                href={lienDuChoix(locale, "projet", depuis)}
                data-cta="appel_choix_projet"
                className="border-terracotta text-terracotta-deep hover:bg-terracotta-soft focus-visible:ring-terracotta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 px-6 text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Réserver un échange projet
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </li>
        </ul>

        <p className="text-fg-soft mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-[13px]">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle className="text-sage h-4 w-4" aria-hidden="true" />
            Confirmation immédiate
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Shield className="text-sage h-4 w-4" aria-hidden="true" />
            Annulable en un clic
          </span>
        </p>
      </Container>
    </section>
  );
}

/** Ce que le visiteur fait pendant le rendez-vous — la seule étape qui change. */
const TROISIEME_ETAPE: Readonly<Record<ChoixRendezVous, string>> = {
  diagnostic: "Quatre questions sur votre activité, et vous repartez avec des pistes concrètes.",
  projet: "On discute de votre projet ou tout autre besoin de renseignements.",
};

/** L'ÉCRAN DU CALENDRIER — celui d'avant, sur le type choisi. */
function Calendrier({
  choix,
  resolu,
  depuis,
  locale,
  isFr,
  trackingContext,
}: {
  choix: ChoixRendezVous;
  resolu: ChoixResolu;
  depuis: string | null;
  locale: string;
  isFr: boolean;
  trackingContext: {
    pageUrl: string;
    utmSource?: string;
    utmCampaign?: string;
    utmMedium?: string;
    utmContent?: string;
    referrer?: string;
  };
}) {
  const duree = libelleDuree(resolu);
  const utmContent = utmContentDuChoix(choix, depuis);
  const retourAuChoix = depuis
    ? `/${locale}/appel?${new URLSearchParams({ [PARAM_DEPUIS]: depuis }).toString()}`
    : `/${locale}/appel`;
  return (
    <>
      {/* Hero ultra-compact — l'utilisateur est ici pour réserver, pas lire.
          Texte condensé pour que le calendrier soit visible above-the-fold
          (sans scroll initial sur desktop 1366x768+ et mobile iPhone 12+). */}
      <section aria-labelledby="appel-hero-h1" className="bg-canvas pt-6 pb-4 sm:pt-10 sm:pb-6">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-terracotta mb-2 inline-flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase sm:text-xs">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {choix === "diagnostic" ? "Diagnostic IA" : "Échange projet"} · Gratuit et sans
              engagement
            </p>
            <h1
              id="appel-hero-h1"
              className="text-fg text-[clamp(1.625rem,4vw,2.5rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {choix === "diagnostic" ? "Votre diagnostic IA" : "Discutons de votre projet IA"}
            </h1>
            {/* Lien DISCRET pour changer d'avis : le choix n'enferme pas. */}
            <a
              href={retourAuChoix}
              data-cta="appel_changer_de_rendez_vous"
              className="text-fg-soft hover:text-terracotta-deep focus-visible:ring-terracotta mt-1 inline-flex min-h-11 items-center gap-1.5 rounded px-1 text-sm underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Changer de rendez-vous
            </a>
          </div>
        </Container>
      </section>

      {/* Section calendrier Calendly — layout mobile-first :
          - Mobile (<lg) : widget Calendly EN PREMIER (above-the-fold prio),
            sidebar (portrait + steps + trust) empilée DESSOUS.
          - Desktop (≥lg) : grid 2 cols, sidebar à gauche sticky, widget à
            droite (réordonnés via lg:order-1/lg:order-2).
          Depuis ADR 0038 le contenu de ce cadre est rendu côté serveur
          (créneaux en HTML statique) : plus rien de Calendly n'est chargé par
          le navigateur tant que le visiteur ne clique pas un créneau. */}
      <section aria-labelledby="appel-calendar-h2" className="bg-canvas pb-12 sm:pb-16">
        <Container>
          <h2 id="appel-calendar-h2" className="sr-only">
            Calendrier de réservation
          </h2>
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)] lg:gap-10">
            <aside className="order-2 space-y-5 lg:sticky lg:top-24 lg:order-1 lg:self-start">
              {/* Portrait Williams */}
              <div className="bg-sand flex items-center gap-4 rounded-2xl p-5">
                <div className="ring-paper relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2">
                  <Image
                    src="/images/axion-ia-fondateur-williams-jullin-portrait-professionnel.jpg"
                    alt="Consultant IA Axion-IA"
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-fg-soft text-[11px] tracking-widest uppercase">Avec</p>
                  <p
                    className="text-fg leading-tight font-semibold"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    L&apos;équipe Axion-IA
                  </p>
                  <p className="text-fg-soft mt-0.5 text-xs">Consultants IA</p>
                </div>
              </div>

              {/* Steps "Comment ça marche" */}
              <div className="bg-paper border-border rounded-2xl border p-5">
                <h3
                  className="text-fg mb-4 text-sm font-semibold"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  Comment ça marche
                </h3>
                <ol className="space-y-3">
                  {[
                    // 🔴 Le CHOIX DU FORMAT s'annonce ici, et pas ailleurs :
                    // c'est l'étape 1 parce que c'est le moment où l'on
                    // s'apprête à cliquer. Chantier visio (B5, Will 28/09) :
                    // le rendez-vous se tient en Google Meet SEULEMENT
                    // (`DISCUTONS_MEET_SEUL`).
                    "Choisissez un créneau : le rendez-vous se tient en visioconférence Google Meet.",
                    // ⚠️ RÉALIGNÉE sur ce que le code envoie vraiment
                    // (`rappels-appel.ts`) : la confirmation dans la minute,
                    // puis les rappels J-1 et H-1.
                    "Vous recevez notre confirmation dans la minute, l'invitation d'agenda séparément, puis un rappel la veille et une heure avant.",
                    TROISIEME_ETAPE[choix],
                  ].map((step, i) => (
                    <li key={step} className="flex gap-3">
                      <span className="bg-terracotta text-paper flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                        {i + 1}
                      </span>
                      <p className="text-fg-soft text-sm leading-relaxed">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Trust signals 3 cols — la durée vient de Calendly (jamais écrite
                  en dur : elle a déjà divergé une fois, le 2026-08-27). */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-paper border-border rounded-xl border p-3 text-center">
                  <Clock className="text-terracotta mx-auto mb-1 h-4 w-4" aria-hidden="true" />
                  <p className="text-fg-soft text-[11px] leading-tight">{duree ?? "Google Meet"}</p>
                </div>
                <div className="bg-paper border-border rounded-xl border p-3 text-center">
                  <Shield className="text-terracotta mx-auto mb-1 h-4 w-4" aria-hidden="true" />
                  <p className="text-fg-soft text-[11px] leading-tight">
                    Gratuit et sans engagement
                  </p>
                </div>
                <div className="bg-paper border-border rounded-xl border p-3 text-center">
                  <CheckCircle
                    className="text-terracotta mx-auto mb-1 h-4 w-4"
                    aria-hidden="true"
                  />
                  <p className="text-fg-soft text-[11px] leading-tight">Confirmation immédiate</p>
                </div>
              </div>
            </aside>

            {/* Widget Calendly — cadre moderne (glow + shadow + ring)
                - Mobile : order-1 (en premier, above-the-fold prio)
                - Desktop : order-2 (à droite) */}
            <div className="relative order-1 lg:order-2">
              <div
                className="from-terracotta/15 to-terracotta/5 pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-br via-transparent opacity-60 blur-2xl"
                aria-hidden="true"
              />
              <div className="bg-paper ring-border shadow-terracotta/10 relative rounded-3xl p-1.5 shadow-2xl ring-1">
                {/* 🔑 LE DRAPEAU EST LU ICI, ET NULLE PART AILLEURS DANS CE
                    PARCOURS. Le sélecteur et le formulaire le reçoivent ;
                    deux lectures indépendantes finiraient par diverger. */}
                <CalendlyInlineWidget
                  calendlyUrl={resolu.url}
                  isFr={isFr}
                  height={720}
                  reservationDirecte={reservationDirecteActive()}
                  locale={locale}
                  utmContent={utmContent}
                  parametresDuChoix={parametresDuChoix(choix, depuis)}
                />
              </div>
              {/* Capture client des `event_scheduled` émis par l'iframe
                  Calendly du REPLI (`CalendlyConsentGate`) : sans iframe, aucun
                  postMessage ne lui parvient — d'où sa conservation après
                  ADR 0038. Elle reçoit l'URL RÉSOLUE (slug du bon type) et le
                  bouton (`utmContent`). */}
              <CalendlyEventCapture calendlyUrl={resolu.url} trackingContext={trackingContext} />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
