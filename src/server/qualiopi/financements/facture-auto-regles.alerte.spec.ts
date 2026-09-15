/**
 * `facture_auto_non_emise` — ce que l'alerte dit, QUAND elle le dit, et qu'elle
 * se TAIT une fois le cas résolu (c'est ce silence qui la ferme :
 * `resolutionAuto: true`).
 *
 * La famille 3 (facture sans PDF ni e-mail) est éprouvée à part, sur la facture
 * elle-même : `facture-auto-reprise.spec.ts`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  etatVide,
  factureFausse,
  sessionEligible,
  type EtatFaux,
} from "./__tests__/fausse-base-facture-auto";

const h = vi.hoisted(() => ({
  etat: null as unknown as EtatFaux,
}));

vi.mock("@/lib/prisma", async () => {
  const { vi: v } = await import("vitest");
  const { etatVide: vide, faussePrisma: fausse } =
    await import("./__tests__/fausse-base-facture-auto");
  h.etat = vide();
  return { prisma: fausse(h.etat, v.fn()) };
});

import {
  casFactureAutoASignaler,
  DELAI_SESSION_NON_FACTUREE_JOURS,
  FENETRE_FACTURE_AUTO_JOURS,
} from "./facture-auto-regles";
import { ALERTE_CATALOGUE } from "@/server/qualiopi/alertes/catalogue";

/** Fin le 5 octobre 2026 à 16:00, heure de Paris. */
const FIN = new Date("2026-10-05T14:00:00.000Z");
const jour = (n: number, heure = "07:00") =>
  new Date(`2026-10-${String(5 + n).padStart(2, "0")}T${heure}:00.000Z`);

beforeEach(() => {
  Object.assign(h.etat, etatVide());
  // Le cron tourne : il a consigné son passage d'hier.
  h.etat.reglages.set("facture_auto_dernier_passage", { at: "2026-10-05T09:30:00.000Z" });
});

const passageRecent = (now: Date) =>
  h.etat.reglages.set("facture_auto_dernier_passage", {
    at: new Date(now.getTime() - 22 * 3_600_000).toISOString(),
  });

describe("famille 1 — session non automatisable", () => {
  it("l'alerte cible la session et NOMME le motif", async () => {
    h.etat.sessions = [sessionEligible("s-1", { interEntreprises: true })];
    const cas = await casFactureAutoASignaler(jour(1));
    expect(cas).toHaveLength(1);
    expect(cas[0]).toMatchObject({ cibleType: "TrainingSession", cibleId: "s-1" });
    expect(cas[0]!.message).toContain("PAR PARTICIPANT");
    expect(cas[0]!.message).toContain("E-mails à valider");
  });

  it("🔑 se tait dès qu'une facture existe (émise à la main) — l'alerte se ferme", async () => {
    h.etat.sessions = [sessionEligible("s-1", { interEntreprises: true })];
    h.etat.factures = [factureFausse({ sessionId: "s-1", emiseAt: jour(1, "06:00") })];
    h.etat.outbox.push({
      template: "facture-envoi",
      entityId: "f-1",
      payload: {},
      createdAt: jour(1),
    });
    expect(await casFactureAutoASignaler(jour(2))).toEqual([]);
  });

  it("pas avant le lendemain : le soir même, rien à signaler", async () => {
    h.etat.sessions = [sessionEligible("s-1", { client: null })];
    expect(await casFactureAutoASignaler(new Date("2026-10-05T20:00:00.000Z"))).toEqual([]);
  });
});

describe("🔴 pas de doublon avec `session_realisee_non_facturee`", () => {
  it("le relais est à J+15, et la fenêtre de l'automate s'arrête la veille", () => {
    expect(DELAI_SESSION_NON_FACTUREE_JOURS).toBe(15);
    expect(FENETRE_FACTURE_AUTO_JOURS).toBe(14);
  });

  it("J+14 : l'alerte de l'automate parle encore", async () => {
    h.etat.sessions = [sessionEligible("s-1", { interEntreprises: true })];
    expect(await casFactureAutoASignaler(jour(14))).toHaveLength(1);
  });

  it("J+15 : elle se tait — l'alerte historique a pris le relais", async () => {
    h.etat.sessions = [sessionEligible("s-1", { interEntreprises: true })];
    expect(await casFactureAutoASignaler(jour(15))).toEqual([]);
  });

  it("l'évaluateur lit la MÊME constante pour le départ de l'alerte historique", () => {
    const src = readFileSync(
      join(process.cwd(), "src/server/qualiopi/alertes/evaluateur.ts"),
      "utf8",
    );
    const depart = src.indexOf("async function regleSessionRealiseeNonFacturee");
    const corps = src.slice(depart, src.indexOf("\nasync function ", depart + 10));
    expect(corps).toContain("daysAgo(DELAI_SESSION_NON_FACTUREE_JOURS, now)");
  });
});

describe("🔴 famille 2 — éligible sans facture : seulement sur un ÉCHEC RÉEL", () => {
  it("🔑 balayage de 07:00 AVANT la tentative de 09:30, même trois jours après : silence", async () => {
    // La fausse alarme de la relecture : session clôturée ou complétée tard,
    // éligible, pas encore tentée. Le cron tourne, aucun échec n'est consigné.
    h.etat.sessions = [sessionEligible("s-1")];
    passageRecent(jour(4));
    expect(await casFactureAutoASignaler(jour(4))).toEqual([]);
  });

  it("le passage a échoué pour cette session : l'alerte le dit, avec le motif", async () => {
    h.etat.sessions = [sessionEligible("s-1")];
    passageRecent(jour(2));
    h.etat.journaux.push({
      action: "qualiopi.facture.generer.auto.echec",
      targetType: "TrainingSession",
      targetId: "s-1",
      createdAt: jour(1, "09:30"),
      changes: { motif: "Identité de l'organisme incomplète (SIRET)." },
    });
    const cas = await casFactureAutoASignaler(jour(2));
    expect(cas).toHaveLength(1);
    expect(cas[0]!.message).toContain("Identité de l'organisme incomplète (SIRET).");
  });

  it("un échec ANTÉRIEUR à la fin de la session ne compte pas", async () => {
    h.etat.sessions = [sessionEligible("s-1")];
    passageRecent(jour(2));
    h.etat.journaux.push({
      action: "qualiopi.facture.generer.auto.echec",
      targetType: "TrainingSession",
      targetId: "s-1",
      createdAt: new Date(FIN.getTime() - 86_400_000),
    });
    expect(await casFactureAutoASignaler(jour(2))).toEqual([]);
  });

  it("le cron ne passe plus depuis plus de 26 h : l'alerte le dit", async () => {
    h.etat.sessions = [sessionEligible("s-1")];
    h.etat.reglages.set("facture_auto_dernier_passage", { at: "2026-10-05T09:30:00.000Z" });
    const cas = await casFactureAutoASignaler(jour(3));
    expect(cas).toHaveLength(1);
    expect(cas[0]!.message).toContain("n'a pas tourné");
  });

  it("🔑 se tait dès que la facture existe", async () => {
    h.etat.sessions = [sessionEligible("s-1")];
    h.etat.reglages.set("facture_auto_dernier_passage", { at: "2026-10-05T09:30:00.000Z" });
    h.etat.factures = [factureFausse({ sessionId: "s-1", emiseAt: jour(3, "06:00") })];
    h.etat.outbox.push({
      template: "facture-envoi",
      entityId: "f-1",
      payload: {},
      createdAt: jour(3),
    });
    expect(await casFactureAutoASignaler(jour(3))).toEqual([]);
  });
});

describe("câblage dans le moteur d'alertes", () => {
  it("le code est catalogué, auto-résolu, adressé à la direction", () => {
    expect(ALERTE_CATALOGUE["facture_auto_non_emise"]).toMatchObject({
      resolutionAuto: true,
      guichet: "direction",
    });
  });

  it("l'évaluateur enregistre la règle et lit CES cas — pas une requête jumelle", () => {
    const src = readFileSync(
      join(process.cwd(), "src/server/qualiopi/alertes/evaluateur.ts"),
      "utf8",
    );
    expect(src).toMatch(
      /\{\s*nom:\s*"facture_auto_non_emise",\s*fn:\s*regleFactureAutoNonEmise\s*\}/,
    );
    const depart = src.indexOf("async function regleFactureAutoNonEmise");
    expect(depart).toBeGreaterThan(-1);
    const corps = src.slice(depart, src.indexOf("\nasync function ", depart + 10));
    expect(corps).toContain("casFactureAutoASignaler(");
    expect(corps).toContain('code: "facture_auto_non_emise"');
  });
});
