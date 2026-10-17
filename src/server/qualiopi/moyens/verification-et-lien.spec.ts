/**
 * Tests — moyens/verification-moyens.ts et test-lien-visio.ts (chantier QNC, lot L07).
 */

import { describe, expect, it, vi } from "vitest";

import { enregistrerVerificationMoyens } from "./verification-moyens";
import { testerLienVisio } from "./test-lien-visio";

const BLOC = {
  salle: true,
  wifi: true,
  projection: true,
  postes: true,
  comptes: true,
  materielStagiaire: true,
};
const SID = "11111111-1111-4111-8111-111111111111";
const UID = "22222222-2222-4222-8222-222222222222";
const DEBUT = new Date("2026-10-20T06:00:00.000Z");

function client(
  session: { dateDebut: Date; lieuType: string | null; estTestInterne: boolean } | null,
) {
  const create = vi.fn().mockResolvedValue({});
  return {
    create,
    c: {
      trainingSession: { findUnique: vi.fn().mockResolvedValue(session) },
      activityLog: { create },
    },
  };
}

describe("enregistrerVerificationMoyens", () => {
  it("écrit au journal, horodaté par le serveur, quand la vérification précède le début", async () => {
    const { c, create } = client({
      dateDebut: DEBUT,
      lieuType: "nos_locaux",
      estTestInterne: false,
    });
    const r = await enregistrerVerificationMoyens(
      c,
      SID,
      BLOC,
      UID,
      new Date("2026-10-19T09:00:00Z"),
    );
    expect(r).toEqual({ ok: true });
    const data = create.mock.calls[0]![0].data;
    expect(data.action).toBe("qualiopi.moyens.verification_session");
    expect(data.targetId).toBe(SID);
    expect(data.changes.enregistreLe).toBe("2026-10-19T09:00:00.000Z");
  });
  it("refuse après le début : rien n'est écrit", async () => {
    const { c, create } = client({
      dateDebut: DEBUT,
      lieuType: "nos_locaux",
      estTestInterne: false,
    });
    const r = await enregistrerVerificationMoyens(
      c,
      SID,
      BLOC,
      UID,
      new Date("2026-10-20T07:00:00Z"),
    );
    expect(r).toEqual({ ok: false, raison: "apres_debut" });
    expect(create).not.toHaveBeenCalled();
  });
  it("chez l'entreprise : exige la fourniture et la confirmation", async () => {
    const { c, create } = client({ dateDebut: DEBUT, lieuType: "sur_site", estTestInterne: false });
    const t = new Date("2026-10-19T09:00:00Z");
    expect(await enregistrerVerificationMoyens(c, SID, BLOC, UID, t)).toEqual({
      ok: false,
      raison: "fourniture_entreprise_manquante",
    });
    const ok = await enregistrerVerificationMoyens(
      c,
      SID,
      {
        ...BLOC,
        fourniParEntreprise: ["salle"],
        confirmationEntreprise: { par: "M. Durand", le: "2026-10-18" },
      },
      UID,
      t,
    );
    expect(ok.ok).toBe(true);
    expect(create).toHaveBeenCalledOnce();
  });
  it("session introuvable", async () => {
    const { c } = client(null);
    expect(await enregistrerVerificationMoyens(c, "x", BLOC, UID, new Date())).toEqual({
      ok: false,
      raison: "session_introuvable",
    });
  });
});

describe("testerLienVisio", () => {
  it("n'appelle jamais le réseau pour un lien manquant ou hors Zoom", async () => {
    const req = vi.fn();
    expect(await testerLienVisio(null, req)).toEqual({ ok: false, raison: "manquant" });
    expect(await testerLienVisio("http://169.254.169.254/", req)).toEqual({
      ok: false,
      raison: "pas_zoom",
    });
    expect(await testerLienVisio("https://zoom.us.evil.example/j/1", req)).toEqual({
      ok: false,
      raison: "pas_zoom",
    });
    expect(req).not.toHaveBeenCalled();
  });
  it("ne suit pas les redirections", async () => {
    const req = vi.fn().mockResolvedValue({ status: 302 });
    expect(await testerLienVisio("https://zoom.us/j/123", req)).toEqual({ ok: true, statut: 302 });
    expect(req.mock.calls[0]![1].redirect).toBe("manual");
  });
  it("lien mort et réseau en panne", async () => {
    expect(
      await testerLienVisio("https://zoom.us/j/1", vi.fn().mockResolvedValue({ status: 404 })),
    ).toEqual({ ok: false, raison: "statut", statut: 404 });
    expect(
      await testerLienVisio("https://zoom.us/j/1", vi.fn().mockRejectedValue(new Error("x"))),
    ).toEqual({ ok: false, raison: "ne_repond_pas" });
  });
});
