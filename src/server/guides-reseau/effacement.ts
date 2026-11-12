/**
 * DEMANDE D'EFFACEMENT reçue en message privé (lot PV-1 bis).
 *
 * 🔴 AUCUNE SUPPRESSION. Ce chemin passe par le module commun de mise à l'écart
 * (`ecarterPourDemandeEffacement`, origine `message-prive`), comme la route `/api/gdpr-erase` et la
 * console Lettre : opposition (plus de prospection), contacts de la page guide écartés, trace
 * `gdpr.erase.requested` (empreintes seulement) et alerte dans la CLOCHE de la console.
 * 🔑 PAS de marque « effacement demandé » ici : l'adresse vient du texte du message, rien ne prouve
 * qu'elle appartient à la personne qui écrit (un tiers couperait les convocations et factures
 * d'une stagiaire). Williams pose la marque après vérification, par le geste de console
 * « Mettre une adresse à l'écart » (origine `console`). Jamais d'e-mail d'alerte, jamais de Telegram. L'effacement lui-même est une
 * décision humaine.
 *
 * Idempotence : celle de `reception.ts` (clé d'idempotence + marque « alerte en file »), plus une
 * garde ici : la trace porte la clé, donc un rejeu après un échec tardif ne réécrit pas une
 * seconde trace.
 * Aucune lecture de la base de personnes : adresse connue ou non, la réponse est identique.
 * Aucune donnée de personne dans les journaux du serveur.
 */
import { prisma } from "@/lib/prisma";
import {
  ACTION_DEMANDE_EFFACEMENT,
  ecarterPourDemandeEffacement,
} from "@/server/rgpd/ecarter-au-lieu-d-effacer";
import { occurredAtValide, type DemandeEffacement } from "./contrat";

export interface ResultatEffacement {
  readonly ok: true;
  readonly type: "demande_effacement";
  readonly recue: true;
}

export interface CrochetsEffacement {
  /** Appelé dès que la demande est enregistrée : l'appelant écrit la marque d'idempotence. */
  readonly apresAlerte?: (r: ResultatEffacement) => Promise<void>;
}

export async function traiterEffacement(
  d: DemandeEffacement,
  maintenant: Date = new Date(),
  crochets: CrochetsEffacement = {},
): Promise<ResultatEffacement> {
  const quand = occurredAtValide(d.occurredAt, maintenant);

  // Rejeu d'une clé déjà tracée : la mise à l'écart est idempotente, on ne réécrit pas de trace.
  const dejaTracee = await prisma.activityLog.findFirst({
    where: {
      action: ACTION_DEMANDE_EFFACEMENT,
      targetType: "message_prive",
      // `target_id` est un UUID : la clé d'idempotence est gardée dans `changes.reference`.
      changes: { path: ["reference"], equals: d.cleIdempotence },
    },
    select: { changes: true },
  });
  // Une trace dont l'opposition n'a pas pu être posée ne ferme pas la demande : on recommence.
  // (La marque « effacement demandé » n'est PAS posée pour un message privé : l'adresse n'est
  // pas prouvée, Williams la pose en console après vérification.)
  const oppositionDejaPosee =
    dejaTracee !== null &&
    typeof dejaTracee.changes === "object" &&
    dejaTracee.changes !== null &&
    (dejaTracee.changes as Record<string, unknown>)["opposition"] === "ok";

  if (!oppositionDejaPosee) {
    const r = await ecarterPourDemandeEffacement({
      email: d.email,
      origine: "message-prive",
      motif: `réseau : ${d.reseau}`,
      cible: { type: "message_prive", id: d.cleIdempotence },
      maintenant: quand,
    });
    // Ni l'opposition ni la trace : la demande n'est pas enregistrée. On lève, la clé est
    // rendue, et le rejeu pourra recommencer.
    if (r.opposition !== "ok" || r.journalId === null) {
      throw new Error("[guides-reseau] mise à l'écart impossible");
    }
  }

  const resultat: ResultatEffacement = { ok: true, type: "demande_effacement", recue: true };
  await crochets.apresAlerte?.(resultat);
  console.warn(
    JSON.stringify({ event: "guides_reseau_effacement", reseau: d.reseau, alerte: "cloche" }),
  );
  return resultat;
}
