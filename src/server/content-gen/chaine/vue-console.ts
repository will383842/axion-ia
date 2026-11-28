/**
 * Console « Chaîne éditoriale » (C14) : calcul PUR des cinq vues du § 10 de
 * `CONCEPTION-CHAINE-EDITORIALE-IA.md`. Règle d'or : un chiffre affiché = un compte sur une
 * table qui existe ; une source illisible ou vide affiche « indisponible », jamais 0.
 * Aucune entrée-sortie ici : les lectures sont dans `vue-console-io.ts`.
 */

export type Source<T> =
  | { readonly etat: "ok"; readonly valeur: T }
  | { readonly etat: "indisponible"; readonly raison: string };

export interface LigneRefus {
  readonly role: string;
  readonly code: string;
  readonly createdAt: Date;
  readonly briefId: string | null;
  readonly jobId: string | null;
}
export interface LigneCout {
  readonly jobId: string | null;
  readonly role: string | null;
  readonly costUsd: number;
}

export interface EntreesVueChaine {
  readonly maintenant: Date;
  readonly periodeJours: number;
  /** Comptes par statut (nouveau, en_brief, couvert, ecarte). */
  readonly besoins: Source<Readonly<Record<string, number>>>;
  /** Comptes par statut de brief. */
  readonly briefs: Source<Readonly<Record<string, number>>>;
  readonly briefsAvecFaits: Source<number>;
  /** Jobs porteurs des briefs, comptés par statut de job. */
  readonly jobsLies: Source<Readonly<Record<string, number>>>;
  readonly statutParJob?: Readonly<Record<string, string>>;
  readonly refus: Source<ReadonlyArray<LigneRefus>>;
  readonly couts: Source<ReadonlyArray<LigneCout>>;
  readonly nbResultats: Source<number>;
  readonly nbPropositions: Source<number>;
}

export interface EtapeEntonnoir {
  readonly cle: string;
  readonly libelle: string;
  readonly nombre: number;
  /** Part de l'étape précédente ; null à la première étape ou si la précédente vaut 0. */
  readonly tauxEtapePrecedente: number | null;
}
export interface Entonnoir {
  readonly etapes: ReadonlyArray<EtapeEntonnoir>;
  readonly abandonnes: number;
  readonly tauxGlobal: number | null;
}
export interface VueRefus {
  readonly total: number;
  readonly parCode: ReadonlyArray<{ readonly code: string; readonly nombre: number }>;
  readonly parRole: ReadonlyArray<{ readonly role: string; readonly nombre: number }>;
  /** 8 semaines, de la plus ancienne à la plus récente. */
  readonly tendance: ReadonlyArray<{ readonly semaineDebut: Date; readonly nombre: number }>;
  readonly exemples: ReadonlyArray<LigneRefus>;
}
export interface VueCout {
  readonly totalUsd: number;
  readonly parRole: ReadonlyArray<{ readonly role: string; readonly usd: number }>;
  readonly parPublieUsd: number | null;
  readonly parAbandonneUsd: number | null;
}
export interface VueChaine {
  readonly periodeJours: number;
  readonly entonnoir: Source<Entonnoir>;
  readonly refus: Source<VueRefus>;
  readonly cout: Source<VueCout>;
  readonly resultats: Source<{ readonly mesures: number }>;
  readonly propositions: Source<{ readonly total: number }>;
}

const JOUR_MS = 86_400_000;
const STATUTS_ABANDON_BRIEF = ["pas_d_angle", "pas_de_matiere", "abandonne"] as const;
const SANS_ROLE = "(sans rôle)";
const STATUTS_JOB_ABANDON = new Set(["failed", "cancelled"]);

const somme = (r: Readonly<Record<string, number>>, cles?: ReadonlyArray<string>): number =>
  Object.entries(r).reduce((s, [k, n]) => (!cles || cles.includes(k) ? s + n : s), 0);

function entonnoir(e: EntreesVueChaine): Source<Entonnoir> {
  if (e.besoins.etat === "indisponible") return e.besoins;
  if (e.briefs.etat === "indisponible") return e.briefs;
  if (e.briefsAvecFaits.etat === "indisponible") return e.briefsAvecFaits;
  if (e.jobsLies.etat === "indisponible") return e.jobsLies;
  const briefs = e.briefs.valeur;
  const jobs = e.jobsLies.valeur;
  const brutes: Array<[string, string, number]> = [
    ["besoins", "Besoins reçus", somme(e.besoins.valeur)],
    ["briefs", "Briefs", somme(briefs)],
    ["briefs_valides", "Briefs validés", briefs["valide"] ?? 0],
    ["dossiers_faits", "Dossiers de faits", e.briefsAvecFaits.valeur],
    ["en_relecture", "En relecture humaine", jobs["needs_review"] ?? 0],
    ["publies", "Publiés", jobs["published"] ?? 0],
  ];
  const etapes = brutes.map(([cle, libelle, nombre], i) => {
    const prec = i === 0 ? null : brutes[i - 1]![2];
    return {
      cle,
      libelle,
      nombre,
      tauxEtapePrecedente: prec === null || prec === 0 ? null : nombre / prec,
    };
  });
  const abandonnes = somme(briefs, STATUTS_ABANDON_BRIEF) + somme(jobs, [...STATUTS_JOB_ABANDON]);
  const premiere = brutes[0]![2];
  return {
    etat: "ok",
    valeur: {
      etapes,
      abandonnes,
      tauxGlobal: premiere === 0 ? null : (jobs["published"] ?? 0) / premiere,
    },
  };
}

function refus(e: EntreesVueChaine): Source<VueRefus> {
  if (e.refus.etat === "indisponible") return e.refus;
  const debut = e.maintenant.getTime() - 8 * 7 * JOUR_MS;
  const lignes = e.refus.valeur.filter((l) => l.createdAt.getTime() >= debut);
  const compte = (cle: (l: LigneRefus) => string) => {
    const m = new Map<string, number>();
    for (const l of lignes) m.set(cle(l), (m.get(cle(l)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const tendance = Array.from({ length: 8 }, (_, i) => {
    const semaineDebut = new Date(debut + i * 7 * JOUR_MS);
    const fin = semaineDebut.getTime() + 7 * JOUR_MS;
    return {
      semaineDebut,
      nombre: lignes.filter(
        (l) => l.createdAt.getTime() >= semaineDebut.getTime() && l.createdAt.getTime() < fin,
      ).length,
    };
  });
  return {
    etat: "ok",
    valeur: {
      total: lignes.length,
      parCode: compte((l) => l.code).map(([code, nombre]) => ({ code, nombre })),
      parRole: compte((l) => l.role).map(([role, nombre]) => ({ role, nombre })),
      tendance,
      exemples: [...lignes]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10),
    },
  };
}

function cout(e: EntreesVueChaine): Source<VueCout> {
  if (e.couts.etat === "indisponible") return e.couts;
  const lignes = e.couts.valeur;
  const parRole = new Map<string, number>();
  let total = 0;
  for (const l of lignes) {
    const r = l.role ?? SANS_ROLE;
    parRole.set(r, (parRole.get(r) ?? 0) + l.costUsd);
    total += l.costUsd;
  }
  const statuts = e.statutParJob ?? {};
  const par = (ok: (s: string) => boolean): number | null => {
    const jobs = new Set<string>();
    let usd = 0;
    for (const l of lignes) {
      const s = l.jobId ? statuts[l.jobId] : undefined;
      if (l.jobId && s && ok(s)) {
        jobs.add(l.jobId);
        usd += l.costUsd;
      }
    }
    return jobs.size === 0 ? null : usd / jobs.size;
  };
  return {
    etat: "ok",
    valeur: {
      totalUsd: total,
      parRole: [...parRole.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([role, usd]) => ({ role, usd })),
      parPublieUsd: par((s) => s === "published"),
      parAbandonneUsd: par((s) => STATUTS_JOB_ABANDON.has(s)),
    },
  };
}

function presence<T>(s: Source<number>, vide: string, fabrique: (n: number) => T): Source<T> {
  if (s.etat === "indisponible") return s;
  if (s.valeur === 0) return { etat: "indisponible", raison: vide };
  return { etat: "ok", valeur: fabrique(s.valeur) };
}

export function construireVueChaine(e: EntreesVueChaine): VueChaine {
  return {
    periodeJours: e.periodeJours,
    entonnoir: entonnoir(e),
    refus: refus(e),
    cout: cout(e),
    resultats: presence(
      e.nbResultats,
      "Aucune mesure enregistrée : le suivi des résultats n'est pas branché (C12).",
      (n) => ({ mesures: n }),
    ),
    propositions: presence(
      e.nbPropositions,
      "Aucune proposition : l'analyse hebdomadaire n'a pas tourné.",
      (n) => ({ total: n }),
    ),
  };
}
