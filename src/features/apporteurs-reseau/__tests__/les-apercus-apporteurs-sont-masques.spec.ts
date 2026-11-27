// Fiche I2-4a : les aperçus apporteurs (décision, lien, réponse à une présentation) rendent
// avec le vrai destinataire et le vrai lien d'espace, par la MÊME fonction que l'envoi, puis
// renvoient un ApercuLecteur masqué et inerte : le navigateur de la console ne reçoit jamais
// un jeton. Aucun e-mail réel ne part : `enqueueEmail` est simulé.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  enqueueEmail: vi.fn(),
  render: vi.fn(),
  lireDossier: vi.fn(),
  pieces: vi.fn(),
  presentation: vi.fn(),
  apporteur: vi.fn(),
}));

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const PRES = "7a1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4c";
const MARQUEUR = "JETONMARQUEURabcdef0123456789";
const LIEN = `https://axion-ia.com/apporteur/dossier/${ID}/${MARQUEUR}`;
const ADRESSE = "claire@exemple.fr";

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: () => h.auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pieceApporteur: { findMany: (...a: unknown[]) => h.pieces(...a) },
    presentationEntreprise: { findUnique: (...a: unknown[]) => h.presentation(...a) },
    apporteurReseau: { findUnique: (...a: unknown[]) => h.apporteur(...a) },
    emailLog: { findFirst: async () => null },
  },
}));
vi.mock("../donnees", () => ({
  lireDossier: (...a: unknown[]) => h.lireDossier(...a),
  purgerContenuPieces: vi.fn(),
}));
vi.mock("../jeton", () => ({ urlDossier: () => LIEN }));
vi.mock("../retrait", () => ({
  retraitDe: async () => null,
  GABARITS_ARGENT: new Set<string>(),
}));
vi.mock("../etablissement-presentation", async (orig) => ({
  ...(await orig<typeof import("../etablissement-presentation")>()),
  lireEtablissements: async () => new Map(),
  lireSiretsDevis: async () => new Map(),
  lireDecisionsAAttribuer: async () => new Map(),
  lireAAttribuerEnAttente: async () => [],
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => h.enqueueEmail(...a),
  emailsQueue: null,
}));
vi.mock("@/lib/email/templates", async (orig) => {
  const vrai = await orig<typeof import("@/lib/email/templates")>();
  return {
    ...vrai,
    renderEmailTemplate: (...a: Parameters<typeof vrai.renderEmailTemplate>) => {
      h.render(...a);
      return vrai.renderEmailTemplate(...a);
    },
  };
});

import { apercuDecisionAction, apercuLienAction } from "../actions-apporteurs";
import { apercuReponseAction } from "../actions-presentations";
import { apercu } from "../apercu-envoi";
import { envoyer, type EnvoiApporteur } from "../envois";
import { jetonOpposition } from "@/server/email/opposition-jeton";

const dossier = {
  id: ID,
  email: ADRESSE,
  prenom: "Claire",
  nom: "Martin",
  statut: "a_verifier",
  versionLien: 2,
  pieces: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.mockResolvedValue({ user: { id: "u1", role: "admin" } });
  h.enqueueEmail.mockResolvedValue({ enqueued: true });
  h.apporteur.mockImplementation(async (a: { select?: Record<string, boolean> }) =>
    a.select && "versionLien" in a.select
      ? { versionLien: 2, statut: "signe", refuseAt: null, resilieAt: null }
      : null,
  );
  h.pieces.mockResolvedValue([]);
  h.presentation.mockResolvedValue({
    id: PRES,
    statut: "reservee",
    contactEnvoyeAt: null,
    denomination: "Entreprise Test",
    recueAt: new Date("2026-11-01T10:00:00Z"),
    personneNom: "Paul Durand",
    personneEmail: "paul@exemple.fr",
    apporteurId: ID,
    apporteur: { id: ID, prenom: "Claire", nom: "Martin", email: ADRESSE },
  });
});

interface EmailLu {
  html: string;
  texte?: string | null | undefined;
  de?: string | null | undefined;
  repondreA?: string | null | undefined;
  a?: string | null | undefined;
}

/** Les trois actions, ramenées à « l'e-mail que la console reçoit » (la forme exacte est vérifiée plus bas). */
const CAS: Array<{ nom: string; lire: () => Promise<{ email: EmailLu; gabarit: string }> }> = [
  {
    nom: "apercuDecisionAction",
    lire: async () => {
      h.lireDossier.mockResolvedValue(dossier);
      const r = await apercuDecisionAction({
        apporteurId: ID,
        decision: "a_completer",
        note: "Merci de renvoyer l'attestation.",
      });
      if (!r.ok) throw new Error(r.message);
      return { email: r.email as unknown as EmailLu, gabarit: r.email.gabarit };
    },
  },
  {
    nom: "apercuLienAction",
    lire: async () => {
      h.lireDossier.mockResolvedValue({ ...dossier, statut: "invite" });
      const r = await apercuLienAction({ apporteurId: ID, mot: null });
      if (!r.ok) throw new Error(r.message);
      return { email: r.email as unknown as EmailLu, gabarit: r.email.gabarit };
    },
  },
  {
    nom: "apercuReponseAction (présentations)",
    lire: async () => {
      const r = await apercuReponseAction({ id: PRES, reponse: "pas_disponible" });
      if (r.etat !== "apercu") throw new Error(r.message);
      const e = r.emails[0]!;
      return { email: e as unknown as EmailLu, gabarit: e.gabarit };
    },
  },
];

describe.each(CAS)("$nom", ({ lire }) => {
  it("1) aucun jeton marqueur dans ce que reçoit la console", async () => {
    const { email } = await lire();
    // Témoin : le rendu a bien reçu un lien personnel, donc le masque a quelque chose à cacher.
    expect(JSON.stringify(h.render.mock.calls.at(-1)![2])).toContain(MARQUEUR);
    expect(JSON.stringify(email)).not.toContain(MARQUEUR);
    expect(JSON.stringify(email)).not.toContain(jetonOpposition(ADRESSE));
  });

  it("2) l'aperçu rend avec le vrai destinataire et le payload que l'envoi met en file", async () => {
    const { gabarit } = await lire();
    const appel = h.render.mock.calls.at(-1)!;
    expect(appel[0]).toBe(gabarit);
    expect(appel[1]).toBe("fr");
    expect(appel[3]).toEqual({ destinataire: expect.stringContaining("@") });
    // Le lien d'espace recalculé (comme à l'envoi) est dans le payload rendu.
    expect(JSON.stringify(appel[2])).toContain(MARQUEUR);
  });

  it("3) pied de page : lien d'opposition masqué, texte présent, en-tête complet", async () => {
    const { email } = await lire();
    const lecteur = (email as unknown as { apercu: EmailLu }).apercu;
    expect(lecteur.html).toContain("/api/unsubscribe?token=[masqué]");
    expect(lecteur.html).not.toMatch(/href=/i);
    expect(typeof lecteur.texte).toBe("string");
    expect((lecteur.texte ?? "").length).toBeGreaterThan(10);
    expect(lecteur.texte).not.toContain(MARQUEUR);
    expect(lecteur.de).toContain("@");
    expect(lecteur.repondreA).toContain("@");
    expect(lecteur.a).toBe(ADRESSE);
  });
});

describe("aperçu et envoi : mêmes arguments de rendu", () => {
  it("4) `apercu(e)` et `envoyer(e)` partent du même payload et du même destinataire", async () => {
    const e: EnvoiApporteur = {
      gabarit: "apporteur-contrat-signe",
      destinataire: ADRESSE,
      payload: { contactName: "Claire" },
      entityType: "ApporteurReseau",
      entityId: ID,
    };
    await apercu(e);
    await envoyer(e);
    const rendu = h.render.mock.calls[0]!;
    const [gabarit, destinataire, locale, payload] = h.enqueueEmail.mock.calls[0]!;
    expect(rendu[0]).toBe(gabarit);
    expect(rendu[1]).toBe(locale);
    expect(rendu[2]).toEqual(payload);
    expect(rendu[3]).toEqual({ destinataire });
  });

  it("5) un payload qui porte un vrai lien : l'aperçu le masque, l'envoi le garde en clair", async () => {
    const e: EnvoiApporteur = {
      gabarit: "apporteur-contrat-signe",
      destinataire: ADRESSE,
      payload: { contactName: "Claire", lien: LIEN },
      entityType: "ApporteurReseau",
      entityId: ID,
    };
    const vu = await apercu(e);
    expect(JSON.stringify(vu)).not.toContain(MARQUEUR);
    await envoyer(e);
    expect(JSON.stringify(h.enqueueEmail.mock.calls[0]![3])).toContain(MARQUEUR);
  });
});

describe("apercuLienAction : une panne du rendu ne remonte pas", () => {
  it("rend un message d'erreur au lieu de lever", async () => {
    h.lireDossier.mockResolvedValue({ ...dossier, statut: "invite" });
    h.render.mockImplementation(() => {
      throw new Error("rendu en panne");
    });
    const r = await apercuLienAction({ apporteurId: ID, mot: null });
    expect(r).toEqual({ ok: false, message: "L'aperçu n'a pas pu être préparé." });
  });
});
