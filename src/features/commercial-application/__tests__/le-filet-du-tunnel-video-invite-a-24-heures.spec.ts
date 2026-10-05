/**
 * Le FILET du tunnel vidéo (lot 4, 2026-10-05) : l'invitation automatique
 * devient un filet de sécurité à +24 h après l'étape 2, SANS toucher à la voie
 * « dossier complet » à +15 minutes (décision du 29/09, inchangée).
 *
 * Ce que ces cas verrouillent :
 *   1. seconde clause d'éligibilité : `details.vsl.etapeAtteinte >= 2`, 24 h
 *      écoulées, pas « suspecte », jamais reprise ;
 *   2. « aucune réservation » (même annulée) : une réservation rattachée à
 *      n'importe quelle ligne de la personne, ou connue par l'adresse de l'invité
 *      pour un échange apporteur, écarte l'invitation (B2 ne part JAMAIS si une
 *      réservation existe, R4) ;
 *   3. la voie du dossier complet garde son délai de 15 minutes et ses règles ;
 *   4. un lead à l'étape 1 seulement n'est jamais invité.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  jobFindMany: vi.fn(),
  subFindMany: vi.fn(),
  subFindUnique: vi.fn(),
  subUpdate: vi.fn(),
  subUpdateMany: vi.fn(),
  evenement: vi.fn(),
  envoyer: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v.replace(/^enc:/, "") }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: { findMany: (...a: unknown[]) => d.jobFindMany(...a) },
    submission: {
      findMany: (...a: unknown[]) => d.subFindMany(...a),
      findUnique: (...a: unknown[]) => d.subFindUnique(...a),
      update: (...a: unknown[]) => d.subUpdate(...a),
      updateMany: (...a: unknown[]) => d.subUpdateMany(...a),
    },
    calendlyEvent: { findFirst: (...a: unknown[]) => d.evenement(...a) },
  },
}));
vi.mock("../invitation-apporteur", () => ({
  envoyerInvitationApporteur: (...a: unknown[]) => d.envoyer(...a),
}));
vi.mock("@/features/admin-job-applications/fiche-apporteur-depuis-candidature", () => ({
  creerFicheApporteurDepuisCandidature: vi.fn(),
}));
vi.mock("@/features/admin-job-applications/journal", () => ({
  consignerEvenement: vi.fn(),
}));

import {
  DELAI_FILET_VSL_MS,
  DELAI_INVITATION_AUTO_MS,
  FENETRE_FILET_VSL_MS,
  ficheEligible,
  ficheEligibleFiletVsl,
  passerInvitationsAuto,
} from "../invitation-auto";

const MAINTENANT = new Date("2026-10-08T10:00:00Z");
const heure = (h: number): string => new Date(MAINTENANT.getTime() - h * 3_600_000).toISOString();
const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };
const DOSSIER_COMPLET = { ...APPORTEUR, source: "/devenir-commercial-ia/candidature" };

/** Un lead vidéo tel que `lead-vsl-actions.ts` l'écrit. */
function leadVsl(o: { etape?: 1 | 2; e2HeuresAvant?: number; suspect?: boolean } = {}) {
  const etape = o.etape ?? 2;
  return {
    ...APPORTEUR,
    etape: "premier-contact",
    source: "/apporteur-affaires/video",
    vsl: {
      version: "vsl-v1",
      etapeAtteinte: etape,
      atteinte: {
        e1: heure((o.e2HeuresAvant ?? 25) + 1),
        ...(etape === 2 ? { e2: heure(o.e2HeuresAvant ?? 25) } : {}),
      },
      ...(o.suspect ? { suspect: true } : {}),
    },
  };
}

function ficheBase(id: string, details: unknown) {
  return {
    id,
    details,
    contactEmail: "enc:nadia@example.com",
    contactEmailHash: "h-nadia",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["CALENDLY_APPORTEUR_URL"] =
    "https://calendly.com/axion-ia/echange-apporteur-affaires";
  d.jobFindMany.mockResolvedValue([]);
  d.subFindMany.mockResolvedValue([]);
  d.subFindUnique.mockResolvedValue({ details: APPORTEUR });
  d.subUpdate.mockResolvedValue({});
  d.evenement.mockResolvedValue(null);
  d.envoyer.mockResolvedValue({ ok: true });
});

/** Les requêtes du passage, distinguées par leur filtre (l'ordre n'est pas un contrat). */
function repondre(parVoie: { dossier?: unknown[]; vsl?: unknown[]; personne?: unknown[] }) {
  d.subFindMany.mockImplementation(async (a: { where: Record<string, unknown> }) => {
    const brut = JSON.stringify(a.where);
    if (brut.includes('"etapeAtteinte"')) return parVoie.vsl ?? [];
    if (brut.includes("contactEmailHash")) return parVoie.personne ?? [];
    return parVoie.dossier ?? [];
  });
}

describe("ficheEligibleFiletVsl — la seconde clause", () => {
  const ok = (details: unknown, h = MAINTENANT) => ficheEligibleFiletVsl(details, h);

  it("étape 2 atteinte il y a plus de 24 h : éligible", () => {
    expect(ok(leadVsl({ e2HeuresAvant: 25 }))).toBe(true);
    expect(ok(leadVsl({ e2HeuresAvant: 24 }))).toBe(true);
  });

  it("avant 24 h : pas encore — le visiteur a le temps de choisir son créneau", () => {
    expect(ok(leadVsl({ e2HeuresAvant: 23 }))).toBe(false);
    expect(ok(leadVsl({ e2HeuresAvant: 1 }))).toBe(false);
  });

  it("au-delà de 24 h + 72 h, la fiche est laissée à la console", () => {
    expect(DELAI_FILET_VSL_MS).toBe(24 * 3_600_000);
    expect(FENETRE_FILET_VSL_MS).toBe(72 * 3_600_000);
    expect(ok(leadVsl({ e2HeuresAvant: 96 }))).toBe(true);
    expect(ok(leadVsl({ e2HeuresAvant: 97 }))).toBe(false);
  });

  it("un lead qui s'est arrêté à l'étape 1 n'est JAMAIS invité (il n'a pas donné son numéro)", () => {
    expect(ok(leadVsl({ etape: 1, e2HeuresAvant: 100 }))).toBe(false);
  });

  it("une ligne « suspecte » n'est jamais invitée", () => {
    expect(ok(leadVsl({ suspect: true }))).toBe(false);
  });

  it("une fiche déjà passée par l'invitation automatique ne l'est pas deux fois", () => {
    expect(ok({ ...leadVsl(), invitationAuto: { issue: "envoyee" } })).toBe(false);
  });

  it("lecture défensive : tout ce qui n'est pas un lead vidéo rend faux, sans lever", () => {
    for (const v of [null, undefined, 1, "x", [], {}, DOSSIER_COMPLET, { vsl: {} }]) {
      expect(ok(v)).toBe(false);
    }
    expect(ok({ vsl: { etapeAtteinte: 2, atteinte: { e2: "pas une date" } } })).toBe(false);
  });

  it("la voie du dossier complet ne change pas : `ficheEligible` ne voit toujours pas un lead vidéo", () => {
    expect(ficheEligible(DOSSIER_COMPLET)).toBe(true);
    expect(ficheEligible(leadVsl())).toBe(false);
    expect(DELAI_INVITATION_AUTO_MS).toBe(15 * 60_000);
  });
});

describe("passerInvitationsAuto — le filet", () => {
  it("invite un lead de l'étape 2, 24 h après, sans réservation — sans administrateur", async () => {
    repondre({ vsl: [ficheBase("lead-1", leadVsl())], personne: [{ id: "lead-1" }] });
    const r = await passerInvitationsAuto(MAINTENANT);
    expect(d.envoyer).toHaveBeenCalledTimes(1);
    expect(d.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: "lead-1", adminId: null }),
    );
    expect(r.envoyees).toBe(1);
    // Marquée : elle ne sera pas reprise.
    expect(d.subUpdate.mock.calls[0]?.[0]?.data.details.invitationAuto.issue).toBe("envoyee");
  });

  it("la requête est posée en base sur l'étape 2 et sur la fenêtre (pas les étapes 1)", async () => {
    repondre({});
    await passerInvitationsAuto(MAINTENANT);
    const appel = d.subFindMany.mock.calls
      .map((c) => c[0] as { where: Record<string, unknown> })
      .find((a) => JSON.stringify(a.where).includes('"etapeAtteinte"'));
    expect(appel).toBeDefined();
    expect(JSON.stringify(appel?.where)).toContain('"equals":2');
    const lte = (appel?.where["submittedAt"] as { lte: Date }).lte;
    expect(lte.getTime()).toBe(MAINTENANT.getTime() - DELAI_FILET_VSL_MS);
    expect(appel?.where["status"]).toEqual({ in: ["new", "in_progress"] });
    expect(appel?.where["deletedAt"]).toBeNull();
    expect(appel?.where["archivedAt"]).toBeNull();
  });

  it("une réservation RATTACHÉE à la personne écarte l'invitation (B2 ne part jamais après une réservation)", async () => {
    repondre({
      vsl: [ficheBase("lead-1", leadVsl())],
      personne: [{ id: "lead-1" }, { id: "dossier-1" }],
    });
    d.evenement.mockResolvedValue({ id: "evt" });
    const r = await passerInvitationsAuto(MAINTENANT);
    expect(d.envoyer).not.toHaveBeenCalled();
    expect(r.envoyees).toBe(0);
    expect(r.ecartees["filet-deja-reserve"]).toBe(1);
    const requete = d.evenement.mock.calls[0]?.[0] as { where: { OR: unknown[] } };
    // Toutes les lignes de la personne, et l'adresse pour un échange apporteur seulement.
    expect(JSON.stringify(requete.where.OR)).toContain("dossier-1");
    expect(JSON.stringify(requete.where.OR)).toContain("nadia@example.com");
    expect(JSON.stringify(requete.where.OR)).toContain("apporteur");
  });

  it("une réservation ANNULÉE compte aussi : aucun filtre de statut", async () => {
    repondre({ vsl: [ficheBase("lead-1", leadVsl())], personne: [{ id: "lead-1" }] });
    d.evenement.mockResolvedValue({ id: "evt-annule" });
    await passerInvitationsAuto(MAINTENANT);
    const requete = d.evenement.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(JSON.stringify(requete.where)).not.toContain("status");
    expect(d.envoyer).not.toHaveBeenCalled();
  });

  it("base muette sur la réservation : on n'invite PAS dans le doute, on réessaiera", async () => {
    repondre({ vsl: [ficheBase("lead-1", leadVsl())], personne: [{ id: "lead-1" }] });
    d.evenement.mockRejectedValue(new Error("base indisponible"));
    const r = await passerInvitationsAuto(MAINTENANT);
    expect(d.envoyer).not.toHaveBeenCalled();
    expect(r.aReessayer).toBe(1);
  });

  it("pas de lien Calendly configuré : rien ne part (comme pour le dossier complet)", async () => {
    delete process.env["CALENDLY_APPORTEUR_URL"];
    repondre({ vsl: [ficheBase("lead-1", leadVsl())] });
    const r = await passerInvitationsAuto(MAINTENANT);
    expect(r.suspendu).toBe("lien-absent");
    expect(d.envoyer).not.toHaveBeenCalled();
  });

  it("un lead trop récent (étape 2 il y a moins de 24 h) n'est pas invité, même s'il est remonté par la base", async () => {
    repondre({ vsl: [ficheBase("lead-1", leadVsl({ e2HeuresAvant: 5 }))] });
    await passerInvitationsAuto(MAINTENANT);
    expect(d.envoyer).not.toHaveBeenCalled();
    expect(d.evenement).not.toHaveBeenCalled();
  });

  it("la voie du dossier complet part toujours, indépendamment du filet (contre-témoin)", async () => {
    repondre({ dossier: [{ id: "dossier-1", details: DOSSIER_COMPLET }] });
    await passerInvitationsAuto(MAINTENANT);
    expect(d.envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: "dossier-1", adminId: null }),
    );
  });

  it("l'invitation « déjà invitée » (une par personne) n'est pas rejouée par le filet", async () => {
    repondre({ vsl: [ficheBase("lead-1", leadVsl())], personne: [{ id: "lead-1" }] });
    d.envoyer.mockResolvedValue({ ok: false, erreur: "deja-invitee", message: "déjà" });
    const r = await passerInvitationsAuto(MAINTENANT);
    expect(r.envoyees).toBe(0);
    expect(r.ecartees["deja-invitee"]).toBe(1);
  });
});
