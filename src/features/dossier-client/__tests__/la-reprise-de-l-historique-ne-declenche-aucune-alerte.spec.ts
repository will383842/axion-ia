// @vitest-environment node
/**
 * ⛔ La reprise de l'historique Calendly (plan V-07b) ne déclenche AUCUNE
 * alerte : ses rencontres sont marquées `repriseHistorique`, que F1 ignore, et
 * n'entrent pas dans le badge « à classer ». Sans cela, ~40 rendez-vous
 * d'avant la mise en service deviendraient 40 rappels le premier jour.
 *
 * TROIS protections, et chacune est vérifiée seule : la requête de F1
 * (`repriseHistorique: false`), la règle `attenduF1`, et la borne (une
 * reprise précède toujours la mise en service). Mutation qui fait rougir :
 * dans `attenduF1`, retirer le test `r.repriseHistorique` → le cas « même
 * postérieure à la borne » rougit (les deux autres protections tiennent encore
 * le premier cas, à dessein).
 * Contre-témoin : la même rencontre, SANS le marqueur, déclencherait F1.
 * Angle mort : le filtre « Historique » de l'écran « À classer » se lit par
 * la requête `lireRencontresAClasser(true)` (non rejouée ici).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attenduF1, passerBalayage } from "@/server/visio/balayage";
import { rencontreF1 } from "@/server/visio/__tests__/_scene-f1";
import { reprendreHistoriqueCalendly } from "../reprise-historique";
import { CLE_TEST, dossierEnMemoire, rendezVousCalendly } from "./_dossier-en-memoire";

const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_TEST;
});
afterEach(() => {
  if (CLE_INITIALE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = CLE_INITIALE;
});

const BORNE = new Date("2026-10-03T10:00:00Z");

function scene() {
  const ancien = rendezVousCalendly({
    startTime: new Date("2026-09-10T08:00:00Z"),
    endTime: new Date("2026-09-10T08:45:00Z"),
    rawPayload: {
      invitee: {
        questions_and_answers: [
          { question: "Quel est votre besoin ?", answer: "Former mon équipe" },
          { question: "Si une personne vous a recommandé, qui ?", answer: "Un ami" },
          { question: "Téléphone", answer: "+33 6 00 00 00 00" },
        ],
      },
    },
  });
  const apporteur = rendezVousCalendly({
    eventTypeName: "Échange apporteur d'affaires",
    startTime: new Date("2026-09-11T08:00:00Z"),
  });
  const base = dossierEnMemoire({
    calendlyEvent: [ancien, apporteur],
    battementCircuit: [
      {
        nom: "balayage",
        premierLe: BORNE,
        dernierLe: BORNE,
        drapeauVuParWorker: "true",
        version: "x",
      },
    ],
  });
  return { base, ancien };
}

describe("⛔ la reprise de l'historique ne déclenche aucune alerte", () => {
  it("rencontres reprises : F1 = 0, aucune ligne d'alerte", async () => {
    const { base } = scene();
    const bilan = await reprendreHistoriqueCalendly(base.client as never, { appliquer: true });
    expect(bilan.rencontresCreees).toBe(1);
    expect(base.tables["rencontre"]?.[0]?.["repriseHistorique"]).toBe(true);

    const notify = vi.fn();
    const r = await passerBalayage(base.client as never, {
      maintenant: new Date("2026-10-08T10:00:00Z"),
      notifier: notify as never,
    });
    expect(r.f1).toBe(0);
    expect(base.tables["alerteVisio"] ?? []).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("la règle seule : une rencontre reprise n'attend rien, même postérieure à la borne", () => {
    expect(
      attenduF1(
        rencontreF1({
          repriseHistorique: true,
          debutPrevu: new Date("2026-10-06T08:00:00Z"),
          finPrevue: new Date("2026-10-06T08:45:00Z"),
        }),
        new Date("2026-10-01T00:00:00Z"),
        new Date("2026-10-08T14:00:00Z"),
      ),
    ).toBeNull();
  });

  it("les réponses deviennent des faits proposés, chiffrés, à ranger ; le téléphone non", async () => {
    const { base } = scene();
    await reprendreHistoriqueCalendly(base.client as never, { appliquer: true });
    const faits = base.tables["fait"] ?? [];
    expect(faits.map((f) => f["type"]).sort()).toEqual(["besoin", "mise_en_relation"]);
    expect(faits.every((f) => f["statut"] === "propose" && f["portee"] === "a_ranger")).toBe(true);
    expect(faits.every((f) => String(f["enonce"]).startsWith("enc:v1:"))).toBe(true);
    expect(faits.every((f) => f["participantLocuteurId"])).toBe(true);
    expect(JSON.stringify(faits)).not.toContain("+33");
  });

  it("aucune rencontre pour l'échange apporteur", async () => {
    const { base } = scene();
    const bilan = await reprendreHistoriqueCalendly(base.client as never, { appliquer: true });
    expect(bilan.eligibles).toBe(1);
    expect(base.tables["rencontre"]).toHaveLength(1);
  });

  it("sans clé de chiffrement : arrêt avant toute écriture", async () => {
    const { base } = scene();
    delete process.env["PII_ENCRYPTION_KEY"];
    await expect(
      reprendreHistoriqueCalendly(base.client as never, { appliquer: true }),
    ).rejects.toThrow(/PII_ENCRYPTION_KEY/);
    expect(base.tables["rencontre"] ?? []).toHaveLength(0);
  });
});
