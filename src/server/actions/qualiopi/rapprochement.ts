/**
 * Rapprochement bancaire Finom v1 — Server Action d'ANALYSE (lecture seule).
 *
 * `analyserReleveAction` parse un export CSV Finom (module pur
 * `financements/rapprochement.ts`), charge les factures OUVERTES (émise /
 * partiellement payée / en retard, hors avoirs) avec leur reste dû NET — MÊME
 * formule que le hub facturation (TTC ?? HT + avoirs négatifs − encaissements
 * succeeded) — puis retourne les suggestions de rapprochement.
 *
 * AUCUNE écriture ici : l'encaissement effectif passe par
 * `enregistrerPaiementFactureAction` (facturation-hub.ts), appelée par le
 * composant client ligne par ligne, avec confirmation. v1 sans persistance —
 * aucun changement de schéma.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import { STATUTS_FACTURE_OUVERTE } from "@/server/qualiopi/financements/statuts-facture";
import {
  parseFinomStatement,
  suggererRapprochements,
} from "@/server/qualiopi/financements/rapprochement";

/** Ligne de relevé sérialisée pour le client (date au format AAAA-MM-JJ). */
export interface LigneReleveDto {
  dateIso: string;
  contrepartie: string;
  reference: string | null;
  montantCents: number;
}

export interface SuggestionDto {
  ligne: LigneReleveDto;
  niveau: "exact" | "probable";
  facture: {
    id: string;
    numero: string;
    clientLabel: string;
    resteDuCents: number;
  };
}

export interface AnalyseReleveResult {
  /** Crédits avec une facture suggérée (exacts d'abord, puis probables). */
  suggestions: SuggestionDto[];
  /** Crédits sans correspondance parmi les factures ouvertes. */
  sansCorrespondance: LigneReleveDto[];
  /** Débits (sorties) — hors périmètre du rapprochement, restitués pour info. */
  debits: LigneReleveDto[];
  /** Erreurs de parsing ligne à ligne (1-indexées). */
  erreursParse: string[];
  /** Nombre de factures ouvertes considérées pour le matching. */
  nbFacturesOuvertes: number;
}

// 500 Ko de texte max — un relevé mensuel Finom TPE pèse quelques Ko.
const AnalyserReleveSchema = z.object({
  csvText: z.string().min(1).max(512_000),
});

export async function analyserReleveAction(
  rawInput: unknown,
): Promise<{ data: AnalyseReleveResult } | { error: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  await requireAdminWrite();
  const parsed = AnalyserReleveSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: "Entrée invalide (fichier vide ou trop volumineux — 500 Ko max)." };
  }

  const { lignes, erreurs } = parseFinomStatement(parsed.data.csvText);
  if (lignes.length === 0) {
    return {
      error:
        erreurs[0] ??
        "Aucun mouvement lisible dans ce fichier — vérifier qu'il s'agit bien d'un export Finom.",
    };
  }

  try {
    // Factures OUVERTES uniquement (une facture payée ou annulée n'attend plus
    // d'encaissement), hors avoirs. Reste dû NET : même formule que le hub.
    const facturesOuvertes = await prisma.factureFormation.findMany({
      where: {
        statut: { in: [...STATUTS_FACTURE_OUVERTE] },
        avoirDeId: null,
      },
      select: {
        id: true,
        numero: true,
        destinataireNom: true,
        montantTtcCents: true,
        montantHtCents: true,
        client: { select: { raisonSociale: true } },
        payments: { where: { status: "succeeded" }, select: { amountCents: true } },
        avoirs: {
          where: { statut: { not: "annulee" } },
          select: { montantTtcCents: true, montantHtCents: true },
        },
      },
    });

    const pourMatch = facturesOuvertes
      .map((f) => {
        const encaisse = f.payments.reduce((acc, p) => acc + p.amountCents, 0);
        const avoirsTtc = f.avoirs.reduce(
          (acc, a) => acc + (a.montantTtcCents ?? a.montantHtCents),
          0,
        );
        return {
          id: f.id,
          numero: f.numero,
          destinataireNom: f.destinataireNom,
          clientNom: f.client?.raisonSociale ?? null,
          resteDuCents: (f.montantTtcCents ?? f.montantHtCents) + avoirsTtc - encaisse,
        };
      })
      // Une créance déjà éteinte (avoir, trop-perçu) n'attend aucun crédit.
      .filter((f) => f.resteDuCents > 0);

    const credits = lignes.filter((l) => l.montantCents > 0);
    const debits = lignes.filter((l) => l.montantCents <= 0);
    const suggestions = suggererRapprochements(credits, pourMatch);

    const toDto = (l: (typeof lignes)[number]): LigneReleveDto => ({
      dateIso: l.date.toISOString().slice(0, 10),
      contrepartie: l.contrepartie,
      reference: l.reference,
      montantCents: l.montantCents,
    });

    const avecFacture: SuggestionDto[] = [];
    const sansCorrespondance: LigneReleveDto[] = [];
    for (const s of suggestions) {
      if (s.niveau === "aucune" || s.facture === null) {
        sansCorrespondance.push(toDto(s.ligne));
        continue;
      }
      avecFacture.push({
        ligne: toDto(s.ligne),
        niveau: s.niveau,
        facture: {
          id: s.facture.id,
          numero: s.facture.numero,
          clientLabel: s.facture.clientNom ?? s.facture.destinataireNom ?? "Client inconnu",
          resteDuCents: s.facture.resteDuCents,
        },
      });
    }

    return {
      data: {
        suggestions: avecFacture,
        sansCorrespondance,
        debits: debits.map(toDto),
        erreursParse: erreurs,
        nbFacturesOuvertes: pourMatch.length,
      },
    };
  } catch {
    // Message métier, jamais err.message brut : l'analyse est une lecture,
    // l'échec est réessayable tel quel.
    return { error: "Analyse impossible — réessayer, ou vérifier le fichier exporté." };
  }
}
