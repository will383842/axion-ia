// « Proposer le réseau d'apporteurs » depuis la fiche d'une candidature à une
// offre d'emploi (décision Will, 2026-09-28).
//
// Ce que ces tests protègent :
//   · la fiche apporteur est créée sur le modèle EXACT de la saisie manuelle :
//     données chiffrées, empreinte d'adresse, `source: import`, marqueurs
//     apporteur, consentement NON simulé — plus le lien vers la candidature et
//     le titre de l'offre, qui font choisir à l'invitation sa variante honnête ;
//   · le DOUBLON se détecte avant d'écrire, par empreinte, et renvoie vers la
//     fiche existante ;
//   · un second clic ne crée pas une seconde fiche (idempotence) ;
//   · un rôle qui ne peut pas écrire sur un dossier candidat n'écrit rien ;
//   · l'invitation ne part que si la case est cochée ;
//   · aucune donnée personnelle en clair dans les journaux.

import { describe, it, expect, vi, beforeEach } from "vitest";

const APP_ID = "11111111-1111-4111-8111-111111111111";
const SUB_ID = "33333333-3333-4333-8333-333333333333";

const lireCandidature = vi.fn(async (_a: unknown) => candidature as unknown);
const ficheDeLaCandidature = vi.fn(async (_a: unknown) => null as unknown);
const lignesParEmpreinte = vi.fn(async (_a: unknown) => [] as unknown[]);
const creer = vi.fn(async (_a: unknown) => ({ id: SUB_ID }));
const journalConsole = vi.fn(async (_a: unknown) => ({ id: "log" }));
const evenement = vi.fn(async (_a: unknown) => ({ id: "evt" }));
const inviter = vi.fn(async (_a: unknown) => ({ ok: true }) as unknown);

let candidature: Record<string, unknown> | null;
let session: { user?: { id?: string; role?: string; name?: string } } | null;
const envMock: { CALENDLY_APPORTEUR_URL?: string | undefined } = {};

vi.mock("@/auth", () => ({ auth: async () => session }));
vi.mock("@/env", () => ({ env: envMock }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `chiffre(${v})`,
  decryptPii: (v: string) => String(v).replace(/^chiffre\(|\)$/g, ""),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      findUnique: (a: unknown) => lireCandidature(a),
      updateMany: async () => ({ count: 1 }),
    },
    jobApplicationEvent: { create: (a: unknown) => evenement(a) },
    submission: {
      findFirst: (a: unknown) => ficheDeLaCandidature(a),
      findMany: (a: unknown) => lignesParEmpreinte(a),
      create: (a: unknown) => creer(a),
    },
    activityLog: { create: (a: unknown) => journalConsole(a) },
  },
}));
vi.mock("@/features/commercial-application/invitation-apporteur", () => ({
  envoyerInvitationApporteur: (a: unknown) => inviter(a),
}));

const { proposerReseauApporteursAction } = await import("../proposer-reseau-actions");

const CALENDLY = "https://calendly.com/axion-ia/echange-apporteur-15-min";

beforeEach(() => {
  vi.clearAllMocks();
  candidature = {
    id: APP_ID,
    offerTitleSnap: "Business Developer B2B",
    firstName: "chiffre(Caroline)",
    lastName: "chiffre(Cochard)",
    email: "chiffre(caroline.cochard@example.com)",
    phone: "chiffre(0612345678)",
    city: "Lyon",
    locale: "fr",
  };
  session = { user: { id: "admin-1", role: "admin", name: "Will" } };
  envMock.CALENDLY_APPORTEUR_URL = CALENDLY;
  ficheDeLaCandidature.mockResolvedValue(null);
  lignesParEmpreinte.mockResolvedValue([]);
  inviter.mockResolvedValue({ ok: true });
});

function donneesCreees(): {
  contactName: string;
  contactEmail: string;
  contactEmailHash: string | null;
  contactPhone: string | null;
  source: string;
  locale: string;
  details: Record<string, unknown>;
} {
  return (creer.mock.calls[0]?.[0] as { data: ReturnType<typeof donneesCreees> }).data;
}

describe("proposerReseauApporteursAction — création", () => {
  it("crée la fiche apporteur : chiffrée, avec empreinte, marqueurs, origine, offre et candidature", async () => {
    const r = await proposerReseauApporteursAction({
      applicationId: APP_ID,
      envoyerInvitation: false,
    });
    expect(r).toMatchObject({ ok: true, submissionId: SUB_ID });
    if (r.ok) expect(r.lien).toMatch(new RegExp(`/contacts/commercial/${SUB_ID}$`));

    const d = donneesCreees();
    expect(d.contactName).toBe("chiffre(Caroline Cochard)");
    expect(d.contactEmail).toBe("chiffre(caroline.cochard@example.com)");
    expect(d.contactPhone).toBe("chiffre(0612345678)");
    expect(d.contactEmailHash, "clé de personne absente").toMatch(/^[0-9a-f]{64}$/);
    expect(d.source).toBe("import");
    expect(d.locale).toBe("fr");
    expect(d.details).toMatchObject({
      unifiedType: "recrutement",
      subType: "candidature-commerciale",
      etape: "premier-contact",
      origine: "candidature-offre-emploi",
      jobApplicationId: APP_ID,
      offreTitre: "Business Developer B2B",
      ville: "Lyon",
      saisiPar: "admin-1",
    });
    // 🔴 Le FAIT, pas un `optin` fabriqué.
    expect(String(d.details["consentement"])).toMatch(/^aucun/);
    expect(d.details).not.toHaveProperty("optin");
  });

  it("case décochée : AUCUN envoi (fiche seule — personne déjà contactée ailleurs)", async () => {
    const r = await proposerReseauApporteursAction({
      applicationId: APP_ID,
      envoyerInvitation: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.invitation).toBeUndefined();
    expect(inviter).not.toHaveBeenCalled();
    const e = evenement.mock.calls[0]?.[0] as { data: { summary: string; type: string } };
    expect(e.data.type).toBe("note");
    expect(e.data.summary).toMatch(
      /^Réseau d'apporteurs proposé le \d{2}\/\d{2} — fiche créée sans invitation$/,
    );
  });

  it("case cochée : l'invitation part vers la fiche créée, avec le lien du serveur", async () => {
    const r = await proposerReseauApporteursAction({
      applicationId: APP_ID,
      envoyerInvitation: true,
    });
    expect(r).toMatchObject({ ok: true, invitation: { envoyee: true } });
    expect(inviter).toHaveBeenCalledWith({
      submissionId: SUB_ID,
      calendlyUrl: CALENDLY,
      adminId: "admin-1",
    });
    const e = evenement.mock.calls[0]?.[0] as { data: { summary: string; meta: unknown } };
    expect(e.data.summary).toMatch(/— invitation envoyée$/);
    expect(e.data.meta).toMatchObject({ submissionId: SUB_ID, invitation: "envoyee" });
  });

  it("invitation demandée sans lien Calendly configuré : RIEN n'est écrit", async () => {
    envMock.CALENDLY_APPORTEUR_URL = undefined;
    const r = await proposerReseauApporteursAction({
      applicationId: APP_ID,
      envoyerInvitation: true,
    });
    expect(r).toMatchObject({ ok: false, erreur: "lien-absent" });
    expect(creer).not.toHaveBeenCalled();
    expect(inviter).not.toHaveBeenCalled();
  });

  it("un envoi raté ne défait pas la fiche : il est rapporté", async () => {
    inviter.mockResolvedValue({ ok: false, erreur: "retenu", message: "Adresse désinscrite." });
    const r = await proposerReseauApporteursAction({
      applicationId: APP_ID,
      envoyerInvitation: true,
    });
    expect(r).toMatchObject({
      ok: true,
      submissionId: SUB_ID,
      invitation: { envoyee: false, message: "Adresse désinscrite." },
    });
  });

  it("🔴 aucune donnée personnelle en clair dans les journaux", async () => {
    await proposerReseauApporteursAction({ applicationId: APP_ID, envoyerInvitation: true });
    const journaux = JSON.stringify([
      journalConsole.mock.calls,
      evenement.mock.calls.map((c) => {
        const d = (c[0] as { data: { summary: string; body: string; meta: unknown } }).data;
        return [d.summary, d.body, d.meta];
      }),
    ]);
    expect(journaux).not.toContain("caroline");
    expect(journaux).not.toContain("Caroline");
    expect(journaux).not.toContain("Cochard");
    expect(journaux).not.toContain("0612345678");
    expect(journaux).toContain("contactEmailHash");
  });
});

describe("proposerReseauApporteursAction — doublon, idempotence, rôle", () => {
  it("DOUBLON : une fiche apporteur existe pour cette empreinte → rien n'est créé, lien vers elle", async () => {
    lignesParEmpreinte.mockResolvedValue([
      {
        id: "fiche-existante",
        details: { unifiedType: "recrutement", subType: "candidature-commerciale" },
      },
    ]);
    const r = await proposerReseauApporteursAction({
      applicationId: APP_ID,
      envoyerInvitation: true,
    });
    expect(r).toMatchObject({ ok: false, erreur: "doublon", submissionId: "fiche-existante" });
    if (!r.ok) expect(r.lien).toMatch(/\/contacts\/commercial\/fiche-existante$/);
    expect(creer).not.toHaveBeenCalled();
    expect(inviter).not.toHaveBeenCalled();
  });

  it("la recherche de doublon porte sur l'EMPREINTE, jamais sur l'adresse en clair", async () => {
    await proposerReseauApporteursAction({ applicationId: APP_ID, envoyerInvitation: false });
    const where = (lignesParEmpreinte.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    expect(where).toHaveProperty("contactEmailHash");
    expect(JSON.stringify(where)).not.toContain("caroline");
  });

  it("un message NON apporteur à la même adresse ne bloque pas la proposition", async () => {
    lignesParEmpreinte.mockResolvedValue([
      { id: "message-contact", details: { unifiedType: "recrutement" } },
    ]);
    const r = await proposerReseauApporteursAction({
      applicationId: APP_ID,
      envoyerInvitation: false,
    });
    expect(r.ok).toBe(true);
    expect(creer).toHaveBeenCalledTimes(1);
  });

  it("IDEMPOTENCE : la fiche née de cette candidature existe → pas de seconde fiche, pas d'envoi", async () => {
    ficheDeLaCandidature.mockResolvedValue({ id: "deja-la", submittedAt: new Date() });
    const r = await proposerReseauApporteursAction({
      applicationId: APP_ID,
      envoyerInvitation: true,
    });
    expect(r).toMatchObject({ ok: true, deja: true, submissionId: "deja-la" });
    expect(creer).not.toHaveBeenCalled();
    expect(inviter).not.toHaveBeenCalled();
    // La recherche porte sur le lien vers la candidature.
    expect(JSON.stringify(ficheDeLaCandidature.mock.calls[0]?.[0])).toContain(APP_ID);
  });

  it("rôle qui n'écrit pas sur un dossier candidat (editor) : refusé, rien n'est lu ni écrit", async () => {
    session = { user: { id: "u-2", role: "editor" } };
    const r = await proposerReseauApporteursAction({
      applicationId: APP_ID,
      envoyerInvitation: true,
    });
    expect(r).toMatchObject({ ok: false, erreur: "non-autorise" });
    expect(lireCandidature).not.toHaveBeenCalled();
    expect(creer).not.toHaveBeenCalled();
  });

  it("sans session : refusé", async () => {
    session = null;
    const r = await proposerReseauApporteursAction({
      applicationId: APP_ID,
      envoyerInvitation: false,
    });
    expect(r).toMatchObject({ ok: false, erreur: "non-autorise" });
    expect(creer).not.toHaveBeenCalled();
  });

  it("candidature introuvable ou identifiant invalide : rien n'est écrit", async () => {
    candidature = null;
    expect(
      await proposerReseauApporteursAction({ applicationId: APP_ID, envoyerInvitation: false }),
    ).toMatchObject({ ok: false, erreur: "introuvable" });
    expect(
      await proposerReseauApporteursAction({
        applicationId: "pas-un-uuid",
        envoyerInvitation: false,
      }),
    ).toMatchObject({ ok: false, erreur: "champs-invalides" });
    expect(creer).not.toHaveBeenCalled();
  });
});
