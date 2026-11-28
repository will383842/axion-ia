// Aide de test (PR N) : un faux client Prisma qui ENREGISTRE chaque appel `modèle.méthode`.
export interface Appel {
  op: string;
  args: unknown;
}

export function fauxPrisma(retours: Record<string, unknown> = {}) {
  const appels: Appel[] = [];
  const defauts: Record<string, unknown> = {
    findMany: [],
    findFirst: null,
    count: 0,
    aggregate: { _max: { verseeAt: null, emiseAt: null, verseAt: null } },
    updateMany: { count: 1 },
    deleteMany: { count: 1 },
    create: {},
    update: {},
  };
  const client: Record<string, unknown> = {
    appels,
    $executeRawUnsafe: async (sql: string) => {
      appels.push({ op: "$executeRawUnsafe", args: sql });
      return 0;
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  };
  const modeles = [
    "apporteurReseau",
    "pieceApporteur",
    "pieceApporteurContenu",
    "pieceAutofactureApporteur",
    "commissionApporteur",
    "apporteurVirementCompte",
    "apporteurChangementIban",
    "apporteurChangementIbanRib",
    "apporteurIbanHistorique",
    "apporteurPurgeRgpd",
    "presentationEntreprise",
    "releveMensuelApporteur",
  ];
  for (const m of modeles) {
    client[m] = new Proxy(
      {},
      {
        get: (_t, methode: string) => async (args: unknown) => {
          const op = `${m}.${methode}`;
          appels.push({ op, args });
          if (op in retours) {
            const r = retours[op];
            return typeof r === "function" ? (r as (a: unknown) => unknown)(args) : r;
          }
          return defauts[methode] ?? null;
        },
      },
    );
  }
  return client as typeof client & { appels: Appel[] };
}

export const ecritures = (appels: Appel[]) =>
  appels.filter((a) =>
    /\.(create|update|updateMany|delete|deleteMany|upsert)$|\$executeRaw/.test(a.op),
  );
