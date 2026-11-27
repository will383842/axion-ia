import { normaliserUrl } from "@/server/content-gen/strategie/carte-requetes";
import { ctrReference, type CourbeCtr } from "./courbe-ctr";
import {
  classerIntention,
  estRequeteMarque,
  type Intention,
  type OptionsIntention,
} from "./intention";
import { calculerPriorite, EFFORT } from "./score";
import type {
  Action,
  CodeDetecteur,
  LigneRequete,
  Proposition,
  Signalement,
  TypePage,
} from "./types";
import { borneHauteWilson } from "./wilson";

/** Toutes les constantes sont exportées : à calibrer sur les 8 semaines d'observation. */
export const SEUILS = {
  /** Planchers par requête. */
  requeteImpressionsMin: 30,
  requeteSemainesMin: 3,
  /** a. Quasi-gagnante. */
  quasiPositionMin: 5,
  quasiPositionMax: 20,
  quasiPositionTitreMax: 10,
  quasiImpressionsMin: 100,
  /** b. CTR anormal. */
  ctrImpressionsMin: 200,
  ctrRatioMax: 0.6,
  /** c. Requête sans page dédiée. */
  sansPageImpressionsMin: 50,
  sansPagePositionMax: 30,
  /** d. Cannibalisation. */
  cannibPartMin: 0.2,
  cannibBasculesMin: 3,
  cannibImpressionsMin: 100,
  /** e. Déclin. */
  declinBaisseMin: 0.3,
  declinClicsPerdusMin: 20,
  declinPositionDegradeeMin: 1.5,
  /** f. Jamais affichée. */
  jamaisAgeMinJours: 45,
  /** Confiance = impressions / (impressions + K). */
  confianceK: 300,
} as const;

function confiance(impressions: number, facteur = 1): number {
  return (impressions / (impressions + SEUILS.confianceK)) * facteur;
}

function prop(
  detecteur: CodeDetecteur,
  action: Action,
  champs: {
    url: string;
    requete?: string;
    pageCible?: string;
    gainClics: number;
    confiance: number;
    motif: string;
  },
): Proposition {
  const gainClics = Math.max(0, Math.round(champs.gainClics * 10) / 10);
  return {
    detecteur,
    action,
    ...champs,
    gainClics,
    effort: EFFORT[action],
    priorite: calculerPriorite(gainClics, champs.confiance, action),
  };
}

/** Plancher par requête : ≥ 30 impressions sur 28 j et présence ≥ 3 semaines sur 4. */
export function respectePlancherRequete(l: LigneRequete): boolean {
  return (
    l.impressions >= SEUILS.requeteImpressionsMin &&
    l.semainesPresentes >= SEUILS.requeteSemainesMin &&
    Number.isFinite(l.position) &&
    Number.isFinite(l.impressions) &&
    Number.isFinite(l.clics) &&
    l.clics >= 0
  );
}

// ── a. Quasi-gagnante ───────────────────────────────────────────────────
export function detecterQuasiGagnante(
  lignes: readonly LigneRequete[],
  o: { proprietaire: (requete: string) => string | null; intention?: OptionsIntention },
): Proposition[] {
  const sortie: Proposition[] = [];
  for (const l of lignes) {
    if (!respectePlancherRequete(l) || estRequeteMarque(l.requete)) continue;
    if (l.position < SEUILS.quasiPositionMin || l.position > SEUILS.quasiPositionMax) continue;
    if (l.impressions < SEUILS.quasiImpressionsMin) continue;
    const proprio = o.proprietaire(l.requete);
    if (proprio === null || normaliserUrl(proprio) !== normaliserUrl(l.url)) continue;
    const ctrActuel = l.clics / l.impressions;
    const titre = l.position <= SEUILS.quasiPositionTitreMax;
    const cible = titre ? Math.max(1, l.position - 2) : SEUILS.quasiPositionTitreMax;
    const gain = l.impressions * Math.max(0, ctrReference(cible) - ctrActuel);
    const base = { url: l.url, requete: l.requete, gainClics: gain };
    const motifPos = `position ${l.position.toFixed(1)} sur ${l.impressions} impressions`;
    if (titre) {
      sortie.push(
        prop("a", "titre_meta", {
          ...base,
          confiance: confiance(l.impressions),
          motif: `Quasi-gagnante : ${motifPos}`,
        }),
      );
      if (classerIntention(l.requete, o.intention).drapeaux.question) {
        sortie.push(
          prop("a", "faq", {
            ...base,
            confiance: confiance(l.impressions, 0.8),
            motif: `Question en position ${l.position.toFixed(1)}`,
          }),
        );
      }
    } else {
      sortie.push(
        prop("a", "mise_a_jour", {
          ...base,
          confiance: confiance(l.impressions, 0.7),
          motif: `Quasi-gagnante : ${motifPos}`,
        }),
      );
      sortie.push(
        prop("a", "lien_interne", {
          ...base,
          confiance: confiance(l.impressions, 0.6),
          motif: `Quasi-gagnante : ${motifPos}`,
        }),
      );
    }
  }
  return sortie;
}

// ── b. CTR anormal ──────────────────────────────────────────────────────
export function detecterCtrAnormal(
  lignes: readonly LigneRequete[],
  o: { courbe: CourbeCtr | null },
): Proposition[] {
  if (!o.courbe) return []; // en veille : moins de 3 tranches valides
  const sortie: Proposition[] = [];
  for (const l of lignes) {
    if (!respectePlancherRequete(l) || estRequeteMarque(l.requete)) continue;
    if (l.impressions < SEUILS.ctrImpressionsMin) continue;
    const attendu = o.courbe.ctrAttendu(l.position);
    if (!(attendu > 0)) continue;
    if (borneHauteWilson(l.clics, l.impressions) >= SEUILS.ctrRatioMax * attendu) continue;
    const gain = l.impressions * (attendu - l.clics / l.impressions) * 0.5;
    sortie.push(
      prop("b", "titre_meta", {
        url: l.url,
        requete: l.requete,
        gainClics: gain,
        confiance: confiance(l.impressions),
        motif: `CTR ${((100 * l.clics) / l.impressions).toFixed(1)} % pour ${(100 * attendu).toFixed(1)} % attendus à la position ${l.position.toFixed(1)}`,
      }),
    );
  }
  return sortie;
}

// ── c. Requête sans page dédiée ─────────────────────────────────────────
/** Types de page qui répondent à une intention ; absente = pas de contrôle. */
export const TYPES_ATTENDUS: Readonly<Partial<Record<Intention, readonly TypePage[]>>> = {
  transactionnelle: ["offre", "conversion"],
  locale: ["ville", "offre"],
  commerciale: ["article", "guide", "offre"],
  informationnelle: ["article", "guide", "faq", "actualite"],
};

export function detecterRequeteSansPage(
  lignes: readonly LigneRequete[],
  o: {
    trouverPageCible: (requete: string, typesAttendus: readonly TypePage[]) => string | null;
    intention?: OptionsIntention;
  },
): Proposition[] {
  const sortie: Proposition[] = [];
  for (const l of lignes) {
    if (!respectePlancherRequete(l) || estRequeteMarque(l.requete)) continue;
    if (l.impressions < SEUILS.sansPageImpressionsMin || l.position > SEUILS.sansPagePositionMax)
      continue;
    const { intention } = classerIntention(l.requete, o.intention);
    const attendus = TYPES_ATTENDUS[intention];
    if (!attendus || attendus.includes(l.typePage)) continue;
    const cible = o.trouverPageCible(l.requete, attendus);
    const motif = `Intention ${intention}, mais la page qui sort est de type ${l.typePage}`;
    const gain = l.impressions * 0.05;
    sortie.push(
      cible
        ? prop("c", "lien_interne", {
            url: l.url,
            requete: l.requete,
            pageCible: cible,
            gainClics: gain,
            confiance: confiance(l.impressions, 0.7),
            motif,
          })
        : prop("c", "nouvelle_page", {
            url: l.url,
            requete: l.requete,
            gainClics: gain,
            confiance: confiance(l.impressions, 0.5),
            motif: `${motif} : brief à valider, jamais publié seul`,
          }),
    );
  }
  return sortie;
}

// ── d. Cannibalisation ──────────────────────────────────────────────────
export interface HistoriqueRequete {
  readonly requete: string;
  /** Nombre de bascules du classement entre URL sur 28 j. */
  readonly bascules: number;
  readonly urls: readonly { readonly url: string; readonly impressions: number }[];
}

export interface SortiePartielle {
  readonly propositions: Proposition[];
  readonly signalements: Signalement[];
}

export function detecterCannibalisation(
  historiques: readonly HistoriqueRequete[],
  o: { proprietaire: (requete: string) => string | null },
): SortiePartielle {
  const propositions: Proposition[] = [];
  const signalements: Signalement[] = [];
  for (const h of historiques) {
    const groupes = new Map<string, number>();
    for (const u of h.urls) {
      const k = normaliserUrl(u.url);
      if (!k || !Number.isFinite(u.impressions) || u.impressions < 0) continue;
      groupes.set(k, (groupes.get(k) ?? 0) + u.impressions);
    }
    const urls = [...groupes].map(([url, impressions]) => ({ url, impressions }));
    const total = urls.reduce((s, u) => s + u.impressions, 0);
    if (!(total >= SEUILS.cannibImpressionsMin) || !(h.bascules >= SEUILS.cannibBasculesMin))
      continue;
    const significatives = urls.filter((u) => u.impressions / total >= SEUILS.cannibPartMin);
    if (significatives.length < 2) continue;
    const fallback = [...significatives].sort(
      (a, b) => b.impressions - a.impressions || a.url.localeCompare(b.url),
    )[0]!.url;
    const proprio = normaliserUrl(o.proprietaire(h.requete) ?? "") || fallback;
    for (const u of significatives) {
      if (u.url === proprio) continue;
      propositions.push(
        prop("d", "lien_interne", {
          url: u.url,
          requete: h.requete,
          pageCible: proprio,
          gainClics: total * 0.03,
          confiance: confiance(total, 0.7),
          motif: `Cannibalisation : ${significatives.length} URL, ${h.bascules} bascules sur 28 j`,
        }),
      );
      signalements.push({
        kind: "fusion",
        detecteur: "d",
        url: u.url,
        requete: h.requete,
        motif: `Fusion à étudier avec ${proprio} (décision humaine)`,
      });
    }
  }
  return { propositions, signalements };
}

// ── e. Déclin ───────────────────────────────────────────────────────────
export interface PageDeclin {
  readonly url: string;
  readonly clics: number;
  readonly clicsPrecedents: number;
  readonly position: number;
  readonly positionPrecedente: number;
  /** Même période, un an plus tôt (quand 13 mois d'historique existent). */
  readonly clicsAnneePrecedente?: number;
  readonly clicsAnneePrecedentePrecedents?: number;
}

export interface TendanceSite {
  readonly clics: number;
  readonly clicsPrecedents: number;
}

export function detecterDeclin(
  pages: readonly PageDeclin[],
  o: { site: TendanceSite },
): SortiePartielle {
  const propositions: Proposition[] = [];
  const ratioSite =
    o.site.clicsPrecedents > 0 && Number.isFinite(o.site.clics)
      ? o.site.clics / o.site.clicsPrecedents
      : 1;
  for (const p of pages) {
    if (![p.clics, p.clicsPrecedents, p.position, p.positionPrecedente].every(Number.isFinite))
      continue;
    if (p.clics < 0 || o.site.clics < 0) continue;
    if (!(p.clicsPrecedents > 0)) continue;
    // Normalisation par la tendance du site ET par la saisonnalité de N−1 (une baisse
    // déjà vue l'an dernier à la même période est attendue ; une hausse n'excuse rien).
    let ratioN1 = 1;
    if (
      p.clicsAnneePrecedente !== undefined &&
      p.clicsAnneePrecedentePrecedents !== undefined &&
      Number.isFinite(p.clicsAnneePrecedente) &&
      p.clicsAnneePrecedentePrecedents > 0
    ) {
      ratioN1 = Math.min(1, Math.max(0, p.clicsAnneePrecedente / p.clicsAnneePrecedentePrecedents));
    }
    const attendus = p.clicsPrecedents * ratioSite * ratioN1;
    const perdus = attendus - p.clics;
    if (!(attendus > 0) || perdus / attendus < SEUILS.declinBaisseMin) continue;
    if (perdus < SEUILS.declinClicsPerdusMin) continue;
    if (p.position - p.positionPrecedente < SEUILS.declinPositionDegradeeMin) continue; // demande en baisse : aucune action
    propositions.push(
      prop("e", "mise_a_jour", {
        url: p.url,
        gainClics: perdus,
        confiance: confiance(p.clicsPrecedents * 10, 0.8),
        motif: `Clics ${p.clicsPrecedents} → ${p.clics} (hors tendance du site), position ${p.positionPrecedente.toFixed(1)} → ${p.position.toFixed(1)}`,
      }),
    );
  }
  return { propositions, signalements: [] };
}

// ── f. Jamais affichée ──────────────────────────────────────────────────
export interface PageVue {
  readonly url: string;
  readonly typePage: TypePage;
  readonly ageJours: number;
  /** Impressions AU NIVEAU DE LA PAGE sur 90 j. */
  readonly impressions90j: number;
}

export function detecterJamaisAffichee(pages: readonly PageVue[]): SortiePartielle {
  const propositions: Proposition[] = [];
  const signalements: Signalement[] = [];
  for (const p of pages) {
    if (p.typePage === "legal" || p.typePage === "conversion") continue;
    if (!Number.isFinite(p.ageJours) || !Number.isFinite(p.impressions90j)) continue;
    if (p.ageJours <= SEUILS.jamaisAgeMinJours || p.impressions90j !== 0) continue;
    propositions.push(
      prop("f", "inspection", {
        url: p.url,
        gainClics: 1,
        confiance: 0.5,
        motif: `Aucune impression en 90 j pour une page de ${p.ageJours} jours`,
      }),
    );
    signalements.push({
      kind: "noindex_ou_fusion",
      detecteur: "f",
      url: p.url,
      motif: "Noindex ou fusion à étudier après inspection (décision humaine)",
    });
  }
  return { propositions, signalements };
}
