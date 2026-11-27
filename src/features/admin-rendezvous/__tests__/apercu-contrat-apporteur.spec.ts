// L'aperçu du contrat apporteur est en LECTURE SEULE et garde les refus de l'envoi.

import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));

const db = vi.hoisted(() => ({
  evt: { linkedSubmissionId: "sub_1" } as Record<string, unknown> | null,
  relie: null as Record<string, unknown> | null,
}));
const ecritures = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  updateMany: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: { findUnique: vi.fn(async () => db.evt), ...ecritures },
    apporteurReseau: { findUnique: vi.fn(async () => db.relie), ...ecritures },
    submission: {
      findUnique: vi.fn(async () => ({ contactName: "Léa Martin", contactEmail: "lea@x.fr" })),
      ...ecritures,
    },
    activityLog: { ...ecritures },
  },
}));

const ouvrir = vi.fn();
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  ouvrirDossierDepuisCandidature: (...a: unknown[]) => ouvrir(...a),
}));
const masque = vi.fn();
vi.mock("@/features/apporteurs-reseau/apercu-masque", () => ({
  apercuMasque: (...a: unknown[]) => masque(...a),
}));
vi.mock("@/features/apporteurs-reseau/jeton", () => ({ urlDossierExemple: () => "https://ex/x" }));

import { apercuContratApporteurAction } from "../apercu-contrat-apporteur";

function role(r: string): void {
  auth.mockResolvedValue({ user: { id: "u_1", role: r } });
}
function aucuneEcriture(): void {
  for (const f of Object.values(ecritures)) expect(f).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  db.evt = { linkedSubmissionId: "sub_1" };
  db.relie = null;
  ouvrir.mockResolvedValue({ ok: false, ferme: false, message: "aucun dossier" });
  masque.mockResolvedValue({ sujet: "S", destinataire: "l***@x.fr", apercu: {} });
  role("admin");
});

describe("apercuContratApporteurAction", () => {
  it("refuse un non-administrateur, sans rien lire", async () => {
    role("editor");
    const r = await apercuContratApporteurAction({ calendlyEventId: "evt_1" });
    expect(r.etat).toBe("erreur");
    expect(ouvrir).not.toHaveBeenCalled();
    expect(masque).not.toHaveBeenCalled();
    aucuneEcriture();
  });

  it("refuse si le dossier existe déjà", async () => {
    ouvrir.mockResolvedValue({ ok: true, apporteurId: "a_1" });
    const r = await apercuContratApporteurAction({ calendlyEventId: "evt_1" });
    expect(r).toMatchObject({ etat: "erreur" });
    expect(masque).not.toHaveBeenCalled();
    aucuneEcriture();
  });

  it("refuse si le dossier est refusé", async () => {
    ouvrir.mockResolvedValue({ ok: false, ferme: false, refuseLe: new Date() });
    const r = await apercuContratApporteurAction({ calendlyEventId: "evt_1" });
    expect(r).toMatchObject({ etat: "erreur", message: expect.stringContaining("refusé") });
    expect(masque).not.toHaveBeenCalled();
    aucuneEcriture();
  });

  it("refuse si la fiche est déjà reliée au dossier d'une autre adresse", async () => {
    db.relie = { prenom: "Paul", nom: "Durand" };
    const r = await apercuContratApporteurAction({ calendlyEventId: "evt_1" });
    expect(r).toMatchObject({ etat: "erreur", message: expect.stringContaining("Paul Durand") });
    expect(masque).not.toHaveBeenCalled();
    aucuneEcriture();
  });

  it("cas nominal : aperçu rendu en français, aucune écriture, dossier jamais créé", async () => {
    const r = await apercuContratApporteurAction({ calendlyEventId: "evt_1" });
    expect(r.etat).toBe("apercu");
    expect(masque).toHaveBeenCalledWith(
      "apporteur-dossier-lien",
      "fr",
      expect.any(Object),
      "lea@x.fr",
    );
    expect(ouvrir).toHaveBeenCalledWith("sub_1", { creer: false });
    aucuneEcriture();
  });
});
