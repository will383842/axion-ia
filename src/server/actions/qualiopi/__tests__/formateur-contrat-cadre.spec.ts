/**
 * Lots L7b, L9b, L7d — actions du contrat-cadre : le rôle d'abord, puis l'interrupteur ;
 * interrupteur absent = refus, RIEN n'est lu, écrit, émis ni envoyé (comportement d'avant).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  auth: vi.fn(),
  allume: vi.fn(),
  preparer: vi.fn(),
  faits: vi.fn(),
  figer: vi.fn(),
  envoyerDossier: vi.fn(),
  emettre: vi.fn(),
  envoyer: vi.fn(),
  apercu: vi.fn(),
  texteValide: vi.fn(),
  resume: vi.fn(),
  log: vi.fn(),
  trainer: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: () => d.auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { trainer: { findUnique: (...a: unknown[]) => d.trainer(...a) } },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  logQualiopiActivity: (...a: unknown[]) => d.log(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: (...a: unknown[]) => d.allume(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/contrat-cadre-emission", () => ({
  preparerContratCadre: (...a: unknown[]) => d.preparer(...a),
  lireFaitsEmissionContrat: (...a: unknown[]) => d.faits(...a),
  versionContratAEmettre: () => 4,
}));
vi.mock("@/server/qualiopi/formateurs-independants/mise-a-niveau", () => ({
  figerListeMiseANiveau: (...a: unknown[]) => d.figer(...a),
  envoyerDossierMiseANiveau: (...a: unknown[]) => d.envoyerDossier(...a),
}));
vi.mock("@/server/qualiopi/documents/signature/emettre-lien-signature", () => ({
  emettreLienSignature: (...a: unknown[]) => d.emettre(...a),
}));
vi.mock("@/server/qualiopi/documents/templates/versions-arretees", () => ({
  resumeVersionArretee: (...a: unknown[]) => d.resume(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({
  envoyer: (...a: unknown[]) => d.envoyer(...a),
  apercu: (...a: unknown[]) => d.apercu(...a),
  texteValide: (...a: unknown[]) => d.texteValide(...a),
  valeursManquantes: () => false,
}));

import {
  apercuNouvelleVersionAction,
  envoyerDossierMiseANiveauAction,
  envoyerNouvelleVersionAction,
  figerListeMiseANiveauAction,
  preparerContratCadreAction,
} from "../formateur-contrat-cadre";

const ID = "00000000-0000-4000-8000-0000000000aa";
const DOC = "00000000-0000-4000-8000-0000000000bb";
const ADMIN = { user: { id: "11111111-1111-4111-8111-111111111111", role: "admin" } };

const effets = () =>
  [d.preparer, d.faits, d.figer, d.envoyerDossier, d.emettre, d.envoyer, d.trainer, d.log].map(
    (f) => f.mock.calls.length,
  );

beforeEach(() => {
  vi.clearAllMocks();
  d.auth.mockResolvedValue(ADMIN);
  d.allume.mockResolvedValue(true);
  d.preparer.mockResolvedValue({
    ok: true,
    documentId: DOC,
    numero: "N-1",
    version: 4,
    remplaces: 0,
  });
  d.faits.mockResolvedValue({
    email: "camille@exemple.fr",
    prenom: "Camille",
    contrats: [
      {
        id: "c",
        numero: "N-0",
        version: 3,
        statutSignature: "signee",
        annuleeAt: null,
        signatures: 2,
      },
    ],
  });
  d.emettre.mockResolvedValue({
    data: { url: "https://lien", expiresAt: new Date(), reemission: false },
  });
  d.envoyer.mockResolvedValue("envoye");
  d.texteValide.mockResolvedValue(true);
  d.resume.mockReturnValue("Un article change.");
  d.figer.mockResolvedValue({ listees: 2 });
  d.envoyerDossier.mockResolvedValue({ ok: true, envoi: "envoye" });
  d.apercu.mockResolvedValue({ sujet: "s", html: "<p></p>", destinataire: "x" });
  d.trainer.mockResolvedValue({ prenom: "Camille", email: "camille@exemple.fr" });
});

const GESTES = [
  [
    "preparerContratCadreAction",
    () => preparerContratCadreAction({ trainerId: ID }),
    "contrat_cadre_emission",
  ],
  ["figerListeMiseANiveauAction", () => figerListeMiseANiveauAction(), "mise_a_niveau"],
  [
    "envoyerDossierMiseANiveauAction",
    () => envoyerDossierMiseANiveauAction({ trainerId: ID }),
    "mise_a_niveau",
  ],
  [
    "apercuNouvelleVersionAction",
    () => apercuNouvelleVersionAction({ trainerId: ID }),
    "nouvelle_version_contrat",
  ],
  [
    "envoyerNouvelleVersionAction",
    () => envoyerNouvelleVersionAction({ trainerIds: [ID] }),
    "nouvelle_version_contrat",
  ],
] as const;

describe("interrupteur absent : comportement d'avant, rien ne se passe", () => {
  it.each(GESTES)("%s refuse sans rien lire ni écrire", async (_n, geste, cle) => {
    d.allume.mockResolvedValue(false);
    expect(await geste()).toHaveProperty("error");
    expect(d.allume).toHaveBeenCalledWith(cle);
    expect(effets().every((n) => n === 0)).toBe(true);
  });
});

describe("le rôle est jugé AVANT l'interrupteur", () => {
  it.each(GESTES)("%s : rôle « reader » refusé, interrupteur jamais lu", async (_n, geste) => {
    d.auth.mockResolvedValue({ user: { id: "u", role: "reader" } });
    expect(await geste()).toHaveProperty("error");
    expect(d.allume).not.toHaveBeenCalled();
    expect(effets().every((n) => n === 0)).toBe(true);
  });

  it("préparer et la nouvelle version exigent `contresigner` : un responsable qualité est refusé", async () => {
    d.auth.mockResolvedValue({ user: { id: "u", role: "responsable_qualite" } });
    expect(await preparerContratCadreAction({ trainerId: ID })).toHaveProperty("error");
    expect(await envoyerNouvelleVersionAction({ trainerIds: [ID] })).toHaveProperty("error");
    expect(d.preparer).not.toHaveBeenCalled();
  });
});

describe("préparer le contrat-cadre (L7b)", () => {
  it("allumé : le service prépare, le journal ne porte que des identifiants", async () => {
    expect(await preparerContratCadreAction({ trainerId: ID })).toEqual({
      data: { numero: "N-1", version: 4, remplaces: 0 },
    });
    const entree = d.log.mock.calls[0]?.[0] as { targetId: string; changes: object };
    expect(entree.targetId).toBe(DOC);
    expect(JSON.stringify(entree.changes)).not.toMatch(/@|Camille/);
  });

  it("un refus du service est rendu tel quel, rien n'est journalisé", async () => {
    d.preparer.mockResolvedValue({ ok: false, refus: ["Motif A.", "Motif B."] });
    expect(await preparerContratCadreAction({ trainerId: ID })).toEqual({
      error: "Motif A. Motif B.",
    });
    expect(d.log).not.toHaveBeenCalled();
  });
});

describe("nouvelle version (L7d)", () => {
  it("texte non validé ou résumé absent : rien n'est préparé, émis ni envoyé", async () => {
    d.texteValide.mockResolvedValue(false);
    expect(await envoyerNouvelleVersionAction({ trainerIds: [ID] })).toHaveProperty("error");
    d.texteValide.mockResolvedValue(true);
    d.resume.mockReturnValue(null);
    expect(await envoyerNouvelleVersionAction({ trainerIds: [ID] })).toHaveProperty("error");
    expect(d.preparer).not.toHaveBeenCalled();
    expect(d.emettre).not.toHaveBeenCalled();
    expect(d.envoyer).not.toHaveBeenCalled();
  });

  it("un formateur non concerné n'a ni pièce ni e-mail", async () => {
    d.faits.mockResolvedValue({ email: "x@exemple.fr", prenom: "X", contrats: [] });
    const r = await envoyerNouvelleVersionAction({ trainerIds: [ID] });
    expect(r).toEqual({ data: { resultats: [expect.objectContaining({ ok: false })] } });
    expect(d.preparer).not.toHaveBeenCalled();
  });

  it("concerné : nouvelle pièce, lien émis, F45 avec le résumé, clé d'envoi sans adresse", async () => {
    const r = await envoyerNouvelleVersionAction({ trainerIds: [ID, ID] });
    expect(r).toEqual({ data: { resultats: [expect.objectContaining({ ok: true })] } });
    expect(d.emettre).toHaveBeenCalledWith(
      expect.objectContaining({ documentGenereId: DOC, partie: "sous_traitant" }),
    );
    const envoi = d.envoyer.mock.calls[0]?.[0] as {
      gabarit: string;
      jobId: string;
      payload: { valeurs: Record<string, string> };
    };
    expect(envoi.gabarit).toBe("formateur-contrat-nouvelle-version");
    expect(envoi.payload.valeurs["liste courte"]).toBe("Un article change.");
    expect(envoi.jobId).not.toMatch(/@/);
  });

  it("plus de 30 formateurs d'un coup : refus", async () => {
    const ids = Array.from(
      { length: 31 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    expect(await envoyerNouvelleVersionAction({ trainerIds: ids })).toHaveProperty("error");
    expect(d.preparer).not.toHaveBeenCalled();
  });
});
