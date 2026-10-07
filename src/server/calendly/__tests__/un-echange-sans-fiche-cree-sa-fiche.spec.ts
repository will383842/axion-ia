// Un échange apporteur réservé SANS formulaire reçoit sa fiche candidat (2026-10-07).
//
// Ce qui est gardé ici : la fiche est créée (et le rendez-vous rattaché) quand
// aucune fiche apporteur n'existe ni à l'adresse ni au nom ; jamais de doublon ;
// aucun e-mail ; le rattrapage des rendez-vous déjà en base ; et la chaîne
// complète jusqu'à « Retenu », qui ouvre le dossier et met le VRAI lien.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string | null) => v,
  decryptPii: (v: string | null) => v,
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (v: string | null | undefined) =>
    v && v.includes("@") ? `h:${v.trim().toLowerCase()}` : null,
}));
vi.mock("@/lib/rgpd-erase", () => ({ ERASED_PLACEHOLDER: "[effacé]" }));
vi.mock("@/server/careers/clamav", () => ({ analyserOctets: vi.fn() }));
vi.mock("@/features/commercial-application/relances-invitation-apporteur", () => ({
  lienReservation: () => "https://calendly.com/axion-ia/echange-apporteur",
}));
const enqueueEmail = vi.fn();
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => enqueueEmail(...a) }));

type Ligne = Record<string, unknown>;
const db = {
  submissions: [] as Ligne[],
  evenements: [] as Ligne[],
  apporteurs: [] as Ligne[],
  journal: [] as Ligne[],
};
let compteur = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++compteur).padStart(12, "0")}`;

function detailsCorrespond(l: Ligne, and: unknown): boolean {
  if (!Array.isArray(and)) return true;
  return and.every((c: { details?: { path: string[]; equals: unknown } }) => {
    if (!c.details) return true;
    const d = (l["details"] ?? {}) as Record<string, unknown>;
    return d[c.details.path[0]!] === c.details.equals;
  });
}
function submissionCorrespond(l: Ligne, w: Record<string, unknown>): boolean {
  if (w["deletedAt"] === null && l["deletedAt"] != null) return false;
  if (typeof w["contactEmailHash"] === "string" && l["contactEmailHash"] !== w["contactEmailHash"])
    return false;
  const inIds = (w["contactEmailHash"] as { in?: string[] } | undefined)?.in;
  if (inIds && !inIds.includes(String(l["contactEmailHash"]))) return false;
  return detailsCorrespond(l, w["AND"]);
}
function evenementCorrespond(l: Ligne, w: Record<string, unknown>): boolean {
  if (w["id"] !== undefined && l["id"] !== w["id"]) return false;
  if (w["status"] !== undefined && l["status"] !== w["status"]) return false;
  if ("linkedSubmissionId" in w && w["linkedSubmissionId"] === null && l["linkedSubmissionId"])
    return false;
  if ("linkedJobApplicationId" in w && l["linkedJobApplicationId"]) return false;
  if (w["inviteeUri"] && !l["inviteeUri"]) return false;
  if (w["inviteeEmail"] && !l["inviteeEmail"]) return false;
  const not = w["NOT"] as { inviteeName?: string } | undefined;
  if (not?.inviteeName && l["inviteeName"] === not.inviteeName) return false;
  if (Array.isArray(w["OR"])) {
    const ok = (w["OR"] as Array<Record<string, unknown>>).some((o) =>
      o["typeRendezVous"]
        ? l["typeRendezVous"] === o["typeRendezVous"]
        : String(l["eventTypeName"] ?? "").includes(
            (o["eventTypeName"] as { contains: string }).contains,
          ),
    );
    if (!ok) return false;
  }
  return true;
}

vi.mock("@/lib/prisma", () => {
  const prisma = {
    submission: {
      findFirst: vi.fn(
        async (a: { where: Record<string, unknown> }) =>
          db.submissions.filter((l) => submissionCorrespond(l, a.where)).at(-1) ?? null,
      ),
      findMany: vi.fn(async (a: { where: Record<string, unknown> }) =>
        db.submissions.filter((l) => submissionCorrespond(l, a.where)),
      ),
      findUnique: vi.fn(
        async (a: { where: { id: string } }) =>
          db.submissions.find((l) => l["id"] === a.where.id) ?? null,
      ),
      create: vi.fn(async (a: { data: Ligne }) => {
        const l = { id: uuid(), deletedAt: null, submittedAt: new Date(), ...a.data };
        db.submissions.push(l);
        return { id: l["id"] };
      }),
    },
    calendlyEvent: {
      findUnique: vi.fn(
        async (a: { where: { id: string } }) =>
          db.evenements.find((l) => l["id"] === a.where.id) ?? null,
      ),
      findMany: vi.fn(async (a: { where: Record<string, unknown> }) =>
        db.evenements.filter((l) => evenementCorrespond(l, a.where)),
      ),
      updateMany: vi.fn(async (a: { where: Record<string, unknown>; data: Ligne }) => {
        const cibles = db.evenements.filter((l) => evenementCorrespond(l, a.where));
        for (const l of cibles) Object.assign(l, a.data);
        return { count: cibles.length };
      }),
    },
    apporteurReseau: {
      findUnique: vi.fn(
        async (a: { where: { emailHash: string } }) =>
          db.apporteurs.find((l) => l["emailHash"] === a.where.emailHash) ?? null,
      ),
      create: vi.fn(async (a: { data: Ligne }) => {
        const l = { id: uuid(), versionLien: 1, statut: "dossier_en_cours", ...a.data };
        db.apporteurs.push(l);
        return { id: l["id"], versionLien: 1 };
      }),
    },
    rendezVousSuivi: { count: vi.fn(async () => 0) },
    emailLog: { findFirst: vi.fn(async () => null) },
    emailOutbox: { findFirst: vi.fn(async () => null) },
    activityLog: {
      create: vi.fn(async (a: { data: Ligne }) => {
        db.journal.push(a.data);
        return {};
      }),
    },
    $queryRaw: vi.fn(async () => []),
    $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
  };
  return { prisma };
});

import { estApporteur } from "@/lib/commercial-application/est-apporteur";
import {
  creerFicheDepuisRendezVous,
  rattraperFichesRendezVousApporteur,
} from "../fiche-rendez-vous-apporteur";
import { preparerIssueApporteur } from "@/features/admin-rendezvous/issue-apporteur-envoi";

const evenement = (surcharge: Ligne = {}): Ligne => ({
  id: "evt_1",
  status: "scheduled",
  eventTypeName: "Échange apporteur (15 min)",
  typeRendezVous: "apporteur",
  startTime: new Date("2026-10-08T08:00:00Z"),
  inviteeUri: "https://api.calendly.com/invitees/1",
  inviteeEmail: "kraft@exemple.fr",
  inviteeName: "Kraft Bastine",
  inviteePhone: "+33600000000",
  linkedSubmissionId: null,
  linkedJobApplicationId: null,
  rawPayload: { invitee: { email: "kraft@exemple.fr" } },
  ...surcharge,
});
const ficheApporteur = (email: string, nom: string): Ligne => ({
  id: uuid(),
  contactEmail: email,
  contactEmailHash: `h:${email}`,
  contactName: nom,
  deletedAt: null,
  locale: "fr",
  details: { unifiedType: "recrutement", subType: "candidature-commerciale" },
});

beforeEach(() => {
  vi.clearAllMocks();
  db.submissions = [];
  db.evenements = [evenement()];
  db.apporteurs = [];
  db.journal = [];
  enqueueEmail.mockResolvedValue({ enqueued: true });
});

const creer = () =>
  creerFicheDepuisRendezVous({
    eventId: "evt_1",
    email: "kraft@exemple.fr",
    nom: "Kraft Bastine",
    telephone: "+33600000000",
    reponses: "Votre réseau : dirigeants de PME",
  });

describe("réservation d'un échange apporteur sans fiche", () => {
  it("crée la fiche candidat apporteur et y rattache le rendez-vous, sans aucun e-mail", async () => {
    const r = await creer();
    expect(r).toMatchObject({ cree: true });
    expect(db.submissions).toHaveLength(1);
    const f = db.submissions[0]!;
    expect(estApporteur(f["details"])).toBe(true);
    expect(f).toMatchObject({
      contactEmail: "kraft@exemple.fr",
      contactName: "Kraft Bastine",
      contactPhone: "+33600000000",
    });
    expect(f["details"]).toMatchObject({
      origine: "rendez-vous-apporteur",
      calendlyEventId: "evt_1",
      reponsesCalendly: "Votre réseau : dirigeants de PME",
    });
    // Aucun balayage d'invitation ou de rappel ne la reprend.
    const d = f["details"] as Record<string, unknown>;
    expect(d["source"]).toBeUndefined();
    expect(d["creationAutomatique"]).toBeUndefined();
    expect(d["vsl"]).toBeUndefined();
    expect(db.evenements[0]!["linkedSubmissionId"]).toBe(f["id"]);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("jamais de doublon : deux passes (webhook puis sondage) donnent UNE fiche", async () => {
    await creer();
    db.evenements[0]!["linkedSubmissionId"] = null;
    const r = await creer();
    expect(r).toMatchObject({ cree: false, motif: "fiche_existante" });
    expect(db.submissions).toHaveLength(1);
  });

  it("une fiche apporteur existe déjà à cette adresse : rattachement seul, aucune création", async () => {
    const f = ficheApporteur("kraft@exemple.fr", "Kraft Bastine");
    db.submissions = [f];
    expect(await creer()).toMatchObject({ cree: false, motif: "fiche_existante" });
    expect(db.submissions).toHaveLength(1);
    expect(db.evenements[0]!["linkedSubmissionId"]).toBe(f["id"]);
  });

  it("même nom, autre adresse (relais Indeed) : rien n'est créé, un humain choisit", async () => {
    db.submissions = [ficheApporteur("kraftbastine_x@indeedemail.com", "Kraft Bastine")];
    expect(await creer()).toMatchObject({ cree: false, motif: "meme_nom_a_verifier" });
    expect(db.submissions).toHaveLength(1);
    expect(db.evenements[0]!["linkedSubmissionId"]).toBeNull();
  });
});

describe("rattrapage des rendez-vous déjà en base", () => {
  it("crée les fiches manquantes ; ignore annulés, effacés, non-apporteurs et adresses non confirmées", async () => {
    db.evenements = [
      evenement(),
      evenement({
        id: "evt_annule",
        status: "canceled",
        inviteeEmail: "a@x.fr",
        inviteeName: "Anne Annule",
      }),
      evenement({ id: "evt_efface", inviteeName: "[effacé]", inviteeEmail: "e@x.fr" }),
      evenement({
        id: "evt_client",
        typeRendezVous: "diagnostic",
        eventTypeName: "Diagnostic 30 min",
        inviteeEmail: "client@x.fr",
        inviteeName: "Claire Client",
        rawPayload: { invitee: { email: "client@x.fr" } },
      }),
      evenement({
        id: "evt_forge",
        inviteeEmail: "victime@x.fr",
        inviteeName: "Victor Forge",
        rawPayload: { invitee: { email: "autre@x.fr" } },
      }),
    ];
    const bilan = await rattraperFichesRendezVousApporteur();
    expect(bilan.crees).toBe(1);
    expect(db.submissions).toHaveLength(1);
    expect(db.evenements.find((e) => e["id"] === "evt_1")!["linkedSubmissionId"]).toBe(
      db.submissions[0]!["id"],
    );
    // Rejeu : rien de plus.
    expect((await rattraperFichesRendezVousApporteur()).crees).toBe(0);
    expect(db.submissions).toHaveLength(1);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});

describe("la chaîne complète jusqu'à « Retenu »", () => {
  it("RDV sans fiche → réservation → fiche créée → Retenu → dossier ouvert et vrai lien", async () => {
    await creer();
    const prep = await preparerIssueApporteur({
      calendlyEventId: "evt_1",
      issue: "retenu",
      ouvrirDossier: true,
    });
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;
    expect(prep.envoi?.gabarit).toBe("apporteur-issue-retenu");
    expect(prep.envoi?.destinataire).toBe("kraft@exemple.fr");
    const url = String(prep.envoi?.payload["dossierUrl"] ?? "");
    expect(url).toMatch(/\/apporteur\/dossier\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{43}$/);
    expect(db.apporteurs).toHaveLength(1);
  });
});
