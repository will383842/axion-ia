// Bug « Ce rendez-vous n'est rattaché à aucune fiche candidat » (cas NEKKACH, 2026-11-27).
// Un candidat créé APRÈS son rendez-vous restait orphelin. Le rattachement n'est permis que sur
// l'adresse CONFIRMÉE par l'API Calendly (jamais la colonne écrite par la route publique), sans
// téléphone ni nom, sans deviner quand plusieurs fiches existent, sans fiche suspecte.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const evtFindUnique = vi.fn();
const evtFindMany = vi.fn();
const evtUpdateMany = vi.fn();
const subFindUnique = vi.fn();
const subFindMany = vi.fn();
const logCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findUnique: (...a: unknown[]) => evtFindUnique(...a),
      findMany: (...a: unknown[]) => evtFindMany(...a),
      updateMany: (...a: unknown[]) => evtUpdateMany(...a),
    },
    submission: {
      findUnique: (...a: unknown[]) => subFindUnique(...a),
      findMany: (...a: unknown[]) => subFindMany(...a),
    },
    activityLog: { create: (...a: unknown[]) => logCreate(...a) },
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null) => (e ? `h-${e.trim().toLowerCase()}` : null),
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v }));
const fetchInvitee = vi.fn();
vi.mock("../api", () => ({
  fetchCalendlyInvitee: (...a: unknown[]) => fetchInvitee(...a),
}));

import {
  rattacherOrphelinsDeLaFiche,
  rattacherRendezVousOrphelin,
  trouverFicheDuRendezVous,
} from "../rattachement-orphelins";

const ADMIN = { adminUserId: "adm_1", libelle: "will@axion-ia.com" };
const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };
const TYPE = "Échange apporteur d'affaires (15 min)";
const orphelin = (o: Record<string, unknown> = {}) => ({
  id: "evt",
  eventTypeName: TYPE,
  typeRendezVous: null,
  inviteeUri: "https://api.calendly.com/scheduled_events/E/invitees/I",
  eventUri: "https://api.calendly.com/scheduled_events/E",
  linkedSubmissionId: null,
  linkedJobApplicationId: null,
  ...o,
});
/** Ce que l'API Calendly confirme. */
const api = (inviteeEmail: string | null) =>
  fetchInvitee.mockResolvedValue({ ok: true, data: { inviteeEmail } });

beforeEach(() => {
  vi.clearAllMocks();
  evtUpdateMany.mockResolvedValue({ count: 1 });
  logCreate.mockResolvedValue({});
});

describe("clic admin sur un rendez-vous orphelin", () => {
  it("rattache par l'adresse confirmée par l'API (casse ignorée) et l'écrit dans le journal", async () => {
    evtFindUnique.mockResolvedValue(orphelin());
    api(" KARIM.NEKKACH@Exemple.FR ");
    subFindMany.mockResolvedValue([{ id: "sub-1", details: APPORTEUR }]);
    expect(await rattacherRendezVousOrphelin("evt", ADMIN)).toEqual({
      ficheId: "sub-1",
      rattache: true,
    });
    expect(subFindMany.mock.calls[0]?.[0].where.contactEmailHash).toBe(
      "h-karim.nekkach@exemple.fr",
    );
    expect(subFindMany.mock.calls[0]?.[0].take).toBeUndefined(); // aucun plafond
    expect(evtUpdateMany).toHaveBeenCalledWith({
      where: { id: "evt", linkedSubmissionId: null, linkedJobApplicationId: null },
      data: { linkedSubmissionId: "sub-1" },
    });
    expect(logCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: "adm_1",
        action: "rendez_vous.rattachement_auto",
        targetId: "sub-1",
        changes: expect.objectContaining({
          critere: "email_confirme_calendly",
          calendlyEventIds: ["evt"],
        }),
      }),
    });
  });

  it("adresse FALSIFIÉE dans la table : seule l'adresse de l'API compte, rien n'est rattaché à la victime", async () => {
    // La route publique a écrit l'adresse de la victime dans la colonne ; l'API dit autre chose.
    evtFindUnique.mockResolvedValue(orphelin({ inviteeEmail: "victime@exemple.fr" }));
    api("pirate@exemple.fr");
    subFindMany.mockImplementation(async (a: { where: { contactEmailHash: string } }) =>
      a.where.contactEmailHash === "h-victime@exemple.fr"
        ? [{ id: "fiche-victime", details: APPORTEUR }]
        : [],
    );
    expect(await rattacherRendezVousOrphelin("evt", ADMIN)).toEqual({
      ficheId: null,
      rattache: false,
    });
    expect(evtUpdateMany).not.toHaveBeenCalled();
    expect(logCreate).not.toHaveBeenCalled();
  });

  it("API absente ou en échec : aucun rattachement", async () => {
    evtFindUnique.mockResolvedValue(orphelin({ inviteeEmail: "karim@exemple.fr" }));
    fetchInvitee.mockResolvedValue({ ok: false, reason: "not_configured" });
    expect((await rattacherRendezVousOrphelin("evt", ADMIN)).rattache).toBe(false);
    expect(subFindMany).not.toHaveBeenCalled();
    expect(evtUpdateMany).not.toHaveBeenCalled();
  });

  it("ne rattache JAMAIS par le téléphone ni par le nom (même téléphone, autre adresse)", async () => {
    evtFindUnique.mockResolvedValue(
      orphelin({ inviteeName: "Karim Nekkach", inviteePhone: "0639981234" }),
    );
    api("relais@indeed.fr");
    subFindMany.mockResolvedValue([]); // aucune fiche à l'adresse relais
    expect(await rattacherRendezVousOrphelin("evt", ADMIN)).toEqual({
      ficheId: null,
      rattache: false,
    });
    expect(evtUpdateMany).not.toHaveBeenCalled();
  });

  it("ambiguïté : deux fiches à la même adresse → aucun rattachement", async () => {
    evtFindUnique.mockResolvedValue(orphelin());
    api("karim@exemple.fr");
    subFindMany.mockResolvedValue([
      { id: "sub-1", details: APPORTEUR },
      { id: "sub-2", details: APPORTEUR },
    ]);
    expect((await rattacherRendezVousOrphelin("evt", ADMIN)).rattache).toBe(false);
    expect(evtUpdateMany).not.toHaveBeenCalled();
  });

  it("une fiche suspecte n'est jamais candidate", async () => {
    evtFindUnique.mockResolvedValue(orphelin());
    api("karim@exemple.fr");
    subFindMany.mockResolvedValue([
      { id: "sub-1", details: { ...APPORTEUR, vsl: { suspect: true } } },
    ]);
    expect((await rattacherRendezVousOrphelin("evt", ADMIN)).rattache).toBe(false);
    expect(evtUpdateMany).not.toHaveBeenCalled();
  });

  it("n'écrase jamais un rattachement existant", async () => {
    evtFindUnique.mockResolvedValue(orphelin({ linkedSubmissionId: "deja" }));
    expect(await rattacherRendezVousOrphelin("evt", ADMIN)).toEqual({
      ficheId: "deja",
      rattache: false,
    });
    expect(evtUpdateMany).not.toHaveBeenCalled();
    expect(fetchInvitee).not.toHaveBeenCalled();
  });
});

describe("l'aperçu n'écrit rien", () => {
  it("trouve la fiche sans updateMany ni journal", async () => {
    evtFindUnique.mockResolvedValue(orphelin());
    api("karim@exemple.fr");
    subFindMany.mockResolvedValue([{ id: "sub-1", details: APPORTEUR }]);
    expect(await trouverFicheDuRendezVous("evt")).toBe("sub-1");
    expect(evtUpdateMany).not.toHaveBeenCalled();
    expect(logCreate).not.toHaveBeenCalled();
  });

  it("adresse falsifiée ou ambiguë : rien trouvé", async () => {
    evtFindUnique.mockResolvedValue(orphelin({ inviteeEmail: "victime@exemple.fr" }));
    api("pirate@exemple.fr");
    subFindMany.mockResolvedValue([]);
    expect(await trouverFicheDuRendezVous("evt")).toBeNull();
    api("karim@exemple.fr");
    subFindMany.mockResolvedValue([
      { id: "a", details: APPORTEUR },
      { id: "b", details: APPORTEUR },
    ]);
    expect(await trouverFicheDuRendezVous("evt")).toBeNull();
  });
});

describe("fiche candidat créée APRÈS le rendez-vous (formulaire)", () => {
  const fiche = (o: Record<string, unknown> = {}) => ({
    id: "sub-9",
    details: APPORTEUR,
    contactEmail: " Karim.Nekkach@exemple.fr",
    deletedAt: null,
    ...o,
  });

  it("rattache quand l'API confirme l'adresse de la fiche, et journalise « formulaire »", async () => {
    subFindUnique.mockResolvedValue(fiche());
    subFindMany.mockResolvedValue([{ id: "sub-9", details: APPORTEUR }]);
    evtFindMany.mockResolvedValue([orphelin({ id: "e1" })]);
    api("karim.nekkach@exemple.fr");
    expect(await rattacherOrphelinsDeLaFiche("sub-9")).toBe(1);
    expect(evtUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["e1"] }, linkedSubmissionId: null, linkedJobApplicationId: null },
      data: { linkedSubmissionId: "sub-9" },
    });
    expect(logCreate.mock.calls[0]?.[0].data).toMatchObject({
      adminUserId: null,
      changes: { auteur: "formulaire", critere: "email_confirme_calendly" },
    });
  });

  it("adresse falsifiée dans la table : l'API dit une autre adresse → aucun rattachement", async () => {
    subFindUnique.mockResolvedValue(fiche());
    subFindMany.mockResolvedValue([{ id: "sub-9", details: APPORTEUR }]);
    evtFindMany.mockResolvedValue([orphelin({ id: "e1" })]); // colonne = adresse de la fiche (forgée)
    api("quelqu-un-d-autre@exemple.fr");
    expect(await rattacherOrphelinsDeLaFiche("sub-9")).toBe(0);
    expect(evtUpdateMany).not.toHaveBeenCalled();
  });

  it("ambiguïté : une autre fiche (même ancienne) porte la même adresse → aucun rattachement", async () => {
    subFindUnique.mockResolvedValue(fiche());
    subFindMany.mockResolvedValue([
      { id: "sub-9", details: APPORTEUR },
      { id: "sub-ancienne", details: APPORTEUR },
    ]);
    evtFindMany.mockResolvedValue([orphelin({ id: "e1" })]);
    api("karim.nekkach@exemple.fr");
    expect(await rattacherOrphelinsDeLaFiche("sub-9")).toBe(0);
    expect(evtUpdateMany).not.toHaveBeenCalled();
    expect(subFindMany.mock.calls[0]?.[0].take).toBeUndefined();
  });

  it("fiche suspecte : aucun rattachement, l'API n'est même pas appelée", async () => {
    subFindUnique.mockResolvedValue(fiche({ details: { ...APPORTEUR, vsl: { suspect: true } } }));
    evtFindMany.mockResolvedValue([orphelin({ id: "e1" })]);
    api("karim.nekkach@exemple.fr");
    expect(await rattacherOrphelinsDeLaFiche("sub-9")).toBe(0);
    expect(fetchInvitee).not.toHaveBeenCalled();
    expect(evtUpdateMany).not.toHaveBeenCalled();
  });

  it("ignore une fiche qui n'est pas un dossier apporteur", async () => {
    subFindUnique.mockResolvedValue(fiche({ details: { unifiedType: "contact" } }));
    expect(await rattacherOrphelinsDeLaFiche("sub-9")).toBe(0);
    expect(evtUpdateMany).not.toHaveBeenCalled();
  });
});

describe("branchements (retirer un appel fait échouer ce test)", () => {
  const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const FORMULAIRES = [
    "src/features/commercial-application/lead-vsl-actions.ts",
    "src/features/commercial-application/lead-actions.ts",
    "src/features/commercial-application/actions.ts",
    "src/features/commercial-application/capture-actions.ts",
  ];

  it.each(FORMULAIRES)("%s appelle rattacherOrphelinsDeLaFiche", (f) => {
    expect(lire(f)).toMatch(/await rattacherOrphelinsDeLaFiche\(submission\.id\)/);
  });

  it("lead-vsl : l'appel est placé APRÈS le test « suspect »", () => {
    const s = lire("src/features/commercial-application/lead-vsl-actions.ts");
    const appel = s.indexOf("await rattacherOrphelinsDeLaFiche(");
    const garde = s.indexOf("if (suspect) {", s.indexOf("async function creerLead"));
    expect(garde).toBeGreaterThan(0);
    expect(appel).toBeGreaterThan(garde);
  });

  it("l'aperçu (issue-apporteur-envoi) ne fait que chercher : jamais le rattachement qui écrit", () => {
    const s = lire("src/features/admin-rendezvous/issue-apporteur-envoi.ts");
    expect(s).toContain("await trouverFicheDuRendezVous(");
    expect(s).not.toContain("rattacherRendezVousOrphelin");
  });

  it("l'action admin rattache (avec auteur) avant d'enregistrer ; le module ne touche plus au téléphone", () => {
    const a = lire("src/features/admin-rendezvous/issue-apporteur-actions.ts");
    expect(a.match(/rattacherSiOrphelin\(/g)?.length).toBeGreaterThanOrEqual(4); // définition + 3 usages
    const m = lire("src/server/calendly/rattachement-orphelins.ts");
    expect(m).not.toMatch(/inviteePhone|normaliserTelephone|PLAFOND/);
  });
});
