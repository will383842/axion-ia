// Un échange apporteur réservé SANS formulaire reçoit sa fiche candidat (2026-10-07).
//
// Ce qui est gardé ici : la fiche est créée (et le rendez-vous rattaché) quand
// aucune fiche apporteur n'existe ni à l'adresse ni au nom ; jamais de doublon ;
// aucun e-mail ; le rattrapage des rendez-vous déjà en base ; et la chaîne
// complète jusqu'à « Retenu », qui ouvre le dossier et met le VRAI lien.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "adm_1", email: "will@axion-ia.com", role: "admin" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
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
  dernierEnvoi: null as { createdAt: Date } | null,
  creationEnPanne: false,
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
      findMany: vi.fn(
        async (a: {
          where: Record<string, unknown>;
          orderBy?: { capturedAt?: "asc" | "desc" };
          take?: number;
        }) => {
          const r = db.evenements.filter((l) => evenementCorrespond(l, a.where));
          if (a.orderBy?.capturedAt) {
            const sens = a.orderBy.capturedAt === "desc" ? -1 : 1;
            r.sort((x, y) => sens * (Number(x["capturedAt"]) - Number(y["capturedAt"])));
          }
          return a.take ? r.slice(0, a.take) : r;
        },
      ),
      updateMany: vi.fn(async (a: { where: Record<string, unknown>; data: Ligne }) => {
        const cibles = db.evenements.filter((l) => evenementCorrespond(l, a.where));
        for (const l of cibles) Object.assign(l, a.data);
        return { count: cibles.length };
      }),
    },
    // Retrait du réseau (#1353) : personne n'est retiré dans ce scénario.
    apporteurReseauRetrait: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    apporteurReseau: {
      findUnique: vi.fn(
        async (a: { where: { emailHash: string } }) =>
          db.apporteurs.find((l) => l["emailHash"] === a.where.emailHash) ?? null,
      ),
      create: vi.fn(async (a: { data: Ligne }) => {
        if (db.creationEnPanne) throw new Error("base injoignable");
        const l = { id: uuid(), versionLien: 1, statut: "dossier_en_cours", ...a.data };
        db.apporteurs.push(l);
        return { id: l["id"], versionLien: 1 };
      }),
    },
    rendezVousSuivi: { count: vi.fn(async () => 0) },
    emailLog: { findFirst: vi.fn(async () => db.dernierEnvoi) },
    emailOutbox: { findFirst: vi.fn(async () => null) },
    activityLog: {
      create: vi.fn(async (a: { data: Ligne }) => {
        db.journal.push(a.data);
        return {};
      }),
    },
    // Prisma 5.22 : `$queryRaw` sur `pg_advisory_xact_lock` (qui rend `void`) LÈVE.
    $queryRaw: vi.fn(async () => {
      throw new Error("Failed to deserialize column of type 'void'");
    }),
    $executeRaw: vi.fn(async () => 1),
    $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
  };
  return { prisma };
});

import { estApporteur } from "@/lib/commercial-application/est-apporteur";
import { etapeDeLaLigne } from "@/lib/commercial-application/etape-apporteur";
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
  capturedAt: new Date("2026-10-07T13:00:00Z"),
  rawPayload: {
    invitee: {
      email: "kraft@exemple.fr",
      name: "Kraft Bastine",
      text_reminder_number: "+33600000000",
    },
  },
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
  db.dernierEnvoi = null;
  db.creationEnPanne = false;
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

describe("suite de l'audit (07/10)", () => {
  it("la fiche porte l'étape « premier contact » : la console ne la prend pas pour un dossier complet", async () => {
    await creer();
    const d = db.submissions[0]!["details"] as Record<string, unknown>;
    expect(d["etape"]).toBe("premier-contact");
    expect(etapeDeLaLigne(d)).toBe("premier-contact");
  });

  it("une réservation déjà annulée au moment du traitement ne crée aucune fiche", async () => {
    db.evenements[0]!["status"] = "canceled";
    expect(await creer()).toMatchObject({ cree: false, motif: "annule" });
    expect(db.submissions).toHaveLength(0);
    expect(db.evenements[0]!["linkedSubmissionId"]).toBeNull();
  });

  it("le gabarit apporteur-demarrage lit l'adresse du site par le filet anti-localhost", () => {
    const src = readFileSync(
      resolve(__dirname, "../../../lib/email/templates/apporteur-demarrage.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/process\.env\.NEXT_PUBLIC_SITE_URL/);
    expect(src).toMatch(/from "@\/lib\/site-url"/);
  });
});

describe("relecture de a1 (07/10)", () => {
  it("le verrou passe par `$executeRaw` (le `$queryRaw` de Prisma 5.22 lève sur `void`)", async () => {
    expect(await creer()).toMatchObject({ cree: true });
    expect(db.submissions).toHaveLength(1);
  });

  it("nom d'un seul mot (relais Indeed possible) : aucune fiche, rattachement à la main", async () => {
    const r = await creerFicheDepuisRendezVous({
      eventId: "evt_1",
      email: "kraft@exemple.fr",
      nom: "Kraft",
      telephone: null,
      reponses: null,
    });
    expect(r).toMatchObject({ cree: false, motif: "nom_a_verifier" });
    expect(db.submissions).toHaveLength(0);
    expect(db.evenements[0]!["linkedSubmissionId"]).toBeNull();
  });

  it("rattrapage : nom et téléphone CONFIRMÉS par Calendly, jamais ceux de la ligne", async () => {
    db.evenements = [
      evenement({
        inviteeName: "Nom Forgé",
        inviteePhone: "+33999999999",
        rawPayload: {
          invitee: {
            email: "kraft@exemple.fr",
            name: "Kraft Bastine",
            text_reminder_number: "+33611111111",
          },
        },
      }),
    ];
    await rattraperFichesRendezVousApporteur();
    expect(db.submissions[0]).toMatchObject({
      contactName: "Kraft Bastine",
      contactPhone: "+33611111111",
    });
  });

  it("rattrapage : des lignes anciennes écartées ne bloquent pas une réservation récente", async () => {
    const anciennes = Array.from({ length: 60 }, (_, i) =>
      evenement({
        id: `evt_vieux_${i}`,
        inviteeEmail: `v${i}@x.fr`,
        inviteeName: "Vieux",
        capturedAt: new Date(Date.UTC(2026, 8, 1, 0, i)),
        rawPayload: { invitee: { email: `v${i}@x.fr`, name: "Vieux" } },
      }),
    );
    db.evenements = [...anciennes, evenement()];
    const bilan = await rattraperFichesRendezVousApporteur();
    expect(bilan.crees).toBe(1);
    expect(db.evenements.find((e) => e["id"] === "evt_1")!["linkedSubmissionId"]).toBeTruthy();
  });
});

describe("création DEMANDÉE dans la console (cas « Krafft », 07/10)", () => {
  const creerManuel = (email = "babak@exemple.fr", nom: string | null = "Krafft") =>
    creerFicheDepuisRendezVous({
      eventId: "evt_1",
      email,
      nom,
      telephone: "+33600000000",
      reponses: null,
      manuel: { adminId: "adm_1" },
    });

  it("nom d'un seul mot : un humain a confirmé → la fiche est créée et rattachée, sans e-mail", async () => {
    const r = await creerManuel();
    expect(r).toMatchObject({ cree: true });
    expect(db.submissions).toHaveLength(1);
    expect(db.submissions[0]!["details"]).toMatchObject({
      origine: "rendez-vous-apporteur",
      saisiPar: "console",
    });
    expect(db.evenements[0]!["linkedSubmissionId"]).toBe(db.submissions[0]!["id"]);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("même nom, autre adresse : l'humain a cherché, la création passe", async () => {
    db.submissions = [ficheApporteur("krafft_x@indeedemail.com", "Krafft")];
    expect(await creerManuel()).toMatchObject({ cree: true });
    expect(db.submissions).toHaveLength(2);
  });

  it("🔴 une fiche existe à la MÊME adresse : rien n'est créé NI rattaché d'office", async () => {
    const f = ficheApporteur("babak@exemple.fr", "Babak Krafft");
    db.submissions = [f];
    const r = await creerManuel();
    expect(r).toMatchObject({ cree: false, motif: "fiche_existante", submissionId: f["id"] });
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
        rawPayload: { invitee: { email: "client@x.fr", name: "Claire Client" } },
      }),
      evenement({
        id: "evt_forge",
        inviteeEmail: "victime@x.fr",
        inviteeName: "Victor Forge",
        rawPayload: { invitee: { email: "autre@x.fr", name: "Victor Forge" } },
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

describe("lot de suite (07/10) : « Retenu »", () => {
  const retenu = (ouvrirDossier: boolean) =>
    preparerIssueApporteur({ calendlyEventId: "evt_1", issue: "retenu", ouvrirDossier });

  it("panne à l'ouverture du dossier : AUCUN e-mail sans lien, échec visible", async () => {
    await creer();
    db.creationEnPanne = true;
    const r = await retenu(true);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toContain("aucun e-mail n'est parti");
  });

  it("Bienvenue déjà partie SANS dossier : rien ne repart, la console propose d'ouvrir le dossier", async () => {
    await creer();
    db.dernierEnvoi = { createdAt: new Date("2026-09-28T09:00:00Z") };
    const r = await retenu(false);
    expect(r).toMatchObject({ ok: true, envoi: null, proposerDossier: true });
    expect((r as { sansEmail: string }).sansEmail).toContain(
      "Ouvrir le dossier et envoyer le lien",
    );
  });

  it("Bienvenue déjà partie AVEC dossier : pas de proposition", async () => {
    await creer();
    await retenu(true);
    db.dernierEnvoi = { createdAt: new Date("2026-10-07T09:00:00Z") };
    const r = await retenu(false);
    expect(r).toMatchObject({ ok: true, envoi: null });
    expect((r as { proposerDossier?: true }).proposerDossier).toBeUndefined();
  });

  it("dossier déjà signé : la Bienvenue ne dit plus « Première étape : complétez… »", async () => {
    await creer();
    await retenu(true);
    db.apporteurs[0]!["statut"] = "a_verifier";
    const r = await retenu(true);
    if (!r.ok || !r.envoi) throw new Error("préparation attendue");
    expect(r.envoi.payload["dossierSigne"]).toBe(true);
    const { renderEmailTemplate } = await import("@/lib/email/templates");
    const rendu = await renderEmailTemplate("apporteur-issue-retenu", "fr", r.envoi.payload);
    expect(rendu.text).not.toContain("Première étape");
    expect(rendu.text).toContain("déjà parvenus");
    expect(rendu.text).not.toContain("SIRET");
  });
});

describe("lot de suite (07/10) : l'aperçu prévient AVANT l'envoi", () => {
  it("dossier résilié : l'avertissement est DANS l'aperçu", async () => {
    await creer();
    await preparerIssueApporteur({
      calendlyEventId: "evt_1",
      issue: "retenu",
      ouvrirDossier: true,
    });
    db.apporteurs[0]!["statut"] = "resilie";
    const { apercuIssueApporteurAction } =
      await import("@/features/admin-rendezvous/issue-apporteur-actions");
    const a = await apercuIssueApporteurAction({ calendlyEventId: "evt_1", issue: "retenu" });
    expect(a).toMatchObject({ etat: "apercu" });
    expect((a as { alerte?: string }).alerte).toContain("résilié");
  });
});

describe("relecture de la PR 1349 (a1) : un dossier REFUSÉ n'est jamais rouvert par la proposition", () => {
  it("Bienvenue déjà partie + dossier refusé : rien n'est proposé, « Dossier refusé le … »", async () => {
    await creer();
    await preparerIssueApporteur({
      calendlyEventId: "evt_1",
      issue: "retenu",
      ouvrirDossier: true,
    });
    db.apporteurs[0]!["statut"] = "refuse";
    db.apporteurs[0]!["refuseAt"] = new Date("2026-10-06T10:00:00Z");
    db.dernierEnvoi = { createdAt: new Date("2026-10-05T09:00:00Z") };
    const r = await preparerIssueApporteur({
      calendlyEventId: "evt_1",
      issue: "retenu",
      ouvrirDossier: false,
    });
    expect(r).toMatchObject({ ok: true, envoi: null });
    expect((r as { proposerDossier?: true }).proposerDossier).toBeUndefined();
    expect((r as { sansEmail: string }).sansEmail).toContain("Dossier refusé le");
  });
});
