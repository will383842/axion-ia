/**
 * 🔴 `D3` — L'ARGENT QUI SORT EST GARDÉ COMME CELUI QUI ENTRE (2026-09-05).
 *
 * ## Le défaut que ces témoins ferment
 *
 * Les quatre actions monétaires du module de rémunération — le run mensuel, les
 * transitions de relevé (dont `→ paye`), la pose et la clôture d'un barème — se
 * contentaient de `requireAdminWrite`, qui autorise `editor`. **Un compte
 * éditorial pouvait donc créer le barème d'un formateur et marquer son relevé
 * « payé »**, alors que le même compte ne pouvait ni émettre une facture ni
 * contresigner : ces deux-là passent par `requireHabilitation`. Le code
 * protégeait l'argent qui ENTRE, pas celui qui SORT.
 *
 * ## Pourquoi DEUX fichiers de témoins et pas un
 *
 * `server/auth/habilitations.spec.ts` verrouille la MATRICE (qui a le droit) ;
 * celui-ci verrouille le CÂBLAGE (l'action interroge-t-elle la matrice ?). Une
 * matrice juste derrière une garde qui ne l'appelle pas ne garde rien — c'est
 * exactement l'état du dépôt jusqu'au 2026-08-15, et c'était encore l'état de
 * ce module-ci jusqu'à aujourd'hui.
 *
 * 🔑 `requireAdminWrite` reste MOCKÉ et RÉSOLVANT bien que plus aucune action ne
 * doive l'appeler. C'est délibéré : sans lui, un retour en arrière ferait
 * échouer l'action sur un import manquant, et le test rougirait sur un message
 * qui n'apprend rien. Résolvant, il laisse passer — et c'est l'assertion
 * `not.toHaveBeenCalled()` qui NOMME la régression.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireHabilitationMock, requireAdminWriteMock, runMock, prismaMock } = vi.hoisted(() => ({
  requireHabilitationMock: vi.fn(),
  requireAdminWriteMock: vi.fn(),
  runMock: vi.fn(),
  prismaMock: {
    trainerStatement: { findUnique: vi.fn(), update: vi.fn() },
    trainerCompensationRule: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireHabilitation: requireHabilitationMock,
  requireAdminWrite: requireAdminWriteMock,
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/qualiopi/remuneration/statements", () => ({
  runRemunerationMensuelle: runMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import {
  runRemunerationMensuelleAction,
  transitionStatementAction,
  createCompensationRuleAction,
  closeCompensationRuleAction,
} from "./trainer-remuneration";

const STATEMENT_ID = "44444444-4444-4444-4444-444444444444";
const TRAINER_ID = "55555555-5555-5555-5555-555555555555";
const RULE_ID = "66666666-6666-6666-6666-666666666666";

/** Les quatre surfaces qui engagent l'argent SORTANT, et rien d'autre. */
const ACTIONS_MONETAIRES: ReadonlyArray<{ nom: string; appel: () => Promise<unknown> }> = [
  {
    nom: "runRemunerationMensuelleAction",
    appel: () => runRemunerationMensuelleAction({ year: 2026, month: 9 }),
  },
  {
    nom: "transitionStatementAction (→ paye)",
    appel: () =>
      transitionStatementAction({ id: STATEMENT_ID, to: "paye", moyenPaiement: "virement" }),
  },
  {
    nom: "createCompensationRuleAction",
    appel: () =>
      createCompensationRuleAction({
        trainerId: TRAINER_ID,
        model: "taux_journalier",
        tauxJourneeHtCents: 90000,
        effectiveFrom: "2026-09-01",
      }),
  },
  {
    nom: "closeCompensationRuleAction",
    appel: () => closeCompensationRuleAction({ id: RULE_ID, effectiveTo: "2026-10-01" }),
  },
];

beforeEach(() => {
  requireHabilitationMock.mockReset().mockResolvedValue({ userId: "u-1", role: "super_admin" });
  requireAdminWriteMock.mockReset().mockResolvedValue({ userId: "u-1", role: "editor" });
  runMock.mockReset().mockResolvedValue({
    lignesEcrites: 0,
    relevesEcrits: 0,
    prestationsLues: 0,
    anomalies: [],
    formateursIgnores: [],
    dryRun: false,
  });
  prismaMock.trainerStatement.findUnique.mockReset().mockResolvedValue(null);
  prismaMock.trainerCompensationRule.findUnique.mockReset().mockResolvedValue(null);
  prismaMock.trainerCompensationRule.findMany.mockReset().mockResolvedValue([]);
  prismaMock.$transaction.mockReset().mockResolvedValue(undefined);
});

describe("🔴 D3 — les quatre actions monétaires passent par la matrice", () => {
  it.each(ACTIONS_MONETAIRES.map((a) => [a.nom, a] as const))(
    "%s demande l'acte « remunerer_formateur »",
    async (_nom, action) => {
      await action.appel().catch(() => undefined);
      expect(
        requireHabilitationMock,
        `${action.nom} n'interroge pas la matrice des actes engageants`,
      ).toHaveBeenCalledWith("remunerer_formateur");
    },
  );

  it.each(ACTIONS_MONETAIRES.map((a) => [a.nom, a] as const))(
    "%s n'utilise PLUS requireAdminWrite (qui autorise editor)",
    async (_nom, action) => {
      await action.appel().catch(() => undefined);
      expect(
        requireAdminWriteMock,
        `${action.nom} garde encore la porte ouverte à un compte « editor »`,
      ).not.toHaveBeenCalled();
    },
  );

  /**
   * Le témoin qui compte vraiment : la garde REFUSE, et rien n'est écrit.
   *
   * Un test qui vérifie seulement l'APPEL de la garde resterait vert si
   * quelqu'un avalait son refus dans un `try/catch`. Ici on mesure l'effet :
   * refus → aucune lecture, aucune écriture, aucun run.
   */
  it.each(ACTIONS_MONETAIRES.map((a) => [a.nom, a] as const))(
    "%s : un refus de la matrice arrête TOUT avant la moindre écriture",
    async (_nom, action) => {
      requireHabilitationMock.mockRejectedValue(
        new Error("forbidden: acte réservé à la direction."),
      );
      await expect(
        action.appel(),
        `${action.nom} a poursuivi malgré le refus de la matrice`,
      ).rejects.toThrow(/^forbidden: /);
      expect(runMock).not.toHaveBeenCalled();
      expect(prismaMock.trainerStatement.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.trainerStatement.update).not.toHaveBeenCalled();
      expect(prismaMock.trainerCompensationRule.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    },
  );
});
