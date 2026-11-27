/**
 * Lot 6 : lectures de la console pour les demandes de changement de compte.
 *
 * ⛔ Aucun IBAN entier : la colonne chiffrée `iban` n'est JAMAIS sélectionnée ; on ne lit que
 * l'empreinte et les quatre derniers caractères. Table absente (P2021) : liste vide.
 */
import "server-only";

import { prisma } from "@/lib/prisma";

import { apporteursAyantCeCompte } from "./compte-deja-connu";
import { delaiOppositionEcoule } from "./changement-iban-regles";
import { changementIbanActif, secretEmpreinteDisponible } from "./interrupteur-changement-iban";
import { lireContenuPiece } from "./pieces-chiffrement";

const absente = (err: unknown) => (err as { code?: unknown })?.code === "P2021";

const CHAMPS = {
  id: true,
  apporteurId: true,
  statut: true,
  ibanFin4: true,
  ibanEmpreinte: true,
  ancienIbanFin4: true,
  origine: true,
  demandeeAt: true,
  confirmeeAt: true,
  avisEnvoyeAt: true,
  traiteeAt: true,
  motifRefus: true,
} as const;

export interface DemandeConsole {
  readonly id: string;
  readonly apporteurId: string;
  readonly statut: string;
  readonly fin4: string;
  readonly ancienFin4: string | null;
  readonly origine: string;
  readonly demandeeAt: Date;
  readonly confirmeeAt: Date | null;
  readonly decidable: boolean;
  readonly motifRefus: string | null;
}

export interface EtatConsole {
  readonly secretAbsent: boolean;
  readonly interrupteurAllume: boolean;
}

export const etatConsole = (): EtatConsole => ({
  secretAbsent: !secretEmpreinteDisponible(),
  interrupteurAllume: changementIbanActif(),
});

type Brute = {
  id: string;
  apporteurId: string;
  statut: string;
  ibanFin4: string;
  ancienIbanFin4: string | null;
  origine: string;
  demandeeAt: Date;
  confirmeeAt: Date | null;
  avisEnvoyeAt: Date | null;
  motifRefus: string | null;
};

const vue = (d: Brute, maintenant: Date): DemandeConsole => ({
  id: d.id,
  apporteurId: d.apporteurId,
  statut: d.statut,
  fin4: d.ibanFin4,
  ancienFin4: d.ancienIbanFin4,
  origine: d.origine,
  demandeeAt: d.demandeeAt,
  confirmeeAt: d.confirmeeAt,
  decidable:
    d.statut === "confirmee" &&
    !!d.confirmeeAt &&
    !!d.avisEnvoyeAt &&
    delaiOppositionEcoule(d.confirmeeAt, maintenant),
  motifRefus: d.motifRefus,
});

export async function listerDemandesConsole(): Promise<DemandeConsole[]> {
  try {
    const l = await prisma.apporteurChangementIban.findMany({
      select: CHAMPS,
      orderBy: { demandeeAt: "desc" },
      take: 200,
    });
    const now = new Date();
    return l.map((d) => vue(d, now));
  } catch (err) {
    if (absente(err)) return [];
    throw err;
  }
}

export interface AlerteCompte {
  readonly code: "deja-connu" | "demande-contestee";
  readonly apporteurId: string;
}

export interface DetailDemande {
  readonly demande: DemandeConsole;
  readonly alertes: AlerteCompte[];
  readonly telephoneModifieRecemment: boolean;
}

/** Le détail, avec les alertes « ce compte est déjà connu » (autre fiche, parrain, filleul, demande contestée). */
export async function lireDetailDemande(id: string): Promise<DetailDemande | null> {
  let d;
  try {
    d = await prisma.apporteurChangementIban.findUnique({ where: { id }, select: CHAMPS });
  } catch (err) {
    if (absente(err)) return null;
    throw err;
  }
  if (!d) return null;
  const alertes: AlerteCompte[] = [];
  // Une demande d'un autre apporteur (contestée) sur la même empreinte.
  const contestees = await prisma.apporteurChangementIban.findMany({
    where: { ibanEmpreinte: d.ibanEmpreinte, apporteurId: { not: d.apporteurId }, statut: "opposee" },
    select: { apporteurId: true },
    take: 10,
  });
  for (const c of contestees) alertes.push({ code: "demande-contestee", apporteurId: c.apporteurId });
  for (const apporteurId of await apporteursAyantCeCompte(d.ibanEmpreinte, d.apporteurId)) {
    alertes.push({ code: "deja-connu", apporteurId });
  }
  return { demande: vue(d, new Date()), alertes, telephoneModifieRecemment: false };
}

/** Les octets du RIB d'une demande, pour la route de la console (déchiffrés ici, seul point de lecture). */
export async function lireRibDemande(id: string) {
  try {
    const r = await prisma.apporteurChangementIbanRib.findUnique({ where: { demandeId: id } });
    if (!r || !r.octets) return null;
    const d = await prisma.apporteurChangementIban.findUnique({
      where: { id },
      select: { apporteurId: true },
    });
    return {
      apporteurId: d?.apporteurId ?? null,
      typeMime: r.typeMime,
      nomFichier: r.nomFichier,
      octets: lireContenuPiece(r.octets),
    };
  } catch (err) {
    if (absente(err)) return null;
    throw err;
  }
}
