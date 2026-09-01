/**
 * `/fr/appel/confirme` — la fin du parcours, chez nous.
 *
 * ## Trois états, et pourquoi ils ne se ressemblent pas
 *
 * **1. Confirmé.** Le cas normal : le rendez-vous existe, on le récapitule.
 *
 * **2. À vérifier** (`?v=1`). Le rendez-vous existe, mais Calendly l'a
 * enregistré dans un autre format que celui demandé. On ne peut pas confirmer
 * « votre visioconférence » à quelqu'un qui recevra un appel. Une alerte est
 * déjà partie ; ici on dit la vérité sans inquiéter inutilement.
 *
 * **3. Incertain** (`?incertain=1`). 🔴 LE CAS QUI JUSTIFIE CETTE PAGE. L'API
 * n'a pas répondu : nous ne savons pas si la réservation existe. Le réflexe
 * serait de dire « une erreur est survenue, réessayez » — ce serait la pire
 * réponse possible, parce que réessayer produirait un doublon si la première a
 * abouti. On dit donc exactement ce qu'on sait, et on demande d'attendre notre
 * appel plutôt que de recommencer.
 *
 * ## Ce que l'URL porte, et ce qu'elle ne porte JAMAIS
 *
 * L'identifiant de l'événement, et rien d'autre. Pas de nom, pas d'e-mail : une
 * adresse d'URL finit dans l'historique du navigateur, dans les journaux du
 * serveur et de Cloudflare, et dans l'en-tête `Referer`. Le détail est relu
 * chez Calendly avec notre jeton, côté serveur.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { CalendarCheck, Clock, Mail, AlertTriangle, HelpCircle } from "lucide-react";

import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { CALENDLY_API_BASE } from "@/server/calendly/api";
import { canalDuRendezVous } from "@/server/calendly/canal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Rendez-vous confirmé · Axion-IA" },
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

interface DetailEvenement {
  readonly debut: Date | null;
  readonly format: "telephone" | "visio" | "inconnu";
  readonly lienReunion: string | null;
  readonly annulerUrl: string | null;
}

/**
 * Relit l'événement pour l'afficher.
 *
 * ⚠️ Rend `null` sans jamais lever. Une relecture qui échoue ne remet pas la
 * réservation en cause : elle a été confirmée par l'API au moment du POST. On
 * affiche alors une confirmation plus sobre, jamais un message d'erreur — dire
 * « erreur » sur un rendez-vous qui existe ferait réserver une seconde fois.
 */
async function relireLEvenement(uuid: string): Promise<DetailEvenement | null> {
  const token = process.env.CALENDLY_API_TOKEN?.trim();
  if (!token || !/^[a-f0-9-]{10,64}$/i.test(uuid)) return null;
  try {
    const res = await fetch(`${CALENDLY_API_BASE}/scheduled_events/${uuid}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const corps: unknown = await res.json();
    const r = (corps as Record<string, unknown> | null)?.["resource"];
    if (typeof r !== "object" || r === null) return null;
    const o = r as Record<string, unknown>;
    const lieu = o["location"];
    const debutBrut = o["start_time"];
    const debut = typeof debutBrut === "string" ? new Date(debutBrut) : null;
    const join =
      typeof lieu === "object" && lieu !== null
        ? (lieu as Record<string, unknown>)["join_url"]
        : null;
    return {
      debut: debut && !Number.isNaN(debut.getTime()) ? debut : null,
      // 🔑 La MÊME dérivation que partout ailleurs. Écrire ici une seconde
      // façon de lire le format ferait diverger la page de l'e-mail que le
      // visiteur reçoit dans la minute.
      format: canalDuRendezVous(null, { event: { location: lieu } }),
      lienReunion: typeof join === "string" && join.startsWith("http") ? join : null,
      annulerUrl: null,
    };
  } catch {
    return null;
  }
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

export default async function ConfirmePage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const incertain = sp["incertain"] === "1";
  const aVerifier = sp["v"] === "1";
  const uuid = typeof sp["e"] === "string" ? sp["e"] : "";

  // Ni identifiant ni incertitude : la page n'a rien à confirmer. On ne la
  // laisse pas exister vide — elle serait indexable et trompeuse.
  if (!incertain && uuid === "") notFound();

  const detail = uuid !== "" ? await relireLEvenement(uuid) : null;

  return (
    <div className="bg-canvas min-h-screen pt-8 pb-20 sm:pt-14">
      <Container>
        <div className="mx-auto max-w-xl">
          {incertain ? (
            <EnCoursDeVerification />
          ) : aVerifier ? (
            <ADeuxVerifier detail={detail} />
          ) : (
            <Confirme detail={detail} />
          )}

          <div className="border-border mt-8 border-t pt-6">
            <Link
              href="/"
              className="text-fg-soft hover:text-terracotta-deep text-sm font-medium underline underline-offset-2"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}

/** Le bandeau de tête, commun aux trois états. */
function Tete({
  icone,
  ton,
  titre,
  sous,
}: {
  icone: React.ReactNode;
  ton: "ok" | "attention";
  titre: string;
  sous: string;
}) {
  return (
    <div className="mb-6">
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${
          ton === "ok" ? "bg-sage text-mocha-fg" : "bg-terracotta text-mocha-fg"
        }`}
      >
        {icone}
      </div>
      <h1
        className="text-fg text-[clamp(1.5rem,5vw,2rem)] leading-tight font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {titre}
      </h1>
      <p className="text-fg-soft mt-2 text-[15px]">{sous}</p>
    </div>
  );
}

function Confirme({ detail }: { detail: DetailEvenement | null }) {
  return (
    <>
      <Tete
        icone={<CalendarCheck className="h-6 w-6" aria-hidden="true" />}
        ton="ok"
        titre="C'est réservé."
        sous="Vous allez recevoir un e-mail de confirmation, avec le lien pour annuler ou déplacer si besoin."
      />

      {/* Le récapitulatif n'apparaît que si la relecture a abouti. Inventer une
          heure serait pire que de n'en afficher aucune : l'e-mail, lui, porte
          la bonne, et deux versions différentes se contrediraient. */}
      {detail?.debut ? (
        <dl className="bg-sand space-y-3 rounded-2xl p-5">
          <div className="flex gap-3">
            <Clock className="text-fg-soft mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <dt className="text-fg-soft text-[11px] font-semibold tracking-widest uppercase">
                Quand
              </dt>
              <dd className="text-fg mt-0.5 font-medium">{quand(detail.debut)}</dd>
            </div>
          </div>
          <div className="flex gap-3">
            <Mail className="text-fg-soft mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <dt className="text-fg-soft text-[11px] font-semibold tracking-widest uppercase">
                Comment
              </dt>
              <dd className="text-fg mt-0.5 font-medium">
                {detail.format === "visio"
                  ? "En visioconférence"
                  : detail.format === "telephone"
                    ? "Par téléphone — nous vous appelons"
                    : "Le format vous sera précisé par e-mail"}
              </dd>
              {detail.format === "visio" ? (
                detail.lienReunion ? (
                  <dd className="mt-1 text-sm break-all">
                    <a
                      href={detail.lienReunion}
                      className="text-terracotta-deep underline underline-offset-2"
                    >
                      {detail.lienReunion}
                    </a>
                  </dd>
                ) : (
                  // Un lien encore absent est un état d'attente légitime :
                  // Google le crée quelques secondes après la réservation.
                  <dd className="text-fg-soft mt-1 text-sm">
                    Le lien de connexion arrive dans votre e-mail de confirmation.
                  </dd>
                )
              ) : null}
            </div>
          </div>
        </dl>
      ) : null}
    </>
  );
}

function ADeuxVerifier({ detail }: { detail: DetailEvenement | null }) {
  return (
    <>
      <Tete
        icone={<AlertTriangle className="h-6 w-6" aria-hidden="true" />}
        ton="attention"
        titre="Votre rendez-vous est pris."
        sous="Un point reste à confirmer de notre côté : le format de l'échange. Nous vous écrivons pour le préciser — vous n'avez rien à faire."
      />
      {detail?.debut ? (
        <div className="bg-sand rounded-2xl p-5">
          <p className="text-fg-soft text-[11px] font-semibold tracking-widest uppercase">Quand</p>
          <p className="text-fg mt-0.5 font-medium">{quand(detail.debut)}</p>
        </div>
      ) : null}
    </>
  );
}

/**
 * 🔴 L'ÉTAT QUI JUSTIFIE TOUTE LA CHAÎNE DE RAISONS TYPÉES.
 *
 * Ne JAMAIS remplacer ce texte par « une erreur est survenue, réessayez ». Nous
 * ne savons pas si la réservation existe : inviter à recommencer produirait un
 * doublon dans la moitié des cas, et un doublon coûte plus qu'une attente.
 */
function EnCoursDeVerification() {
  return (
    <>
      <Tete
        icone={<HelpCircle className="h-6 w-6" aria-hidden="true" />}
        ton="attention"
        titre="Nous vérifions votre réservation."
        sous="Votre demande est partie, mais nous n'avons pas reçu la confirmation de notre agenda. Nous vérifions à la main, tout de suite."
      />
      <div className="border-border bg-paper text-fg-soft space-y-3 rounded-2xl border p-5 text-[15px]">
        <p className="text-fg font-semibold">Ce que vous avez à faire : rien.</p>
        <p>
          Vous recevrez un e-mail dans les prochaines minutes — soit la confirmation de votre
          rendez-vous, soit une invitation à en choisir un autre.
        </p>
        <p>
          <strong className="text-fg">Merci de ne pas réserver à nouveau</strong> dans
          l&apos;intervalle&nbsp;: si votre premier rendez-vous a bien été enregistré, vous en
          auriez deux.
        </p>
      </div>
    </>
  );
}
