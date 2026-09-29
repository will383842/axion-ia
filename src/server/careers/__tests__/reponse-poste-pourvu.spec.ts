import { beforeEach, describe, expect, it, vi } from "vitest";

const reglage = vi.fn(async (..._a: unknown[]): Promise<unknown> => null);
const lister = vi.fn(async (..._a: unknown[]): Promise<unknown[]> => []);
const compter = vi.fn(async (..._a: unknown[]) => 0);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: (...a: unknown[]) => reglage(...a) },
    jobApplication: {
      findMany: (...a: unknown[]) => lister(...a),
      count: (...a: unknown[]) => compter(...a),
    },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string) => (v === "illisible" ? null : v),
}));
const repondre = vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({
  ecrit: true,
  enfile: true,
  replyId: "r",
}));
vi.mock("@/features/admin-job-applications/envoyer-reponse", () => ({
  ecrireEtEnfilerReponse: (...a: unknown[]) => repondre(...a),
}));

import {
  AGE_MIN_JOURS,
  AUTEUR,
  PAR_PASSAGE,
  critereEligible,
  passerReponsePostePourvu,
  posteCourt,
} from "../reponse-poste-pourvu";

const MAINTENANT = new Date("2026-09-28T10:35:00Z");
const dossier = (i: number, prenom = `Prenom${i}`) => ({
  id: `id-${i}`,
  email: "chiffre",
  locale: "fr",
  status: "new",
  offerTitleSnap: "Rédacteur web / Content Manager IA",
  firstName: prenom,
});

beforeEach(() => {
  vi.clearAllMocks();
  reglage.mockResolvedValue({ value: { actif: true } });
});

describe("posteCourt — l'intitulé qu'on écrit dans une phrase", () => {
  it.each([
    [
      "Développeur web / Product Engineer — produits SaaS dopés à l'IA",
      "Développeur web / Product Engineer",
    ],
    ["Monteur son / Sound designer (F/H) — Podcast Axion-IA.com", "Monteur son / Sound designer"],
    [
      "Candidature spontanée — Data Scientist / Ingénieur IA junior",
      "Data Scientist / Ingénieur IA junior",
    ],
    ["COMMERCIAL", "Commercial"],
    ["", null],
  ])("« %s » → « %s »", (brut, attendu) => {
    expect(posteCourt(brut)).toBe(attendu);
  });
});

describe("critereEligible — ce qui protège un dossier", () => {
  it("seulement « nouvelle », sans aucune réponse, sans opposition, déposée depuis 7 jours", () => {
    const w = critereEligible(MAINTENANT);
    expect(w.status).toBe("new");
    expect(w.replies).toEqual({ none: {} });
    expect(w.vivierOpposedAt).toBeNull();
    expect((w.submittedAt as { lte: Date }).lte.getTime()).toBe(
      MAINTENANT.getTime() - AGE_MIN_JOURS * 86_400_000,
    );
  });

  it("exclut les offres vidéo, par slug ET par intitulé (candidature sans offre)", () => {
    const texte = JSON.stringify(critereEligible(MAINTENANT));
    expect(texte).toContain("monteur-video-freelance-distance");
    expect(texte).toContain("videaste-freelance-tournage");
    expect(texte).toContain("monteur vid");
    expect(texte).toContain("vidéaste");
  });
});

describe("le passage horaire", () => {
  it("🔴 interrupteur ABSENT = rien ne part", async () => {
    reglage.mockResolvedValue(null);
    const b = await passerReponsePostePourvu(MAINTENANT);
    expect(b.actif).toBe(false);
    expect(lister).not.toHaveBeenCalled();
    expect(repondre).not.toHaveBeenCalled();
  });

  it("interrupteur arrêté (actif:false) = rien ne part", async () => {
    reglage.mockResolvedValue({ value: { actif: false } });
    await passerReponsePostePourvu(MAINTENANT);
    expect(repondre).not.toHaveBeenCalled();
  });

  it("personnalise chaque message et signe « réponse automatique »", async () => {
    lister.mockResolvedValue([dossier(1, "Julie")]);
    await passerReponsePostePourvu(MAINTENANT);
    const [, acteur, contenu] = repondre.mock.calls[0] as [
      unknown,
      { userId: null; nom: string },
      { subject: string; bodyMarkdown: string },
    ];
    expect(acteur).toEqual({ userId: null, nom: AUTEUR });
    expect(contenu.subject).toBe("Votre candidature — Rédacteur web / Content Manager IA");
    expect(contenu.bodyMarkdown).toMatch(/^Bonjour Julie,/);
    expect(contenu.bodyMarkdown).not.toContain("{");
  });

  it(`au plus ${PAR_PASSAGE} envois par passage — le plafond de la boîte est partagé`, async () => {
    lister.mockResolvedValue(Array.from({ length: 40 }, (_, i) => dossier(i)));
    compter.mockResolvedValue(25);
    const b = await passerReponsePostePourvu(MAINTENANT);
    expect(repondre).toHaveBeenCalledTimes(PAR_PASSAGE);
    expect(b).toMatchObject({ envoyees: PAR_PASSAGE, restantes: 25 });
  });

  it("🔴 un prénom illisible est écarté SANS affamer la file : les suivants partent", async () => {
    const illisibles = Array.from({ length: 20 }, (_, i) => dossier(i, "illisible"));
    lister.mockResolvedValue([...illisibles, dossier(100), dossier(101)]);
    const b = await passerReponsePostePourvu(MAINTENANT);
    expect(b).toMatchObject({ envoyees: 2, ecartees: 20 });
    expect(repondre).toHaveBeenCalledTimes(2);
  });
});
