// M7 (lot A) — les deux envois de l'écran W-4 :
//   · F12 « Demander un complément » ROUVRE le dossier (à compléter, version d'accès +1)
//     et donne le NOUVEAU lien ; le motif est dans `valeurs` ;
//   · F13 « Refuser le dossier » ÉCRIT l'état refusé (une ligne `refus_administrateur`
//     ajoutée au registre des contrôles, jamais rien d'effacé), puis part avec le motif
//     dans `valeurs`.
// Dans les deux cas, AUCUN [crochet] ne reste vide dans l'e-mail qui partirait.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { remplir, varianteDe } from "@/lib/email/templates/_formateur-independant";
import { CROCHET_NON_REMPLI } from "@/lib/email/templates/formateur-independant-textes";

const h = vi.hoisted(() => ({
  settings: vi.fn(),
  textes: vi.fn(),
  envoyer: vi.fn(),
  journal: vi.fn(),
  tx: {
    $executeRaw: vi.fn(async () => 1),
    trainer: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUnique: vi.fn(async () => ({
        id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
        email: "f@exemple.invalid",
        prenom: "Camille",
        accesVersion: 3,
      })),
      findFirst: vi.fn(async () => ({
        id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
        email: "f@exemple.invalid",
        prenom: "Camille",
      })),
    },
    verificationRegistreSousTraitance: {
      findFirst: vi.fn(async () => null as unknown),
      create: vi.fn(async () => ({})),
    },
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findMany: (...a: unknown[]) => h.settings(...a) },
    $transaction: vi.fn(async (fn: (t: typeof h.tx) => unknown) => fn(h.tx)),
  },
}));
vi.mock("../envois", () => ({
  envoyer: (...a: unknown[]) => h.envoyer(...a),
  texteValide: (...a: unknown[]) => h.textes(...a),
}));
vi.mock("@/server/journal/journaliser", () => ({
  journaliser: (...a: unknown[]) => h.journal(...a),
}));
vi.mock("../jeton-dossier", () => ({
  urlDossierFormateur: (id: string, v: number) => `https://exemple.invalid/dossier/${id}/v${v}`,
}));

import { demanderComplementW4, refuserDossier, SOURCE_REFUS_DOSSIER } from "../envois-dossier";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const PAR = "0a1b2c3d-4e5f-4061-8a7b-9c0d1e2f3a4c";
const maintenant = new Date("2026-10-12T10:00:00Z");

function envoi() {
  return (
    h.envoyer.mock.calls[0] as unknown as [
      {
        gabarit: "formateur-dossier-a-completer" | "formateur-dossier-refuse";
        payload: Record<string, unknown>;
      },
    ]
  )[0];
}
function crochetsVides(e: ReturnType<typeof envoi>): string[] {
  const v = varianteDe(e.gabarit, e.payload);
  return [v.objet, ...v.paragraphes]
    .map((t) => remplir(t, e.payload))
    .filter((t) => CROCHET_NON_REMPLI.test(t));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.settings.mockResolvedValue([{ key: "formateurs.dossier_en_ligne", value: { actif: true } }]);
  h.textes.mockResolvedValue(true);
  h.envoyer.mockResolvedValue("envoye");
  h.tx.trainer.updateMany.mockResolvedValue({ count: 1 });
});

describe("F12 depuis W-4 — demanderComplementW4", () => {
  it("rouvre le dossier « à compléter » avec une nouvelle version, et donne le nouveau lien", async () => {
    const r = await demanderComplementW4({ trainerId: ID, motif: "le CV", parId: PAR, maintenant });
    expect(r).toEqual({ ok: true, envoi: "envoye" });
    expect(h.tx.trainer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: ID, dossierStatut: { in: ["a_verifier"] } }),
        data: { accesVersion: { increment: 1 }, dossierStatut: "a_completer" },
      }),
    );
    const e = envoi();
    expect(e.gabarit).toBe("formateur-dossier-a-completer");
    expect(e.payload).toMatchObject({
      prenom: "Camille",
      lien: `https://exemple.invalid/dossier/${ID}/v3`,
      valeurs: { motif: "le CV" },
    });
    expect(crochetsVides(e)).toEqual([]);
    // Journal : identifiant UUID seulement.
    expect(h.journal).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({ targetType: "Trainer", targetId: ID }),
      { exiger: true },
    );
  });

  it("un motif hors de la liste fermée de W-4 est refusé, rien n'est écrit", async () => {
    const r = await demanderComplementW4({
      trainerId: ID,
      motif: "<script>",
      parId: PAR,
      maintenant,
    });
    expect(r).toEqual({ ok: false, raison: "etat" });
    expect(h.tx.trainer.updateMany).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("dossier en ligne éteint, ou texte non validé : rien n'est rouvert, rien ne part", async () => {
    h.settings.mockResolvedValue([]);
    expect(
      await demanderComplementW4({ trainerId: ID, motif: "le CV", parId: PAR, maintenant }),
    ).toEqual({ ok: false, raison: "eteint" });
    h.settings.mockResolvedValue([{ key: "formateurs.dossier_en_ligne", value: { actif: true } }]);
    h.textes.mockResolvedValue(false);
    expect(
      await demanderComplementW4({ trainerId: ID, motif: "le CV", parId: PAR, maintenant }),
    ).toEqual({ ok: false, raison: "texte-non-valide" });
    expect(h.tx.trainer.updateMany).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("dossier pas « à vérifier » (double clic, déjà rouvert) : rien ne part", async () => {
    h.tx.trainer.updateMany.mockResolvedValue({ count: 0 });
    expect(
      await demanderComplementW4({ trainerId: ID, motif: "le CV", parId: PAR, maintenant }),
    ).toEqual({ ok: false, raison: "etat" });
    expect(h.envoyer).not.toHaveBeenCalled();
  });
});

describe("F13 — refuserDossier", () => {
  const ROUGE = {
    id: "11111111-1111-4111-8111-111111111111",
    verdict: "rouge",
    source: "recherche-entreprises",
    verifieAt: new Date("2026-10-11T09:00:00Z"),
    siren: "123456789",
    siret: null,
    numeroDeclarationActivite: null,
    motif: "siren_cesse",
  };

  it("écrit l'état refusé (ligne ajoutée, motif d'origine gardé), journalise, puis F13 part rempli", async () => {
    h.tx.verificationRegistreSousTraitance.findFirst.mockResolvedValue(ROUGE);
    const r = await refuserDossier({ trainerId: ID, motif: "entreprise fermée", parId: PAR });
    expect(r).toEqual({ ok: true, envoi: "envoye" });
    expect(h.tx.verificationRegistreSousTraitance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        trainerId: ID,
        verdict: "rouge",
        source: SOURCE_REFUS_DOSSIER,
        verifieAt: ROUGE.verifieAt,
        motif: "siren_cesse",
        verifieParId: PAR,
      }),
    });
    expect(h.journal).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        action: "qualiopi.formateur.dossier_refuse",
        targetType: "Trainer",
        targetId: ID,
      }),
      { exiger: true },
    );
    const e = envoi();
    expect(e.gabarit).toBe("formateur-dossier-refuse");
    expect(e.payload).toMatchObject({ prenom: "Camille", valeurs: { motif: "entreprise fermée" } });
    expect(crochetsVides(e)).toEqual([]);
  });

  it("déjà refusé (second clic) : aucune seconde ligne, l'e-mail garde sa clé unique", async () => {
    h.tx.verificationRegistreSousTraitance.findFirst.mockResolvedValue({
      ...ROUGE,
      source: SOURCE_REFUS_DOSSIER,
    });
    const r = await refuserDossier({ trainerId: ID, motif: "entreprise fermée", parId: PAR });
    expect(r.ok).toBe(true);
    expect(h.tx.verificationRegistreSousTraitance.create).not.toHaveBeenCalled();
    expect((h.envoyer.mock.calls[0] as unknown as [{ jobId: string }])[0].jobId).toBe(
      `fi-dossier-refuse-${ID}`,
    );
  });

  it("le dernier contrôle n'est plus rouge : rien n'est écrit, rien ne part", async () => {
    h.tx.verificationRegistreSousTraitance.findFirst.mockResolvedValue({
      ...ROUGE,
      verdict: "vert",
    });
    expect(await refuserDossier({ trainerId: ID, motif: "entreprise fermée", parId: PAR })).toEqual(
      { ok: false, raison: "etat" },
    );
    expect(h.tx.verificationRegistreSousTraitance.create).not.toHaveBeenCalled();
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("texte non validé : l'état n'est pas écrit (on ne refuse pas sans prévenir)", async () => {
    h.textes.mockResolvedValue(false);
    expect(await refuserDossier({ trainerId: ID, motif: "entreprise fermée", parId: PAR })).toEqual(
      { ok: false, raison: "texte-non-valide" },
    );
    expect(h.tx.verificationRegistreSousTraitance.create).not.toHaveBeenCalled();
  });
});
