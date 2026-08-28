/**
 * Poser et retirer une indisponibilité depuis la console (2026-08-26).
 *
 * L'action écrit dans l'agenda Google, et c'est TOUT — elle ne parle jamais à
 * Calendly. Elle n'en a pas besoin : un événement occupé posé dans cet agenda
 * ferme le créneau correspondant chez Calendly en 11 secondes (mesuré le
 * 2026-08-26, événement témoin à l'appui). Le jeton Calendly n'a de toute façon
 * pas le périmètre d'écriture.
 *
 * 🔴 LE CALCUL QUE L'UTILISATEUR NE DOIT PAS AVOIR À FAIRE.
 * Calendly ferme aussi le créneau ADJACENT à un événement occupé. Demander
 * « ferme après 12 h » et poser le blocage à 12:00 supprime le créneau de 11:30,
 * qui finit pourtant pile à midi. `depuisFinDeCreneau` prend l'heure telle que
 * l'humain la pense — « le dernier créneau se termine à 12 h » — et laisse
 * `debutBlocageApres()` décaler le blocage du battement mesuré. L'interface
 * parle donc en langage humain, et personne n'a à redécouvrir ce piège en
 * constatant qu'il lui manque un créneau.
 */

"use server";

import { revalidatePath } from "next/cache";
import { invaliderCreneaux } from "@/server/calendly/revalider-creneaux";
import { z } from "zod";
import { requireAdminWrite } from "@/server/actions/backups/_guards";
import {
  poserIndisponibilite,
  creerRendezVous,
  modifierEvenement,
  retirerEvenement,
  listerEvenements,
  debutBlocageApres,
  MARQUEUR_CONSOLE,
} from "@/server/google-calendar/events";
import { adminPath } from "@/lib/admin-path";

/** Ce que l'interface renvoie — jamais une exception, toujours une phrase. */
export interface ResultatAction {
  readonly ok: boolean;
  /** Message destiné à l'écran, en français, qui dit quoi faire le cas échéant. */
  readonly message: string;
}

const SchemaPoser = z.object({
  titre: z.string().trim().min(1).max(120),
  /** Instant de début, ISO. */
  debutIso: z.string().datetime(),
  /** Instant de fin, ISO. */
  finIso: z.string().datetime(),
  /**
   * Quand vrai, `debutIso` désigne la FIN DU DERNIER CRÉNEAU À CONSERVER, et le
   * blocage réel est décalé du battement Calendly. C'est le mode « ferme après
   * 12 h » — celui que l'interface utilise par défaut.
   */
  depuisFinDeCreneau: z.boolean().default(false),
  note: z.string().trim().max(500).optional(),
});

/**
 * Traduit une cause technique en phrase actionnable.
 *
 * Un code d'erreur brut renvoie l'utilisateur vers un développeur. Ces
 * phrases-là disent ce qui manque et où le poser — en particulier `forbidden`,
 * de loin l'échec le plus probable à la mise en service, et dont la cause est
 * un partage d'agenda non fait plutôt qu'une panne.
 */
function phrasePour(reason: string): string {
  switch (reason) {
    case "not_configured":
      return "L'agenda Google n'est pas encore connecté à la console. Il manque les trois variables GOOGLE_CALENDAR_* dans Coolify.";
    case "forbidden":
      return "Le compte de service n'a pas le droit d'écrire dans cet agenda. Dans Google Agenda, partagez-le avec son adresse en « Apporter des modifications aux événements ».";
    case "bad_private_key":
      return "La clé privée Google n'est pas exploitable — vérifiez GOOGLE_CALENDAR_PRIVATE_KEY (les sauts de ligne ont pu être perdus au copier-coller).";
    case "rejected":
      return "Google a refusé l'authentification du compte de service. La clé a peut-être été révoquée.";
    default:
      return "L'agenda Google n'a pas répondu. Réessayez dans un instant — rien n'a été écrit.";
  }
}

/**
 * Rafraîchit ce qui dépend de l'agenda après une écriture réussie.
 *
 * 🔴 CETTE FONCTION NE RAFRAÎCHISSAIT QUE LA CONSOLE — corrigé le 2026-08-27.
 *
 * `creerRendezVousAction` affiche à l'écran, en toutes lettres : « Rendez-vous
 * ajouté. Le créneau se ferme à la réservation en ligne **dans la minute**. »
 * C'était faux. Les quatre actions ne revalidaient que `admin/agenda` : le site
 * public continuait de vendre le créneau que l'exploitant venait de bloquer,
 * jusqu'au passage du cron.
 *
 * Le scénario qui a déclenché tout l'audit — « un rendez-vous posé à la main
 * ferme le créneau chez Calendly sans que personne nous prévienne » — était donc
 * reproduit **depuis l'intérieur de notre propre produit**, avec une promesse
 * imprimée à l'écran.
 *
 * ⚠️ POURQUOI UNE INVALIDATION IMMÉDIATE NE SUFFIT PAS, ET POURQUOI ON N'EN
 * AJOUTE PAS UNE DIFFÉRÉE ICI. Google met ~11 secondes à propager la fermeture
 * vers Calendly (mesuré le 2026-08-26). Invalider à t=0 recharge donc la liste
 * d'AVANT et la remet en cache pour deux minutes — l'invalidation immédiate
 * rendrait le décalage PIRE que de ne rien faire, si elle était seule.
 *
 * Elle ne l'est pas : le cron `revalidate-slots` repasse toutes les 2 minutes.
 * L'invalidation immédiate sert le cas où l'exploitant recharge tout de suite
 * (il verra son blocage pris en compte au passage suivant, pas au sien), et le
 * cron ferme la fenêtre. Ajouter ici un job différé donnerait un troisième
 * chemin d'invalidation à maintenir pour gagner ~90 secondes sur un geste
 * d'administration : pas le bon compromis.
 *
 * `invaliderCreneaux` ne throw jamais — une écriture d'agenda réussie ne doit
 * pas échouer parce qu'un cache a résisté.
 */
function rafraichir(): void {
  revalidatePath(adminPath("fr", "agenda"));
  invaliderCreneaux("console-agenda");
}

export async function poserIndisponibiliteAction(input: unknown): Promise<ResultatAction> {
  await requireAdminWrite();

  const parsed = SchemaPoser.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Les dates saisies ne sont pas valides." };
  }
  const { titre, debutIso, finIso, depuisFinDeCreneau, note } = parsed.data;

  const debutDemande = new Date(debutIso);
  const fin = new Date(finIso);
  const debut = depuisFinDeCreneau ? debutBlocageApres(debutDemande) : debutDemande;

  if (fin.getTime() <= debut.getTime()) {
    return { ok: false, message: "La fin doit être après le début." };
  }

  const res = await poserIndisponibilite({
    titre,
    debut,
    fin,
    ...(note ? { note } : {}),
  });

  if (!res.ok) return { ok: false, message: phrasePour(res.reason) };

  rafraichir();
  return {
    ok: true,
    message:
      "Indisponibilité posée. La réservation en ligne se ferme sur cette plage en moins de deux minutes.",
  };
}

const SchemaRetirer = z.object({ eventId: z.string().trim().min(1).max(200) });

/**
 * Retire une indisponibilité posée depuis la console.
 *
 * 🔴 LA GARDE N'EST PAS DÉCORATIVE. On relit l'événement et on VÉRIFIE qu'il
 * porte le marqueur avant de supprimer. Sans elle, un identifiant fabriqué à la
 * main — ou une erreur de rendu — supprimerait un vrai rendez-vous de l'agenda
 * de Will, et une suppression d'agenda ne se rattrape pas. La console n'a aucune
 * raison légitime de supprimer autre chose que ce qu'elle a elle-même posé.
 */
export async function retirerIndisponibiliteAction(input: unknown): Promise<ResultatAction> {
  await requireAdminWrite();

  const parsed = SchemaRetirer.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Identifiant d'événement invalide." };
  const { eventId } = parsed.data;

  // Fenêtre large autour d'aujourd'hui : l'événement visé y est forcément, et on
  // évite de demander à l'appelant une date qu'il pourrait se tromper à fournir.
  const maintenant = Date.now();
  const lecture = await listerEvenements(
    new Date(maintenant - 90 * 86_400_000).toISOString(),
    new Date(maintenant + 365 * 86_400_000).toISOString(),
  );
  if (!lecture.ok) return { ok: false, message: phrasePour(lecture.reason) };

  const cible = lecture.events.find((e) => e.id === eventId);
  if (!cible) {
    return { ok: false, message: "Cet événement n'existe plus dans l'agenda." };
  }
  if (!cible.description?.includes(MARQUEUR_CONSOLE)) {
    return {
      ok: false,
      message:
        "Cet événement n'a pas été posé depuis la console — supprimez-le directement dans Google Agenda si c'est bien votre intention.",
    };
  }

  const res = await retirerEvenement(eventId);
  if (!res.ok) return { ok: false, message: phrasePour(res.reason) };

  rafraichir();
  return {
    ok: true,
    message: "Indisponibilité retirée. Les créneaux rouvrent en moins de deux minutes.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendez-vous : créer, modifier (2026-08-27)
// ─────────────────────────────────────────────────────────────────────────────
//
// 🔴 CE QUE LA CONSOLE PEUT ÉCRIRE, ET CE QU'ELLE NE DOIT JAMAIS TOUCHER.
//
// Elle écrit dans l'agenda Google, jamais dans Calendly — qui n'expose AUCUNE
// API de création de réservation, et dont notre jeton est de toute façon en
// lecture seule. Ce n'est pas une limite gênante : un événement occupé posé dans
// Google ferme le créneau Calendly correspondant en une dizaine de secondes.
// Une seule écriture tient donc les deux bouts.
//
// En revanche, un rendez-vous VENU de Calendly ne se modifie ni ne se supprime
// ici. Le supprimer de Google ne l'annulerait pas côté Calendly : l'invité
// garderait son rendez-vous, recevrait ses rappels, et se présenterait à
// l'heure dite pendant que la console afficherait un créneau libre. C'est la
// panne la plus coûteuse possible pour un agenda — deux personnes qui n'ont pas
// la même vérité. La garde `MARQUEUR_CONSOLE` est donc la même que pour la
// suppression, et le message renvoie vers la page d'annulation Calendly, seule
// voie qui prévient réellement l'invité.

const SchemaCreerRdv = z.object({
  titre: z.string().trim().min(1).max(120),
  debutIso: z.string().datetime(),
  finIso: z.string().datetime(),
  contact: z.string().trim().max(120).optional(),
  telephone: z.string().trim().max(40).optional(),
  note: z.string().trim().max(500).optional(),
});

const SchemaModifier = z.object({
  eventId: z.string().trim().min(1).max(200),
  titre: z.string().trim().min(1).max(120),
  debutIso: z.string().datetime(),
  finIso: z.string().datetime(),
  contact: z.string().trim().max(120).optional(),
  telephone: z.string().trim().max(40).optional(),
  note: z.string().trim().max(500).optional(),
});

/**
 * Retrouve un événement de l'agenda et vérifie qu'il vient bien de la console.
 *
 * Mutualisé entre modification et suppression : la garde ne vaut que si elle est
 * IDENTIQUE aux deux endroits. Deux copies divergent — c'est ainsi qu'un jour
 * l'une des deux oublie de vérifier.
 */
async function trouverEvenementModifiable(
  eventId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const maintenant = Date.now();
  const lecture = await listerEvenements(
    new Date(maintenant - 90 * 86_400_000).toISOString(),
    new Date(maintenant + 365 * 86_400_000).toISOString(),
  );
  if (!lecture.ok) return { ok: false, message: phrasePour(lecture.reason) };

  const cible = lecture.events.find((e) => e.id === eventId);
  if (!cible) return { ok: false, message: "Cet événement n'existe plus dans l'agenda." };

  if (cible.fromCalendly) {
    return {
      ok: false,
      message:
        "Ce rendez-vous vient de la réservation en ligne. Le modifier ici ne préviendrait pas la personne : utilisez la page de report Calendly, depuis sa fiche.",
    };
  }
  if (!cible.description?.includes(MARQUEUR_CONSOLE)) {
    return {
      ok: false,
      message:
        "Cet événement n'a pas été posé depuis la console — modifiez-le directement dans Google Agenda si c'est bien votre intention.",
    };
  }
  return { ok: true };
}

/** Crée un vrai rendez-vous dans l'agenda. Ferme le créneau Calendly au passage. */
export async function creerRendezVousAction(input: unknown): Promise<ResultatAction> {
  await requireAdminWrite();

  const parsed = SchemaCreerRdv.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Saisie invalide : vérifiez le titre et les horaires." };
  }
  const { titre, debutIso, finIso, contact, telephone, note } = parsed.data;
  const debut = new Date(debutIso);
  const fin = new Date(finIso);
  // Une fin antérieure au début produirait un événement que Google refuse, avec
  // un message technique. On le dit ici, en français, avant d'appeler.
  if (fin.getTime() <= debut.getTime()) {
    return { ok: false, message: "La fin doit être postérieure au début." };
  }

  const res = await creerRendezVous({
    titre,
    debut,
    fin,
    ...(contact ? { contact } : {}),
    ...(telephone ? { telephone } : {}),
    ...(note ? { note } : {}),
  });
  if (!res.ok) return { ok: false, message: phrasePour(res.reason) };

  rafraichir();
  return {
    ok: true,
    // 🔴 Disait « dans la minute ». C'était faux deux fois : rien n'invalidait
    // le site public, et même une fois branché, Google met ~11 s à propager vers
    // Calendly puis le cron repasse toutes les 2 min. On annonce la borne haute
    // MESURÉE, pas l'intention — une promesse d'interface est un contrat.
    message:
      "Rendez-vous ajouté. Le créneau se ferme à la réservation en ligne en moins de deux minutes.",
  };
}

/** Modifie un événement posé depuis la console — horaire, titre, contact ou note. */
export async function modifierEvenementAction(input: unknown): Promise<ResultatAction> {
  await requireAdminWrite();

  const parsed = SchemaModifier.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Saisie invalide : vérifiez le titre et les horaires." };
  }
  const { eventId, titre, debutIso, finIso, contact, telephone, note } = parsed.data;
  const debut = new Date(debutIso);
  const fin = new Date(finIso);
  if (fin.getTime() <= debut.getTime()) {
    return { ok: false, message: "La fin doit être postérieure au début." };
  }

  const garde = await trouverEvenementModifiable(eventId);
  if (!garde.ok) return { ok: false, message: garde.message };

  const res = await modifierEvenement(eventId, {
    titre,
    debut,
    fin,
    phrase:
      "Rendez-vous posé depuis la console Axion-IA. Il ferme la réservation en ligne sur ce créneau.",
    ...(contact ? { contact } : {}),
    ...(telephone ? { telephone } : {}),
    ...(note ? { note } : {}),
  });
  if (!res.ok) return { ok: false, message: phrasePour(res.reason) };

  rafraichir();
  return { ok: true, message: "Rendez-vous modifié. L'agenda et la réservation en ligne suivent." };
}
