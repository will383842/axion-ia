/** Un petit monde en mémoire (session, projet, questionnaires, preuves) pour les tests du recueil. */

type Ligne = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const SESSION = "22222222-2222-4222-8222-222222222222";
const PROJET = "66666666-6666-4666-8666-666666666666";
const CLIENT = "77777777-7777-4777-8777-777777777777";

export interface Question {
  ordre: number;
  texte: string;
  typeVise: string;
  cleVisee?: string | null;
  faitSourceId?: string | null;
  poseeDeViveVoix?: boolean;
}
export interface Questionnaire extends Ligne {
  id: string;
  projetId: string;
  version: number;
  statut: string;
  mode: string;
  modele: string | null;
  questions: Question[];
}

export function fauxMonde(init: {
  interrupteur?: "eteint" | "essai" | "actif";
  session?: Ligne;
  contactEmail?: string;
  projetsOuverts?: string[];
  questionsDesFaits?: Array<{ texte: string; typeVise: string }>;
}) {
  let n = 0;
  let mutations = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const session: Ligne = {
    id: SESSION,
    estTestInterne: false,
    projetId: PROJET,
    clientId: CLIENT,
    titreSession: "Formation IA",
    createdAt: new Date("2026-10-01T00:00:00Z"),
    client: {
      raisonSociale: "ACME",
      contactNom: "Jeanne",
      contactEmail: init.contactEmail ?? "drh@acme.test",
    },
    ...(init.session ?? {}),
  };
  const questionnaires: Questionnaire[] = [];
  if (init.questionsDesFaits) {
    questionnaires.push({
      id: id(),
      projetId: PROJET,
      version: 1,
      statut: "brouillon",
      mode: "a_copier",
      modele: "modele-ia",
      questions: init.questionsDesFaits.map((q, i) => ({ ...q, ordre: i + 1 })),
    });
  }
  const remises: Ligne[] = [];
  const relances: Ligne[] = [];

  const filtre = (l: Ligne, where: Ligne = {}): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (v !== null && typeof v === "object" && !(v instanceof Date)) {
        if ("not" in v) return l[k] !== v.not;
        return true;
      }
      return l[k] === v;
    });
  const trier = <T extends Ligne>(rows: T[], orderBy?: Ligne): T[] => {
    if (!orderBy) return rows;
    const [[k, sens]] = Object.entries(orderBy) as [[string, "asc" | "desc"]];
    return [...rows].sort((a, b) => {
      const x = a[k] instanceof Date ? a[k].getTime() : a[k];
      const y = b[k] instanceof Date ? b[k].getTime() : b[k];
      return sens === "asc" ? x - y : y - x;
    });
  };

  const db = {
    setting: {
      findUnique: async () =>
        init.interrupteur === undefined ? null : { value: { etat: init.interrupteur } },
    },
    trainingSession: {
      findUnique: async () => session,
      findFirst: async ({ where }: { where: Ligne }) => (filtre(session, where) ? session : null),
      updateMany: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        if (!filtre(session, where)) return { count: 0 };
        mutations++;
        Object.assign(session, data);
        return { count: 1 };
      },
    },
    projet: {
      findMany: async () => (init.projetsOuverts ?? [PROJET]).map((id) => ({ id })),
    },
    questionnaireCadrage: {
      findFirst: async ({ where, orderBy }: { where: Ligne; orderBy?: Ligne }) =>
        trier(
          questionnaires.filter((q) => filtre(q, where)),
          orderBy,
        )[0] ?? null,
      findMany: async ({ where, orderBy }: { where: Ligne; orderBy?: Ligne }) =>
        trier(
          questionnaires.filter((q) => filtre(q, where)),
          orderBy,
        ),
      create: async ({ data }: { data: Ligne }) => {
        mutations++;
        const { questions, ...reste } = data;
        const q: Questionnaire = {
          id: id(),
          ...reste,
          reponseRecueLe: null,
          questions: (questions?.create ?? []) as Question[],
        } as unknown as Questionnaire;
        questionnaires.push(q);
        return { id: q.id };
      },
      updateMany: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const cibles = questionnaires.filter((q) => filtre(q, where));
        for (const c of cibles) Object.assign(c, data);
        if (cibles.length > 0) mutations++;
        return { count: cibles.length };
      },
    },
    questionnaireQuestion: {
      findMany: async ({ where }: { where: Ligne }) =>
        (questionnaires.find((q) => q.id === where["questionnaireId"])?.questions ?? []).filter(
          (x) => x.poseeDeViveVoix !== true && x.ordre > 0,
        ),
    },
    remiseRetour: {
      create: async ({ data }: { data: Ligne }) => {
        mutations++;
        const l = { id: id(), ...data };
        remises.push(l);
        return { id: l.id };
      },
      findFirst: async ({ where, orderBy }: { where: Ligne; orderBy?: Ligne }) =>
        trier(
          remises.filter((r) => filtre(r, where)),
          orderBy,
        )[0] ?? null,
    },
    relanceJournal: {
      create: async ({ data }: { data: Ligne }) => {
        mutations++;
        relances.push({ id: id(), ...data });
        return {};
      },
      count: async ({ where }: { where: Ligne }) => relances.filter((r) => filtre(r, where)).length,
      findFirst: async ({ where, orderBy }: { where: Ligne; orderBy?: Ligne }) =>
        trier(
          relances.filter((r) => filtre(r, where)),
          orderBy,
        )[0] ?? null,
    },
    activityLog: {
      create: async () => {
        mutations++;
        return {};
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(db),
  };

  return {
    db: db as never,
    session,
    questionnaires,
    remises,
    relances,
    ecritures: () => mutations,
  };
}
