import { beforeEach, describe, expect, it, vi } from "vitest";

const reglage = vi.fn(async (..._a: unknown[]): Promise<unknown> => null);
const lister = vi.fn(async (..._a: unknown[]): Promise<unknown[]> => []);
const compter = vi.fn(async (..._a: unknown[]) => 0);
const tunnel = vi.fn(async (..._a: unknown[]): Promise<Array<{ id: string | null }>> => []);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...a: unknown[]) => tunnel(...a),
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
const preparer = vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({
  fiche: "creee",
  submissionId: "fiche-1",
}));
const inviter = vi.fn(async (..._a: unknown[]) => "envoyee");
vi.mock("@/server/careers/proposer-reseau-auto", () => ({
  DEBUT_PROPOSITION_RESEAU: new Date("2026-09-29T12:00:00+02:00"),
  preparerProposition: (...a: unknown[]) => preparer(...a),
  envoyerProposition: (...a: unknown[]) => inviter(...a),
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

  it("🔴 exclut les COMMERCIAUX — catégorie `commercial` et intitulés commerciaux (tunnel apporteur)", () => {
    const w = critereEligible(MAINTENANT);
    const texte = JSON.stringify(w);
    expect(texte).toContain('"category":{"not":"commercial"}');
    for (const t of ["commercial", "business dev", "apporteur"]) expect(texte).toContain(`"${t}"`);
  });

  it("🔴 exclut toute candidature BASCULÉE dans le tunnel (fiche apporteur née d'elle)", () => {
    expect(critereEligible(MAINTENANT, ["app-tunnel"]).id).toEqual({ notIn: ["app-tunnel"] });
    expect(critereEligible(MAINTENANT).id).toBeUndefined();
  });
});

describe("🔴 proposition du réseau d'apporteurs — candidatures FUTURES seulement", () => {
  const recente = (i: number) => ({ ...dossier(i), submittedAt: new Date("2026-10-01T09:00:00Z") });
  const ancienne = (i: number) => ({
    ...dossier(i),
    submittedAt: new Date("2026-09-20T09:00:00Z"),
  });
  const corpsEnvoye = () => (repondre.mock.calls[0]![2] as { bodyMarkdown: string }).bodyMarkdown;

  it("candidature reçue après le 29/09 : « poste pourvu » + paragraphe réseau, PUIS l'invitation", async () => {
    lister.mockResolvedValue([recente(1)]);
    await passerReponsePostePourvu(MAINTENANT);
    expect(preparer).toHaveBeenCalledWith("id-1", "poste-pourvu");
    expect(corpsEnvoye()).toContain("réseau d'apporteurs d'affaires indépendants");
    expect(corpsEnvoye().indexOf("réseau d'apporteurs")).toBeLessThan(
      corpsEnvoye().indexOf("Si vous préférez que nous supprimions"),
    );
    expect(inviter).toHaveBeenCalledWith("id-1", "fiche-1");
  });

  it("candidature d'AVANT le 29/09 : rien de nouveau (ni proposition, ni invitation)", async () => {
    lister.mockResolvedValue([ancienne(1)]);
    await passerReponsePostePourvu(MAINTENANT);
    expect(preparer).not.toHaveBeenCalled();
    expect(corpsEnvoye()).not.toContain("réseau d'apporteurs");
    expect(inviter).not.toHaveBeenCalled();
  });

  it("🔴 fiche impossible (déjà apporteur, lien absent) : le message N'ANNONCE PAS d'invitation", async () => {
    preparer.mockResolvedValueOnce({ fiche: "impossible", raison: "doublon" });
    lister.mockResolvedValue([recente(1)]);
    await passerReponsePostePourvu(MAINTENANT);
    expect(corpsEnvoye()).not.toContain("réseau d'apporteurs");
    expect(inviter).not.toHaveBeenCalled();
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

  it("🔴 le passage exclut les candidatures du tunnel lues en base", async () => {
    tunnel.mockResolvedValueOnce([{ id: "app-tunnel" }, { id: null }]);
    await passerReponsePostePourvu(MAINTENANT);
    const where = (lister.mock.calls[0]![0] as { where: { id?: unknown } }).where;
    expect(where.id).toEqual({ notIn: ["app-tunnel"] });
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
