// Base EN MÉMOIRE pour les tests de la preuve de l'accord (contacts de la page + demandes +
// registre de consentements). Données 100 % fictives (example.test). Sert aux deux specs
// (confirmation au clic, mise à l'écart) : un seul comportement de `where` à maintenir.

export type Ligne = Record<string, unknown>;

export interface BasePreuve {
  contacts: Ligne[];
  demandes: Ligne[];
  registre: Ligne[];
  /** Appels de suppression : doivent rester VIDES. */
  suppressions: string[];
  /** Nombre de requêtes sur les contacts de la page (l'interrupteur éteint → 0). */
  requetes: number;
  panneContacts: Error | null;
  /** Appelé APRÈS une lecture de contacts, avant que l'appelant n'écrive (simule une course). */
  apresLecture: (() => void) | null;
}

export function nouvelleBase(): BasePreuve {
  return {
    contacts: [],
    demandes: [],
    registre: [],
    suppressions: [],
    requetes: 0,
    panneContacts: null,
    apresLecture: null,
  };
}

const t = (v: unknown): number | string | null =>
  v instanceof Date ? v.getTime() : typeof v === "string" ? v : null;
const avant = (a: unknown, b: unknown): boolean => t(a)! < t(b)!;

function conditionValeur(valeur: unknown, cond: unknown): boolean {
  if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
    const c = cond as Record<string, unknown>;
    if ("in" in c) return (c["in"] as unknown[]).includes(valeur);
    if ("lte" in c) return t(valeur) !== null && !avant(c["lte"], valeur);
    if ("lt" in c) return t(valeur) !== null && avant(valeur, c["lt"]);
    if ("gt" in c) return t(valeur) !== null && avant(c["gt"], valeur);
    if ("gte" in c) return t(valeur) !== null && !avant(valeur, c["gte"]);
    if ("not" in c) return valeur !== c["not"];
    throw new Error(`condition non gérée : ${JSON.stringify(Object.keys(c))}`);
  }
  if (cond instanceof Date) return t(valeur) === t(cond);
  return valeur === cond;
}

export function correspond(l: Ligne, where: Ligne | undefined): boolean {
  if (where === undefined) return true;
  return Object.entries(where).every(([cle, cond]) => {
    if (cle === "OR") return (cond as Ligne[]).some((w) => correspond(l, w));
    if (cle === "AND") return (cond as Ligne[]).every((w) => correspond(l, w));
    return conditionValeur(l[cle], cond);
  });
}

/** Un faux client Prisma : seulement ce que `preuve-page-guide.ts` appelle. */
export function clientPrisma(base: BasePreuve) {
  const garde = () => {
    base.requetes += 1;
    if (base.panneContacts) throw base.panneContacts;
  };
  const interdit = (nom: string) => async () => {
    base.suppressions.push(nom);
    throw new Error(`${nom} ne doit JAMAIS être appelé`);
  };
  return {
    contactGuideReseau: {
      updateMany: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        garde();
        const visees = base.contacts.filter((c) => correspond(c, where));
        for (const c of visees) Object.assign(c, data);
        return { count: visees.length };
      },
      findMany: async ({
        where,
        orderBy,
        take,
      }: {
        where?: Ligne;
        orderBy?: Ligne | Ligne[];
        take?: number;
      }) => {
        garde();
        let r = base.contacts.filter((c) => correspond(c, where));
        const ordres = orderBy === undefined ? [] : Array.isArray(orderBy) ? orderBy : [orderBy];
        r = [...r].sort((a, b) => {
          for (const o of ordres) {
            const [k, sens] = Object.entries(o)[0]! as [string, "asc" | "desc"];
            const va = a[k] instanceof Date ? (a[k] as Date).getTime() : (a[k] as string | number);
            const vb = b[k] instanceof Date ? (b[k] as Date).getTime() : (b[k] as string | number);
            if (va === vb) continue;
            return (va! < vb! ? -1 : 1) * (sens === "desc" ? -1 : 1);
          }
          return 0;
        });
        const lignes = take === undefined ? r : r.slice(0, take);
        base.apresLecture?.();
        // Jointure « guideRequest » demandée par select/include : on la rend à plat.
        return lignes.map((c) => ({
          ...c,
          guideRequest: base.demandes.find((d) => d["id"] === c["guideRequestId"]) ?? null,
        }));
      },
      delete: interdit("contactGuideReseau.delete"),
      deleteMany: interdit("contactGuideReseau.deleteMany"),
    },
    guideRequest: {
      findUnique: async ({ where }: { where: Ligne }) =>
        base.demandes.find((d) => correspond(d, where)) ?? null,
      delete: interdit("guideRequest.delete"),
      deleteMany: interdit("guideRequest.deleteMany"),
    },
    consentEvent: {
      findFirst: async ({ where }: { where: Ligne }) =>
        base.registre.find((r) => correspond(r, where)) ?? null,
      delete: interdit("consentEvent.delete"),
      deleteMany: interdit("consentEvent.deleteMany"),
      update: interdit("consentEvent.update"),
      updateMany: interdit("consentEvent.updateMany"),
    },
  };
}

/** Faux `recordConsentEvent` : consigne la ligne comme le vrai (personKey = « h:adresse »). */
export function enregistreurRegistre(base: BasePreuve) {
  return async (input: {
    email: string;
    formRef: string;
    consentVersion: string;
    action: string;
    occurredAt?: Date;
  }): Promise<boolean> => {
    base.registre.push({
      personKey: `h:${input.email.trim().toLowerCase()}`,
      formRef: input.formRef,
      consentVersion: input.consentVersion,
      action: input.action,
      occurredAt: input.occurredAt,
    });
    return true;
  };
}
