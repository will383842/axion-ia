import { versionNormalisee } from "../regle-attribution";

/**
 * MESURE EN LECTURE SEULE — apporteurs et commissions par version de contrat signée (lot G1, Q8).
 *
 * Question posée : combien d'apporteurs ont signé chaque version du contrat
 * (`ApporteurReseau.signatureApporteur.version`), et combien de commissions créées depuis la
 * bascule 2.8 les concernent ?
 *
 * Versions lues comme `versionAuMoins` (regle-attribution.ts) : forme canonique seulement,
 * normalisée (« 2.6.0 » = « 2.6 ») ; tout le reste est classé « illisible ». Une version ABSENTE
 * est classée « absente » : l'hypothèse « absente = v2 » n'a pas de source vérifiée, elle n'est
 * donc pas affirmée.
 *
 * Aucune écriture : le seul accès base passe par deux `findMany` de lecture, verrouillés par un
 * test statique. Le rapport ne contient que des COMPTES (aucun identifiant, aucun nom, aucun
 * montant). Une ligne dont l'effectif d'apporteurs est sous `SEUIL_MASQUAGE` est masquée EN
 * ENTIER (commissions comprises) ; aucune commission n'est écartée sans être comptée.
 */

/** Signature sans champ `version` : classée telle quelle, sans supposer une version. */
export const VERSION_ABSENTE = "absente";
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
  return versionNormalisee(v) ?? VERSION_INCONNUE;
}

export type Mesure = {
  lignes: LigneVersion[];
  sansSignature: number;
  /** Commissions dont l'apporteur n'a pas de signature : comptées ici, jamais perdues. */
  commissionsNonRattachees: number;
};

export function mesurerVersions(
  apporteurs: readonly ApporteurLu[],
  commissions: readonly CommissionLue[],
): Mesure {
  const versionDe = new Map<string, string>();
  let sansSignature = 0;
  let commissionsNonRattachees = 0;
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
    if (v === undefined) {
      commissionsNonRattachees += 1; // apporteur sans signature : comptée à part
      continue;
    }
    ligne(v).commissions += 1;
    if (!avecCommission.has(c.apporteurId)) {
      avecCommission.add(c.apporteurId);
      ligne(v).apporteursAvecCommission += 1;
    }
  }
  const lignes = [...parVersion.values()].sort((a, b) =>
    a.version.localeCompare(b.version, "fr", { numeric: true }),
  );
  return { lignes, sansSignature, commissionsNonRattachees };
}

const masque = (n: number): string =>
  n > 0 && n < SEUIL_MASQUAGE ? `< ${SEUIL_MASQUAGE}` : String(n);

export function formaterRapport(mesure: Mesure, depuis: string): string {
  // Effectif d'apporteurs sous le seuil : TOUTE la ligne est masquée, commissions comprises
  // (un compte exact de commissions décrirait l'activité d'une personne identifiable).
  const ligne = (l: LigneVersion): string => {
    if (l.apporteurs > 0 && l.apporteurs < SEUIL_MASQUAGE) {
      const m = `< ${SEUIL_MASQUAGE}`;
      return `${l.version} | ${m} | ${m} | ${m}`;
    }
    return `${l.version} | ${l.apporteurs} | ${masque(l.apporteursAvecCommission)} | ${masque(l.commissions)}`;
  };
  const out = [
    `Version signée | apporteurs | dont avec commission depuis ${depuis} | commissions depuis ${depuis}`,
    "---|---|---|---",
    ...mesure.lignes.map(ligne),
    "",
    `Apporteurs sans signature : ${masque(mesure.sansSignature)}`,
    `Commissions non rattachées (apporteur sans signature) depuis ${depuis} : ${masque(mesure.commissionsNonRattachees)}`,
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
