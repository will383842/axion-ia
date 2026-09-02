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
 *
 * ## 🎯 Le passage « punch » du 2026-09-02
 *
 * Will : « il manque de punch », « je veux la perfection […] pour ne pas perdre
 * de prospect en cours de route ». Trois manques mesurés sur cet écran :
 *
 * 1. **Le récapitulatif ne se lisait pas.** Un `<dl>` beige plat, deux lignes
 *    de 16 px, aucune hiérarchie : la date — la seule information que le
 *    visiteur est venu vérifier — avait exactement le poids visuel du mot
 *    « Quand ». Elle passe en serif large dans une carte à en-tête, et la carte
 *    porte une bordure `border-strong` au lieu du sable presque invisible.
 * 2. **Rien ne disait la SUITE.** Le prospect quittait la page en sachant
 *    seulement qu'un e-mail arrivait. Deux messages distincts vont pourtant lui
 *    parvenir — le nôtre et l'invitation d'agenda de Calendly — puis deux
 *    rappels. Ne pas l'annoncer, c'est fabriquer le doute qui produit le
 *    deuxième e-mail « je n'ai rien reçu » et, pire, la seconde réservation.
 *    D'où `<CeQuiSePasseMaintenant>`.
 * 3. **Le lien de visio était une URL brute en `break-all`.** Illisible, et
 *    impossible à viser au pouce. C'est devenu une action nommée de 44 px.
 *
 * ⛔ Ce qui n'a PAS changé, et ne doit pas changer : on n'invente ni date, ni
 * heure, ni format. Quand `relireLEvenement` rend `null`, la carte disparaît et
 * la tête renvoie à l'e-mail, qui fait foi.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Clock,
  Mail,
  AlertTriangle,
  BellRing,
  ExternalLink,
  HelpCircle,
  Phone,
  Video,
} from "lucide-react";

import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { TeteDeParcours, SortiesDeParcours } from "@/components/booking/parcours-ui";
import { RemonterAuMessage } from "@/components/booking/RemonterAuMessage";
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
  readonly fin: Date | null;
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
    const join =
      typeof lieu === "object" && lieu !== null
        ? (lieu as Record<string, unknown>)["join_url"]
        : null;
    return {
      debut: dateOuNull(o["start_time"]),
      // La fin sert UNIQUEMENT à afficher une durée mesurée. Sans elle, aucune
      // durée n'est écrite : « 45 minutes » recopié depuis la page de
      // réservation serait une durée inventée le jour où l'event-type change.
      fin: dateOuNull(o["end_time"]),
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

function dateOuNull(brut: unknown): Date | null {
  if (typeof brut !== "string") return null;
  const d = new Date(brut);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Le jour et l'heure, séparés — parce qu'ils ne se lisent pas au même poids.
 *
 * 🔑 Une seule dérivation. `quand()` compose ces deux morceaux au lieu de
 * refaire ses propres `Intl.DateTimeFormat` : deux formatages du même instant
 * finiraient par diverger d'un fuseau ou d'une capitale.
 */
function quandEnDeux(d: Date): { jour: string; heure: string } {
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
  return { jour: `${jour.charAt(0).toUpperCase()}${jour.slice(1)}`, heure };
}

function quand(d: Date): string {
  const { jour, heure } = quandEnDeux(d);
  return `${jour} à ${heure} (heure de Paris)`;
}

/** La durée en minutes, ou `null` si l'un des deux bouts manque. */
function dureeEnMinutes(debut: Date, fin: Date | null): number | null {
  if (!fin) return null;
  const minutes = Math.round((fin.getTime() - debut.getTime()) / 60_000);
  return minutes > 0 && minutes < 24 * 60 ? minutes : null;
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
          {/* On arrive ici par l'action serveur, depuis le bas du formulaire :
              sans ce geste, « C'est réservé » s'affichait 325 px au-dessus de
              l'écran (mesuré en prod le 2026-09-02). */}
          <RemonterAuMessage />
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
          surtitre="Premier contact · confirmé"
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
          surtitre="Premier contact · enregistré"
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
        <CarteRendezVous
          debut={detail.debut}
          fin={detail.fin}
          format={detail.format}
          lienReunion={detail.lienReunion}
        />
      ) : null}

      {/* ⚠️ La chronologie s'affiche dans les DEUX branches, y compris sans
          détail. Elle ne dit rien de la date ni du format : elle dit ce qui
          arrive ensuite, et c'est précisément là que le visiteur privé de
          récapitulatif a le plus besoin d'être tenu. */}
      <CeQuiSePasseMaintenant format={detail?.format ?? "inconnu"} />
    </>
  );
}

/**
 * Le récapitulatif — la carte que le visiteur est venu lire.
 *
 * 🔑 Une seule information est mise en avant : QUAND. Le format vient ensuite,
 * et l'action de visio en dernier, parce qu'elle ne sert que le jour J. Aucun
 * champ n'est écrit sans donnée : la durée disparaît si l'API n'a pas rendu
 * l'heure de fin, le bloc visio si le format n'est pas une visio.
 */
function CarteRendezVous({
  debut,
  fin,
  format,
  lienReunion,
}: {
  debut: Date;
  fin: Date | null;
  format: DetailEvenement["format"];
  lienReunion: string | null;
}) {
  const { jour, heure } = quandEnDeux(debut);
  const minutes = dureeEnMinutes(debut, fin);
  const PictoFormat = format === "visio" ? Video : format === "telephone" ? Phone : Mail;

  return (
    <section
      aria-label="Votre rendez-vous"
      className="border-border-strong bg-paper overflow-hidden rounded-2xl border shadow-sm"
    >
      <p className="bg-sage-soft text-fg border-border-strong border-b px-5 py-2.5 text-[11px] font-semibold tracking-widest uppercase">
        Votre rendez-vous
      </p>

      <div className="p-5 sm:p-6">
        <div className="flex gap-4">
          <span
            className="bg-sage-soft text-sage flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            aria-hidden="true"
          >
            <Clock className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-fg-muted text-[11px] font-semibold tracking-widest uppercase">
              Quand
            </p>
            <p
              className="text-fg mt-1 text-[clamp(1.0625rem,4.8vw,1.375rem)] leading-snug font-semibold"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {jour} à {heure}
            </p>
            <p className="text-fg-soft mt-1 text-sm">
              Heure de Paris{minutes ? ` · ${minutes} minutes` : ""}
            </p>
          </div>
        </div>

        <div className="border-border-strong mt-5 border-t pt-5">
          <div className="flex gap-4">
            <span
              className="bg-sage-soft text-sage flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              aria-hidden="true"
            >
              <PictoFormat className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-fg-muted text-[11px] font-semibold tracking-widest uppercase">
                Comment
              </p>
              <p className="text-fg mt-1 font-semibold">
                {format === "visio"
                  ? "En visioconférence"
                  : format === "telephone"
                    ? "Par téléphone — nous vous appelons"
                    : "Le format vous sera précisé par e-mail"}
              </p>

              {format === "visio" ? (
                lienReunion ? (
                  // 🔴 Une action nommée, pas une URL. L'adresse brute en
                  // `break-all` occupait trois lignes illisibles et n'offrait
                  // aucune cible franche au pouce.
                  <a
                    href={lienReunion}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-terracotta text-terracotta-deep hover:bg-terracotta-soft focus-visible:ring-terracotta mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 text-[15px] font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto"
                  >
                    <Video className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Ouvrir le lien de la visioconférence
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>
                ) : (
                  // Un lien encore absent est un état d'attente légitime :
                  // Google le crée quelques secondes après la réservation.
                  <p className="text-fg-soft mt-2 text-sm">
                    Le lien de connexion arrive dans votre e-mail de confirmation.
                  </p>
                )
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * 🔴 LA CHRONOLOGIE — c'est elle qui empêche de perdre le prospect ici.
 *
 * Le parcours envoie DEUX messages distincts (le nôtre et l'invitation
 * d'agenda émise par Calendly), puis deux rappels. Un visiteur qui n'a pas été
 * prévenu de cette séquence interprète le second message comme un doublon, le
 * premier rappel comme une erreur, et l'absence d'invitation dans les trente
 * secondes comme un échec de réservation — celui qui produit la deuxième
 * réservation, la seule panne réellement coûteuse de cet écran.
 *
 * ⚠️ Aucune ligne ne cite d'horaire : la séquence est vraie quelle que soit la
 * date, et le reste vrai même quand la relecture Calendly n'a rien rendu.
 */
function CeQuiSePasseMaintenant({ format }: { format: DetailEvenement["format"] }) {
  const etapes = [
    {
      Picto: Mail,
      titre: "Notre e-mail de confirmation",
      corps:
        "Il arrive dans la minute et récapitule tout, avec vos liens pour annuler ou déplacer.",
    },
    {
      Picto: CalendarPlus,
      titre: "L'invitation dans votre agenda",
      corps:
        format === "visio"
          ? "Elle arrive séparément, envoyée par Calendly. Acceptez-la pour bloquer le créneau : le lien de connexion y figure aussi."
          : "Elle arrive séparément, envoyée par Calendly. Acceptez-la pour bloquer le créneau dans votre agenda.",
    },
    {
      Picto: BellRing,
      titre: "Deux rappels, sans rien faire",
      corps: "Un la veille, un autre une heure avant. Vous ne pouvez pas l'oublier.",
    },
    {
      Picto: CalendarClock,
      titre: "Un empêchement ?",
      corps:
        "Annulez ou déplacez en un clic depuis l'e-mail, jusqu'à la dernière minute. Aucune justification à donner.",
    },
  ];

  return (
    <section aria-labelledby="suite-du-parcours" className="mt-9">
      <h2
        id="suite-du-parcours"
        className="text-terracotta text-[11px] font-semibold tracking-widest uppercase sm:text-xs"
      >
        Ce qui se passe maintenant
      </h2>
      <ol className="mt-5">
        {etapes.map(({ Picto, titre, corps }, i) => {
          const dernier = i === etapes.length - 1;
          return (
            <li key={titre} className="flex gap-4">
              <div className="flex shrink-0 flex-col items-center">
                <span
                  className="border-border-strong bg-paper text-terracotta flex h-9 w-9 items-center justify-center rounded-full border"
                  aria-hidden="true"
                >
                  <Picto className="h-4 w-4" />
                </span>
                {/* Le fil qui relie les étapes : il n'existe qu'entre deux
                    pastilles, jamais après la dernière. */}
                {dernier ? null : (
                  <span className="bg-border-strong w-px grow" aria-hidden="true" />
                )}
              </div>
              <div className={dernier ? "" : "pb-6"}>
                <p className="text-fg font-semibold">{titre}</p>
                <p className="text-fg-soft mt-1 text-[15px] leading-relaxed">{corps}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ADeuxVerifier({ detail }: { detail: DetailEvenement | null }) {
  return (
    <>
      <TeteDeParcours
        surtitre="Premier contact · un point à confirmer"
        icone={<AlertTriangle className="h-6 w-6" aria-hidden="true" />}
        ton="attention"
        titre="Votre rendez-vous est pris."
        sous="Un point reste à confirmer de notre côté : le format de l'échange. Nous vous écrivons pour le préciser — vous n'avez rien à faire."
      />
      {/* ⚠️ La date, et RIEN d'autre. C'est précisément le format qui est en
          doute ici : afficher une ligne « Comment » reviendrait à confirmer ce
          qu'on vient d'annoncer comme incertain. */}
      {detail?.debut ? (
        <div className="border-border-strong bg-paper rounded-2xl border p-5 shadow-sm">
          <p className="text-fg-muted text-[11px] font-semibold tracking-widest uppercase">Quand</p>
          <p
            className="text-fg mt-1 text-[clamp(1.0625rem,4.8vw,1.375rem)] leading-snug font-semibold"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {quand(detail.debut)}
          </p>
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
 *
 * ⚠️ Aucune chronologie ici, et c'est délibéré : annoncer « votre invitation
 * d'agenda arrive » à quelqu'un dont on ignore si la réservation existe serait
 * une promesse qu'on ne sait pas tenir.
 *
 * ⚠️ Cette fonction est la DERNIÈRE du fichier, et doit le rester : la garde
 * `les-ecrans-de-fin-disent-vrai.spec.ts` lit son corps jusqu'à la fin du
 * fichier pour vérifier qu'il ne contient ni « erreur » ni invitation à
 * recommencer. Une fonction ajoutée après elle entrerait dans la mesure.
 */
function EnCoursDeVerification() {
  return (
    <>
      <TeteDeParcours
        surtitre="Premier contact · en cours de vérification"
        icone={<HelpCircle className="h-6 w-6" aria-hidden="true" />}
        ton="attention"
        titre="Nous vérifions votre réservation."
        sous="Votre demande est partie, mais nous n'avons pas reçu la confirmation de notre agenda. Nous vérifions à la main, tout de suite."
      />
      <div className="border-border-strong bg-paper text-fg-soft space-y-3 rounded-2xl border p-5 text-[15px] shadow-sm sm:p-6">
        <p className="text-fg text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>
          Ce que vous avez à faire : rien.
        </p>
        <p className="leading-relaxed">
          Vous recevrez un e-mail dans les prochaines minutes — soit la confirmation de votre
          rendez-vous, soit une invitation à en choisir un autre.
        </p>
        <p className="border-terracotta bg-terracotta-soft text-fg rounded-lg border-l-4 px-4 py-3 leading-relaxed">
          <strong className="font-semibold">Merci de ne pas réserver à nouveau</strong> dans
          l&apos;intervalle&nbsp;: si votre premier rendez-vous a bien été enregistré, vous en
          auriez deux.
        </p>
      </div>
    </>
  );
}
