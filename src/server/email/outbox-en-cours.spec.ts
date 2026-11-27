import { describe, expect, it } from "vitest";
import {
  AGE_JOURNAL_ORPHELIN_MIN,
  MOTIF_CONSTAT_TACHE_ABSENTE,
  estDejaFait,
  trancherApprouveAncien,
  type EtatTacheOutbox,
} from "./outbox-en-cours";

const MAINT = new Date("2026-11-20T12:00:00Z");
const ilYA = (min: number) => new Date(MAINT.getTime() - min * 60_000);
const j = (status: string, error: string | null = null) => ({ status, error });
const trancher = (tache: EtatTacheOutbox, journal: ReturnType<typeof j> | null, age = 120) =>
  trancherApprouveAncien({ tache, journal, approuveAt: ilYA(age), maintenant: MAINT });

describe("trancherApprouveAncien — la table du balayage (OUT-1)", () => {
  it("tâche présente, quel que soit le journal : parti", () => {
    for (const journal of [null, j("pending"), j("failed"), j("cancelled"), j("sent")]) {
      expect(trancher("presente", journal, 20)).toBe("parti");
    }
  });
  it("tâche échouée, quel que soit le journal : rien parti", () => {
    for (const journal of [null, j("pending"), j("failed"), j("sent")]) {
      expect(trancher("echouee", journal)).toBe("rien_parti");
    }
  });
  it("tâche absente + `sent` ou `bounced` : parti (tâche purgée)", () => {
    expect(trancher("absente", j("sent"))).toBe("parti");
    expect(trancher("absente", j("bounced"))).toBe("parti");
  });
  it("tâche absente + aucun journal / `failed` / `cancelled` : rien parti", () => {
    expect(trancher("absente", null)).toBe("rien_parti");
    expect(trancher("absente", j("failed"))).toBe("rien_parti");
    expect(trancher("absente", j("cancelled"))).toBe("rien_parti");
  });
  it("tâche absente + `pending` de moins d'une heure : attendre", () => {
    expect(trancher("absente", j("pending"), AGE_JOURNAL_ORPHELIN_MIN - 1)).toBe("attendre");
  });
  it("tâche absente + `pending` d'au moins une heure, sans repère : premier constat", () => {
    expect(trancher("absente", j("pending"), AGE_JOURNAL_ORPHELIN_MIN)).toBe("constat_1");
    expect(trancher("absente", j("pending", "autre erreur"), 180)).toBe("constat_1");
  });
  it("tâche absente + `pending` d'au moins une heure, avec le repère : orphelin", () => {
    expect(trancher("absente", j("pending", MOTIF_CONSTAT_TACHE_ABSENTE), 180)).toBe("orphelin");
  });
});

describe("estDejaFait", () => {
  it("vrai : tâche présente, ou tâche absente avec `sent` / `bounced`", () => {
    expect(estDejaFait("presente", null)).toBe(true);
    expect(estDejaFait("absente", j("sent"))).toBe(true);
    expect(estDejaFait("absente", j("bounced"))).toBe(true);
  });
  it("faux : tâche échouée, ou absente sans envoi confirmé", () => {
    expect(estDejaFait("echouee", j("sent"))).toBe(false);
    expect(estDejaFait("absente", null)).toBe(false);
    expect(estDejaFait("absente", j("pending"))).toBe(false);
    expect(estDejaFait("absente", j("failed"))).toBe(false);
  });
});
