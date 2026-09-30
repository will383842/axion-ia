/**
 * L'ÉTAT d'un e-mail de suivi, tel que Will le lit (chantier visio, PR 7) —
 * source unique de l'onglet Échanges et de la vue « E-mail de suivi ».
 *
 * Quand la ligne `email_suivi` pointe un `email_outbox`, l'état est CELUI de
 * la file (à valider, validé, envoyé, écarté). Sans `email_outbox`, trois cas
 * très différents se cachent derrière le même `null`, et on ne les confond
 * pas :
 *
 *   · « en préparation » — la demande que l'étape `email_suivi` est en train
 *     de rédiger (à faire, en cours, suspendue) ;
 *   · « rédaction échouée » — l'étape a échoué définitivement : rien ne
 *     partira de cette demande, Will utilise le modèle fixe (qui REPREND
 *     cette ligne, `emailSuiviGabaritFixe`) ;
 *   · « retiré de la file » — l'e-mail est sorti de `email_outbox` (purge de
 *     rétention, effacement RGPD : `onDelete: SetNull`), ou la demande a été
 *     annulée.
 *
 * Seule la demande la PLUS RÉCENTE sans e-mail est celle que l'étape rédige
 * (`pourEmail` du worker lit la même) : une ligne plus ancienne sans e-mail
 * a forcément été retirée de la file.
 *
 * Module PUR.
 */

import type { EmailOutboxStatus, StatutEtape } from "../../../prisma/generated/client";

export type EtatEmailSuivi =
  EmailOutboxStatus | "en_preparation" | "redaction_echouee" | "retire_de_la_file";

export const LIBELLE_ETAT_EMAIL_SUIVI = {
  a_valider: "à valider dans la file des e-mails",
  approuve: "validé, en cours d'envoi",
  envoye: "envoyé",
  refuse: "écarté",
  en_preparation: "en préparation",
  redaction_echouee: "rédaction automatique échouée : utilisez le modèle fixe",
  retire_de_la_file: "retiré de la file",
} as const satisfies Record<EtatEmailSuivi, string>;

const ETAPE_EN_VOL: ReadonlySet<StatutEtape> = new Set(["a_faire", "en_cours", "suspendu"]);

/** L'état d'une demande SANS e-mail, lu dans l'étape `email_suivi` de la rencontre. */
function etatSansEmail(etape: StatutEtape | null): EtatEmailSuivi {
  if (etape !== null && ETAPE_EN_VOL.has(etape)) return "en_preparation";
  if (etape === "echec_definitif") return "redaction_echouee";
  return "retire_de_la_file";
}

/**
 * Les états des e-mails de suivi d'UNE rencontre, dans l'ordre reçu (le plus
 * récent d'abord). `etape` : le statut de l'étape `email_suivi`, `null` si
 * aucune.
 */
export function etatsDesEmailsSuivi(
  lignes: ReadonlyArray<{ readonly statut: EmailOutboxStatus | null; readonly creeLe: Date }>,
  etape: StatutEtape | null,
): EtatEmailSuivi[] {
  const sansEmail = lignes.filter((l) => l.statut === null);
  const plusRecente = sansEmail.reduce<(typeof lignes)[number] | null>(
    (m, l) => (m === null || l.creeLe.getTime() > m.creeLe.getTime() ? l : m),
    null,
  );
  return lignes.map((l) => {
    if (l.statut !== null) return l.statut;
    return l === plusRecente ? etatSansEmail(etape) : "retire_de_la_file";
  });
}
