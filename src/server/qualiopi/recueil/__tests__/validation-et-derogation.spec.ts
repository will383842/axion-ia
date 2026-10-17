/** Chantier QNC, L03 — validation horodatée de l'analyse, dérogation motivée journalisée. */
import { describe, expect, it } from "vitest";

import { accorderDerogation } from "../derogation";
import { garderEnvoiConvention } from "../garde-convention";
import { validerAnalyse } from "../validation";
import { fauxDb } from "./utils-faux";

const SESSION = "22222222-2222-4222-8222-222222222222";
const QUESTIONNAIRE = "33333333-3333-4333-8333-333333333333";
const ADMIN = "44444444-4444-4444-8444-444444444444";
const MOTIF = "Client historique : la rentrée ne laisse pas le temps du cadrage.";

describe("validerAnalyse", () => {
  const q = { id: QUESTIONNAIRE, statut: "reponse_recue", projetId: "p1" };

  it("refuse quand le recueil est éteint (rien n'est écrit)", async () => {
    const db = fauxDb({ interrupteur: "eteint", questionnaire: q });
    const r = await validerAnalyse(db as never, {
      questionnaireId: QUESTIONNAIRE,
      auteurId: ADMIN,
    });
    expect(r.ok).toBe(false);
    expect(db.journal).toHaveLength(0);
  });

  it("en essai, refuse un projet qui n'est pas du banc d'essai", async () => {
    const db = fauxDb({
      interrupteur: "essai",
      questionnaire: q,
      session: { estTestInterne: false },
    });
    const r = await validerAnalyse(db as never, {
      questionnaireId: QUESTIONNAIRE,
      auteurId: ADMIN,
    });
    expect(r.ok).toBe(false);
    expect(db.journal).toHaveLength(0);
  });

  it("refuse tant que l'entreprise n'a pas répondu", async () => {
    const db = fauxDb({ interrupteur: "actif", questionnaire: { ...q, statut: "copie" } });
    const r = await validerAnalyse(db as never, {
      questionnaireId: QUESTIONNAIRE,
      auteurId: ADMIN,
    });
    expect(r).toMatchObject({ ok: false });
    expect(db.journal).toHaveLength(0);
  });

  it("écrit UNE ligne horodatée au journal, avec l'auteur", async () => {
    const db = fauxDb({ interrupteur: "actif", questionnaire: q });
    const maintenant = new Date("2026-10-16T09:30:00Z");
    const r = await validerAnalyse(db as never, {
      questionnaireId: QUESTIONNAIRE,
      auteurId: ADMIN,
      maintenant,
    });
    expect(r).toMatchObject({ ok: true, valideLe: maintenant });
    expect(db.journal).toHaveLength(1);
    expect(db.journal[0]).toMatchObject({
      action: "qualiopi.recueil.analyse_validee",
      targetType: "QuestionnaireCadrage",
      targetId: QUESTIONNAIRE,
      adminUserId: ADMIN,
    });
  });

  it("est idempotente : une seconde validation n'écrit rien", async () => {
    const db = fauxDb({ interrupteur: "actif", questionnaire: q });
    await validerAnalyse(db as never, { questionnaireId: QUESTIONNAIRE, auteurId: ADMIN });
    const r = await validerAnalyse(db as never, {
      questionnaireId: QUESTIONNAIRE,
      auteurId: ADMIN,
    });
    expect(r).toMatchObject({ ok: true, dejaValidee: true });
    expect(db.journal).toHaveLength(1);
  });
});

describe("accorderDerogation", () => {
  const session = { estTestInterne: false, projetId: "p1", devis: null };

  it("refuse un motif trop court : un motif qui ne dit rien ne couvre rien", async () => {
    const db = fauxDb({ interrupteur: "actif", session });
    const r = await accorderDerogation(db as never, {
      sessionId: SESSION,
      motif: "urgent",
      auteurId: ADMIN,
    });
    expect(r.ok).toBe(false);
    expect(db.journal).toHaveLength(0);
  });

  it("refuse quand le recueil est éteint pour cette session", async () => {
    const db = fauxDb({ interrupteur: "eteint", session });
    const r = await accorderDerogation(db as never, {
      sessionId: SESSION,
      motif: MOTIF,
      auteurId: ADMIN,
    });
    expect(r.ok).toBe(false);
    expect(db.journal).toHaveLength(0);
  });

  it("journalise l'accord (motif, auteur) puis la garde le voit", async () => {
    const db = fauxDb({ interrupteur: "actif", session });
    const r = await accorderDerogation(db as never, {
      sessionId: SESSION,
      motif: `  ${MOTIF}  `,
      auteurId: ADMIN,
    });
    expect(r.ok).toBe(true);
    expect(db.journal).toHaveLength(1);
    expect(db.journal[0]).toMatchObject({
      action: "qualiopi.recueil.derogation_accordee",
      targetType: "TrainingSession",
      targetId: SESSION,
      adminUserId: ADMIN,
    });
    expect((db.journal[0]!["changes"] as { motif: string }).motif).toBe(MOTIF);
  });
});

describe("garderEnvoiConvention", () => {
  const session = { estTestInterne: false, projetId: "p1", devis: { statut: "envoye" } };

  it("REFUSE sans cadrage validé ni devis accepté, et n'écrit rien", async () => {
    const db = fauxDb({ interrupteur: "actif", session });
    const v = await garderEnvoiConvention({ sessionId: SESSION, auteurId: ADMIN }, db as never);
    expect(v.ok).toBe(false);
    expect(db.journal).toHaveLength(0);
  });

  it("par dérogation : passe ET journalise l'usage (qui, motif)", async () => {
    const db = fauxDb({
      interrupteur: "actif",
      session,
      journal: [
        {
          action: "qualiopi.recueil.derogation_accordee",
          targetType: "TrainingSession",
          targetId: SESSION,
          changes: { motif: MOTIF },
          createdAt: new Date("2026-10-15T08:00:00Z"),
        },
      ],
    });
    const v = await garderEnvoiConvention({ sessionId: SESSION, auteurId: ADMIN }, db as never);
    expect(v).toMatchObject({ ok: true, decision: { voie: "derogation", motif: MOTIF } });
    const usage = db.journal.find((j) => j["action"] === "qualiopi.recueil.derogation_utilisee");
    expect(usage).toMatchObject({ targetId: SESSION, adminUserId: ADMIN });
  });

  it("éteint : passe sans rien lire ni rien écrire (inchangé)", async () => {
    const db = fauxDb({ session });
    const v = await garderEnvoiConvention({ sessionId: SESSION, auteurId: ADMIN }, db as never);
    expect(v).toMatchObject({ ok: true, decision: { voie: "eteint" } });
    expect(db.journal).toHaveLength(0);
  });
});
