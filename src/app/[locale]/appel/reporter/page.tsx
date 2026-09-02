/**
 * `/fr/appel/reporter` — déplacer son rendez-vous, chez nous.
 *
 * ## Deux écrans, et le second est une confirmation
 *
 * 1. **Choisir** — le rendez-vous actuel, puis le calendrier. Chaque créneau
 *    est un lien vers ce même écran, avec `?debut=`.
 * 2. **Confirmer** — les deux horaires côte à côte, l'ancien et le nouveau, et
 *    un bouton qui POSTe.
 *
 * ## 🔴 LA MÊME RÈGLE QUE L'ANNULATION : LE LIEN AFFICHE, LE BOUTON AGIT
 *
 * Cliquer un créneau ne déplace rien. Les clients de messagerie pré-chargent
 * les liens, et un report est irréversible dans les deux sens : l'ancien
 * créneau est libéré, le nouveau est pris. Voir
 * `appel/annuler/__tests__/ouvrir-le-lien-nannule-rien.spec.ts`, qui garde la
 * même propriété sur la page sœur.
 *
 * ## Le prospect ne retape RIEN
 *
 * Nom, adresse, téléphone, fuseau, format et réponses aux questions sont repris
 * de la ligne existante (`report.ts`). Redemander tout ça pour un changement
 * d'heure ferait abandonner — et créerait une occasion de saisir différemment
 * ce qui était déjà juste.
 *
 * ## ⚠️ Le format ne change PAS lors d'un report
 *
 * Un rendez-vous téléphonique reporté reste téléphonique. Proposer d'en changer
 * ici semblerait généreux et produirait la panne la plus embarrassante du lot :
 * quelqu'un qui attend un appel devant un écran, ou l'inverse. Pour changer de
 * format, on annule et on reprend.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { CalendarClock, ArrowRight } from "lucide-react";

import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { CalendlySlotPicker } from "@/components/booking/CalendlySlotPicker";
import { fetchAvailableSlots } from "@/server/calendly/availability";
import {
  lireLeLien,
  CHAMP_JETON,
  CHAMP_LOCALE_ANNULATION,
  CHAMP_NOUVEAU_DEBUT,
} from "@/server/calendly/liens-rendez-vous";
import { canalDuRendezVous } from "@/server/calendly/canal";
import { creneauExploitable } from "@/server/calendly/formulaire-reservation";
import { reporterDepuisLeLien } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Déplacer votre rendez-vous · Axion-IA" },
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

function quand(d: Date): string {
  const jour = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(d);
  const heure = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(d);
  return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} à ${heure}`;
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-canvas min-h-screen pt-8 pb-20 sm:pt-14">
      <Container>
        <div className="mx-auto max-w-3xl">{children}</div>
      </Container>
    </div>
  );
}

export default async function ReporterPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const jeton = typeof sp["t"] === "string" ? sp["t"] : "";
  const fait = sp["fait"] === "1";
  const echec = typeof sp["echec"] === "string" ? sp["echec"] : "";
  const nouveauDebut = typeof sp["debut"] === "string" ? sp["debut"] : "";

  if (fait) return <Deplace locale={locale} />;
  if (jeton === "") notFound();

  const lecture = await lireLeLien(jeton, "reschedule");
  if (!lecture.ok) return <LienRefuse raison={lecture.raison} />;

  const rdv = await prisma.calendlyEvent.findUnique({
    where: { id: lecture.rendezVousId },
    select: { id: true, startTime: true, status: true, location: true, rawPayload: true },
  });
  if (!rdv) return <Introuvable />;
  if (rdv.status === "canceled") return <DejaAnnule locale={locale} />;

  const format = canalDuRendezVous(rdv.location, rdv.rawPayload);
  const libelleFormat =
    format === "visio" ? "en visioconférence" : format === "telephone" ? "par téléphone" : null;

  // ── ÉCRAN 2 : confirmer un créneau déjà choisi ────────────────────────────
  if (nouveauDebut !== "" && creneauExploitable(nouveauDebut, new Date())) {
    return (
      <Cadre>
        <h1
          className="text-fg text-[clamp(1.5rem,5vw,2rem)] leading-tight font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Confirmer le déplacement&nbsp;?
        </h1>
        <p className="text-fg-soft mt-2 mb-6 text-[15px]">
          Rien n&apos;est encore déplacé. Vérifiez les deux horaires, puis confirmez.
        </p>

        {/* Les DEUX horaires côte à côte. Montrer seulement le nouveau laisserait
            douter de ce qu'on remplace — et c'est précisément ce doute qui fait
            renoncer au dernier clic. */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="bg-sand rounded-2xl p-5">
            <p className="text-fg-soft text-[11px] font-semibold tracking-widest uppercase">
              Actuellement
            </p>
            <p className="text-fg mt-1 font-medium line-through decoration-1">
              {rdv.startTime ? quand(rdv.startTime) : "Horaire indisponible"}
            </p>
          </div>
          <ArrowRight className="text-fg-soft mx-auto hidden h-5 w-5 sm:block" aria-hidden="true" />
          <div className="border-terracotta bg-terracotta/5 rounded-2xl border p-5">
            <p className="text-terracotta-deep text-[11px] font-semibold tracking-widest uppercase">
              Nouveau
            </p>
            <p className="text-fg mt-1 font-semibold">{quand(new Date(nouveauDebut))}</p>
            <p className="text-fg-soft mt-0.5 text-sm">heure de Paris</p>
          </div>
        </div>

        {libelleFormat ? (
          <p className="text-fg-soft mt-4 text-sm">
            Le rendez-vous reste <strong className="text-fg">{libelleFormat}</strong>. Pour en
            changer, annulez et reprenez un créneau.
          </p>
        ) : null}

        {echec ? <EchecPrecedent raison={echec} /> : null}

        {/* 🔑 UN FORMULAIRE, PAS UN LIEN. Un lien serait pré-chargeable, et un
            report est irréversible dans les deux sens. */}
        <form action={reporterDepuisLeLien} className="mt-6 space-y-3">
          <input type="hidden" name={CHAMP_JETON} value={jeton} />
          <input type="hidden" name={CHAMP_LOCALE_ANNULATION} value={locale} />
          <input type="hidden" name={CHAMP_NOUVEAU_DEBUT} value={nouveauDebut} />
          <button
            type="submit"
            data-cta="appel_reporter_confirmer"
            className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep focus-visible:ring-terracotta flex h-12 w-full items-center justify-center rounded-lg text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Confirmer ce nouvel horaire
          </button>
          <p className="text-fg-soft text-center text-[13px]">
            <a
              href={`/${locale}/appel/reporter?t=${encodeURIComponent(jeton)}`}
              className="text-terracotta-deep underline underline-offset-2"
            >
              Choisir un autre créneau
            </a>
          </p>
        </form>
      </Cadre>
    );
  }

  // ── ÉCRAN 1 : choisir ─────────────────────────────────────────────────────
  const dispo = await fetchAvailableSlots({
    schedulingUrl: process.env.NEXT_PUBLIC_CALENDLY_APPEL_URL ?? "",
  });

  return (
    <Cadre>
      <div className="bg-terracotta text-mocha-fg mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
        <CalendarClock className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1
        className="text-fg text-[clamp(1.5rem,5vw,2rem)] leading-tight font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Déplacer votre rendez-vous
      </h1>
      <p className="text-fg-soft mt-2 text-[15px]">
        Actuellement&nbsp;:{" "}
        <strong className="text-fg">{rdv.startTime ? quand(rdv.startTime) : "—"}</strong>
        {libelleFormat ? `, ${libelleFormat}` : null}. Choisissez un nouveau créneau — vous
        n&apos;aurez rien d&apos;autre à saisir.
      </p>

      {echec ? <EchecPrecedent raison={echec} /> : null}

      <div className="mt-6">
        {dispo.ok ? (
          <CalendlySlotPicker
            days={dispo.days}
            isFr={locale === "fr"}
            height={620}
            dureeMinutes={dispo.dureeMinutes}
            // 🔑 La destination est décidée ICI, par l'appelant. Le sélecteur
            // n'a pas à connaître le report.
            lienDuCreneau={(iso) =>
              `/${locale}/appel/reporter?t=${encodeURIComponent(jeton)}&debut=${encodeURIComponent(iso)}`
            }
          />
        ) : (
          // ⚠️ Repli honnête : sans créneaux, on ne bricole pas un calendrier
          // vide. On renvoie vers le lien Calendly, qui fonctionne.
          <div className="border-border bg-paper text-fg-soft rounded-2xl border p-5 text-[15px]">
            <p className="text-fg font-semibold">Le calendrier est momentanément indisponible.</p>
            <p className="mt-2">
              Écrivez-nous à{" "}
              <a
                href="mailto:contact@axion-ia.com"
                className="text-terracotta-deep underline underline-offset-2"
              >
                contact@axion-ia.com
              </a>{" "}
              en indiquant le créneau souhaité — nous le déplaçons à la main.
            </p>
          </div>
        )}
      </div>
    </Cadre>
  );
}

function Deplace({ locale }: { locale: string }) {
  return (
    <Cadre>
      <h1
        className="text-fg text-[clamp(1.5rem,5vw,2rem)] leading-tight font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        C&apos;est déplacé.
      </h1>
      <p className="text-fg-soft mt-2 text-[15px]">
        Vous allez recevoir une nouvelle confirmation, avec l&apos;invitation d&apos;agenda mise à
        jour. L&apos;ancien créneau est libéré.
      </p>
      <div className="border-border mt-8 border-t pt-6">
        <Link href="/" className="text-fg-soft text-sm underline underline-offset-2">
          Retour à l&apos;accueil
        </Link>
      </div>
      <span hidden>{locale}</span>
    </Cadre>
  );
}

function LienRefuse({ raison }: { raison: "expire" | "invalide" | "mauvais_geste" }) {
  const t =
    raison === "expire"
      ? "Ce lien a expiré."
      : raison === "mauvais_geste"
        ? "Ce lien ne sert pas à déplacer un rendez-vous."
        : "Ce lien n'est pas lisible.";
  return (
    <Cadre>
      <h1
        className="text-fg text-[clamp(1.5rem,5vw,2rem)] leading-tight font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {t}
      </h1>
      {/* Jamais de cul-de-sac : une sortie qui marche, toujours. */}
      <div className="border-border bg-paper text-fg-soft mt-6 rounded-2xl border p-5 text-[15px]">
        <p className="text-fg font-semibold">Ce que vous pouvez faire</p>
        <p className="mt-2">
          Écrivez-nous à{" "}
          <a
            href="mailto:contact@axion-ia.com"
            className="text-terracotta-deep underline underline-offset-2"
          >
            contact@axion-ia.com
          </a>{" "}
          en indiquant la date souhaitée : nous déplaçons le rendez-vous à la main.
        </p>
      </div>
    </Cadre>
  );
}

function Introuvable() {
  return (
    <Cadre>
      <h1
        className="text-fg text-[clamp(1.5rem,5vw,2rem)] leading-tight font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Ce rendez-vous n&apos;existe plus.
      </h1>
      <p className="text-fg-soft mt-2 text-[15px]">
        Il a peut-être été annulé, ou les données ont été effacées à votre demande.
      </p>
    </Cadre>
  );
}

function DejaAnnule({ locale }: { locale: string }) {
  return (
    <Cadre>
      <h1
        className="text-fg text-[clamp(1.5rem,5vw,2rem)] leading-tight font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Ce rendez-vous est annulé.
      </h1>
      {/* ⚠️ On ne propose PAS de le déplacer : il n'y a rien à déplacer. Un
          bouton qui ne peut pas aboutir est pire que son absence. */}
      <p className="text-fg-soft mt-2 text-[15px]">
        Il n&apos;y a donc rien à déplacer — mais vous pouvez en reprendre un quand vous voulez.
      </p>
      <div className="border-border mt-8 border-t pt-6">
        <Link
          href="/appel"
          className="text-terracotta-deep text-sm font-medium underline underline-offset-2"
        >
          Prendre un nouveau rendez-vous
        </Link>
      </div>
      <span hidden>{locale}</span>
    </Cadre>
  );
}

/**
 * L'échec de la tentative précédente.
 *
 * ⚠️ Chaque message dit ce que le visiteur DOIT FAIRE, pas seulement ce qui
 * s'est passé. Et le cas `silence` lui dit surtout ce qu'il ne doit PAS faire :
 * réessayer pourrait créer un second rendez-vous.
 */
function EchecPrecedent({ raison }: { raison: string }) {
  const message =
    raison === "creneau_pris"
      ? "Ce créneau vient d'être pris par quelqu'un d'autre. Votre rendez-vous actuel est toujours valable — choisissez-en un autre."
      : raison === "silence"
        ? "Nous n'avons pas reçu de réponse de notre agenda. Votre rendez-vous actuel tient toujours. Ne réessayez pas tout de suite : nous vérifions et nous vous écrivons dans les prochaines minutes."
        : "Nous n'avons pas pu déplacer ce rendez-vous. Votre créneau actuel est intact. Réessayez, ou écrivez-nous à contact@axion-ia.com.";
  return (
    <div
      role="alert"
      className="border-terracotta bg-terracotta/5 text-fg mt-5 rounded-xl border px-4 py-3 text-sm"
    >
      {message}
    </div>
  );
}
