/**
 * Qualiopi — VERROU CONSULTATIF de l'émission des autofactures.
 *
 * 🔴 TROIS ÉMETTEURS, UNE SÉRIE LÉGALE. Le bouton « Émettre », le déclenchement
 * à la validation du relevé et le cron horaire de rattrapage passent tous par
 * `emettreAutofacture`. Sans sérialisation, deux d'entre eux lisent le même
 * relevé encore sans facture, lisent le même maximum de la série AXI-AUTOF, et
 * émettent deux PDF et deux e-mails portant le même numéro.
 *
 * ── POURQUOI UN VERROU DE SÉRIE, ET NON UN VERROU PAR RELEVÉ ────────────────
 *
 * Un verrou par relevé fermerait la double émission du MÊME relevé, pas le
 * doublon de numéro entre DEUX relevés : `numeroFacture` n'est pas unique en
 * base, donc aucune collision P2002 ne force la reprise que `nextNumero`
 * suppose chez les autres séries (cf. `numbering/allocate.ts`). Une seule clé
 * sérialise les deux : relecture du relevé, allocation du numéro, pièce,
 * écriture. Sans migration.
 *
 * Coût : les émissions d'autofactures passent une à une. Le volume est de
 * quelques pièces par mois ; le cron en tente au plus 25 par passage.
 *
 * `pg_try_advisory_xact_lock` en ATTENTE BORNÉE, jamais la variante bloquante :
 * l'attente compterait dans le délai de la transaction, et un rendu lent ferait
 * lever un émetteur qui n'a rien fait. Au-delà de l'attente, l'appelant le DIT
 * (bouton) ou reprend au passage suivant (cron).
 *
 * ⚠️ Le verrou est tenu par la connexion de la transaction ; le travail utilise
 * le client global, dont les écritures sont validées au fil de l'eau. C'est le
 * patron de `financements/verrou-facture-session.ts` : l'émetteur suivant, une
 * fois le verrou obtenu, relit donc bien le relevé écrit par le précédent.
 *
 * ⚠️ Si le travail dépasse le délai de la transaction, celle-ci lève alors que
 * l'écriture a pu aboutir. L'appelant ne conclut JAMAIS « rien n'a été écrit »
 * d'une exception : le relevé est relu sous verrou à l'essai suivant, et
 * l'éligibilité refuse un relevé déjà facturé.
 */

import { prisma } from "@/lib/prisma";

export const CLE_VERROU_EMISSION_AUTOFACTURE = "autofacture_emission";

/** Attente maximale du verrou avant de renoncer. */
export const ATTENTE_VERROU_AUTOFACTURE_MS = 15_000;
const PAS_ATTENTE_MS = 250;

/** Délai de la transaction qui porte le verrou : attente + rendu PDF + écriture. */
const DELAI_TRANSACTION_MS = ATTENTE_VERROU_AUTOFACTURE_MS + 120_000;

export type IssueVerrouAutofacture<T> = { acquis: true; valeur: T } | { acquis: false };

export async function avecVerrouEmissionAutofacture<T>(
  travail: () => Promise<T>,
): Promise<IssueVerrouAutofacture<T>> {
  return prisma.$transaction(
    async (tx) => {
      const limite = Date.now() + ATTENTE_VERROU_AUTOFACTURE_MS;
      for (;;) {
        const lignes = await tx.$queryRaw<Array<{ acquis: boolean }>>`
          SELECT pg_try_advisory_xact_lock(hashtext(${CLE_VERROU_EMISSION_AUTOFACTURE})) AS acquis`;
        if (lignes[0]?.acquis === true) break;
        if (Date.now() >= limite) return { acquis: false } as const;
        await new Promise((r) => setTimeout(r, PAS_ATTENTE_MS));
      }
      return { acquis: true, valeur: await travail() } as const;
    },
    { maxWait: 10_000, timeout: DELAI_TRANSACTION_MS },
  );
}
