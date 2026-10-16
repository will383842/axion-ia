/** Un faux client minimal, en mémoire, pour les gestes du recueil. */
export interface Ligne {
  [k: string]: unknown;
}

export function fauxDb(init: {
  interrupteur?: "eteint" | "essai" | "actif";
  session?: Ligne | null;
  questionnaire?: Ligne | null;
  journal?: Ligne[];
}) {
  const journal: Ligne[] = [...(init.journal ?? [])];
  const db = {
    journal,
    setting: {
      findUnique: async () =>
        init.interrupteur === undefined ? null : { value: { etat: init.interrupteur } },
    },
    trainingSession: {
      findUnique: async () => (init.session === undefined ? null : init.session),
      findFirst: async () => (init.session && init.session["estTestInterne"] ? init.session : null),
    },
    questionnaireCadrage: {
      findUnique: async () => (init.questionnaire === undefined ? null : init.questionnaire),
      findMany: async () => (init.questionnaire ? [init.questionnaire] : []),
    },
    activityLog: {
      create: async ({ data }: { data: Ligne }) => {
        journal.push({ ...data, createdAt: new Date("2026-10-16T10:00:00Z") });
      },
      findFirst: async ({ where }: { where: Ligne }) => {
        const trouves = journal.filter(
          (j) =>
            j["action"] === where["action"] &&
            (where["targetId"] === undefined ||
              typeof where["targetId"] !== "string" ||
              j["targetId"] === where["targetId"]),
        );
        return trouves.length === 0 ? null : trouves[trouves.length - 1];
      },
    },
  };
  return db;
}
