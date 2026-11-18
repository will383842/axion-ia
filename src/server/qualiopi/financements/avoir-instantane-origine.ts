/**
 * Lecture, dans l'INSTANTANÉ du PDF d'origine d'un avoir, des champs qui n'ont pas de colonne
 * en base : le motif de la rectification (et les champs qui l'accompagnent).
 *
 * Contexte : `genererAvoirFacture` écrit `motifAvoir`, `avoirSurNumero` et `estAvoir` dans
 * `documents_generes.metadata.renderData.data`. Régénérer le PDF d'un avoir sans relire ces
 * champs le ferait sortir comme une FACTURE (titre, référence, motif absents).
 *
 * ⛔ Aucun motif n'est jamais inventé ni reconstitué (ni depuis le journal d'activité, ni
 * depuis les lignes) : sans instantané exploitable, on rend `null` et l'appelant refuse.
 */
import { prisma } from "@/lib/prisma";

export interface ChampsAvoirInstantane {
  estAvoir: boolean;
  motifAvoir: string | null;
  avoirSurNumero: string | null;
  numero: string | null;
  tauxTvaStandardPercent?: number;
}

export interface AvoirOrigine {
  motifAvoir: string;
  avoirSurNumero: string;
  tauxTvaStandardPercent?: number;
}

function objet(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Fonction pure : lit `renderData` (ou `null`) ; ne lève jamais. */
export function extraireChampsAvoir(snapshot: unknown): ChampsAvoirInstantane | null {
  try {
    const data = objet(objet(snapshot)?.["data"]);
    if (data === null) return null;
    const texte = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
    const taux = data["tauxTvaStandardPercent"];
    return {
      estAvoir: data["estAvoir"] === true,
      motifAvoir: texte(data["motifAvoir"]),
      avoirSurNumero: texte(data["avoirSurNumero"]),
      numero: texte(data["numero"]),
      ...(typeof taux === "number" && Number.isFinite(taux)
        ? { tauxTvaStandardPercent: taux }
        : {}),
    };
  } catch {
    return null;
  }
}

function renderDataDe(metadata: unknown): unknown {
  return objet(metadata)?.["renderData"];
}

function origineDepuis(champs: ChampsAvoirInstantane | null): AvoirOrigine | null {
  if (champs === null || !champs.estAvoir) return null;
  if (champs.motifAvoir === null || champs.avoirSurNumero === null) return null;
  return {
    motifAvoir: champs.motifAvoir,
    avoirSurNumero: champs.avoirSurNumero,
    ...(champs.tauxTvaStandardPercent !== undefined
      ? { tauxTvaStandardPercent: champs.tauxTvaStandardPercent }
      : {}),
  };
}

/**
 * Source 1 : l'instantané du PDF courant, SEULEMENT s'il est un avoir complet.
 * Source 2 : le plus ancien PDF `avoir` portant ce numéro (couvre un avoir déjà mal régénéré).
 */
export async function lireAvoirOrigine(
  avoirNumero: string,
  documentIdCourant: string | null,
): Promise<AvoirOrigine | null> {
  if (documentIdCourant !== null) {
    const courant = await prisma.documentGenere.findUnique({
      where: { id: documentIdCourant },
      select: { metadata: true },
    });
    const depuisCourant = origineDepuis(extraireChampsAvoir(renderDataDe(courant?.metadata)));
    if (depuisCourant !== null) return depuisCourant;
  }

  const ancien = await prisma.documentGenere.findFirst({
    where: {
      type: "avoir",
      metadata: { path: ["renderData", "data", "numero"], equals: avoirNumero },
    },
    orderBy: { createdAt: "asc" },
    select: { metadata: true },
  });
  return origineDepuis(extraireChampsAvoir(renderDataDe(ancien?.metadata)));
}
