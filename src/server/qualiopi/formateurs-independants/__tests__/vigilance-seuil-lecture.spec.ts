/**
 * Lot G1 (correctif de la relecture) — la LECTURE du cumul des honoraires HT compte
 * chaque somme UNE fois et une seule : facture, avoir, réémission, trop-perçu imputé,
 * indemnité d'annulation.
 *
 * 🔴 Le cumul déclenche une obligation légale (attestation URSSAF) : en cas de doute il
 * SUR-estime, jamais il ne sous-estime. Les deux défauts corrigés ici allaient dans le
 * sens dangereux :
 *   - un avoir TOTAL (pièce non payée, passée en `annule`) était déduit une seconde fois ;
 *   - un trop-perçu IMPUTÉ sur le relevé suivant était déduit une seconde fois (l'avoir
 *     partiel l'avait déjà déduit ; l'imputation est un remboursement).
 *
 * Le faux client applique les filtres que la lecture envoie (formateur, statut) sur une
 * petite base en mémoire, et rend les relations demandées par `select` — rien d'autre.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { gardeVirementMission, type ContexteVirementMission } from "../paiement/virement-mission";
import { phaseVigilanceFormateur, vigilanceExigible } from "../vigilance-seuil";
import {
  lireCumulHonorairesHtCents,
  lireCumulsHonorairesHtCents,
  type ClientCumulHonoraires,
} from "../vigilance-seuil-lecture";

interface Releve {
  id: string;
  trainerId: string;
  statut: "brouillon" | "a_valider" | "valide" | "facture_recue" | "paye" | "annule";
  totalHtCents: number;
  avoirDeId?: string;
}
interface Ligne {
  statementId: string;
  montantHtCents: number;
  statut: "previsionnel" | "calcule" | "valide" | "annule";
  imputeDeStatementId?: string;
}

type Filtre = string | { in?: string[]; not?: unknown } | undefined;
function accepte(v: unknown, f: Filtre): boolean {
  if (f === undefined) return true;
  if (typeof f === "string") return v === f;
  if (f.in) return f.in.includes(v as string);
  if ("not" in f) return f.not === null ? v !== null && v !== undefined : v !== f.not;
  return true;
}

/** Une base en mémoire qui répond comme Prisma aux deux lectures (`aggregate`, `findMany`). */
function base(releves: Releve[], lignes: Ligne[] = []): ClientCumulHonoraires {
  const filtrer = (where: Record<string, Filtre>) =>
    releves.filter((r) => accepte(r.trainerId, where.trainerId) && accepte(r.statut, where.statut));
  const projeter = (r: Releve, select: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(select)) {
      if (k === "avoirDe") {
        const o = r.avoirDeId ? releves.find((x) => x.id === r.avoirDeId) : undefined;
        out.avoirDe = o ? { statut: o.statut } : null;
      } else if (k === "feeLines") {
        const w = ((v as { where?: Record<string, Filtre> }).where ?? {}) as Record<string, Filtre>;
        out.feeLines = lignes
          .filter(
            (l) =>
              l.statementId === r.id &&
              accepte(l.statut, w.statut) &&
              accepte(l.imputeDeStatementId ?? null, w.imputeDeStatementId),
          )
          .map((l) => ({ montantHtCents: l.montantHtCents }));
      } else {
        out[k] = (r as unknown as Record<string, unknown>)[k] ?? null;
      }
    }
    return out;
  };
  return {
    trainerStatement: {
      async aggregate(a: unknown) {
        const { where } = a as { where: Record<string, Filtre> };
        const lus = filtrer(where);
        return {
          _sum: { totalHtCents: lus.length ? lus.reduce((s, r) => s + r.totalHtCents, 0) : null },
        };
      },
      async findMany(a: unknown) {
        const { where, select } = a as {
          where: Record<string, Filtre>;
          select: Record<string, unknown>;
        };
        return filtrer(where).map((r) => projeter(r, select));
      },
    },
  } as unknown as ClientCumulHonoraires;
}

const T = "11111111-1111-4111-8111-111111111111";
const AUTRE = "99999999-9999-4999-8999-999999999999";
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

/** Mission de juillet 2026 (dernière journée le 31/07), virement le 15/08, sans attestation. */
const virement: ContexteVirementMission = {
  derniereJournee: "2026-07-31",
  echeance: "2026-08-30",
  aujourdhui: "2026-08-15",
  maintenant: new Date("2026-08-15T10:00:00Z"),
  totalTtcCents: 0,
  attestationsValidesJusquau: [],
  demandeIbanEnAttente: false,
  dernierChangementIban: null,
  ibanEmpreinteActuelle: "a".repeat(64),
  ibanEmpreinteAffichee: "a".repeat(64),
  finPourDeces: false,
};
const virementAttend = (cumul: number | null) =>
  !gardeVirementMission({ ...virement, vigilanceExigible: vigilanceExigible(cumul) }).autorise;

/* ─── Les cas, chiffrés à la main ─────────────────────────────────────────────── */

function casFactureSeule() {
  return base([{ id: id(), trainerId: T, statut: "paye", totalHtCents: 250_000 }]);
}

/** 3 000 payé ; pièce de 2 500 annulée par avoir TOTAL ; avoir −2 500 ; réémission 2 500. */
function casAvoirTotalEtReemission() {
  const piece = id();
  return base(
    [
      { id: id(), trainerId: T, statut: "paye", totalHtCents: 300_000 },
      { id: piece, trainerId: T, statut: "annule", totalHtCents: 250_000 },
      { id: id(), trainerId: T, statut: "valide", totalHtCents: -250_000, avoirDeId: piece },
      { id: id(), trainerId: T, statut: "facture_recue", totalHtCents: 250_000 },
    ],
    [],
  );
}

/** 4 000 payé + 1 500 reçu ; avoir PARTIEL −600 d'une pièce payée, pas encore imputé. */
function casAvoirPartielNonImpute() {
  const payee = id();
  return base([
    { id: payee, trainerId: T, statut: "paye", totalHtCents: 400_000 },
    { id: id(), trainerId: T, statut: "facture_recue", totalHtCents: 150_000 },
    { id: id(), trainerId: T, statut: "valide", totalHtCents: -60_000, avoirDeId: payee },
  ]);
}

/**
 * 4 000 payé ; trop-perçu de 500 → avoir partiel −500 ; relevé suivant de 2 000 portant
 * une ligne d'imputation −500 (total 1 500), facture reçue.
 */
function casTropPercuImpute(statutSuivant: Releve["statut"] = "facture_recue") {
  const payee = id();
  const avoir = id();
  const suivant = id();
  return base(
    [
      { id: payee, trainerId: T, statut: "paye", totalHtCents: 400_000 },
      { id: avoir, trainerId: T, statut: "valide", totalHtCents: -50_000, avoirDeId: payee },
      { id: suivant, trainerId: T, statut: statutSuivant, totalHtCents: 150_000 },
    ],
    [
      { statementId: suivant, montantHtCents: 200_000, statut: "calcule" },
      { statementId: suivant, montantHtCents: -50_000, statut: "calcule", imputeDeStatementId: avoir },
    ],
  );
}

/** 3 000 payé + relevé d'indemnité d'annulation de 1 200, validé. */
function casIndemnite() {
  const indem = id();
  return base(
    [
      { id: id(), trainerId: T, statut: "paye", totalHtCents: 300_000 },
      { id: indem, trainerId: T, statut: "valide", totalHtCents: 120_000 },
    ],
    [{ statementId: indem, montantHtCents: 120_000, statut: "valide" }],
  );
}

/** 2 000 payé ; 9 000 brouillon, 9 000 à valider, 9 000 annulé (sans avoir) : 2 000. */
function casNonComptes() {
  return base([
    { id: id(), trainerId: T, statut: "paye", totalHtCents: 200_000 },
    { id: id(), trainerId: T, statut: "brouillon", totalHtCents: 900_000 },
    { id: id(), trainerId: T, statut: "a_valider", totalHtCents: 900_000 },
    { id: id(), trainerId: T, statut: "annule", totalHtCents: 900_000 },
    { id: id(), trainerId: AUTRE, statut: "paye", totalHtCents: 900_000 },
  ]);
}

const CAS = [
  {
    nom: "1. facture seule — 2 500",
    db: casFactureSeule,
    cumul: 250_000,
    phase: "sous_le_seuil",
    attend: false,
  },
  {
    // 3 000 + 2 500 (réémission) ; la pièce annulée ET son avoir total sortent ensemble.
    nom: "2. facture + avoir total + réémission — 5 500",
    db: casAvoirTotalEtReemission,
    cumul: 550_000,
    phase: "seuil_atteint",
    attend: true,
  },
  {
    // 4 000 + 1 500 − 600 : l'avoir partiel est déduit une fois.
    nom: "3. avoir partiel non imputé — 4 900",
    db: casAvoirPartielNonImpute,
    cumul: 490_000,
    phase: "approche",
    attend: false,
  },
  {
    // 4 000 − 500 (avoir) + 2 000 (le relevé suivant AVANT imputation) = 5 500.
    nom: "4. trop-perçu imputé sur le relevé suivant — 5 500",
    db: () => casTropPercuImpute(),
    cumul: 550_000,
    phase: "seuil_atteint",
    attend: true,
  },
  {
    // 3 000 + 1 200.
    nom: "5. indemnité d'annulation — 4 200",
    db: casIndemnite,
    cumul: 420_000,
    phase: "approche",
    attend: false,
  },
  {
    nom: "6. brouillon, à valider, annulé (et un autre formateur) non comptés — 2 000",
    db: casNonComptes,
    cumul: 200_000,
    phase: "sous_le_seuil",
    attend: false,
  },
] as const;

describe("contre-calcul de la LECTURE du cumul : chaque somme une fois", () => {
  for (const c of CAS) {
    it(c.nom, async () => {
      const cumul = await lireCumulHonorairesHtCents(T, c.db());
      expect(cumul).toBe(c.cumul);
      expect(phaseVigilanceFormateur(cumul)).toBe(c.phase);
      expect(virementAttend(cumul)).toBe(c.attend);
    });
  }

  it("le même contre-calcul par la lecture GROUPÉE (alertes, relances, renouvellement)", async () => {
    for (const c of CAS) {
      const cumuls = await lireCumulsHonorairesHtCents([T], c.db());
      expect(cumuls.get(T), c.nom).toBe(c.cumul);
    }
  });

  it("trop-perçu imputé sur un relevé suivant encore à valider : seul l'avoir compte (3 500)", async () => {
    expect(await lireCumulHonorairesHtCents(T, casTropPercuImpute("a_valider"))).toBe(350_000);
  });

  it("une imputation annulée ne se rajoute pas", async () => {
    const payee = id();
    const avoir = id();
    const suivant = id();
    const db = base(
      [
        { id: payee, trainerId: T, statut: "paye", totalHtCents: 400_000 },
        { id: avoir, trainerId: T, statut: "valide", totalHtCents: -50_000, avoirDeId: payee },
        { id: suivant, trainerId: T, statut: "paye", totalHtCents: 200_000 },
      ],
      [
        { statementId: suivant, montantHtCents: 200_000, statut: "valide" },
        { statementId: suivant, montantHtCents: -50_000, statut: "annule", imputeDeStatementId: avoir },
      ],
    );
    expect(await lireCumulHonorairesHtCents(T, db)).toBe(550_000);
  });

  it("lecture groupée : un formateur sans relevé vaut 0 ; une lecture en échec rend null pour tous", async () => {
    const cumuls = await lireCumulsHonorairesHtCents([T, AUTRE], casFactureSeule());
    expect(cumuls.get(T)).toBe(250_000);
    expect(cumuls.get(AUTRE)).toBe(0);
    const panne = {
      trainerStatement: {
        aggregate: async () => {
          throw new Error("no db");
        },
        findMany: async () => {
          throw new Error("no db");
        },
      },
    } as unknown as ClientCumulHonoraires;
    expect(await lireCumulHonorairesHtCents(T, panne)).toBeNull();
    const g = await lireCumulsHonorairesHtCents([T, AUTRE], panne);
    expect([g.get(T), g.get(AUTRE)]).toEqual([null, null]);
  });
});
