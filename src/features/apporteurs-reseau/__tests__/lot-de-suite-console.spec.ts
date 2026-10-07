import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot de suite du 07/10 (relecture de a1) : lien du dossier (déjà envoyé, dossier signé),
// dossier « Nouvel apporteur » relié à sa fiche candidat, messages exacts et vouvoyés.
vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  envoyer: vi.fn(),
  lireDossier: vi.fn(),
  dernierLien: null as { createdAt: Date } | null,
  candidatures: [] as Array<{ id: string; details: unknown; contactEmailHash?: string }>,
  dejaRelie: null as { id: string; prenom?: string; nom?: string } | null,
  doublon: null as { id: string } | null,
  createEnErreur: false,
  cree: vi.fn(),
}));

vi.mock("../envois", () => ({
  envoyer: (...a: unknown[]) => h.envoyer(...a),
  avecTexteLibre: (p: Record<string, unknown>) => p,
}));
vi.mock("../donnees", () => ({
  lireDossier: (...a: unknown[]) => h.lireDossier(...a),
  purgerContenuPieces: vi.fn(),
}));
vi.mock("../contrat-pdf", () => ({
  empreinte: () => "x",
  rendreContratPdf: vi.fn(),
  texteDuContrat: () => "",
}));
vi.mock("../annuaire", () => ({ lireEntrepriseParSiren: vi.fn() }));
vi.mock("@/lib/r2-storage", () => ({
  getObjectBufferR2: vi.fn(),
  isR2Configured: () => true,
  uploadToR2: vi.fn(),
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null) => v,
  encryptPii: (v: string | null) => v,
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "empreinte" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: { findFirst: vi.fn(async () => h.dernierLien) },
    // Le filtre d'adresse est appliqué pour de vrai (07/10 : fiche reliée si l'adresse concorde).
    submission: {
      findMany: vi.fn(async (a: { where: Record<string, unknown> }) =>
        h.candidatures.filter(
          (c) =>
            (a.where["id"] === undefined || a.where["id"] === c.id) &&
            (c.contactEmailHash ?? "empreinte") === a.where["contactEmailHash"],
        ),
      ),
    },
    apporteurReseau: {
      findUnique: vi.fn(async (a: { where: Record<string, unknown> }) =>
        "submissionId" in a.where ? h.dejaRelie : "emailHash" in a.where ? h.doublon : null,
      ),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        if (h.createEnErreur) throw new Error("Unique constraint failed on emailHash");
        h.cree(a.data);
        return { id: "nouvel-apporteur" };
      }),
    },
  },
}));

import {
  envoyerLien,
  ouvrirDossierManuel,
  preparerLien,
  sirenAContresigner,
} from "../verification";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const dossier = (over: Record<string, unknown> = {}) => ({
  id: ID,
  statut: "dossier_en_cours",
  versionLien: 1,
  prenom: "Claire",
  email: "claire@exemple.fr",
  pieces: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "secret-de-test");
  h.lireDossier.mockResolvedValue(dossier());
  h.envoyer.mockResolvedValue("envoye");
  h.dernierLien = null;
  h.candidatures = [];
  h.dejaRelie = null;
  h.doublon = null;
  h.createEnErreur = false;
});

describe("7) « Envoyer le lien du dossier »", () => {
  it.each(["a_verifier", "signe"])("dossier %s : plus de lien à envoyer", async (statut) => {
    h.lireDossier.mockResolvedValue(dossier({ statut }));
    expect(await preparerLien(ID, null)).toMatchObject({ ok: false });
  });

  it("déjà envoyé : l'aperçu le dit, et le renvoi exige une confirmation", async () => {
    h.dernierLien = { createdAt: new Date("2026-10-06T09:00:00Z") };
    const prep = await preparerLien(ID, null);
    expect(prep).toMatchObject({ ok: true, dejaEnvoyeLe: "6 octobre" });
    const sans = await envoyerLien(ID, null);
    expect(sans).toMatchObject({ ok: false });
    expect((sans as { message: string }).message).toContain("déjà envoyé le 6 octobre");
    expect(h.envoyer).not.toHaveBeenCalled();
    expect(await envoyerLien(ID, null, undefined, true)).toMatchObject({ ok: true });
    expect(h.envoyer).toHaveBeenCalledTimes(1);
  });

  it("jamais envoyé : part sans confirmation", async () => {
    expect(await envoyerLien(ID, null)).toMatchObject({ ok: true });
  });
});

describe("12) « Nouvel apporteur » : dossier relié à la fiche candidat de la même adresse", () => {
  const nouveau = () =>
    ouvrirDossierManuel({ prenom: "Kraft", nom: "Bastine", email: "k@x.fr", telephone: null });

  it("fiche candidat apporteur trouvée : le dossier y est relié", async () => {
    h.candidatures = [
      { id: "sub-1", details: { unifiedType: "recrutement", subType: "candidature-commerciale" } },
    ];
    await nouveau();
    expect(h.cree).toHaveBeenCalledWith(expect.objectContaining({ submissionId: "sub-1" }));
  });

  it("fiche déjà reliée à un autre dossier : pas de second lien", async () => {
    h.candidatures = [
      { id: "sub-1", details: { unifiedType: "recrutement", subType: "candidature-commerciale" } },
    ];
    h.dejaRelie = { id: "autre" };
    await nouveau();
    expect(h.cree.mock.calls[0]![0]).not.toHaveProperty("submissionId");
  });

  it("menu « Apporteurs » ; page : « Actifs » par défaut, puis « Dossier en cours »", () => {
    const nav = readFileSync(resolve(__dirname, "../../../lib/admin-nav.ts"), "utf8");
    expect(nav).toContain('label: "Apporteurs",');
    expect(nav).not.toContain('label: "Apporteurs signés"');
    const page = readFileSync(
      resolve(__dirname, "../../../app/[locale]/(admin)/[adminPrefix]/apporteurs/page.tsx"),
      "utf8",
    );
    expect(page).toContain('{ cle: "actifs", libelle: "Actifs", statuts: ["signe"] }');
    expect(page).toContain('statuts: ["dossier_en_cours", "a_verifier", "a_completer"]');
    expect(page).toContain('const ongletParDefaut = "actifs";');
  });
});

describe("relecture du formulaire (a1)", () => {
  const fiche = { unifiedType: "recrutement", subType: "candidature-commerciale" };
  const avec = (submissionId: string) =>
    ouvrirDossierManuel({
      prenom: "Kraft",
      nom: "Bastine",
      email: "k@x.fr",
      telephone: null,
      submissionId,
    });

  it("1) fiche choisie dont l'adresse n'est PAS celle saisie : jamais reliée", async () => {
    h.candidatures = [{ id: "sub-A", details: fiche, contactEmailHash: "autre-adresse" }];
    expect(await avec("sub-A")).toMatchObject({ ok: true });
    expect(h.cree.mock.calls[0]![0]).not.toHaveProperty("submissionId");
  });

  it("2) fiche choisie déjà reliée à un autre dossier : refus dit, aucun second dossier", async () => {
    h.candidatures = [{ id: "sub-A", details: fiche }];
    h.dejaRelie = { id: "app-B", prenom: "Paul", nom: "Martin" };
    const r = await avec("sub-A");
    expect(r).toMatchObject({ ok: false, dejaRelieA: "app-B" });
    expect((r as { message: string }).message).toContain("déjà reliée au dossier de Paul Martin");
    expect(h.cree).not.toHaveBeenCalled();
  });

  it("3) deux clics simultanés (unicité de l'adresse) : « dossier existant »", async () => {
    h.createEnErreur = true;
    h.doublon = null;
    const create = vi.fn();
    void create;
    // Le premier appel ne voit pas le dossier, la création échoue, le second regard le trouve.
    const prisma = (await import("@/lib/prisma")).prisma as unknown as {
      apporteurReseau: { findUnique: ReturnType<typeof vi.fn> };
    };
    prisma.apporteurReseau.findUnique
      .mockResolvedValueOnce(null) // dossier existant ?
      .mockResolvedValueOnce({ id: "app-C" }); // après l'erreur d'unicité
    expect(
      await ouvrirDossierManuel({ prenom: "A", nom: "B", email: "k@x.fr", telephone: null }),
    ).toEqual({ ok: true, apporteurId: "app-C", existait: true });
  });
});

describe("5, 6, 14) messages exacts et vouvoyés", () => {
  it("SIREN invalide : dire de cliquer d'abord « À compléter »", async () => {
    expect(await sirenAContresigner("123456789")).toContain("« À compléter »");
  });

  it("le message « résilié » ne renvoie plus à un geste qui n'existe pas", () => {
    const src = readFileSync(resolve(__dirname, "../donnees.ts"), "utf8");
    expect(src).not.toContain("Rouvrez le dossier depuis sa fiche");
  });

  it("plus de tutoiement dans les messages de la console des apporteurs", () => {
    for (const f of [
      "../verification.ts",
      "../presentations.ts",
      "../actions-presentations.ts",
      "../actions-commissions.ts",
      "../actions-apporteurs.ts",
      "../../admin-rendezvous/issue-apporteur-actions.ts",
    ]) {
      const src = readFileSync(resolve(__dirname, f), "utf8");
      expect(src, f).not.toMatch(
        /"[^"]*\b(Choisis|Indique|Réessaie|reconnecte-toi|demande-lui|fais-le|Ton rôle)\b/,
      );
    }
  });
});
