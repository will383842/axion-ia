/**
 * LA lecture des faits d'un client — une seule, pour la console (fiche,
 * « Préparer », page du projet) comme pour le worker (questionnaire P6).
 *
 * Elle reçoit SON client Prisma : la console passe `prisma`, le worker le
 * sien. Mêmes colonnes, même déchiffrement (`dechiffrerParole` seulement), et
 * la même règle RGPD : un fait EFFACÉ n'a plus d'énoncé ni de texte court,
 * quel que soit le lecteur. Une divergence de cette règle entre deux copies
 * ne se verrait pas au compilateur — d'où ce module unique (garde
 * `__tests__/un-fait-efface-n-a-plus-d-enonce-pour-aucun-lecteur.spec.ts`).
 *
 * ⚠️ Ne vérifie pas le rôle : appelée APRÈS la garde côté console.
 */

import type { FaitStatut, PrismaClient } from "../../../prisma/generated/client";
import { dechiffrerParole } from "@/lib/chiffrer-parole";
import type { FaitAConsolider } from "@/features/dossier-client/consolider-faits";

export const TEXTE_ILLISIBLE = "(illisible : clé de chiffrement absente)";

export interface FaitLu extends FaitAConsolider {
  readonly citationVerifiee: boolean;
  readonly contactLocuteurId: string | null;
}

export interface OptionsLectureFaits {
  /** Les statuts lus (la console lit aussi les proposés ; le worker, les validés seuls). */
  readonly statuts: ReadonlyArray<FaitStatut>;
  /**
   * Ce qu'on met à la place d'une parole indéchiffrable : « (illisible…) »
   * à l'écran, rien (`""`) dans une entrée envoyée à l'IA.
   */
  readonly illisible: string;
}

function dechiffrerOu(v: string | null, illisible: string): string | null {
  if (v === null) return null;
  try {
    return dechiffrerParole(v);
  } catch {
    return illisible;
  }
}

export async function lireFaitsDUnClient(
  db: Pick<PrismaClient, "fait">,
  clientId: string,
  o: OptionsLectureFaits,
): Promise<FaitLu[]> {
  const lignes = await db.fait.findMany({
    where: { clientId, statut: { in: [...o.statuts] } },
    select: {
      id: true,
      type: true,
      cle: true,
      portee: true,
      projetId: true,
      statut: true,
      suivi: true,
      enonce: true,
      texteCourt: true,
      montantMinCents: true,
      montantMaxCents: true,
      dateCible: true,
      quantite: true,
      refCatalogue: true,
      constateLe: true,
      citationDebutMs: true,
      rencontreId: true,
      contactSujetId: true,
      contactLocuteurId: true,
      relation: true,
      relationAvecFaitId: true,
      remplaceParId: true,
      citationVerifiee: true,
    },
    orderBy: { constateLe: "desc" },
  });
  return lignes.map((l) => {
    const efface = l.statut === "efface";
    const texteCourt = efface ? null : dechiffrerOu(l.texteCourt, o.illisible);
    return {
      ...l,
      enonce: efface ? "" : (dechiffrerOu(l.enonce, o.illisible) ?? ""),
      texteCourt: texteCourt === "" ? null : texteCourt,
    };
  });
}
