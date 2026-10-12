/**
 * Lot B, M3 — les actions de l'étape 4 quand le contrat se signe DANS le dossier.
 *
 *   · contrat à signer : l'envoi « sans signature » est refusé (le dossier part avec lui) ;
 *   · « Signer mon contrat » : rien n'est signé si l'entreprise est bloquante ou s'il
 *     manque un élément ; signé → dossier envoyé → contrôle, F11, puis F10 ;
 *   · « Recevoir mon code » : passe par le service, rend l'adresse masquée et le PDF ;
 *   · lexique des formateurs respecté par les nouveaux textes et messages.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  lire: vi.fn(),
  envoyerDossier: vi.fn(),
  mode: vi.fn(),
  demander: vi.fn(),
  signer: vi.fn(),
  accuse: vi.fn(),
  pdf: vi.fn(),
  registre: vi.fn(),
  controle: vi.fn(),
  alerte: vi.fn(),
  ordre: [] as string[],
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "1.2.3.4" }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/qualiopi/formateurs-independants/dossier", async (orig) => ({
  ...(await orig<object>()),
  lireDossierParLien: (...a: unknown[]) => h.lire(...a),
  envoyerDossier: (...a: unknown[]) => {
    h.ordre.push("envoyerDossier");
    return h.envoyerDossier(...a);
  },
}));
vi.mock("@/server/qualiopi/formateurs-independants/contrat-dans-le-dossier", () => ({
  modeContratDossier: () => h.mode(),
  demanderCodeDuDossier: (...a: unknown[]) => h.demander(...a),
  signerContratDuDossier: (...a: unknown[]) => {
    h.ordre.push("signer");
    return h.signer(...a);
  },
  envoyerAccuseDossier: (...a: unknown[]) => {
    h.ordre.push("F10");
    return h.accuse(...a);
  },
  lienPdfContratDossier: (...a: unknown[]) => h.pdf(...a),
}));
vi.mock("@/server/registre-entreprises/annuaire", () => ({
  lireEtablissementParSiret: (...a: unknown[]) => h.registre(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/regles-admission", async (orig) => ({
  ...(await orig<object>()),
  jugerAdmissionFormateur: () => ({ ecran: "ok" }),
  ECRANS_QUI_LAISSENT_CONTINUER: new Set(["ok"]),
}));
vi.mock("@/server/qualiopi/formateurs-independants/controle", () => ({
  controlerRegistreFormateur: (...a: unknown[]) => {
    h.ordre.push("controle");
    return h.controle(...a);
  },
}));
vi.mock("@/server/qualiopi/formateurs-independants/source-registre", () => ({
  sourceRegistreCommune: () => ({}),
}));
vi.mock("@/server/qualiopi/formateurs-independants/envois-dossier", () => ({
  alerterDossierRecu: (...a: unknown[]) => {
    h.ordre.push("F11");
    return h.alerte(...a);
  },
  prevenirStatutNonOuvert: vi.fn(),
}));

import {
  demanderCodeContratAction,
  envoyerDossierAction,
  signerEtEnvoyerDossierAction,
} from "./actions";
import { TEXTES } from "./textes";

const T = "6f1b8a52-4a0e-4d4c-9f43-2f6a7d1c9e10";
const DOSSIER = {
  id: T,
  accesVersion: 1,
  etat: "modifiable",
  statut: "en_cours",
  ibanFige: false,
  prenom: "Camille",
  nom: "Martin",
  email: "camille@exemple.fr",
  telephone: null,
  codePostalPro: "69001",
  siret: "12345678900011",
  nda: "en cours",
  regimeTva: "franchise",
  ibanSaisi: true,
  codeUrssafSaisi: true,
  pieces: [
    { type: "attestation_vigilance_urssaf", statut: "deposee", motif: null, nomFichier: "a" },
    { type: "rib", statut: "deposee", motif: null, nomFichier: "r" },
    { type: "cv", statut: "deposee", motif: null, nomFichier: "c" },
    { type: "recepisse_declaration_activite", statut: "deposee", motif: null, nomFichier: "d" },
  ],
  suggestions: { codePostal: null, siret: null, nda: null },
};

function fd(champs: Record<string, string>): FormData {
  const f = new FormData();
  f.set("id", T);
  f.set("jeton", "123.abc");
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.ordre.length = 0;
  h.lire.mockResolvedValue(DOSSIER);
  h.mode.mockResolvedValue({ mode: "a_signer", version: 3 });
  h.registre.mockResolvedValue({ ok: true, entreprise: { active: true } });
  h.envoyerDossier.mockResolvedValue({ ok: true });
  h.signer.mockResolvedValue({ ok: true, documentId: "doc-1" });
  h.accuse.mockResolvedValue("envoye");
  h.demander.mockResolvedValue({ ok: true, destinataireMasque: "c***@e***.fr" });
  h.pdf.mockResolvedValue("https://r2.example/contrat.pdf");
  h.controle.mockResolvedValue({ ok: true });
  h.alerte.mockResolvedValue(undefined);
});

describe("étape 4, contrat à signer dans le dossier", () => {
  it("l'envoi sans signature est refusé quand le contrat se signe ici", async () => {
    const r = await envoyerDossierAction(fd({ certifie: "1" }));
    expect(r.ok).toBe(false);
    expect(h.envoyerDossier).not.toHaveBeenCalled();
  });

  it("coupé (sans contrat) : l'envoi sans signature reste celui d'avant", async () => {
    h.mode.mockResolvedValue({ mode: "sans_contrat" });
    const r = await envoyerDossierAction(fd({ certifie: "1" }));
    expect(r).toEqual({ ok: true });
    expect(h.envoyerDossier).toHaveBeenCalled();
    expect(h.signer).not.toHaveBeenCalled();
  });

  it("« Recevoir mon code » : adresse masquée et lien du PDF", async () => {
    const r = await demanderCodeContratAction(fd({}));
    expect(r).toEqual({
      ok: true,
      adresse: "c***@e***.fr",
      pdfUrl: "https://r2.example/contrat.pdf",
    });
    expect(h.demander.mock.calls[0]![0]).toMatchObject({ id: T, siret: "12345678900011" });
  });

  it("signer exige les deux cases et un code de 6 chiffres", async () => {
    expect((await signerEtEnvoyerDossierAction(fd({ certifie: "1", code: "123456" }))).ok).toBe(
      false,
    );
    expect(
      (await signerEtEnvoyerDossierAction(fd({ certifie: "1", accepte: "1", code: "12a456" }))).ok,
    ).toBe(false);
    expect(h.signer).not.toHaveBeenCalled();
  });

  it("il manque un élément : rien n'est signé", async () => {
    h.lire.mockResolvedValue({ ...DOSSIER, ibanSaisi: false });
    const r = await signerEtEnvoyerDossierAction(
      fd({ certifie: "1", accepte: "1", code: "123456" }),
    );
    expect(r.ok).toBe(false);
    expect(h.signer).not.toHaveBeenCalled();
  });

  it("signé → dossier envoyé → contrôle, F11, puis F10 (dans cet ordre)", async () => {
    const r = await signerEtEnvoyerDossierAction(
      fd({ certifie: "1", accepte: "1", code: "123 456" }),
    );
    expect(r).toEqual({ ok: true });
    expect(h.signer.mock.calls[0]![1]).toBe("123456");
    expect(h.ordre).toEqual(["signer", "envoyerDossier", "controle", "F11", "F10"]);
    expect(h.accuse.mock.calls[0]![1]).toBe("doc-1");
  });

  it("signature refusée (code faux) : le dossier ne part pas", async () => {
    h.signer.mockResolvedValue({ ok: false, message: "Ce code ne correspond pas." });
    const r = await signerEtEnvoyerDossierAction(
      fd({ certifie: "1", accepte: "1", code: "123456" }),
    );
    expect(r).toEqual({ ok: false, message: "Ce code ne correspond pas." });
    expect(h.envoyerDossier).not.toHaveBeenCalled();
  });
});

const INTERDITS =
  /\b(poste|entretien|recrutement|salaire|rémunération|bienvenue|vous devez|obligatoire|agent commercial|grenoble|expert-comptable|embauche)\b/i;

describe("lexique des nouveaux textes", () => {
  it("textes de l'étape 4 et messages du service", () => {
    const textes = [
      TEXTES.contratRempli,
      ...TEXTES.contratResume,
      TEXTES.contratApresCode,
      TEXTES.jaiLu,
      ...TEXTES.jaiLuPoints,
      TEXTES.signeEnTantQue("x"),
      TEXTES.codeEnvoye("x"),
      TEXTES.merciSigneTitre,
      TEXTES.merciSigneLigne,
      TEXTES.contratDejaSigne,
    ];
    expect(textes.filter((t) => INTERDITS.test(t))).toEqual([]);
    const service = readFileSync(
      join(process.cwd(), "src/server/qualiopi/formateurs-independants/contrat-dans-le-dossier.ts"),
      "utf8",
    );
    const litteraux = [...service.matchAll(/"([^"\n]{12,})"/g)].map((m) => m[1]!);
    expect(litteraux.filter((t) => INTERDITS.test(t))).toEqual([]);
  });
});
