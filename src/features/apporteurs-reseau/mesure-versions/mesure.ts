/**
 * MESURE EN LECTURE SEULE — apporteurs et commissions par version de contrat signée (lot G1, Q8).
 *
 * Question posée : combien d'apporteurs ont signé chaque version du contrat
 * (`ApporteurReseau.signatureApporteur.version`, absente = v2, signature antérieure au 07/10), et
 * combien de commissions créées depuis la bascule 2.8 les concernent ?
 *
 * Aucune écriture : le seul accès base passe par `findMany` / `groupBy`-équivalents de lecture,
 * verrouillé par un test statique. Le rapport ne contient que des COMPTES (aucun identifiant,
 * aucun nom, aucun montant) ; les groupes de moins de `SEUIL_MASQUAGE` sont rendus « < 5 ».
 */

/** Version attribuée à une signature sans champ `version` (antérieure au 07/10). */
export const VERSION_ABSENTE = "2";
export const VERSION_INCONNUE = "illisible";
/** Sous ce seuil, un compte est masqué dans le rapport (petits effectifs = personnes identifiables). */
export const SEUIL_MASQUAGE = 5;

export type ApporteurLu = { id: string; statut: string; signatureApporteur: unknown };
export type CommissionLue = { apporteurId: string };

export type LigneVersion = {
  version: string;
  apporteurs: number;
  /** Apporteurs de cette version qui ont au moins une commission dans la fenêtre. */
  apporteursAvecCommission: number;
  commissions: number;
};

/** Lit `signatureApporteur.version` sans rien supposer : JSON libre venu de la base. */
export function versionSignee(signature: unknown): string | null {
  if (signature === null || signature === undefined) return null; // jamais signé
  if (typeof signature !== "object" || Array.isArray(signature)) return VERSION_INCONNUE;
  const v = (signature as { version?: unknown }).version;
  if (v === undefined || v === null || v === "") return VERSION_ABSENTE;
  if (typeof v === "string" || typeof v === "number") return String(v).trim();
  return VERSION_INCONNUE;
}

export function mesurerVersions(
  apporteurs: readonly ApporteurLu[],
  commissions: readonly CommissionLue[],
): { lignes: LigneVersion[]; sansSignature: number } {
  const versionDe = new Map<string, string>();
  let sansSignature = 0;
  const parVersion = new Map<string, LigneVersion>();
  const ligne = (version: string): LigneVersion => {
    let l = parVersion.get(version);
    if (!l) {
      l = { version, apporteurs: 0, apporteursAvecCommission: 0, commissions: 0 };
      parVersion.set(version, l);
    }
    return l;
  };
  for (const a of apporteurs) {
    const v = versionSignee(a.signatureApporteur);
    if (v === null) {
      sansSignature += 1;
      continue;
    }
    versionDe.set(a.id, v);
    ligne(v).apporteurs += 1;
  }
  const avecCommission = new Set<string>();
  for (const c of commissions) {
    const v = versionDe.get(c.apporteurId);
    if (v === undefined) continue; // apporteur non signé ou hors périmètre : non compté
    ligne(v).commissions += 1;
    if (!avecCommission.has(c.apporteurId)) {
      avecCommission.add(c.apporteurId);
      ligne(v).apporteursAvecCommission += 1;
    }
  }
  const lignes = [...parVersion.values()].sort((a, b) =>
    a.version.localeCompare(b.version, "fr", { numeric: true }),
  );
  return { lignes, sansSignature };
}

const masque = (n: number): string =>
  n > 0 && n < SEUIL_MASQUAGE ? `< ${SEUIL_MASQUAGE}` : String(n);

export function formaterRapport(
  mesure: { lignes: LigneVersion[]; sansSignature: number },
  depuis: string,
): string {
  const out = [
    `Version signée | apporteurs | dont avec commission depuis ${depuis} | commissions depuis ${depuis}`,
    "---|---|---|---",
    ...mesure.lignes.map(
      (l) =>
        `${l.version} | ${masque(l.apporteurs)} | ${masque(l.apporteursAvecCommission)} | ${masque(l.commissions)}`,
    ),
    "",
    `Apporteurs sans signature : ${masque(mesure.sansSignature)}`,
  ];
  return out.join("\n");
}

/** Client minimal : uniquement des LECTURES, requêtes fixées par l'appelant. */
export type ClientLecture = {
  apporteurReseau: { findMany(): Promise<ApporteurLu[]> };
  commissionApporteur: { findMany(): Promise<CommissionLue[]> };
};

export async function mesurerDepuisBase(client: ClientLecture) {
  const [apporteurs, commissions] = await Promise.all([
    client.apporteurReseau.findMany(),
    client.commissionApporteur.findMany(),
  ]);
  return mesurerVersions(apporteurs, commissions);
}
