/**
 * `/fr/appel/reserver` — le formulaire de réservation, chez nous.
 *
 * ## Ce que cette route remplace
 *
 * L'écran 2 du parcours, jusqu'ici hébergé par Calendly : le visiteur cliquait
 * un créneau sur `/appel` et changeait de site pour donner son nom. Cette page
 * garde le parcours entier dans notre design, et n'envoie toujours aucun
 * JavaScript — voir `components/booking/FormulaireReservation.tsx` pour le
 * détail des sept décisions « mobile d'abord » qui en découlent.
 *
 * ## Le contrat de repli, hérité de `availability.ts`
 *
 * Cette page ne s'affiche QUE si tout est réuni : le drapeau est allumé, le
 * créneau est lisible, l'event-type répond, et toutes ses questions sont
 * rendables. Dès qu'un de ces points manque, le visiteur repart sur `/appel`,
 * d'où le lien Calendly reste accessible. Un formulaire absent se remarque ; un
 * formulaire amputé, non.
 *
 * ## 🔴 CETTE ROUTE NE DOIT PAS ÊTRE INDEXÉE
 *
 * Elle n'a aucun sens sans le paramètre `debut`, et une page de formulaire
 * indexée sans son créneau se présenterait à Google comme un doublon vide de
 * `/appel`. `robots: { index: false }` plus bas.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { FormulaireReservation } from "@/components/booking/FormulaireReservation";
import { RemonterAuMessage } from "@/components/booking/RemonterAuMessage";
import { resoudreEventTypePourReservation } from "@/server/calendly/availability";
import { lireLaRepriseDuCreneau } from "@/server/calendly/reprise-formulaire";
import {
  reservationDirecteActive,
  creneauExploitable,
  CHAMP_LOCALE,
  CHAMP_LEURRE,
} from "@/server/calendly/formulaire-reservation";
import { soumettreLaReservation } from "./actions";
import { signalerRepliPermanent } from "@/server/calendly/alertes-reservation";

/**
 * Rendu à chaque requête.
 *
 * Obligatoire, et pas seulement souhaitable : la page dépend d'un paramètre de
 * requête, d'un cookie, et de la disponibilité d'un créneau. Aucun de ces trois
 * ne se met en cache.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Confirmer votre rendez-vous · Axion-IA" },
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

/** Durée par défaut si l'event-type ne la donne pas — celle de l'appel découverte. */
const DUREE_DEFAUT = 45;

/**
 * « lundi 15 septembre à 14 h 30 », en heure de Paris.
 *
 * ⚠️ `timeZone` explicite. Le serveur tourne en UTC : sans elle, le libellé
 * afficherait une heure décalée de deux heures l'été, et le visiteur lirait un
 * créneau différent de celui qu'il a cliqué.
 */
function creneauLisible(debut: Date): string {
  const d = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(debut);
  const h = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(debut);
  return `${d.charAt(0).toUpperCase()}${d.slice(1)} à ${h}`;
}

export default async function ReserverPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;

  // Le drapeau d'abord : tant qu'il est éteint, cette route n'existe pas pour
  // le visiteur, et les créneaux continuent de pointer vers Calendly.
  if (!reservationDirecteActive()) redirect(`/${locale}/appel`);

  const debutBrut = typeof sp["debut"] === "string" ? sp["debut"] : "";
  const debut = new Date(debutBrut);

  // Sans créneau exploitable, il n'y a rien à confirmer. On renvoie au
  // calendrier plutôt que d'afficher un formulaire qui ne mène nulle part.
  //
  // 🔑 Le jugement vient d'une fonction partagée avec l'action : si la page
  // acceptait un créneau que l'action refuse, le visiteur remplirait un
  // formulaire condamné d'avance et ne l'apprendrait qu'après avoir tout saisi.
  if (!creneauExploitable(debutBrut, new Date())) redirect(`/${locale}/appel`);

  const et = await resoudreEventTypePourReservation(
    process.env.NEXT_PUBLIC_CALENDLY_APPEL_URL ?? "",
  );
  if (!et) {
    // Jeton absent, API muette, ou une question qu'on ne sait pas poser : le
    // contrat de repli s'applique, et il est écrit dans `questions.ts`.
    //
    // 🔴 MAIS ON ALERTE ICI, ET PAS SEULEMENT DANS L'ACTION.
    //
    // L'alerte vivait uniquement côté action, et elle était INATTEIGNABLE :
    // c'est cette page qui fait la résolution EN PREMIER. Quand elle échoue,
    // aucun visiteur n'atteint le formulaire, donc aucun envoi n'a lieu, donc
    // l'action n'est jamais appelée. La seule branche qui alertait ne se
    // déclenchait que si quelqu'un postait à la main.
    //
    // La déduplication (quinze minutes, même clé des deux côtés) évite qu'une
    // panne produise une alerte par visiteur.
    await signalerRepliPermanent();
    redirect(`/${locale}/appel`);
  }

  const reprise = await lireLaRepriseDuCreneau(debutBrut);

  return (
    <div className="bg-canvas min-h-screen pt-6 pb-16 sm:pt-10">
      <Container>
        {/* Retour au calendrier — en TÊTE, et pas seulement en pied de page :
            un visiteur qui s'est trompé de créneau doit pouvoir revenir sans
            faire défiler tout le formulaire. */}
        <div className="mx-auto max-w-xl">
          <Link
            href="/appel"
            className="text-fg-soft hover:text-terracotta-deep focus-visible:ring-terracotta -ml-1 inline-flex items-center gap-1.5 rounded px-1 py-1 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Choisir un autre créneau
          </Link>

          <h1
            className="text-fg mt-3 mb-1 text-[clamp(1.5rem,5vw,2rem)] leading-tight font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Confirmer votre rendez-vous
          </h1>
          <p className="text-fg-soft mb-6 text-[15px]">
            Dernière étape. Sans engagement — vous pourrez annuler ou déplacer d&apos;un clic depuis
            l&apos;e-mail de confirmation.
          </p>

          {/* ⚠️ Quand la reprise n'a pas pu tout garder, on le DIT. Un champ vide
              sans explication ferait croire à une perte de données ; un champ
              vide annoncé se retape. Voir `reprise-formulaire.ts`. */}
          {reprise && reprise.abandonnes.length > 0 ? (
            <div className="border-border bg-sand text-fg-soft mb-5 rounded-xl border px-4 py-3 text-sm">
              Votre réponse la plus longue était trop volumineuse pour être conservée pendant
              l&apos;aller-retour. Elle est à ressaisir&nbsp;; le reste est intact.
            </div>
          ) : null}

          {/* Après un refus, le bandeau d'erreurs est en TÊTE du formulaire et le
              bouton d'envoi en bas : sans ce geste, la navigation client laissait
              le prospect devant le bouton, 990 px sous le message. */}
          {reprise && Object.keys(reprise.erreurs).length > 0 ? <RemonterAuMessage /> : null}
          <FormulaireReservation
            debutIso={debut.toISOString()}
            creneauLisible={creneauLisible(debut)}
            dureeMinutes={et.dureeMinutes ?? DUREE_DEFAUT}
            questions={et.questions}
            {...(reprise ? { erreurs: reprise.erreurs, valeurs: reprise.valeurs } : {})}
            replidUrl={process.env.NEXT_PUBLIC_CALENDLY_APPEL_URL}
            action={soumettreLaReservation}
            locale={locale}
            champLocale={CHAMP_LOCALE}
            champLeurre={CHAMP_LEURRE}
            retourAuCalendrier={`/${locale}/appel`}
          />
        </div>
      </Container>
    </div>
  );
}
