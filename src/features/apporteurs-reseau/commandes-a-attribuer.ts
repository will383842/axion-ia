// Réseau d'apporteurs — la liste « Commandes à attribuer » de la console (contrat 2.6, art. 3.1 ;
// relecture de a1, 09/10/2026). Une commande soldée dont l'établissement ne correspond à aucune
// attribution exacte attend le choix de Williams, sous 15 jours de l'encaissement.

import "server-only";

import { prisma } from "@/lib/prisma";

import { lireEtablissements } from "./etablissement-presentation";
import { nomComplet } from "./presentations";

export interface CandidatVue {
  presentationId: string;
  apporteur: string;
  perimetre: string;
}

export interface CommandeAAttribuerVue {
  factureId: string;
  numero: string | null;
  montantHtCents: number | null;
  denomination: string;
  siren: string;
  siret: string | null;
  creeAt: Date;
  candidats: CandidatVue[];
}

export async function lireCommandesAAttribuer(): Promise<CommandeAAttribuerVue[]> {
  let lignes: Array<{
    factureId: string;
    siren: string;
    siret: string | null;
    candidats: string[];
    creeAt: Date;
  }> = [];
  try {
    lignes = await prisma.commandeAAttribuer.findMany({
      where: { decideeAt: null },
      orderBy: { creeAt: "asc" },
      take: 100,
      select: { factureId: true, siren: true, siret: true, candidats: true, creeAt: true },
    });
  } catch {
    return []; // table pas encore migrée : rien à attribuer
  }
  if (lignes.length === 0) return [];
  const ids = [...new Set(lignes.flatMap((l) => l.candidats))];
  const [factures, presentations, etabs] = await Promise.all([
    prisma.factureFormation.findMany({
      where: { id: { in: lignes.map((l) => l.factureId) } },
      select: { id: true, numero: true, montantHtCents: true },
    }),
    prisma.presentationEntreprise.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        denomination: true,
        apporteur: { select: { prenom: true, nom: true } },
      },
    }),
    lireEtablissements(ids),
  ]);
  const f = new Map(factures.map((x) => [x.id, x]));
  const p = new Map(presentations.map((x) => [x.id, x]));
  return lignes.map((l) => ({
    factureId: l.factureId,
    numero: f.get(l.factureId)?.numero ?? null,
    montantHtCents: f.get(l.factureId)?.montantHtCents ?? null,
    denomination: p.get(l.candidats[0] ?? "")?.denomination ?? `SIREN ${l.siren}`,
    siren: l.siren,
    siret: l.siret,
    creeAt: l.creeAt,
    candidats: l.candidats
      .filter((id) => p.has(id))
      .map((id) => {
        const e = etabs.get(id);
        const x = p.get(id)!;
        return {
          presentationId: id,
          apporteur: nomComplet(x.apporteur.prenom, x.apporteur.nom),
          perimetre: !e?.siret
            ? "toute l'entreprise (avant la 2.6)"
            : e.entreprise
              ? `toute l'entreprise (établissement ${e.siret})`
              : `établissement ${e.siret}`,
        };
      }),
  }));
}
