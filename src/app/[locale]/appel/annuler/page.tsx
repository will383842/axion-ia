/**
 * `/fr/appel/annuler` — annuler son rendez-vous, chez nous.
 *
 * ## 🔴 CETTE PAGE N'ANNULE RIEN. ELLE AFFICHE.
 *
 * C'est la décision qui gouverne tout le fichier, et elle est contre-intuitive
 * pour qui vient d'écrire le client d'annulation : il serait plus simple
 * d'annuler à l'ouverture du lien et d'afficher « c'est fait ».
 *
 * Ce serait une panne grave. Les clients de messagerie d'entreprise
 * PRÉ-CHARGENT les liens : antivirus, filtres, aperçu d'Outlook. Un rendez-vous
 * serait annulé sans que personne n'ait cliqué, et le prospect découvrirait
 * l'annulation en ne recevant pas d'appel.
 *
 * Ce dépôt a déjà tranché ce point ailleurs, et il a écrit pourquoi : la route
 * d'opposition vivier accepte le pré-chargement « parce que l'effet est
 * protecteur de la personne et réversible », en précisant que **le même
 * raisonnement ne vaudrait PAS pour une action irréversible**. Annuler en est
 * une : le créneau libéré peut être repris dans la minute.
 *
 * Donc : le lien ouvre un récapitulatif et un bouton. Le bouton POSTe. Zéro
 * JavaScript, comme le reste du parcours.
 *
 * ## Ce que la page sait, et ce qu'elle ne dit pas
 *
 * Le jeton ne porte que l'identifiant de notre ligne — pas d'adresse, pas de
 * nom (voir `liens-rendez-vous.ts`). Le détail se relit en base, côté serveur.
 * L'URL, elle, ne transporte jamais rien de personnel.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { CalendarX, Clock, AlertTriangle } from "lucide-react";

import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import {
  lireLeLien,
  CHAMP_JETON,
  CHAMP_LOCALE_ANNULATION,
} from "@/server/calendly/liens-rendez-vous";
import { canalDuRendezVous } from "@/server/calendly/canal";
import { annulerDepuisLeLien } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Annuler votre rendez-vous · Axion-IA" },
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
  return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} à ${heure} (heure de Paris)`;
}

export default async function AnnulerPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const jeton = typeof sp["t"] === "string" ? sp["t"] : "";
  const fait = sp["fait"] === "1";
  const deja = sp["deja"] === "1";
  const echec = typeof sp["echec"] === "string" ? sp["echec"] : "";

  if (jeton === "" && !fait && !deja) notFound();

  // Après l'action, on revient ici sans jeton : le geste est accompli, il n'y a
  // plus rien à autoriser. Reposter le jeton dans l'URL de retour l'exposerait
  // dans l'historique pour rien.
  if (fait || deja) return <Accompli locale={locale} deja={deja} />;

  const lecture = await lireLeLien(jeton, "cancel");
  if (!lecture.ok) return <LienRefuse locale={locale} raison={lecture.raison} />;

  const rdv = await prisma.calendlyEvent.findUnique({
    where: { id: lecture.rendezVousId },
    select: {
      id: true,
      startTime: true,
      status: true,
      location: true,
      rawPayload: true,
      eventTypeName: true,
    },
  });

  // Un jeton valide dont la ligne a disparu : effacement RGPD, purge, ou
  // identifiant d'un autre environnement. On ne dit pas « lien invalide », qui
  // serait faux — le lien est bon, c'est le rendez-vous qui n'existe plus.
  if (!rdv) return <Introuvable locale={locale} />;

  // Déjà annulé côté Calendly, découvert par le cron : on l'affiche comme un
  // fait accompli plutôt que de proposer un bouton qui ne ferait rien.
  if (rdv.status === "canceled") return <Accompli locale={locale} deja />;

  const format = canalDuRendezVous(rdv.location, rdv.rawPayload);

  return (
    <div className="bg-canvas min-h-screen pt-8 pb-20 sm:pt-14">
      <Container>
        <div className="mx-auto max-w-xl">
          <div className="bg-terracotta text-mocha-fg mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
            <CalendarX className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1
            className="text-fg text-[clamp(1.5rem,5vw,2rem)] leading-tight font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Annuler ce rendez-vous&nbsp;?
          </h1>
          <p className="text-fg-soft mt-2 mb-6 text-[15px]">
            Rien n&apos;est encore annulé. Vérifiez qu&apos;il s&apos;agit bien du bon rendez-vous,
            puis confirmez.
          </p>

          {/* Le récapitulatif AVANT le bouton : c'est ce qui distingue une
              confirmation d'un piège. */}
          <dl className="bg-sand space-y-3 rounded-2xl p-5">
            <div className="flex gap-3">
              <Clock className="text-fg-soft mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <dt className="text-fg-soft text-[11px] font-semibold tracking-widest uppercase">
                  Quand
                </dt>
                <dd className="text-fg mt-0.5 font-medium">
                  {rdv.startTime ? quand(rdv.startTime) : "Horaire indisponible"}
                </dd>
                <dd className="text-fg-soft mt-1 text-sm">
                  {format === "visio"
                    ? "En visioconférence"
                    : format === "telephone"
                      ? "Par téléphone"
                      : (rdv.eventTypeName ?? "Rendez-vous")}
                </dd>
              </div>
            </div>
          </dl>

          {echec ? <EchecPrecedent raison={echec} /> : null}

          {/* 🔑 LE GESTE PASSE PAR UN POST. Un lien ne peut pas annuler : les
              clients de messagerie pré-chargent les liens, pas les envois de
              formulaire. */}
          <form action={annulerDepuisLeLien} className="mt-6 space-y-3">
            <input type="hidden" name={CHAMP_JETON} value={jeton} />
            <input type="hidden" name={CHAMP_LOCALE_ANNULATION} value={locale} />
            <button
              type="submit"
              data-cta="appel_annuler_confirmer"
              className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep focus-visible:ring-terracotta flex h-12 w-full items-center justify-center rounded-lg text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Oui, annuler ce rendez-vous
            </button>
            <p className="text-fg-soft text-center text-[13px]">
              Vous préférez le déplacer&nbsp;?{" "}
              <Link href="/appel" className="text-terracotta-deep underline underline-offset-2">
                Choisir un autre créneau
              </Link>
            </p>
          </form>
        </div>
      </Container>
    </div>
  );
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-canvas min-h-screen pt-8 pb-20 sm:pt-14">
      <Container>
        <div className="mx-auto max-w-xl">{children}</div>
      </Container>
    </div>
  );
}

function Accompli({ locale, deja }: { locale: string; deja: boolean }) {
  return (
    <Cadre>
      <h1
        className="text-fg text-[clamp(1.5rem,5vw,2rem)] leading-tight font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {/* 🔑 Deux phrases distinctes, et ce n'est pas cosmétique. Dire « nous
            venons de l'annuler » à quelqu'un qui clique son lien une seconde
            fois lui ferait croire qu'il vient d'annuler autre chose. */}
        {deja ? "Ce rendez-vous est déjà annulé." : "C'est annulé."}
      </h1>
      <p className="text-fg-soft mt-2 text-[15px]">
        {deja
          ? "Il n'y a rien de plus à faire — le créneau est libéré."
          : "Le créneau est libéré. Vous ne recevrez plus de rappel."}
      </p>
      <div className="border-border mt-8 border-t pt-6">
        <Link
          href="/appel"
          className="text-terracotta-deep text-sm font-medium underline underline-offset-2"
        >
          Reprendre un rendez-vous quand vous voulez
        </Link>
        <span className="text-fg-soft mx-2 text-sm">·</span>
        <Link href="/" className="text-fg-soft text-sm underline underline-offset-2">
          Retour à l&apos;accueil
        </Link>
      </div>
      <span hidden>{locale}</span>
    </Cadre>
  );
}

/**
 * Un lien refusé.
 *
 * 🔑 Un message par motif, et jamais de cul-de-sac. Le modèle est celui de la
 * page d'opposition vivier : dire ce qui s'est passé, puis donner une sortie
 * qui marche. « Lien invalide » tout court laisserait quelqu'un devant un mur
 * alors qu'un appel réglerait la chose en trente secondes.
 */
function LienRefuse({
  locale,
  raison,
}: {
  locale: string;
  raison: "expire" | "invalide" | "mauvais_geste";
}) {
  const texte =
    raison === "expire"
      ? {
          titre: "Ce lien a expiré.",
          corps: "Les liens d'annulation cessent d'être valables peu après l'heure du rendez-vous.",
        }
      : raison === "mauvais_geste"
        ? {
            titre: "Ce lien ne sert pas à annuler.",
            corps: "Il correspond à un déplacement de rendez-vous, pas à une annulation.",
          }
        : {
            titre: "Ce lien n'est pas lisible.",
            corps:
              "Il a peut-être été coupé par votre messagerie — cela arrive quand un lien passe à la ligne.",
          };

  return (
    <Cadre>
      <div className="bg-terracotta text-mocha-fg mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1
        className="text-fg text-[clamp(1.5rem,5vw,2rem)] leading-tight font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {texte.titre}
      </h1>
      <p className="text-fg-soft mt-2 text-[15px]">{texte.corps}</p>
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
          en indiquant la date du rendez-vous : nous l&apos;annulons à la main, tout de suite.
        </p>
      </div>
      <span hidden>{locale}</span>
    </Cadre>
  );
}

function Introuvable({ locale }: { locale: string }) {
  return (
    <Cadre>
      <h1
        className="text-fg text-[clamp(1.5rem,5vw,2rem)] leading-tight font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Ce rendez-vous n&apos;existe plus.
      </h1>
      {/* ⚠️ On ne dit PAS « lien invalide » : ce serait faux. Le lien est bon,
          c'est la ligne qui a disparu — effacement RGPD, purge, ou un
          identifiant venu d'un autre environnement. */}
      <p className="text-fg-soft mt-2 text-[15px]">
        Il a peut-être déjà été annulé, ou les données ont été effacées à votre demande. Vous
        n&apos;avez rien à faire.
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
 * ⚠️ Le visiteur revient ici après un POST qui n'a pas abouti. Sans ce bloc, il
 * reverrait le même écran, cliquerait le même bouton, et obtiendrait le même
 * résultat — la boucle sans sortie que ce parcours a déjà produite une fois,
 * sur le formulaire de réservation.
 */
function EchecPrecedent({ raison }: { raison: string }) {
  const message =
    raison === "silence"
      ? "Nous n'avons pas reçu de réponse de notre agenda. Réessayez dans un instant — et si cela recommence, écrivez-nous, nous annulons à la main."
      : "Nous n'avons pas pu annuler ce rendez-vous. Réessayez, ou écrivez-nous à contact@axion-ia.com et nous le ferons pour vous.";
  return (
    <div
      role="alert"
      className="border-terracotta bg-terracotta/5 text-fg mt-5 rounded-xl border px-4 py-3 text-sm"
    >
      {message}
    </div>
  );
}
