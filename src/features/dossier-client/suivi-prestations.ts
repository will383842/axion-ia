/**
 * Lecture du suivi d'une prestation (`projet_suivis`, étape 3). Une prestation = un `Projet`.
 * Les projets, leurs statuts et leurs devis viennent de `lireProjetsDuClient` (déjà lu par la
 * page) ; ici on n'ajoute que ce que Will a noté : le type, l'étape forcée, le montant.
 */

import { prisma } from "@/lib/prisma";
import {
  estTypePrestation,
  etapeAffichee,
  type EtapePrestation,
  type TypePrestation,
} from "@/features/dossier-client/prestations";

export interface SuiviLu {
  readonly type: string;
  readonly etapeForcee: string | null;
  readonly montantCents: number | null;
  /** 0 à 100 ; absent ou `null` : non estimées. */
  readonly probabilitePct?: number | null;
  /** Jour AAAA-MM-JJ ; absent ou `null` : non estimée. */
  readonly cloturePrevueLe?: string | null;
}

export interface PrestationSuivie {
  readonly projetId: string;
  readonly numero: string;
  readonly titre: string;
  /** NULL : le type n'a pas encore été choisi. */
  readonly type: TypePrestation | null;
  readonly etape: EtapePrestation;
  readonly etapeForcee: boolean;
  readonly montantCents: number | null;
  readonly probabilitePct: number | null;
  readonly cloturePrevueLe: string | null;
}

/** PUR : projets (avec statuts de devis) + suivis notés -> ce que le client a pris. */
export function assemblerPrestations(
  projets: ReadonlyArray<{
    id: string;
    numero: string;
    titre: string;
    statut: string;
    devis: ReadonlyArray<{ statut: string }>;
  }>,
  suivis: ReadonlyMap<string, SuiviLu>,
): PrestationSuivie[] {
  return projets.map((p) => {
    const s = suivis.get(p.id);
    const { etape, forcee } = etapeAffichee(
      s?.etapeForcee ?? null,
      p.statut,
      p.devis.map((d) => d.statut),
    );
    return {
      projetId: p.id,
      numero: p.numero,
      titre: p.titre,
      type: estTypePrestation(s?.type) ? s.type : null,
      etape,
      etapeForcee: forcee,
      montantCents: s?.montantCents ?? null,
      probabilitePct: s?.probabilitePct ?? null,
      cloturePrevueLe: s?.cloturePrevueLe ?? null,
    };
  });
}

/**
 * Les suivis notés pour ces projets. Une panne de lecture (base de build, table pas encore migrée)
 * rend `null` : la fiche s'affiche sans le bloc, jamais en erreur.
 */
export async function lireSuivisDesProjets(
  projetIds: ReadonlyArray<string>,
): Promise<ReadonlyMap<string, SuiviLu> | null> {
  if (projetIds.length === 0) return new Map();
  try {
    const lignes = await prisma.projetSuivi.findMany({
      where: { projetId: { in: [...projetIds] } },
      select: {
        projetId: true,
        type: true,
        etapeForcee: true,
        montantCents: true,
        probabilitePct: true,
        cloturePrevueLe: true,
      },
    });
    return new Map(
      lignes.map((l) => [
        l.projetId,
        {
          type: l.type,
          etapeForcee: l.etapeForcee,
          montantCents: l.montantCents,
          probabilitePct: l.probabilitePct,
          cloturePrevueLe: l.cloturePrevueLe?.toISOString().slice(0, 10) ?? null,
        },
      ]),
    );
  } catch {
    return null;
  }
}
