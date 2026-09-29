/**
 * Une FAUSSE BASE en mémoire pour les tests de l'enregistreur (PR 5).
 *
 * Elle imite le sous-ensemble de Prisma que le circuit utilise : `findUnique`,
 * `findFirst`, `findMany`, `count`, `create`, `createMany`, `update`,
 * `updateMany`, `upsert`, `delete` ; filtres d'égalité, `in`, `not`, `gte`,
 * `lte`, `gt`, `lt`, `contains`, `OR` ; relations à un et à plusieurs ;
 * `select` imbriqués et `_count`. Et surtout les CONTRAINTES qui comptent :
 * unicité (dont l'index partiel « un seul enregistrement actif par
 * rencontre »), levées avec le code `P2002` comme Prisma.
 *
 * ⚠️ Ce n'est pas Postgres : les triggers, les CHECK et les clés composées
 * sont prouvés par Gate D (`tests/sql/dossier-client-comportement.sql`). Ici,
 * on prouve le comportement du CODE.
 */

import { randomUUID } from "node:crypto";

type Ligne = Record<string, unknown>;

interface Relation {
  readonly table: string;
  readonly local: string;
  readonly distant: string;
  readonly un: boolean;
}

const RELATIONS: Readonly<Record<string, Readonly<Record<string, Relation>>>> = {
  enregistrement: {
    rencontre: { table: "rencontre", local: "rencontreId", distant: "id", un: true },
    tranches: {
      table: "enregistrementTranche",
      local: "id",
      distant: "enregistrementId",
      un: false,
    },
  },
  rencontre: {
    calendlyEvent: { table: "calendlyEvent", local: "calendlyEventId", distant: "id", un: true },
    participants: { table: "rencontreParticipant", local: "id", distant: "rencontreId", un: false },
    enregistrements: { table: "enregistrement", local: "id", distant: "rencontreId", un: false },
  },
  enregistrementTranche: {
    morceaux: { table: "enregistrementMorceau", local: "id", distant: "trancheId", un: false },
    enregistrement: { table: "enregistrement", local: "enregistrementId", distant: "id", un: true },
  },
  enregistrementMorceau: {
    tranche: { table: "enregistrementTranche", local: "trancheId", distant: "id", un: true },
  },
  // Les sept relations de la règle B3 (`RELATIONS_B3`), pour `_count`.
  client: Object.fromEntries(
    [
      ["devis", "devis"],
      ["facturesFormation", "factureFormation"],
      ["sessions", "trainingSession"],
      ["enrollmentsFinances", "enrollment"],
      ["coachingContracts", "coachingContract"],
      ["auditMissions", "auditMission"],
      ["dossiersFinancement", "dossierFinancement"],
    ].map(([rel, table]) => [
      rel as string,
      { table: table as string, local: "id", distant: "clientId", un: false },
    ]),
  ),
};

/** Clés composées : `a_b_c: { a, b, c }` → trois égalités. */
const CLES_COMPOSEES = new Set(["enregistrementId_piste_numero", "trancheId_seq"]);

/** Unicités à faire respecter (colonnes). */
const UNICITES: Readonly<Record<string, ReadonlyArray<ReadonlyArray<string>>>> = {
  enregistrement: [["id"], ["cleClient"]],
  enregistrementTranche: [["id"], ["enregistrementId", "piste", "numero"]],
  enregistrementMorceau: [["trancheId", "seq"], ["cleR2"]],
  rencontre: [["id"], ["calendlyEventId"]],
  appareilEnregistrement: [["id"], ["jetonHash"]],
  setting: [["key"]],
  alerteVisio: [["cle"]],
  battementCircuit: [["nom"]],
};

const DEFAUTS: Readonly<Record<string, () => Ligne>> = {
  enregistrement: () => ({
    id: randomUUID(),
    incomplet: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  enregistrementTranche: () => ({ id: randomUUID(), tailleOctets: 0 }),
  enregistrementMorceau: () => ({ recuLe: new Date() }),
  enregistrementConsentement: () => ({ id: randomUUID() }),
  rencontre: () => ({
    id: randomUUID(),
    estTestInterne: false,
    repriseHistorique: false,
    rattachementStatut: "a_classer",
    type: "inconnu",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  appareilEnregistrement: () => ({ id: randomUUID(), creeLe: new Date() }),
  alerteVisio: () => ({ premiereLe: new Date(), essais: 0, envoyeeLe: null, dernierEssaiLe: null }),
  alerteSysteme: () => ({
    id: randomUUID(),
    cibleId: null,
    cibleType: null,
    lu: false,
    resolue: false,
    resolueAt: null,
    notifiedAt: null,
    metadata: {},
    createdAt: new Date(),
  }),
  battementCircuit: () => ({ premierLe: new Date() }),
  consentEvent: () => ({ id: randomUUID(), createdAt: new Date() }),
  calendlyEvent: () => ({ id: randomUUID(), status: "scheduled", rawPayload: {} }),
  clientContact: () => ({ id: randomUUID() }),
  rencontreParticipant: () => ({ id: randomUUID() }),
  client: () => ({ id: randomUUID() }),
  adminUser: () => ({ id: randomUUID(), status: "active" }),
  setting: () => ({ updatedAt: new Date() }),
};

/** Tables dont `updatedAt` est posé automatiquement (`@updatedAt`). */
const AVEC_UPDATED_AT = new Set(["enregistrement", "rencontre", "setting"]);

const ETATS_ACTIFS = new Set(["accord_en_attente", "en_cours", "interrompu"]);

function conflit(table: string, champs: string): Error {
  const e = new Error(`Unique constraint failed on ${table}(${champs})`);
  (e as Error & { code: string }).code = "P2002";
  return e;
}

function egal(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if ((a === undefined || a === null) && (b === undefined || b === null)) return true;
  return a === b;
}

function comparer(a: unknown, b: unknown): number {
  const va = a instanceof Date ? a.getTime() : (a as number);
  const vb = b instanceof Date ? b.getTime() : (b as number);
  return va < vb ? -1 : va > vb ? 1 : 0;
}

const OPERATEURS = new Set(["in", "not", "gte", "lte", "gt", "lt", "contains", "mode", "equals"]);

function estOperateurs(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    !(v instanceof Date) &&
    !Array.isArray(v) &&
    Object.keys(v).length > 0 &&
    Object.keys(v).every((k) => OPERATEURS.has(k))
  );
}

export class FausseBase {
  readonly tables: Record<string, Ligne[]> = {};

  constructor() {
    return new Proxy(this, {
      get: (cible, nom: string | symbol) => {
        if (typeof nom !== "string" || nom in cible) return Reflect.get(cible, nom);
        return cible.modele(nom);
      },
    });
  }

  /**
   * `$transaction(fn)` : `fn` reçoit la base elle-même. ⚠️ Pas d'annulation :
   * une exception n'efface pas les écritures faites avant elle. Suffit pour
   * rejouer `assurerRencontrePourCalendly` (PR 4) sous la liste du jour ;
   * l'atomicité de cette fonction est prouvée par les tests du dossier client.
   */
  async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    return fn(this);
  }

  lignes(table: string): Ligne[] {
    this.tables[table] ??= [];
    return this.tables[table];
  }

  /** Insère une ligne telle quelle (défauts appliqués), sans contrôle. */
  semer(table: string, ligne: Ligne): Ligne {
    const complete = { ...(DEFAUTS[table]?.() ?? {}), ...ligne };
    this.lignes(table).push(complete);
    return complete;
  }

  private correspond(
    table: string,
    ligne: Ligne,
    where: Record<string, unknown> | undefined,
  ): boolean {
    if (!where) return true;
    for (const [cle, attendu] of Object.entries(where)) {
      if (attendu === undefined) continue;
      if (cle === "OR") {
        if (
          !(attendu as Array<Record<string, unknown>>).some((w) => this.correspond(table, ligne, w))
        )
          return false;
        continue;
      }
      if (cle === "AND") {
        if (
          !(attendu as Array<Record<string, unknown>>).every((w) =>
            this.correspond(table, ligne, w),
          )
        )
          return false;
        continue;
      }
      if (cle === "NOT") {
        if (this.correspond(table, ligne, attendu as Record<string, unknown>)) return false;
        continue;
      }
      if (CLES_COMPOSEES.has(cle)) {
        if (!this.correspond(table, ligne, attendu as Record<string, unknown>)) return false;
        continue;
      }
      const rel = RELATIONS[table]?.[cle];
      if (rel) {
        const lies = this.lies(ligne, rel);
        const quantif = attendu as Record<string, unknown>;
        if (!rel.un && ("some" in quantif || "none" in quantif || "every" in quantif)) {
          // Filtres de relation à plusieurs, comme Prisma : `some`, `none`, `every`.
          const sous = (k: string) => quantif[k] as Record<string, unknown>;
          if ("some" in quantif && !lies.some((l) => this.correspond(rel.table, l, sous("some"))))
            return false;
          if ("none" in quantif && lies.some((l) => this.correspond(rel.table, l, sous("none"))))
            return false;
          if (
            "every" in quantif &&
            !lies.every((l) => this.correspond(rel.table, l, sous("every")))
          )
            return false;
          continue;
        }
        if (rel.un) {
          const lie = lies[0];
          if (!lie || !this.correspond(rel.table, lie, attendu as Record<string, unknown>))
            return false;
        } else if (
          !lies.some((l) => this.correspond(rel.table, l, attendu as Record<string, unknown>))
        ) {
          return false;
        }
        continue;
      }
      const valeur = ligne[cle];
      if (estOperateurs(attendu)) {
        for (const [op, arg] of Object.entries(attendu)) {
          if (op === "mode") continue;
          if (op === "in" && !(arg as unknown[]).some((x) => egal(valeur, x))) return false;
          if (op === "equals" && !egal(valeur, arg)) return false;
          if (op === "not") {
            if (arg === null) {
              if (valeur === null || valeur === undefined) return false;
            } else if (estOperateurs(arg)) {
              if (this.correspond(table, ligne, { [cle]: arg })) return false;
            } else if (egal(valeur, arg)) return false;
          }
          if (op === "contains") {
            const insensible = (attendu as { mode?: string }).mode === "insensitive";
            const v = String(valeur ?? "");
            const a = String(arg);
            if (!(insensible ? v.toLowerCase().includes(a.toLowerCase()) : v.includes(a)))
              return false;
          }
          if (["gte", "lte", "gt", "lt"].includes(op)) {
            if (valeur === null || valeur === undefined) return false;
            const c = comparer(valeur, arg);
            if (op === "gte" && c < 0) return false;
            if (op === "lte" && c > 0) return false;
            if (op === "gt" && c <= 0) return false;
            if (op === "lt" && c >= 0) return false;
          }
        }
        continue;
      }
      if (!egal(valeur, attendu)) return false;
    }
    return true;
  }

  private lies(ligne: Ligne, rel: Relation): Ligne[] {
    const v = ligne[rel.local];
    if (v === null || v === undefined) return [];
    return this.lignes(rel.table).filter((l) => egal(l[rel.distant], v));
  }

  private projeter(
    table: string,
    ligne: Ligne,
    select?: Record<string, unknown>,
    include?: Record<string, unknown>,
  ): Ligne {
    const sortie: Ligne = {};
    const base = select ? Object.keys(select).filter((k) => select[k]) : Object.keys(ligne);
    for (const k of base) {
      if (k === "_count") {
        const quoi = (select?.["_count"] as { select: Record<string, boolean> }).select;
        const compte: Record<string, number> = {};
        for (const r of Object.keys(quoi)) {
          const rel = RELATIONS[table]?.[r];
          compte[r] = rel ? this.lies(ligne, rel).length : 0;
        }
        sortie["_count"] = compte;
        continue;
      }
      const rel = RELATIONS[table]?.[k];
      if (rel) {
        sortie[k] = this.lireRelation(ligne, rel, select?.[k]);
        continue;
      }
      sortie[k] = ligne[k] ?? null;
    }
    if (include) {
      for (const [k, v] of Object.entries(include)) {
        const rel = RELATIONS[table]?.[k];
        if (rel && v) sortie[k] = this.lireRelation(ligne, rel, v);
      }
    }
    return sortie;
  }

  private lireRelation(ligne: Ligne, rel: Relation, arg: unknown): unknown {
    const opts = typeof arg === "object" && arg !== null ? (arg as Record<string, unknown>) : {};
    let lies = this.lies(ligne, rel).filter((l) =>
      this.correspond(rel.table, l, opts["where"] as Record<string, unknown> | undefined),
    );
    if (typeof opts["take"] === "number") lies = lies.slice(0, opts["take"]);
    const proj = lies.map((l) =>
      this.projeter(rel.table, l, opts["select"] as Record<string, unknown> | undefined),
    );
    return rel.un ? (proj[0] ?? null) : proj;
  }

  private verifierUnicite(table: string, candidat: Ligne, sauf?: Ligne): void {
    for (const champs of UNICITES[table] ?? []) {
      if (champs.some((c) => candidat[c] === null || candidat[c] === undefined)) continue;
      const doublon = this.lignes(table).some(
        (l) => l !== sauf && champs.every((c) => egal(l[c], candidat[c])),
      );
      if (doublon) throw conflit(table, champs.join(","));
    }
    if (table === "enregistrement" && ETATS_ACTIFS.has(String(candidat["statut"]))) {
      const autreActif = this.lignes(table).some(
        (l) =>
          l !== sauf &&
          egal(l["rencontreId"], candidat["rencontreId"]) &&
          ETATS_ACTIFS.has(String(l["statut"])),
      );
      if (autreActif) throw conflit(table, "rencontre_id (un seul actif)");
    }
  }

  private appliquer(table: string, ligne: Ligne, data: Ligne): Ligne {
    const nouvelle: Ligne = { ...ligne };
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      if (typeof v === "object" && v !== null && !(v instanceof Date) && "increment" in v) {
        nouvelle[k] = Number(nouvelle[k] ?? 0) + Number((v as { increment: number }).increment);
      } else {
        nouvelle[k] = v;
      }
    }
    if (AVEC_UPDATED_AT.has(table) && !("updatedAt" in data)) nouvelle["updatedAt"] = new Date();
    return nouvelle;
  }

  private remplacer(table: string, ancienne: Ligne, nouvelle: Ligne): void {
    const liste = this.lignes(table);
    liste[liste.indexOf(ancienne)] = nouvelle;
  }

  modele(table: string): Record<string, (args?: Record<string, unknown>) => Promise<unknown>> {
    const trouver = (where?: Record<string, unknown>): Ligne[] =>
      this.lignes(table).filter((l) => this.correspond(table, l, where));
    return {
      findUnique: async (a = {}) => {
        const l = trouver(a["where"] as Record<string, unknown>)[0];
        return l ? this.projeter(table, l, a["select"] as never, a["include"] as never) : null;
      },
      findFirst: async (a = {}) => {
        const l = trouver(a["where"] as Record<string, unknown>)[0];
        return l ? this.projeter(table, l, a["select"] as never, a["include"] as never) : null;
      },
      findMany: async (a = {}) => {
        let ls = trouver(a["where"] as Record<string, unknown>);
        const ordre = a["orderBy"] as Record<string, "asc" | "desc"> | undefined;
        if (ordre) {
          const [k, sens] = Object.entries(ordre)[0] ?? [];
          if (k) ls = [...ls].sort((x, y) => comparer(x[k], y[k]) * (sens === "desc" ? -1 : 1));
        }
        if (typeof a["take"] === "number") ls = ls.slice(0, a["take"]);
        return ls.map((l) => this.projeter(table, l, a["select"] as never, a["include"] as never));
      },
      count: async (a = {}) => trouver(a["where"] as Record<string, unknown>).length,
      create: async (a = {}) => {
        const ligne = { ...(DEFAUTS[table]?.() ?? {}), ...(a["data"] as Ligne) };
        this.verifierUnicite(table, ligne);
        this.lignes(table).push(ligne);
        return this.projeter(table, ligne, a["select"] as never);
      },
      createMany: async (a = {}) => {
        const donnees = a["data"] as Ligne[];
        for (const d of donnees) {
          const ligne = { ...(DEFAUTS[table]?.() ?? {}), ...d };
          this.verifierUnicite(table, ligne);
          this.lignes(table).push(ligne);
        }
        return { count: donnees.length };
      },
      update: async (a = {}) => {
        const l = trouver(a["where"] as Record<string, unknown>)[0];
        if (!l) throw Object.assign(new Error(`${table} introuvable`), { code: "P2025" });
        const n = this.appliquer(table, l, a["data"] as Ligne);
        this.verifierUnicite(table, n, l);
        this.remplacer(table, l, n);
        return this.projeter(table, n, a["select"] as never);
      },
      updateMany: async (a = {}) => {
        const ls = trouver(a["where"] as Record<string, unknown>);
        for (const l of ls) {
          const n = this.appliquer(table, l, a["data"] as Ligne);
          this.verifierUnicite(table, n, l);
          this.remplacer(table, l, n);
        }
        return { count: ls.length };
      },
      upsert: async (a = {}) => {
        const l = trouver(a["where"] as Record<string, unknown>)[0];
        if (l) {
          const n = this.appliquer(table, l, a["update"] as Ligne);
          this.remplacer(table, l, n);
          return this.projeter(table, n, a["select"] as never);
        }
        const ligne = { ...(DEFAUTS[table]?.() ?? {}), ...(a["create"] as Ligne) };
        this.verifierUnicite(table, ligne);
        this.lignes(table).push(ligne);
        return this.projeter(table, ligne, a["select"] as never);
      },
      delete: async (a = {}) => {
        const l = trouver(a["where"] as Record<string, unknown>)[0];
        if (!l) throw Object.assign(new Error(`${table} introuvable`), { code: "P2025" });
        this.lignes(table).splice(this.lignes(table).indexOf(l), 1);
        return l;
      },
    };
  }
}

/** Une fausse base typée comme le client Prisma (les tests n'utilisent que ce sous-ensemble). */
export function fausseBase(): FausseBase {
  return new FausseBase();
}

/** Un stockage audio en mémoire : ce qui atteint réellement « R2 ». */
export function fauxStockage(options: { echecDepot?: boolean; echecSuppression?: boolean } = {}) {
  const objets = new Map<string, Buffer>();
  return {
    objets,
    disponible: () => true,
    deposer: async (cle: string, octets: Buffer) => {
      if (options.echecDepot) throw new Error("R2 injoignable");
      objets.set(cle, Buffer.from(octets));
    },
    supprimer: async (cle: string) => {
      if (options.echecSuppression) throw new Error("R2 injoignable");
      objets.delete(cle);
    },
    lire: async (cle: string) => objets.get(cle) ?? null,
    existe: async (cle: string) => objets.has(cle),
  };
}
