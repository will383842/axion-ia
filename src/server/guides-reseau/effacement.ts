/**
 * DEMANDE D'EFFACEMENT reçue en message privé (lot PV-1 bis).
 *
 * 🔴 AUCUNE SUPPRESSION. Ce chemin fait deux choses, et seulement deux :
 *   1. l'adresse est mise À L'ÉCART des envois — le mécanisme d'opposition existant
 *      (`enregistrerOppositionPourAdresse` : empreinte, CRM, relances programmées retirées) —
 *      et ses contacts de la page guide passent à `merci_statut = 'ecarte'` ;
 *   2. UNE alerte e-mail part vers l'opérateur (`destinataireAlertesInternes`), adresse MASQUÉE
 *      par `redactEmail`. L'effacement lui-même est une décision humaine.
 *
 * Aucune lecture de la base de personnes : adresse connue ou non, la réponse et l'alerte sont
 * identiques (rien de révélateur). Aucune donnée de personne dans les journaux, pas même masquée.
 * L'idempotence est celle de `reception.ts` (clé d'idempotence + marque « e-mail en file »).
 * Gabarit réutilisé : `qualiopi-alerte-interne` — aucun nouveau gabarit, donc aucun écart entre
 * les deux conteneurs (app / worker).
 */
import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { redactEmail } from "@/lib/pii-redaction";
import { enregistrerOppositionPourAdresse } from "@/server/email/opposition";
import { enqueueEmail } from "@/server/queue/queues";
import { mettreContactsAEcart } from "./mise-a-l-ecart";
import { occurredAtValide, type DemandeEffacement } from "./contrat";

export const ORIGINE_OPPOSITION_EFFACEMENT = "message-prive-effacement";

export interface ResultatEffacement {
  readonly ok: true;
  readonly type: "demande_effacement";
  readonly recue: true;
}

export interface CrochetsEffacement {
  /** Appelé dès que l'alerte est en file : l'appelant écrit la marque d'idempotence. */
  readonly apresAlerte?: (r: ResultatEffacement) => Promise<void>;
}

export async function traiterEffacement(
  d: DemandeEffacement,
  maintenant: Date = new Date(),
  crochets: CrochetsEffacement = {},
): Promise<ResultatEffacement> {
  // 1. Mise à l'écart (idempotent). Un échec lève : rien n'est parti, la clé est rendue.
  const ecartee = await enregistrerOppositionPourAdresse(d.email, {
    origine: ORIGINE_OPPOSITION_EFFACEMENT,
  });
  if (!ecartee.ok) throw new Error("[guides-reseau] mise à l'écart impossible");
  // Les contacts de la page guide passent à « ecarte » (jamais supprimés ; rejeu sans effet).
  await mettreContactsAEcart(d.email);

  // 2. UNE alerte, adresse masquée. jobId = clé d'idempotence : doublon file impossible.
  const quand = occurredAtValide(d.occurredAt, maintenant).toISOString();
  const envoi = await enqueueEmail(
    "qualiopi-alerte-interne",
    destinataireAlertesInternes(),
    "fr",
    {
      niveau: "important",
      code: "DEMANDE_EFFACEMENT_MESSAGE_PRIVE",
      titre: "Demande d'effacement reçue en message privé",
      message:
        `Réseau : ${d.reseau}. Adresse : ${redactEmail(d.email)}. Reçue le ${quand}. ` +
        "L'adresse est déjà écartée des envois. Aucune donnée n'a été supprimée : " +
        "l'effacement reste à traiter par l'opérateur.",
      createdAt: quand,
    },
    { jobId: `guides-reseau-effacement-${d.cleIdempotence}` },
  );
  if (envoi.enqueued !== true && envoi.garePourValidation !== true) {
    throw new Error("[guides-reseau] alerte non mise en file");
  }

  const resultat: ResultatEffacement = { ok: true, type: "demande_effacement", recue: true };
  await crochets.apresAlerte?.(resultat);
  console.warn(
    JSON.stringify({ event: "guides_reseau_effacement", reseau: d.reseau, alerte: "en_file" }),
  );
  return resultat;
}
