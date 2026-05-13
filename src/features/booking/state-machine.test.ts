// Tests state machine — Sprint X.4
//
// Tests purs (sans DB) sur la whitelist TRANSITIONS + helpers d'assertion.
// Les tests applyTransition() avec Prisma sont écrits en integration
// (vitest.integration.config.ts) — pas dans ce fichier.
//
// Cible : couverture Agent 3 §7 TS1-TS12 (transitions clés, terminal states,
// idempotence input shapes).

import { describe, it, expect } from "vitest";
import {
  TRANSITIONS,
  TERMINAL_STATES,
  isTransitionAllowed,
  assertTransitionAllowed,
  isTerminalState,
  StateMachineError,
} from "./state-machine";

describe("state-machine — whitelist transitions", () => {
  describe("isTransitionAllowed", () => {
    it("autorise les transitions clés D49-D51", () => {
      // Parcours visiteur → cadrage → contrat → acompte → confirmé
      expect(isTransitionAllowed("option_pending", "cadrage_scheduled")).toBe(true);
      expect(isTransitionAllowed("cadrage_scheduled", "cadrage_held")).toBe(true);
      expect(isTransitionAllowed("cadrage_held", "contract_pending")).toBe(true);
      expect(isTransitionAllowed("contract_pending", "contract_payment_sent")).toBe(true);
      expect(isTransitionAllowed("contract_payment_sent", "awaiting_admin_validation")).toBe(true);
      expect(isTransitionAllowed("awaiting_admin_validation", "confirmed")).toBe(true);
    });

    it("autorise le skip cadrage pour audit_flash_onsite (I3)", () => {
      expect(isTransitionAllowed("option_pending", "contract_pending")).toBe(true);
    });

    it("autorise le devis avant contrat (I4)", () => {
      expect(isTransitionAllowed("cadrage_held", "quote_required")).toBe(true);
      expect(isTransitionAllowed("quote_required", "quote_sent")).toBe(true);
      expect(isTransitionAllowed("quote_sent", "quote_signed")).toBe(true);
      expect(isTransitionAllowed("quote_signed", "contract_pending")).toBe(true);
    });

    it("autorise la pause/reprise bidirectionnelle (D61)", () => {
      expect(isTransitionAllowed("confirmed", "paused")).toBe(true);
      expect(isTransitionAllowed("paused", "confirmed")).toBe(true);
    });

    it("autorise l'escalade installment_overdue → disputed (D59)", () => {
      expect(isTransitionAllowed("confirmed", "installment_overdue")).toBe(true);
      expect(isTransitionAllowed("invoiced_balance", "installment_overdue")).toBe(true);
      expect(isTransitionAllowed("installment_overdue", "disputed")).toBe(true);
      expect(isTransitionAllowed("installment_overdue", "paid_balance")).toBe(true);
    });

    it("refuse les transitions hors whitelist", () => {
      expect(isTransitionAllowed("option_pending", "confirmed")).toBe(false); // skip toutes les étapes
      expect(isTransitionAllowed("option_pending", "completed")).toBe(false);
      expect(isTransitionAllowed("draft", "confirmed")).toBe(false);
      expect(isTransitionAllowed("cadrage_scheduled", "confirmed")).toBe(false);
    });

    it("refuse les transitions backward arbitraires", () => {
      expect(isTransitionAllowed("confirmed", "option_pending")).toBe(false);
      expect(isTransitionAllowed("completed", "in_progress")).toBe(false);
      expect(isTransitionAllowed("paid_balance", "invoiced_balance")).toBe(false);
    });
  });

  describe("isTerminalState", () => {
    it("identifie les terminaux V1", () => {
      for (const t of [
        "archived",
        "paid_balance",
        "refunded_full",
        "refunded_partial",
        "disputed",
        "lost_other_won",
        "expired_no_response",
        "refused",
        "quote_declined",
        "cadrage_declined",
        "cancelled_by_user",
        "cancelled_by_admin",
        "no_show",
        "force_majeure",
      ] as const) {
        expect(isTerminalState(t)).toBe(true);
      }
    });

    it("rejette les statuts non-terminaux", () => {
      for (const s of [
        "option_pending",
        "cadrage_scheduled",
        "contract_pending",
        "awaiting_admin_validation",
        "confirmed",
        "paused",
        "in_progress",
        "completed",
        "installment_overdue",
      ] as const) {
        expect(isTerminalState(s)).toBe(false);
      }
    });

    it("les terminaux ont aucune transition sortante", () => {
      // Note : certains terminaux "sémantiques" ont encore des transitions
      // techniques :
      //   - cancelled_by_user/admin → refunded_*   (transition comptable)
      //   - no_show → invoiced_balance / archived  (acompte conservé)
      //   - paid_balance → archived                (cron retention 12 mois)
      const SEMANTIC_TERMINALS_WITH_ACCOUNTING_TRANSITIONS = new Set([
        "cancelled_by_user",
        "cancelled_by_admin",
        "no_show",
        "paid_balance",
        "force_majeure", // → refunded_full (refund 100%)
      ]);
      for (const t of TERMINAL_STATES) {
        if (SEMANTIC_TERMINALS_WITH_ACCOUNTING_TRANSITIONS.has(t)) continue;
        expect(TRANSITIONS[t].length).toBe(0);
      }
    });
  });

  describe("assertTransitionAllowed", () => {
    it("ne throw pas pour une transition valide", () => {
      expect(() => assertTransitionAllowed("option_pending", "cadrage_scheduled")).not.toThrow();
    });

    it("throw StateMachineError pour une transition invalide", () => {
      try {
        assertTransitionAllowed("option_pending", "confirmed");
        expect.fail("devrait throw");
      } catch (err) {
        expect(err).toBeInstanceOf(StateMachineError);
        expect((err as StateMachineError).code).toBe("transition_not_allowed");
      }
    });

    it("throw pour transition depuis terminal", () => {
      expect(() => assertTransitionAllowed("paid_balance", "confirmed")).toThrow(StateMachineError);
    });
  });

  describe("invariants spécification", () => {
    it("TS1 — pending V0 ne mène qu'à option_pending ou cancelled (compat migration)", () => {
      expect(TRANSITIONS.pending).toEqual(
        expect.arrayContaining(["option_pending", "cancelled_by_admin"]),
      );
      expect(TRANSITIONS.pending.length).toBe(2);
    });

    it("TS2 — postponed est mort-né (drop V1)", () => {
      expect(TRANSITIONS.postponed).toEqual([]);
    });

    it("TS3 — option_pending → uniquement les 5 sorties autorisées", () => {
      expect(new Set(TRANSITIONS.option_pending)).toEqual(
        new Set([
          "cadrage_scheduled",
          "contract_pending",
          "lost_other_won",
          "refused",
          "expired_no_response",
        ]),
      );
    });

    it("TS4 — confirmed peut paused (D61) ET installment_overdue (D59)", () => {
      expect(TRANSITIONS.confirmed).toContain("paused");
      expect(TRANSITIONS.confirmed).toContain("installment_overdue");
    });

    it("TS5 — disputed est terminal recouvrement hors-app", () => {
      expect(TRANSITIONS.disputed).toEqual([]);
      expect(isTerminalState("disputed")).toBe(true);
    });

    it("TS6 — paused ↔ confirmed bidirectionnel", () => {
      expect(TRANSITIONS.paused).toContain("confirmed");
      expect(TRANSITIONS.confirmed).toContain("paused");
    });

    it("TS7 — installment_overdue ne peut pas être archivé directement (Agent 3 D59)", () => {
      expect(TRANSITIONS.installment_overdue).not.toContain("archived");
    });

    it("TS8 — paid_balance archivable (terminal succès)", () => {
      expect(TRANSITIONS.paid_balance).toEqual(["archived"]);
    });
  });
});
