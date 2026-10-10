// Enrichissement d'un `CalendlyEvent` depuis l'API Calendly v2 (ADR 0036).
//
// Sépare volontairement l'accès réseau (`./api`) de l'écriture en base (ici),
// pour que la logique d'application soit testable sans stub HTTP.
//
// Deux appelants :
//   1. `POST /api/calendly/client-event` — juste après la capture postMessage.
//   2. `enrichCalendlyEventAction` — bouton admin (rattrapage d'une ligne
//      ancienne, ou re-synchro après annulation côté Calendly).
//
// Règle d'écriture, en deux moitiés :
//
//   • l'admin est propriétaire du QUI — nom, email, téléphone, lieu, notes. Un
//     enrichissement tardif ne doit jamais effacer ce qui a été recopié à la
//     main depuis Gmail : ces champs ne sont écrits que s'ils sont vides.
//   • Calendly est propriétaire du QUAND — horaire et statut. Garder une
//     ancienne heure après un déplacement d'invité produirait une fiche qui
//     ment, ce qui est pire que pas de fiche du tout pour un agenda.
//
// Seul le statut terminal posé après coup est protégé : il décrit ce qui s'est
// passé pendant l'appel, et l'humain qui l'a saisi a vu l'appel.
//
// ── L'ISSUE DU RDV VA AUSSI AU CRM (2026-08-18) ───────────────────────────────
//
// Ce module détectait déjà les annulations tout seul, mais il ne le disait qu'à
// Telegram : il n'importait pas `@/server/crm-sync`. L'automatisation existait
// donc pour l'AFFICHAGE et pas pour la SYNCHRO — le CRM n'apprenait une
// annulation que si quelqu'un repassait le statut à la main dans la console,
// alors que la PRISE de rendez-vous, elle, part toute seule depuis `discover.ts`.
// C'était une asymétrie, pas une décision.
//
// Deux statuts partent d'ici, et deux seulement :
//   · `canceled` — l'invité (ou l'hôte) a annulé côté Calendly ;
//   · `no_show`  — l'hôte a coché « Mark as no-show ». Contrairement à ce qu'on
//     a longtemps écrit ici, l'API le sait : l'invitee porte `no_show`.
//
// `completed` reste MANUEL, et ce n'est pas un oubli : rien dans l'API ne dit
// qu'un rendez-vous a été honoré. Une règle temporelle (« l'heure de fin est
// passée depuis N heures ⇒ honoré ») affirmerait au CRM un fait commercial que
// personne n'a constaté — et un rendez-vous passé n'a pas forcément eu lieu.

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { notify } from "@/server/notifications";
import { syncCalendlyEventToCrm } from "@/server/crm-sync";
import { fetchCalendlyInvitee, isCalendlyApiConfigured } from "./api";
import { rattacherEchangeApporteur } from "./rattachement-apporteur";
import { creerFicheDepuisRendezVous } from "./fiche-rendez-vous-apporteur";
import { estRendezVousApporteur } from "./appel-apporteur";
import { emettreEvenementPlausible } from "@/lib/analytics/plausible-serveur";
import { majMessageVsl } from "@/features/commercial-application/lead-vsl-details";
import { VSL_MERCI_PATH } from "@/lib/commercial-application/vsl-apporteur";
import { envoyerScheduleApporteur } from "@/server/meta/schedule-apporteur";
import { annulerRelancesLeadApporteur } from "@/features/commercial-application/relances-lead-apporteur";
import {
  attributionDeLaFiche,
  completerAttribution,
  type AttributionFiche,
} from "./attribution-fiche-video";
import {
  besoinDesReponses,
  reponsesDesQuestions,
  classerRendezVous,
  estColonneTypeRendezVousAbsente,
  eventTypeUriDuBrut,
  sansColonnesTypeRendezVous,
  uriDeTypeValide,
  utmDuTracking,
  type TypeRendezVous,
} from "./type-rendez-vous";

/** Colonnes lues à chaque enrichissement, hors celles du lot « Types de rendez-vous ». */
const SELECT_LIGNE = {
  id: true,
  eventUri: true,
  inviteeUri: true,
  inviteeName: true,
  inviteeEmail: true,
  inviteePhone: true,
  startTime: true,
  endTime: true,
  location: true,
  status: true,
  eventTypeName: true,
  eventTypeSlug: true,
  cancelUrl: true,
  rescheduleUrl: true,
  rawPayload: true,
  utmSource: true,
  utmMedium: true,
  utmCampaign: true,
  // Lus pour le rattachement automatique d'un échange apporteur : on ne
  // rattache qu'une ligne qui ne l'est à rien (cf. rattachement-apporteur).
  linkedSubmissionId: true,
  linkedJobApplicationId: true,
} as const;

/**
 * Colonnes ajoutées par le lot « Types de rendez-vous » (2026-10-04). Lues À
 * PART : pendant la fenêtre app/worker, elles n'existent pas encore en base, et
 * leur absence ne doit pas empêcher l'enrichissement du reste.
 */
const SELECT_TYPE_RDV = { typeRendezVous: true, eventTypeUri: true, utmContent: true } as const;

export type EnrichOutcome =
  | {
      ok: true;
      updatedFields: string[];
      /**
       * Réponses libres du formulaire Calendly, NON persistées (la colonne
       * `notes` appartient à l'admin) — transmises à l'appelant pour la
       * notification de création uniquement.
       */
      answersText: string | null;
    }
  | { ok: false; reason: string };

/**
 * État Calendly → enum `CalendlyEventStatus`.
 *
 * `noShow` l'emporte sur l'annulation : quand les deux sont vrais, c'est que
 * l'hôte a annulé le créneau APRÈS avoir constaté l'absence. Garder « annulé »
 * dans ce cas effacerait l'information la plus utile des deux.
 */
function mapCalendlyStatus(
  raw: string | null,
  noShow: boolean,
): "scheduled" | "canceled" | "no_show" | null {
  if (noShow) return "no_show";
  if (raw === "canceled") return "canceled";
  if (raw === "active") return "scheduled";
  return null;
}

/**
 * Enrichit une ligne `calendly_events` à partir de ses URI stockées.
 *
 * Ne throw jamais : toute erreur remonte en `{ ok: false, reason }`. Le
 * contexte d'appel principal est un beacon navigateur — l'échec de
 * l'enrichissement ne doit jamais faire échouer la capture elle-même.
 */
export async function enrichCalendlyEvent(eventId: string): Promise<EnrichOutcome> {
  if (!isCalendlyApiConfigured()) return { ok: false, reason: "not_configured" };

  let row: {
    id: string;
    eventUri: string | null;
    inviteeUri: string | null;
    inviteeName: string | null;
    inviteeEmail: string | null;
    inviteePhone: string | null;
    startTime: Date | null;
    endTime: Date | null;
    location: string | null;
    status: string;
    eventTypeName: string;
    eventTypeSlug: string;
    cancelUrl: string | null;
    rescheduleUrl: string | null;
    rawPayload: unknown;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    linkedSubmissionId: string | null;
    linkedJobApplicationId: string | null;
    typeRendezVous: TypeRendezVous | null;
    eventTypeUri: string | null;
    utmContent: string | null;
  } | null;
  // Vrai pendant la fenêtre app/worker : la migration du lot « Types de
  // rendez-vous » n'est pas passée, on n'écrit donc pas ses colonnes.
  let colonnesTypeAbsentes = false;
  try {
    try {
      row = await prisma.calendlyEvent.findUnique({
        where: { id: eventId },
        select: { ...SELECT_LIGNE, ...SELECT_TYPE_RDV },
      });
    } catch (e) {
      if (!estColonneTypeRendezVousAbsente(e)) throw e;
      colonnesTypeAbsentes = true;
      const sansType = await prisma.calendlyEvent.findUnique({
        where: { id: eventId },
        select: SELECT_LIGNE,
      });
      row = sansType
        ? { ...sansType, typeRendezVous: null, eventTypeUri: null, utmContent: null }
        : null;
    }
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, reason: "db_read_failed" };
  }
  // Distinct de `not_found` (qui signifie « Calendly ne connaît plus l'event ») :
  // ici c'est notre propre ligne qui manque.
  if (!row) return { ok: false, reason: "not_found_local" };
  if (!row.inviteeUri) return { ok: false, reason: "no_invitee_uri" };

  const res = await fetchCalendlyInvitee(row.inviteeUri, row.eventUri);
  if (!res.ok) return { ok: false, reason: res.reason };

  const d = res.data;
  const data: Record<string, unknown> = {};
  const updatedFields: string[] = [];
  const setIfEmpty = <T>(field: string, current: T | null, incoming: T | null): void => {
    if (current == null && incoming != null) {
      data[field] = incoming;
      updatedFields.push(field);
    }
  };

  setIfEmpty("inviteeName", row.inviteeName, d.inviteeName);
  setIfEmpty("inviteeEmail", row.inviteeEmail, d.inviteeEmail);
  setIfEmpty("inviteePhone", row.inviteePhone, d.inviteePhone);
  setIfEmpty("location", row.location, d.location);
  setIfEmpty("cancelUrl", row.cancelUrl, d.cancelUrl);
  setIfEmpty("rescheduleUrl", row.rescheduleUrl, d.rescheduleUrl);
  if (d.timezone) {
    data["timezone"] = d.timezone;
    updatedFields.push("timezone");
  }

  // Le nom lisible de l'event-type remplace le slug technique tant que
  // personne ne l'a renommé à la main (à la capture on n'a que le slug).
  if (d.eventTypeName && row.eventTypeName === row.eventTypeSlug) {
    data["eventTypeName"] = d.eventTypeName;
    updatedFields.push("eventTypeName");
  }

  // ── Champs dont Calendly est propriétaire ────────────────────────────────
  //
  // L'HORAIRE et le STATUT échappent à la règle « ne jamais écraser une saisie
  // humaine », et c'est délibéré : Calendly est le système de référence du
  // *quand*. Si un invité déplace son créneau depuis le mail Calendly, garder
  // l'ancienne heure sous prétexte qu'un humain l'avait recopiée produirait une
  // fiche qui ment — le pire résultat possible pour un agenda. L'admin reste
  // propriétaire du *qui* (nom, email, téléphone), que l'API ne fait que
  // compléter quand c'est vide.
  //
  // Ces deux transitions sont aussi les seules occasions de savoir qu'un RDV a
  // bougé : sans webhook (Calendly Free), rien d'autre ne le signale.
  const rescheduled =
    d.startTime != null &&
    row.startTime != null &&
    d.startTime.getTime() !== row.startTime.getTime();
  if (d.startTime != null && d.startTime.getTime() !== (row.startTime?.getTime() ?? NaN)) {
    data["startTime"] = d.startTime;
    updatedFields.push("startTime");
  }
  if (d.endTime != null && d.endTime.getTime() !== (row.endTime?.getTime() ?? NaN)) {
    data["endTime"] = d.endTime;
    updatedFields.push("endTime");
  }

  // On ne rétrograde jamais un statut posé manuellement en fin de parcours
  // (`completed` / `no_show`) : il décrit ce qui s'est réellement passé pendant
  // l'appel, ce que l'API ne peut pas savoir.
  const mapped = mapCalendlyStatus(d.calendlyStatus, d.noShow);
  const terminal = row.status === "completed" || row.status === "no_show";
  const canceled = mapped === "canceled" && row.status !== "canceled" && !terminal;
  const noShow = mapped === "no_show" && !terminal;
  if (mapped && mapped !== row.status && !terminal) {
    data["status"] = mapped;
    updatedFields.push("status");
  }

  // ── La charge brute, remontee a chaque passage ───────────────────────────
  //
  // 🔴 ELLE N'ETAIT ECRITE QU'A LA CAPTURE. Le statut, les horaires et le
  // telephone se rafraichissaient ici pendant qu'elle vieillissait sur place :
  // le 2026-08-27, une fiche affichait « Annule » au-dessus d'un JSON qui disait
  // encore `"status": "active"`. Le statut avait raison — verifie sur trois
  // sources, dont l'agenda Google ou l'evenement avait bel et bien disparu —
  // mais l'ecran donnait a lire deux verites d'ages differents sans les dater.
  //
  // ⚠️ ON PRESERVE LES CLES PRIVEES, prefixees `_`. `rawPayload._ipHash` est
  // interroge par `api/calendly/client-event` (`path: ["_ipHash"]`) pour
  // reconnaitre un renvoi du meme visiteur. L'ecraser ne casserait RIEN de
  // visible : la requete ne trouverait simplement plus rien, et le garde-fou
  // anti-abus s'eteindrait en silence. C'est exactement le genre de panne qu'on
  // ne decouvre qu'apres.
  const ancienBrut =
    typeof row.rawPayload === "object" && row.rawPayload !== null
      ? (row.rawPayload as Record<string, unknown>)
      : {};
  const clesPrivees = Object.fromEntries(
    Object.entries(ancienBrut).filter(([cle]) => cle.startsWith("_")),
  );
  // ⚠️ ON N'ECRIT QUE SI ON A REELLEMENT QUELQUE CHOSE. Remplacer une charge
  // brute existante par un objet vide detruirait la seule trace exploitable d'un
  // cas litigieux — et cette fonction promet, en tete de fichier, de ne jamais
  // lever : lire `d.raw.invitee` sans garde suffirait a violer ce contrat le
  // jour ou un appelant rendrait la forme courte.
  const brutFrais = d.raw;

  // ── Le type du rendez-vous et sa provenance (2026-10-04) ─────────────────
  //
  // Reclassé à CHAQUE passage : l'URI du type n'est souvent connue qu'ici (la
  // capture par l'iframe n'en porte aucune), et c'est elle qui fait foi — un
  // type renommé dans Calendly garde son URI. Hors de `updatedFields`, comme la
  // charge brute : ce sont des métadonnées, pas un changement de la fiche.
  const eventTypeUriFrais =
    uriDeTypeValide(brutFrais?.event?.["event_type"]) ??
    row.eventTypeUri ??
    eventTypeUriDuBrut(row.rawPayload);
  const typeRendezVous = await classerRendezVous({
    eventTypeUri: eventTypeUriFrais,
    eventTypeName: (data["eventTypeName"] as string | undefined) ?? row.eventTypeName,
  });
  let callBookedAEmettre = false;
  let scheduleMetaAEmettre = false;
  const besoin = besoinDesReponses(brutFrais?.invitee?.["questions_and_answers"]);
  const reponses = reponsesDesQuestions(brutFrais?.invitee?.["questions_and_answers"]);
  const utm = utmDuTracking(brutFrais?.invitee);
  if (!colonnesTypeAbsentes) {
    if (eventTypeUriFrais && eventTypeUriFrais !== row.eventTypeUri) {
      data["eventTypeUri"] = eventTypeUriFrais;
    }
    if (typeRendezVous !== row.typeRendezVous) data["typeRendezVous"] = typeRendezVous;
    if (row.utmContent == null && utm.utmContent) data["utmContent"] = utm.utmContent;
  }
  // Les UTM de l'iframe priment : on ne complète que ce qui est vide.
  if (row.utmSource == null && utm.utmSource) data["utmSource"] = utm.utmSource;
  if (row.utmMedium == null && utm.utmMedium) data["utmMedium"] = utm.utmMedium;
  if (row.utmCampaign == null && utm.utmCampaign) data["utmCampaign"] = utm.utmCampaign;

  if (
    brutFrais &&
    (Object.keys(brutFrais.invitee).length > 0 || Object.keys(brutFrais.event).length > 0)
  ) {
    data["rawPayload"] = {
      ...clesPrivees,
      invitee: brutFrais.invitee,
      event: brutFrais.event,
      _refreshedAt: new Date().toISOString(),
    } as never;
    // ── `Call Booked` côté SERVEUR (lot 4 du tunnel vidéo, 2026-10-05) ───────
    // Une réservation faite depuis le lien de l'e-mail (B1, invitation) n'est
    // vue par AUCUN script du site : seul l'enrichissement la connaît de façon
    // sûre. UNE fois par réservation — le marqueur `_callBookedServeur` vit dans
    // les clés privées (préfixe `_`, préservées à chaque passage) — et JAMAIS
    // pour une réservation que le NAVIGATEUR a déjà comptée : une ligne créée
    // par la capture de l'iframe porte `_ipHash`, et l'événement navigateur
    // `Call Booked` la couvre (sans cela Plausible compterait deux fois).
    // Émis APRÈS l'écriture réussie : un échec d'écriture ne marque rien.
    const echangeApporteurActif =
      d.calendlyStatus === "active" &&
      !d.noShow &&
      estRendezVousApporteur({
        eventTypeName: (data["eventTypeName"] as string | undefined) ?? row.eventTypeName,
        typeRendezVous,
      });
    if (
      echangeApporteurActif &&
      ancienBrut["_ipHash"] === undefined &&
      ancienBrut["_callBookedServeur"] === undefined
    ) {
      (data["rawPayload"] as Record<string, unknown>)["_callBookedServeur"] =
        new Date().toISOString();
      callBookedAEmettre = true;
    }
    // ── `Schedule` vers Meta (lot 5, 2026-10-05) ─────────────────────────────
    // Même mécanique, même raison : l'enrichissement est le seul endroit qui
    // connaisse la réservation de façon sûre. UNE tentative par réservation
    // (marqueur `_scheduleMeta`, clé privée préservée) — et, à la différence de
    // Plausible, AUSSI pour une réservation que le navigateur a tirée : Meta
    // dédoublonne sur `event_id` (`schedule:<id de la réservation>`), et le tir
    // navigateur se perd (bloqueurs, onglet fermé). Le consentement, lui, est lu
    // sur la fiche (`envoyerScheduleApporteur`) : sans accord tracé, rien ne part.
    if (echangeApporteurActif && ancienBrut["_scheduleMeta"] === undefined) {
      (data["rawPayload"] as Record<string, unknown>)["_scheduleMeta"] = new Date().toISOString();
      scheduleMetaAEmettre = true;
    }
    // ⚠️ VOLONTAIREMENT ABSENT de `updatedFields`. Ce tableau annonce ce qui a
    // CHANGE pour la fiche — il alimente le journal et l'alerte. La charge brute
    // change a chaque passage, ne serait-ce que par son horodatage : l'y inscrire
    // ferait passer toute fiche pour modifiee a chaque sondage, et noierait les
    // vrais changements (un deplacement, une annulation) sous du bruit.
  }

  try {
    const ecriture = { ...data, enrichedAt: new Date() };
    // `select` ÉTROIT : sans lui, Prisma relit toutes les colonnes, y compris
    // celles qu'une migration pas encore passée n'a pas posées.
    try {
      await prisma.calendlyEvent.update({
        where: { id: eventId },
        data: ecriture,
        select: { id: true },
      });
    } catch (e) {
      if (!estColonneTypeRendezVousAbsente(e)) throw e;
      await prisma.calendlyEvent.update({
        where: { id: eventId },
        data: sansColonnesTypeRendezVous(ecriture),
        select: { id: true },
      });
    }
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, reason: "db_write_failed" };
  }

  // 🔴 SEULE L'ADRESSE QUE CALENDLY CONFIRME DECIDE D'UN RATTACHEMENT, et ce
  // n'est pas un exces de prudence : c'est la difference entre une ligne
  // parasite et le dossier d'un tiers.
  //
  // `/api/calendly/client-event` est une route PUBLIQUE qui ecrit
  // `inviteeEmail` depuis le corps de la requete. Son propre en-tete dit que la
  // porte reste ouverte a l'appel scripte informe (`Origin` en dur dans
  // `TRUSTED_ORIGINS`) et que « fabriquer une fiche au nom d'un tiers » reste
  // atteignable. Jusqu'ici, cela ne produisait qu'une ligne fausse.
  //
  // `setIfEmpty` (plus haut) n'ecrase JAMAIS un champ deja rempli : l'adresse
  // forgee survit donc a l'enrichissement. Lire `row.inviteeEmail` ici
  // reviendrait a rattacher automatiquement, en silence et sans trace, le
  // rendez-vous de quelqu'un au dossier apporteur d'une VICTIME choisie par
  // l'appelant — puis a afficher « echange reserve » sur ce dossier.
  //
  // 🔑 On echoue donc FERME : sans adresse confirmee par l'API, aucun
  // rattachement automatique. Le selecteur de la console reste la, et un admin
  // rattache a la main — ce qui laisse, lui, un auteur.
  const inviteeEmail = d.inviteeEmail ?? "";

  // ── Rattachement d'un échange apporteur à son dossier (2026-09-19) ──────────
  //
  // C'est ICI que l'adresse de l'invité devient connue : la capture depuis le
  // widget n'en porte aucune. Le rattachement se fait donc après l'écriture,
  // avec l'adresse fraîche. Il n'écrit que sur une ligne rattachée à rien, et
  // cette condition est posée dans sa requête d'écriture même.
  //
  // Best-effort strict : un rattachement raté laisse la fiche comme avant (le
  // sélecteur de la console reste là), il ne fait pas échouer l'enrichissement.
  let ficheRattachee: string | null = row.linkedSubmissionId ?? null;
  try {
    const issueRattachement = await rattacherEchangeApporteur({
      id: eventId,
      eventTypeName: (data["eventTypeName"] as string | undefined) ?? row.eventTypeName,
      typeRendezVous,
      inviteeEmail,
      inviteeName: d.inviteeName ?? null,
      linkedSubmissionId: row.linkedSubmissionId,
      linkedJobApplicationId: row.linkedJobApplicationId,
    });
    // Aucune fiche apporteur, ni à l'adresse ni au nom (réservation sans formulaire) :
    // on la crée, sans e-mail, pour que « Retenu » puisse ouvrir le dossier (07/10).
    if (!issueRattachement.rattache && issueRattachement.motif === "aucun_dossier_apporteur") {
      try {
        await creerFicheDepuisRendezVous({
          eventId,
          email: inviteeEmail,
          nom: d.inviteeName ?? null,
          telephone: d.inviteePhone ?? row.inviteePhone ?? null,
          reponses: d.answersText ?? null,
        });
      } catch (e) {
        Sentry.captureException(e, { tags: { service: "calendly-fiche-rendez-vous" } });
      }
    }
    if (issueRattachement.rattache) {
      ficheRattachee = issueRattachement.submissionId;
      // Fiche née de la page vidéo : le message de la console dit la suite.
      // Sans bloc `vsl`, la requête ne touche rien (autres parcours inchangés).
      try {
        await majMessageVsl(
          issueRattachement.submissionId,
          "Échange réservé (inscription depuis la page vidéo /apporteur-affaires/video) — téléphone et réponse donnés.",
        );
      } catch (e) {
        Sentry.captureException(e, { tags: { service: "calendly-message-vsl" } });
      }
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { service: "calendly-rattachement-apporteur" } });
  }
  // ── L'attribution D'ORIGINE de la fiche (2026-10-10) ───────────────────────
  // Rattachée à une fiche née de la page vidéo, la réservation reprend son
  // annonce (`utm_content`) et ses UTM manquants, quel que soit le lien emprunté
  // (page « C'est noté », B1, rappels) — voir `attribution-fiche-video.ts`.
  // Best-effort strict : un échec laisse la réservation telle quelle.
  let attribution: AttributionFiche | null = null;
  if (ficheRattachee) {
    try {
      const fiche = await prisma.submission.findUnique({
        where: { id: ficheRattachee },
        select: { details: true },
      });
      attribution = fiche ? attributionDeLaFiche(fiche.details) : null;
      if (attribution) {
        const { ecrire, marqueurRemplace } = completerAttribution(
          {
            utmSource: (data["utmSource"] as string | undefined) ?? row.utmSource,
            utmMedium: (data["utmMedium"] as string | undefined) ?? row.utmMedium,
            utmCampaign: (data["utmCampaign"] as string | undefined) ?? row.utmCampaign,
            utmContent: colonnesTypeAbsentes
              ? null
              : ((data["utmContent"] as string | undefined) ?? row.utmContent),
          },
          attribution,
        );
        const { utmContent, ...autres } = ecrire;
        const maj: Record<string, unknown> = { ...autres };
        if (utmContent && !colonnesTypeAbsentes) maj["utmContent"] = utmContent;
        if (marqueurRemplace && maj["utmContent"]) {
          // Le marqueur du BOUTON n'est pas perdu : il reste lisible dans la charge brute.
          const brut = (data["rawPayload"] ?? row.rawPayload) as unknown;
          maj["rawPayload"] = {
            ...(brut && typeof brut === "object" && !Array.isArray(brut)
              ? (brut as Record<string, unknown>)
              : {}),
            _utmContentBouton: marqueurRemplace,
          } as never;
        }
        if (Object.keys(maj).length > 0) {
          await prisma.calendlyEvent.update({
            where: { id: eventId },
            data: maj,
            select: { id: true },
          });
        }
      }
    } catch (e) {
      Sentry.captureException(e, { tags: { service: "calendly-attribution-fiche" } });
    }
  }

  // `Schedule` (Meta, serveur) : seulement si la réservation est rattachée à une
  // fiche — c'est elle qui porte la réponse à la bannière, la source de la
  // campagne et le `fbclid` horodaté. Fail-soft, borné à 3 s, ne lève jamais.
  if (scheduleMetaAEmettre && ficheRattachee && inviteeEmail) {
    try {
      await envoyerScheduleApporteur({
        calendlyEventId: eventId,
        submissionId: ficheRattachee,
        email: inviteeEmail,
        nom: d.inviteeName ?? row.inviteeName,
        telephone: d.inviteePhone ?? row.inviteePhone,
      });
    } catch (e) {
      Sentry.captureException(e, { tags: { service: "calendly-schedule-meta" } });
    }
  }

  // `Call Booked` (serveur) : le libellé de campagne seulement, jamais une donnée
  // personnelle (règle de `plausible-serveur.ts`). Fail-soft, borné à 1,5 s.
  //
  // 🔴 2026-10-10 — SEULEMENT pour une réservation rattachée à une fiche née de la
  // PAGE VIDÉO : sous le chemin du tunnel (`VSL_MERCI_PATH`), une réservation
  // Indeed ou d'un ancien formulaire gonflait l'objectif de la campagne. Les
  // autres échanges apporteur n'ont pas d'objectif serveur ailleurs : rien.
  // `annonce` = l'utm_content d'ORIGINE de la fiche (un libellé, jamais une
  // donnée personnelle).
  if (callBookedAEmettre && attribution?.ficheVideo) {
    try {
      await emettreEvenementPlausible({
        nom: "Call Booked",
        chemin: VSL_MERCI_PATH,
        props: {
          source:
            (data["utmSource"] as string | undefined) ??
            row.utmSource ??
            attribution.utmSource ??
            "direct",
          origine: "serveur",
          ...(attribution.utmContent ? { annonce: attribution.utmContent } : {}),
        },
      });
    } catch (e) {
      Sentry.captureException(e, { tags: { service: "calendly-call-booked-serveur" } });
    }
  }

  // ── Réservation d'un échange apporteur : les messages d'attente s'arrêtent ──
  // (tunnel vidéo, règles R1/R2 de 03-MESSAGES-ET-DECISIONS) : une personne qui
  // a RÉSERVÉ ne reçoit plus « votre inscription n'est pas terminée », ni les
  // rappels J+2 / J+7. Fait ICI, avec l'adresse que Calendly CONFIRME, et pas au
  // rattachement : il doit valoir même si la personne n'a aucune fiche, ou une
  // fiche déjà rattachée à la main. Retire des tâches, n'en crée aucune ; une
  // annulation ultérieure du créneau ne les rétablit pas. Best-effort strict.
  if (
    inviteeEmail &&
    estRendezVousApporteur({
      eventTypeName: (data["eventTypeName"] as string | undefined) ?? row.eventTypeName,
      typeRendezVous,
    })
  ) {
    try {
      await annulerRelancesLeadApporteur(
        inviteeEmail,
        "Envoi annulé : un échange apporteur a été réservé.",
      );
    } catch (e) {
      Sentry.captureException(e, { tags: { service: "calendly-annuler-relances-apporteur" } });
    }
  }
  // Le nom et le type de RDV viennent de la ligne, complétés par ce que
  // l'enrichissement vient d'écrire. Sans eux, l'alerte disait seulement
  // « annulation » + un identifiant technique : illisible depuis un téléphone,
  // et il fallait ouvrir la console pour savoir DE QUEL rendez-vous il s'agit.
  const inviteeName = (data["inviteeName"] as string | undefined) ?? row.inviteeName ?? undefined;
  const eventName = (data["eventTypeName"] as string | undefined) ?? row.eventTypeName ?? undefined;
  // L'horaire le plus récent : celui que l'enrichissement vient d'écrire s'il a
  // bougé, sinon celui de la ligne.
  const occurredAt = (data["startTime"] as Date | undefined) ?? row.startTime;

  // ── Synchro CRM (lot L2) ────────────────────────────────────────────────────
  //
  // Émise sur TRANSITION seulement (`canceled` / `noShow` sont déjà des gardes
  // de changement d'état) : chaque émission porte un `event_id` neuf, donc
  // re-sonder toutes les 10 minutes une ligne déjà annulée dupliquerait
  // l'interaction dans la timeline CRM.
  //
  // Sans adresse d'invité, pas de clé de personne — rien ne part, exactement
  // comme dans `discover.ts` et `admin-calendly/actions.ts`.
  //
  // `syncCalendlyEventToCrm` ne lève jamais et n'appelle aucun réseau (l'émission
  // part par l'outbox) ; le try/catch reste par principe : un échec de synchro ne
  // doit pas faire passer un enrichissement réussi pour un échec.
  if ((canceled || noShow) && inviteeEmail) {
    try {
      await syncCalendlyEventToCrm({
        kind: canceled ? "canceled" : "no_show",
        subjectRef: `site:calendly_event:${eventId}`,
        sourceSlug: "calendly",
        ...(occurredAt ? { occurredAt } : {}),
        person: {
          email: inviteeEmail,
          fullName: inviteeName ?? null,
          phone: (data["inviteePhone"] as string | undefined) ?? row.inviteePhone ?? null,
        },
        payload: {
          eventTypeName: eventName ?? row.eventTypeName,
          typeRendezVous,
          besoin,
          reponses,
          source: "api_poll",
        },
      });
    } catch (e) {
      Sentry.captureException(e);
    }
  }

  // Alerte Telegram sur les deux évènements qu'on avait rendus détectables. Les
  // catégories existaient depuis l'ADR 0030 mais n'avaient AUCUN émetteur : sans
  // webhook, rien ne pouvait constater une annulation. Best-effort strict —
  // `notify()` ne throw pas, et un échec d'alerte ne doit pas faire passer un
  // enrichissement réussi pour un échec.
  if (canceled || rescheduled) {
    try {
      if (canceled) {
        await notify({
          category: "CALENDLY_INVITEE_CANCELED",
          payload: {
            eventUri: eventId,
            inviteeEmail,
            reason: "Annulation constatée côté Calendly",
            ...(inviteeName ? { inviteeName } : {}),
            ...(eventName ? { eventName } : {}),
            ...(row.startTime ? { eventStartTime: row.startTime.toISOString() } : {}),
          },
          // Une annulation ne doit être annoncée qu'une fois, même si
          // l'enrichissement est relancé à la main derrière.
          dedupKey: `cal-cancel-${eventId}`,
          dedupTtlSec: 86_400,
        });
      } else if (rescheduled && row.startTime && d.startTime) {
        await notify({
          category: "CALENDLY_INVITEE_RESCHEDULED",
          payload: {
            eventUri: eventId,
            inviteeEmail,
            oldStart: row.startTime.toISOString(),
            newStart: d.startTime.toISOString(),
            ...(inviteeName ? { inviteeName } : {}),
            ...(eventName ? { eventName } : {}),
          },
          dedupKey: `cal-resched-${eventId}-${d.startTime.toISOString()}`,
          dedupTtlSec: 86_400,
        });
      }
    } catch (e) {
      Sentry.captureException(e);
    }
  }

  return { ok: true, updatedFields, answersText: d.answersText };
}
