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
import { TeteDeParcours, SortiesDeParcours } from "@/components/booking/parcours-ui";
import { CALENDLY_API_BASE } from "@/server/calendly/api";
import { canalDuRendezVous } from "@/server/calendly/canal";

export const dynamic = "force-dynamic";

/**
 * Le titre de l'onglet dit l'ÉTAT, pas l'espoir.
 *
 * Un seul titre « Rendez-vous confirmé » pour les trois états faisait mentir
 * l'onglet et l'historique sur le cas incertain — celui où, précisément, on ne
 * sait pas. Un visiteur qui retrouve l'onglet une heure plus tard lit d'abord
 * son titre.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const e = typeof sp["e"] === "string" ? sp["e"] : "";
  const titre =
    e !== "" && !FORME_IDENTIFIANT.test(e)
      ? "Page introuvable · Axion-IA"
      : sp["incertain"] === "1"
        ? "Réservation en cours de vérification · Axion-IA"
        : sp["v"] === "1"
          ? "Rendez-vous pris, format à confirmer · Axion-IA"
          : "Rendez-vous confirmé · Axion-IA";
  return { title: { absolute: titre }, robots: { index: false, follow: false } };
}

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

interface DetailEvenement {
  readonly debut: Date | null;
  readonly format: "telephone" | "visio" | "inconnu";
  readonly lienReunion: string | null;
}

/**
 * La forme d'un identifiant d'événement Calendly. Partagée entre la garde de
 * la page et la relecture : deux jugements sur le même identifiant ne doivent
 * pas pouvoir diverger.
 */
const FORME_IDENTIFIANT = /^[a-f0-9-]{10,64}$/i;

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
  if (!token || !FORME_IDENTIFIANT.test(uuid)) return null;
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

  // 🔴 Un identifiant qui n'a pas la FORME d'un identifiant Calendly n'est pas
  // une réservation dont la relecture a échoué : c'est une adresse forgée ou
  // tronquée. Lui répondre « c'est réservé » confirmerait un rendez-vous qui
  // n'a jamais existé — mesuré en prod avec `?e=bidon`, le 2026-09-02.
  if (uuid !== "" && !FORME_IDENTIFIANT.test(uuid)) notFound();

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

          <SortiesDeParcours secondaire={{ href: "/", label: "Retour à l'accueil" }} />
        </div>
      </Container>
    </div>
  );
}

function Confirme({ detail }: { detail: DetailEvenement | null }) {
  return (
    <>
      {detail?.debut ? (
        <TeteDeParcours
          icone={<CalendarCheck className="h-6 w-6" aria-hidden="true" />}
          ton="ok"
          titre="C'est réservé."
          sous="Vous allez recevoir un e-mail de confirmation, avec le lien pour annuler ou déplacer si besoin."
        />
      ) : (
        // 🔴 Sans détail, on ne dit pas « c'est réservé » avec l'assurance d'un
        // écran qui affiche la date. La réservation existe — l'API l'a
        // confirmée au POST — mais un écran sans date ni format ressemblait
        // trait pour trait au succès complet, et rien n'indiquait au visiteur
        // OÙ vérifier. On le dit : l'e-mail fait foi.
        <TeteDeParcours
          icone={<CalendarCheck className="h-6 w-6" aria-hidden="true" />}
          ton="ok"
          titre="Votre réservation est enregistrée."
          sous="Nous n'avons pas pu afficher le détail ici. L'e-mail de confirmation, qui arrive dans la minute, fait foi : il porte la date, le format et le lien pour annuler ou déplacer."
        />
      )}

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
      <TeteDeParcours
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
      <TeteDeParcours
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
