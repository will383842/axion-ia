/**
 * Audit présentiel (PR3) : transforme les événements REÇUS (déjà déchiffrés) en une vue lisible.
 *
 * Fonction pure : aucune base, aucun journal, aucun effet. Elle ne lit qu'une LISTE BLANCHE de clés
 * du journal de l'outil (voir `_PLAN-AUDIT-PRESENTIEL-2026-11-02/maquettes-v2/calculs.js`) : tout
 * autre champ, notamment un prénom qui s'y glisserait, n'est jamais affiché.
 * Jamais de prix ni de montant : les heures sont des heures par semaine déclarées sur place.
 */

import { CATALOGUE_PISTES, type PisteCatalogue } from "./catalogue-pistes";

export const ETAPES_AUDIT = [
  "Avant le rendez-vous",
  "Accueil",
  "Vos outils",
  "Les personnes",
  "Un dossier en exemple",
  "Les chiffres",
  "Les priorités et la suite",
] as const;
export const NOMBRE_ETAPES = 7;

export interface SessionLue {
  readonly id: string;
  readonly statut: string;
  readonly jetonExpireLe: Date;
  readonly jetonRevoqueLe: Date | null;
  readonly dernierSeq: number;
  readonly derniereEtapeIndex: number;
  readonly dernierEnvoiLe: Date | null;
  readonly creeLe: Date;
}

export interface EvenementLu {
  readonly seq: number;
  readonly type: string;
  readonly etape: string | null;
  readonly etapeIndex: number | null;
  readonly heurePc: Date;
  readonly recuLe: Date;
  /** `null` : contenu illisible (déchiffrement ou JSON impossible). */
  readonly donnees: Record<string, unknown> | null;
}

export interface TacheVue {
  readonly tid: string;
  readonly nom: string;
  readonly outil: string;
  readonly heuresSemaine: number;
}
export interface PosteVue {
  readonly pid: string;
  readonly poste: string;
  readonly statut: "valide" | "absent" | "en_cours";
  readonly heuresSemaine: number;
  readonly taches: ReadonlyArray<TacheVue>;
}
export interface PrioriteVue {
  readonly rang: number;
  readonly libelle: string;
  readonly postes: ReadonlyArray<string>;
  readonly heuresRecuperables: number;
  readonly risque: string;
  readonly preuve: "vu" | "dit";
}
export interface AbonnementVue {
  readonly nom: string;
  readonly sert: string;
  readonly usage: string;
  readonly doublon: string;
  readonly remplace: string;
  readonly justificatif: string;
  readonly renouvellement: string;
  readonly limiteResiliation: string;
}
export interface LigneJournal {
  readonly seq: number;
  readonly type: string;
  readonly etape: string;
  readonly heurePc: Date;
  readonly recuLe: Date;
  readonly illisible: boolean;
}

export interface VueAudit {
  readonly etape: number;
  readonly etapesTotal: 7;
  readonly nomEtape: string;
  readonly termine: boolean;
  readonly derniereReception: Date | null;
  readonly nombreEvenements: number;
  readonly illisibles: number;
  readonly trous: ReadonlyArray<number>;
  readonly postes: ReadonlyArray<PosteVue>;
  readonly entretiensValides: number;
  readonly priorites: ReadonlyArray<PrioriteVue>;
  readonly abonnements: ReadonlyArray<AbonnementVue>;
  readonly journal: ReadonlyArray<LigneJournal>;
}

const CLES_INTERDITES = new Set(["__proto__", "constructor", "prototype"]);
const MAX_JOURNAL = 100;
const MAX_TROUS = 50;
const PREUVE = { vu: 1, dit: 0.8 } as const;
const RISQUE: Record<string, number> = { faible: 1, moyen: 0.8, eleve: 0.6 };

const num = (x: unknown): number => {
  const n = parseFloat(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const txt = (x: unknown, max = 200): string =>
  typeof x === "string" ? x.slice(0, max) : typeof x === "number" ? String(x) : "";
const ids = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((v): v is string => typeof v === "string").slice(0, 100) : [];

function limiteResiliation(renouv: string, preavis: number): string {
  if (!renouv) return "";
  const d = new Date(`${renouv}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() - preavis);
  return d.toISOString().slice(0, 10);
}

/** Les mêmes heures que l'outil : fois × minutes ÷ 60, plus la reprise des erreurs (mensuelle → hebdomadaire). */
function heuresTache(get: (k: string) => unknown, k: string): number {
  const base = (num(get(`${k}fois`)) * num(get(`${k}minutes`))) / 60;
  const reprise = (((num(get(`${k}errFreq`)) * num(get(`${k}errMin`))) / 60) * 12) / 52;
  return base + reprise;
}

/** Catalogue de pistes éventuellement joint aux événements (`pistes: { id: { nom, faisa, risque } }`). */
function lireCatalogue(
  donnees: Record<string, unknown>,
  vers: Record<string, PisteCatalogue>,
): void {
  const brut = donnees["pistes"];
  if (brut === null || typeof brut !== "object" || Array.isArray(brut)) return;
  for (const [id, v] of Object.entries(brut as Record<string, unknown>).slice(0, 100)) {
    if (CLES_INTERDITES.has(id) || v === null || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const nom = txt(o["nom"], 200);
    if (nom === "") continue;
    vers[id] = { nom, faisa: num(o["faisa"]) || 2, risque: txt(o["risque"], 20) || "moyen" };
  }
}

export function construireVueAudit(
  session: SessionLue,
  evenements: ReadonlyArray<EvenementLu>,
): VueAudit {
  const tries = [...evenements].sort((a, b) => a.seq - b.seq);
  // Sans prototype et sans clés dangereuses : un contenu reçu ne peut jamais toucher Object.prototype.
  const etat: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const catalogue: Record<string, PisteCatalogue> = { ...CATALOGUE_PISTES };
  let termine = false;
  let etapeMax = session.derniereEtapeIndex;
  let derniere: Date | null = session.dernierEnvoiLe;
  let illisibles = 0;
  for (const e of tries) {
    if (e.donnees === null) illisibles += 1;
    if (e.type === "audit_termine") termine = true;
    if (e.etapeIndex !== null && e.type !== "rapport_brouillon" && e.etapeIndex > etapeMax) {
      etapeMax = e.etapeIndex;
    }
    if (derniere === null || e.recuLe > derniere) derniere = e.recuLe;
    // Une étape revalidée REMPLACE l'ancienne valeur (l'ancien événement reste dans le journal).
    if (e.donnees !== null && (e.type === "etape_validee" || e.type === "entretien_valide")) {
      for (const [cle, valeur] of Object.entries(e.donnees)) {
        if (CLES_INTERDITES.has(cle)) continue;
        etat[cle] = valeur;
      }
      lireCatalogue(e.donnees, catalogue);
    }
  }
  const etape = Math.max(0, Math.min(NOMBRE_ETAPES, etapeMax));
  const get = (k: string): unknown => etat[k];

  const postes: PosteVue[] = ids(get("personnes.liste")).map((pid) => {
    const statutBrut = txt(get(`p.${pid}.statut`), 20);
    const statut = statutBrut === "valide" || statutBrut === "absent" ? statutBrut : "en_cours";
    const tousIds = ids(get(`p.${pid}.taches`));
    const taches = tousIds
      .map((tid) => ({ tid, k: `p.${pid}.t.${tid}.` }))
      // Même règle que l'outil : on ne retire une tâche que si c'est la MÊME personne et le MÊME geste.
      .filter(({ tid, k }) => {
        const meme = txt(get(`${k}meme`), 80);
        const nom = txt(get(`${k}nom`));
        return (
          (nom !== "" || num(get(`${k}fois`)) > 0) &&
          !(meme !== "" && tousIds.includes(meme) && meme !== tid)
        );
      })
      .map(({ tid, k }) => ({
        tid,
        nom: txt(get(`${k}nom`)),
        outil: txt(get(`${k}outil`), 80),
        heuresSemaine: heuresTache(get, k),
      }));
    return {
      pid,
      poste: txt(get(`p.${pid}.poste`), 80),
      statut,
      heuresSemaine: statut === "absent" ? 0 : taches.reduce((s, t) => s + t.heuresSemaine, 0),
      taches: statut === "absent" ? [] : taches,
    };
  });

  const observation = get("a5.fait") === "oui" ? txt(get("a5.tache"), 80) : null;
  const groupes = new Map<
    string,
    {
      libelle: string;
      faisaDefaut: number;
      risqueDefaut: string;
      postes: string[];
      h: number;
      vu: boolean;
    }
  >();
  // Priorités : tâches dont une part est jugée récupérable (a6.part.<tid> > 0), regroupées par piste.
  for (const p of postes) {
    if (p.statut === "absent") continue;
    // Les tâches FILTRÉES (doublons « même geste » et tâches vides écartés), comme `lignes()` de l'outil.
    for (const { tid } of p.taches) {
      const k = `p.${p.pid}.t.${tid}.`;
      const part = num(get(`a6.part.${tid}`));
      if (part <= 0) continue;
      const nom = txt(get(`${k}nom`));
      const h = heuresTache(get, k);
      const piste = txt(get(`a6.piste.${tid}`), 80);
      const id = piste || `etude-${tid}`;
      const d = piste !== "" ? catalogue[piste] : undefined;
      const g = groupes.get(id) ?? {
        libelle: d ? d.nom : `À étudier : ${nom}`,
        faisaDefaut: d ? d.faisa : 2,
        risqueDefaut: d ? d.risque : "moyen",
        postes: [],
        h: 0,
        vu: false,
      };
      g.h += (h * part) / 100;
      if (p.poste !== "" && !g.postes.includes(p.poste)) g.postes.push(p.poste);
      if (observation !== null && observation === tid) g.vu = true;
      groupes.set(id, g);
    }
  }
  const priorites = [...groupes.entries()]
    .map(([id, g]) => {
      const faisa = num(get(`a7.faisa.${id}`)) || g.faisaDefaut;
      const risque = txt(get(`a7.risque.${id}`), 20) || g.risqueDefaut;
      const preuve: "vu" | "dit" = g.vu ? "vu" : "dit";
      return {
        libelle: g.libelle,
        postes: g.postes,
        heuresRecuperables: g.h,
        risque,
        preuve,
        score: g.h * faisa * PREUVE[preuve] * (RISQUE[risque] ?? 0.8),
      };
    })
    .sort((a, b) => b.score - a.score || b.heuresRecuperables - a.heuresRecuperables)
    .map(({ score: _s, ...reste }, i) => ({ rang: i + 1, ...reste }));

  const abonnements: AbonnementVue[] = ids(get("abos.liste")).map((id) => {
    const k = `abo.${id}.`;
    const renouv = txt(get(`${k}renouv`), 10);
    return {
      nom: txt(get(`${k}nom`)),
      sert: txt(get(`${k}sert`)),
      usage: txt(get(`${k}usage`)),
      doublon: txt(get(`${k}doublon`)),
      remplace: txt(get(`${k}remplace`), 20) || "non",
      justificatif: txt(get(`${k}justif`), 20) || "verifier",
      renouvellement: renouv,
      limiteResiliation: limiteResiliation(renouv, num(get(`${k}preavis`))),
    };
  });

  const recus = new Set(tries.map((e) => e.seq));
  const trous: number[] = [];
  const dernierSeq = Math.max(session.dernierSeq, tries.at(-1)?.seq ?? 0);
  for (let s = 1; s <= dernierSeq && trous.length < MAX_TROUS; s += 1) {
    if (!recus.has(s)) trous.push(s);
  }

  return {
    etape,
    etapesTotal: NOMBRE_ETAPES,
    nomEtape: etape >= 1 ? (ETAPES_AUDIT[etape - 1] ?? "") : "",
    termine,
    derniereReception: derniere,
    nombreEvenements: tries.length,
    illisibles,
    trous,
    postes,
    entretiensValides: postes.filter((p) => p.statut === "valide").length,
    priorites,
    abonnements,
    journal: tries
      .slice(-MAX_JOURNAL)
      .reverse()
      .map((e) => ({
        seq: e.seq,
        type: e.type,
        etape: e.etape ?? "",
        heurePc: e.heurePc,
        recuLe: e.recuLe,
        illisible: e.donnees === null,
      })),
  };
}
