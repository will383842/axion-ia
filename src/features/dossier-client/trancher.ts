/**
 * « Garder cette valeur » : Will tranche une information « à trancher »
 * (chantier visio, V1-02).
 *
 * Deux valeurs validées différentes pour une information unique (budget,
 * effectif, échéance…) restent « à trancher » : `consoliderFaits` n'en choisit
 * aucune en silence. Ce geste dit laquelle vaut : les AUTRES faits validés du
 * même (type, clé, portée, projet) du même client reçoivent
 * `remplaceParId = <fait gardé>`, chacun avec un `FaitEvenement(remplace)`,
 * dans une seule transaction. Le contenu des faits ne change pas (trigger
 * `faits_contenu_immuable` : `remplace_par_id` est une colonne de cycle de vie).
 *
 * Le fait gardé doit être validé et encore vivant (non remplacé) : un second
 * clic sur une page périmée est refusé au lieu de tout rendre « à reconfirmer ».
 * La mise à jour conditionnelle du fait gardé pose le verrou de ligne qui
 * sérialise deux clics simultanés.
 *
 * Module neutre.
 */

import type { BaseTransactionnelle } from "./base";
import { TYPES_DE_FAITS } from "@/server/visio/types-de-faits";

export class ErreurTrancher extends Error {}

export interface EntreeTrancher {
  readonly faitId: string;
  readonly parAdminId: string | null;
}

export interface ResultatTrancher {
  readonly clientId: string;
  readonly remplaces: number;
}

export async function garderCetteValeur(
  db: BaseTransactionnelle,
  e: EntreeTrancher,
): Promise<ResultatTrancher> {
  return db.$transaction(async (tx) => {
    const garde = await tx.fait.findUnique({
      where: { id: e.faitId },
      select: {
        id: true,
        clientId: true,
        portee: true,
        projetId: true,
        type: true,
        cle: true,
        statut: true,
        remplaceParId: true,
      },
    });
    if (garde === null) throw new ErreurTrancher("Information introuvable.");
    if (garde.clientId === null || garde.portee === "a_ranger") {
      throw new ErreurTrancher("Cette information n'est pas encore rangée.");
    }
    if (TYPES_DE_FAITS[garde.type].cardinalite !== "unique") {
      throw new ErreurTrancher("Cette information accepte plusieurs valeurs : rien à trancher.");
    }
    // Verrou et contrôle en une écriture : la valeur gardée est encore vivante.
    const vivant = await tx.fait.updateMany({
      where: { id: garde.id, statut: "valide", remplaceParId: null },
      data: { remplaceParId: null },
    });
    if (vivant.count !== 1) {
      throw new ErreurTrancher("Cette valeur a déjà été remplacée : rechargez la page.");
    }

    const autres = await tx.fait.findMany({
      where: {
        clientId: garde.clientId,
        portee: garde.portee,
        projetId: garde.projetId,
        type: garde.type,
        cle: garde.cle,
        statut: "valide",
        remplaceParId: null,
        id: { not: garde.id },
      },
      select: { id: true },
    });
    for (const f of autres) {
      await tx.fait.update({ where: { id: f.id }, data: { remplaceParId: garde.id } });
      await tx.faitEvenement.create({
        data: { faitId: f.id, action: "remplace", parAdminId: e.parAdminId },
      });
    }
    return { clientId: garde.clientId, remplaces: autres.length };
  });
}
