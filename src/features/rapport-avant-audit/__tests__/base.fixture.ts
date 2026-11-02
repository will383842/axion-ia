/** Une base d'audit minimale et VALIDE (contrat `base-audit/1`), pour les tests de persistance. */
import { SECTIONS_ANALYSE, VERSION_BASE_AUDIT, type BaseAudit } from "../base-audit-schema";

export const CLIENT_FIXTURE = "11111111-1111-4111-8111-111111111111";

const SOURCE = { type: "questionnaire", reference: "Réponse du dirigeant", personne: "Dirigeant" };

export function baseValide(): BaseAudit {
  const section = { resume: "", elements: [] };
  return {
    version: VERSION_BASE_AUDIT,
    meta: {
      clientId: CLIENT_FIXTURE,
      raisonSociale: "Société d'exemple",
      generePar: "test",
      genereLe: "2026-11-02T10:00:00Z",
      questionnaires: ["q1"],
      complet: true,
      limites: [],
      reponseDirection: { fournieParUnDirigeant: "oui", repondant: "Président", remarque: "" },
    },
    besoins_declares: [
      {
        id: "B1",
        categorie: "douleur",
        enonce: "Les devis prennent trop de temps",
        citations: [{ texte: "Je passe mes soirées sur les devis", auteur: "Dirigeant" }],
        nbPersonnes: 1,
        intensite: "fort",
      },
    ],
    equipe_analyse: [],
    ...Object.fromEntries(SECTIONS_ANALYSE.map((k) => [k, section])),
    evolution_financiere: {
      exercices: [],
      tendance: "indeterminee",
      tauxAnnuelMoyenPct: null,
      lecture: "",
      limites: [],
    },
    pistes: [
      {
        id: "P1",
        titre: "Automatiser les devis",
        description: "Générer un devis depuis la demande",
        besoinsServis: ["B1"],
        horsDemande: false,
        gain: "fort",
        effort: "moyen",
        rang: 1,
        sources: [SOURCE],
      },
    ],
    contradictions: [],
    questions_jour_j: [],
    propositions_fiche: [
      {
        champ: "effectif",
        valeur: "12",
        confiance: "probable",
        sources: [SOURCE],
        application: "a_cocher",
      },
    ],
    couverture: {
      personnesAvecReponse: 1,
      reponsesDonnees: 10,
      questionsSansReponse: 3,
      personnesAttenduesSansReponse: [],
      alertes: [],
    },
    fiches_personnes: [],
    annexe_reponses: [],
    sources: [],
  } as unknown as BaseAudit;
}

// ── Une fausse table `rapports_avant_audit` en mémoire (aucune suppression possible) ──

type Ligne = Record<string, unknown> & { id: string };

function correspond(l: Ligne, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => {
    const val = l[k];
    if (v === null) return val === null || val === undefined;
    // Égalité de dates par VALEUR, comme Postgres (le jeton de prise est une date).
    if (v instanceof Date) return val instanceof Date && val.getTime() === v.getTime();
    if (typeof v === "object" && v !== null && !(v instanceof Date)) {
      const o = v as Record<string, unknown>;
      if ("in" in o) return (o.in as unknown[]).includes(val);
      if ("lt" in o) return val instanceof Date && val < (o.lt as Date);
      if ("not" in o) return o.not === null ? val !== null && val !== undefined : val !== o.not;
      if ("has" in o) return Array.isArray(val) && val.includes(o.has);
      if ("hasSome" in o) {
        return Array.isArray(val) && (o.hasSome as unknown[]).some((x) => val.includes(x));
      }
      throw new Error(`filtre non géré : ${k}`);
    }
    return val === v;
  });
}

function projeter(l: Ligne, select?: Record<string, boolean>): Record<string, unknown> {
  if (select === undefined) return { ...l };
  return Object.fromEntries(Object.keys(select).map((k) => [k, l[k] ?? null]));
}

export function fausseTable(maintenant: () => Date = () => new Date()) {
  const lignes: Ligne[] = [];
  let n = 0;
  const table = {
    lignes,
    create: async ({
      data,
      select,
    }: {
      data: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => {
      n += 1;
      const l: Ligne = {
        id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
        statut: "en_attente",
        etape: null,
        progression: 0,
        erreur: null,
        debutLe: null,
        finLe: null,
        versionSchema: null,
        baseAudit: null,
        baseEmpreinte: null,
        jetonsEntree: 0,
        jetonsSortie: 0,
        nbRecherches: 0,
        pdfChemin: null,
        pdfValideLe: null,
        pdfValideParId: null,
        propositionsFiche: null,
        ecarteLe: null,
        ecarteMotif: null,
        creeLe: maintenant(),
        majLe: maintenant(),
        ...data,
      };
      lignes.push(l);
      return projeter(l, select);
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      const vises = lignes.filter((l) => correspond(l, where));
      for (const l of vises) Object.assign(l, data, { majLe: maintenant() });
      return { count: vises.length };
    },
    findUnique: async ({
      where,
      select,
    }: {
      where: { id: string };
      select?: Record<string, boolean>;
    }) => {
      const l = lignes.find((x) => x.id === where.id);
      return l === undefined ? null : projeter(l, select);
    },
    findMany: async ({
      where,
      select,
    }: {
      where: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => lignes.filter((l) => correspond(l, where)).map((l) => projeter(l, select)),
    count: async ({ where }: { where: Record<string, unknown> }) =>
      lignes.filter((l) => correspond(l, where)).length,
    delete: async () => {
      throw new Error("SUPPRESSION INTERDITE");
    },
    deleteMany: async () => {
      throw new Error("SUPPRESSION INTERDITE");
    },
  };
  return table;
}
