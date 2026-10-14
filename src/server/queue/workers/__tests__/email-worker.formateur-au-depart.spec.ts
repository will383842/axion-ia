// CAMP-1 — Le filet du départ pour les e-mails aux FORMATEURS INDÉPENDANTS.
//
// Sur le VRAI processeur (base, file et envoi doublés) :
//   - un texte dont la validation est retirée après l'enfilage ne part pas ;
//   - base muette = RETENU (échec fermé), clos « annulé », jamais « échec » ;
//   - fiche effacée ou fin de collaboration = retenu, sauf l'argent ;
//   - une sollicitation formateur (F2) honore l'opposition, l'argent passe.

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  ctor: vi.fn(),
  sendEmail: vi.fn(),
  render: vi.fn(),
  cloturer: vi.fn(),
  noter: vi.fn(),
  annuler: vi.fn(),
  submission: vi.fn(),
  rebond: vi.fn(),
  opposition: vi.fn(),
  abonne: vi.fn(),
  settings: vi.fn(),
  trainer: vi.fn(),
  application: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(...args: unknown[]) {
      d.ctor(...args);
    }
    on(): this {
      return this;
    }
  },
}));
vi.mock("../../connection", () => ({ getBullConnectionOrThrow: () => ({ host: "doublure" }) }));
vi.mock("../../lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("../../lib/sanitize-job-data", () => ({ redactEmailValue: (v: string) => v }));
vi.mock("@/lib/email/client", () => ({
  sendEmail: (...a: unknown[]) => d.sendEmail(...a),
  verifyTransport: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => d.render(...a),
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null) => (v === null ? null : String(v).replace(/^chiffre\(|\)$/g, "")),
  isDecryptedEmailUsable: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findUnique: (...a: unknown[]) => d.submission(...a) },
    emailLog: { findFirst: (...a: unknown[]) => d.rebond(...a) },
    emailOpposition: { findUnique: (...a: unknown[]) => d.opposition(...a) },
    newsletterSubscriber: { findUnique: (...a: unknown[]) => d.abonne(...a) },
    setting: { findMany: (...a: unknown[]) => d.settings(...a) },
    trainer: { findUnique: (...a: unknown[]) => d.trainer(...a) },
    jobApplication: { findUnique: (...a: unknown[]) => d.application(...a) },
  },
}));
vi.mock("@/lib/r2-storage", () => ({ isR2Configured: () => false, getObjectBufferR2: vi.fn() }));
vi.mock("@/server/email/email-log", () => ({
  cloturerJournal: (...a: unknown[]) => d.cloturer(...a),
  noterTentativeEchouee: (...a: unknown[]) => d.noter(...a),
  marquerAnnule: (...a: unknown[]) => d.annuler(...a),
}));

import { startEmailWorker } from "../email-worker";
import { MARQUE_EFFACEMENT, RELECTURES_AU_DEPART } from "@/server/email/relecture-au-depart";
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";
import {
  GABARITS_FORMATEUR_INDEPENDANT,
  GABARITS_SOLLICITATION_FORMATEUR,
} from "@/lib/email/templates/formateur-independant-textes";
import {
  GABARITS_SOLLICITATION_FORMATEUR_LOCAL,
  estSollicitationSoumiseAOpposition,
} from "@/server/email/verdict-envoi";
import { empreinteAttendue } from "@/server/email/textes-formateurs-a-valider";

/** Lot 8A — une validation porte l'empreinte du texte actuel. */
const validation = (cle: string) => ({ valide: true, empreinte: empreinteAttendue(cle) });

type Processeur = (job: Record<string, unknown>) => Promise<void>;
function processeur(): Processeur {
  startEmailWorker();
  return d.ctor.mock.calls.at(-1)?.[1] as Processeur;
}

const TRAINER = "22222222-2222-4222-8222-222222222222";

function job(template: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "job-f",
    name: template,
    data: {
      template,
      to: "claire@exemple.fr",
      locale: "fr",
      payload: {},
      entityType: "Trainer",
      entityId: TRAINER,
      ...over,
    },
    attemptsMade: 0,
    opts: { attempts: 5 },
  };
}

function valides(...gabarits: string[]) {
  d.settings.mockImplementation(async (q: { where: { key: { startsWith: string } } }) =>
    q.where.key.startsWith === "formateurs."
      ? [{ key: "formateurs.textes_valides", value: { actif: true } }]
      : gabarits.map((g) => ({
          key: `textes_valides.${g}`,
          value: validation(`textes_valides.${g}`),
        })),
  );
}

/** Textes validés ET `relances_auto` allumé (relance du dossier, L6). */
function relancesAllumees(...gabarits: string[]) {
  d.settings.mockImplementation(async (q: { where: { key: { startsWith: string } } }) =>
    q.where.key.startsWith === "formateurs."
      ? [
          { key: "formateurs.textes_valides", value: { actif: true } },
          { key: "formateurs.dossier_en_ligne", value: { actif: true } },
          { key: "formateurs.relances_auto", value: { actif: true } },
        ]
      : gabarits.map((g) => ({
          key: `textes_valides.${g}`,
          value: validation(`textes_valides.${g}`),
        })),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  d.render.mockResolvedValue({ subject: "Objet", html: "<p>x</p>", text: "x", famille: "B" });
  d.sendEmail.mockResolvedValue({ messageId: "<m1>" });
  d.cloturer.mockResolvedValue(undefined);
  d.annuler.mockResolvedValue(1);
  d.rebond.mockResolvedValue(null);
  d.opposition.mockResolvedValue(null);
  d.abonne.mockResolvedValue(null);
  d.trainer.mockResolvedValue({ email: "claire@exemple.fr", finCollaborationAt: null });
  d.application.mockResolvedValue({ email: "chiffre(claire@exemple.fr)" });
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("chaque e-mail formateur indépendant a un lecteur au départ", () => {
  it.each(GABARITS_FORMATEUR_INDEPENDANT)("%s", (g) => {
    expect(RELECTURES_AU_DEPART.has(g)).toBe(true);
  });
  it("le rappel d'invitation apporteur garde le sien", () => {
    expect(RELECTURES_AU_DEPART.has("apporteur-invitation-relance")).toBe(true);
  });
});

describe("les sollicitations formateurs (F1, F2, F7, F22, F55)", () => {
  it("la copie locale de verdict-envoi est égale à la liste des textes", () => {
    expect([...GABARITS_SOLLICITATION_FORMATEUR_LOCAL].sort()).toEqual(
      [...GABARITS_SOLLICITATION_FORMATEUR].sort(),
    );
    expect(GABARITS_SOLLICITATION_FORMATEUR.size).toBe(5);
  });
  it("sont soumises à l'opposition ; l'argent et les pièces non", () => {
    for (const g of GABARITS_SOLLICITATION_FORMATEUR) {
      expect(estSollicitationSoumiseAOpposition(g, {})).toBe(true);
    }
    expect(estSollicitationSoumiseAOpposition("formateur-virement-fait", {})).toBe(false);
    expect(estSollicitationSoumiseAOpposition("formateur-dossier-relance", {})).toBe(false);
  });
});

describe("copies locales et noms", () => {
  it("la marque d'effacement est celle de rgpd-erase", () => {
    expect(MARQUE_EFFACEMENT).toBe(ERASED_PLACEHOLDER);
  });
});

describe("texte validé, relu au départ", () => {
  it("validé : la relance part", async () => {
    valides("formateur-dossier-relance");
    // L6 : la relance du dossier exige en plus `relances_auto` et un dossier à compléter.
    relancesAllumees("formateur-dossier-relance");
    d.trainer.mockResolvedValue({
      email: "claire@exemple.fr",
      finCollaborationAt: null,
      dossierStatut: "en_cours",
    });
    await processeur()(job("formateur-dossier-relance"));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });
  it("L6 : dossier envoyé entre l'enfilage et le départ : la relance est retenue", async () => {
    relancesAllumees("formateur-dossier-relance");
    d.trainer.mockResolvedValue({
      email: "claire@exemple.fr",
      finCollaborationAt: null,
      dossierStatut: "a_verifier",
    });
    await processeur()(job("formateur-dossier-relance"));
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.annuler).toHaveBeenCalledWith("job-f", expect.stringMatching(/plus à compléter/));
  });
  it("L6 : dossier ou relances coupés après l'enfilage : retenue", async () => {
    valides("formateur-dossier-relance");
    d.trainer.mockResolvedValue({
      email: "claire@exemple.fr",
      finCollaborationAt: null,
      dossierStatut: "en_cours",
    });
    await processeur()(job("formateur-dossier-relance"));
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.annuler).toHaveBeenCalledWith("job-f", expect.stringMatching(/coupé/));
  });
  it("validation retirée après l'enfilage : retenu, clos annulé", async () => {
    valides();
    await processeur()(job("formateur-dossier-relance"));
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.annuler).toHaveBeenCalledWith("job-f", expect.stringMatching(/non validé/));
    expect(d.noter).not.toHaveBeenCalled();
  });
  it("base muette : retenu (échec fermé), clos annulé", async () => {
    d.settings.mockRejectedValue(new Error("base"));
    d.trainer.mockRejectedValue(new Error("base"));
    await processeur()(job("formateur-dossier-relance"));
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.annuler).toHaveBeenCalledTimes(1);
  });
  it("sans fiche liée : retenu", async () => {
    // L6 : un gabarit SANS lecteur propre, pour que seul le filet commun décide.
    valides("formateur-dossier-lien");
    await processeur()(
      job("formateur-dossier-lien", { entityType: undefined, entityId: undefined }),
    );
    expect(d.sendEmail).not.toHaveBeenCalled();
  });
});

describe("fiche et fin de collaboration", () => {
  it("fiche effacée (art. 17) : retenu", async () => {
    // L6 : un gabarit SANS lecteur propre, pour que seul le filet commun décide.
    valides("formateur-dossier-lien");
    d.trainer.mockResolvedValue({ email: "erased:abc@erased.local", finCollaborationAt: null });
    await processeur()(job("formateur-dossier-lien"));
    expect(d.sendEmail).not.toHaveBeenCalled();
  });
  it("fiche marquée effacée (marque art. 17) : retenu", async () => {
    // L6 : un gabarit SANS lecteur propre, pour que seul le filet commun décide.
    valides("formateur-dossier-lien");
    d.trainer.mockResolvedValue({ email: "[erased-rgpd-art17]", finCollaborationAt: null });
    await processeur()(job("formateur-dossier-lien"));
    expect(d.sendEmail).not.toHaveBeenCalled();
  });
  it("candidature indéchiffrable : retenu (échec fermé)", async () => {
    // L6 : un gabarit SANS lecteur propre, pour que seul le filet commun décide.
    valides("formateur-dossier-lien");
    d.application.mockResolvedValue({ email: null });
    await processeur()(
      job("formateur-dossier-lien", { entityType: "JobApplication", entityId: TRAINER }),
    );
    expect(d.sendEmail).not.toHaveBeenCalled();
  });
  it("candidature effacée : retenu", async () => {
    valides("formateur-invitation-relance");
    d.application.mockResolvedValue(null);
    await processeur()(
      job("formateur-invitation-relance", { entityType: "JobApplication", entityId: TRAINER }),
    );
    expect(d.sendEmail).not.toHaveBeenCalled();
  });
  it("fin de collaboration : la relance est retenue, le virement part", async () => {
    valides("formateur-dossier-relance", "formateur-virement-fait");
    d.trainer.mockResolvedValue({ email: "claire@exemple.fr", finCollaborationAt: new Date() });
    const p = processeur();
    await p(job("formateur-dossier-relance"));
    expect(d.sendEmail).not.toHaveBeenCalled();
    await p(job("formateur-virement-fait"));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("opposition", () => {
  it("une sollicitation formateur (F2) s'arrête sur l'opposition", async () => {
    valides("formateur-invitation-relance");
    d.opposition.mockResolvedValue({ id: "o-1" });
    await processeur()(
      job("formateur-invitation-relance", { entityType: "JobApplication", entityId: TRAINER }),
    );
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.annuler).toHaveBeenCalledWith("job-f", expect.stringMatching(/opposée/));
  });
  it("table des oppositions muette : la sollicitation formateur est retenue", async () => {
    valides("formateur-invitation-relance");
    d.opposition.mockRejectedValue(new Error("base"));
    await processeur()(
      job("formateur-invitation-relance", { entityType: "JobApplication", entityId: TRAINER }),
    );
    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(d.annuler).toHaveBeenCalledTimes(1);
  });
  it("l'argent passe malgré l'opposition", async () => {
    valides("formateur-virement-fait");
    d.opposition.mockResolvedValue({ id: "o-1" });
    await processeur()(job("formateur-virement-fait"));
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
  });
});
