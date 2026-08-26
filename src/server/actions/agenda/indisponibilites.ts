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
import { z } from "zod";
import { requireAdminWrite } from "@/server/actions/backups/_guards";
import {
  poserIndisponibilite,
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

/** Rafraîchit la page d'agenda après une écriture réussie. */
function rafraichir(): void {
  revalidatePath(adminPath("fr", "agenda"));
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
      "Indisponibilité posée. La réservation en ligne se ferme sur cette plage en quelques secondes.",
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
    message: "Indisponibilité retirée. Les créneaux rouvrent en quelques secondes.",
  };
}
