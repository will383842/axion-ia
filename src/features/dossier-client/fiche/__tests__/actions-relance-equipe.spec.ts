import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  garer: vi.fn(),
  qFind: vi.fn(),
  outboxFind: vi.fn(),
  suivi: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/chiffrer-parole", () => ({
  dechiffrerParole: (v: string) => v.replace("enc:", ""),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    questionnaireAvantAudit: { findFirst: m.qFind },
    emailOutbox: { findFirst: m.outboxFind },
  },
}));
vi.mock("@/features/questionnaire-preaudit/de-la-fiche", () => ({
  fichesCouvertes: async (id: string) => [id],
  questionnairesDesFiches: (ids: string[]) => ({ clientId: { in: ids } }),
}));
vi.mock("@/features/questionnaire-preaudit/suivi-par-personne", () => ({
  lireSuiviParPersonne: m.suivi,
}));
vi.mock("@/server/email/outbox-service", () => ({ garerPourValidation: m.garer }));

import { demanderAuDirigeantDeRelancerSonEquipeAction as agir } from "../actions-relance-equipe";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const QUEST = "22222222-2222-4222-8222-222222222222";
const fd = () => {
  const f = new FormData();
  f.set("clientId", CLIENT);
  f.set("questionnaireId", QUEST);
  return f;
};
const ligne = (nom: string, etat: string) => ({
  nom,
  etat,
  role: "collaborateur",
  sourceNom: "equipe",
});
const suiviAvecManquants = () => ({
  get: () => ({
    suivi: {
      dirigeant: { nom: "Anne Durand", etat: "recu", role: "dirigeant", sourceNom: "equipe" },
      collaborateurs: [ligne("Paul Martin", "pas_de_nouvelles"), ligne("Léa Roux", "recu")],
      referents: [],
      total: { attendus: 3, recus: 2 },
    },
  }),
});

async function lancer(): Promise<string> {
  try {
    await agir(fd());
  } catch (e) {
    return decodeURIComponent((e as Error).message);
  }
  return "";
}

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u1", role: "super_admin" } });
  m.qFind.mockResolvedValue({
    id: QUEST,
    destinataire: "enc:Anne@Client.fr",
    envoyeLe: new Date(),
    closLe: null,
    expireLe: new Date("2026-11-05T10:00:00Z"),
  });
  m.outboxFind.mockResolvedValue(null);
  m.suivi.mockResolvedValue(suiviAvecManquants());
  m.garer.mockResolvedValue("outbox-1");
});

describe("demander au dirigeant de relancer son équipe", () => {
  it("gare un brouillon au dirigeant SEUL, sans réponse, et n'envoie rien", async () => {
    const sortie = await lancer();
    expect(sortie).toContain("Message prêt");
    expect(m.garer).toHaveBeenCalledTimes(1);
    const arg = m.garer.mock.calls[0]![0];
    expect(arg.recipient).toBe("anne@client.fr");
    expect(arg.template).toBe("questionnaire-relance-equipe");
    expect(arg.entityType).toBe("questionnaire_preaudit");
    expect(arg.entityId).toBe(QUEST);
    expect(arg.payload).toEqual({
      prenom: "Anne",
      manquants: ["Paul"],
      auditCourt: "5 novembre",
    });
    // Le brouillon n'a aucune adresse de collaborateur ni lien.
    expect(JSON.stringify(arg)).not.toMatch(/\blien\b|http/);
  });

  it("refuse un doublon déjà à valider", async () => {
    m.outboxFind.mockResolvedValue({ id: "deja" });
    expect(await lancer()).toContain("déjà prêt");
    expect(m.garer).not.toHaveBeenCalled();
  });

  it("refuse un rôle qui n'est pas super-administrateur", async () => {
    m.auth.mockResolvedValue({ user: { id: "u2", role: "admin" } });
    expect(await lancer()).toContain("Réservé au super-administrateur");
    expect(m.garer).not.toHaveBeenCalled();
    expect(m.qFind).not.toHaveBeenCalled();
  });

  it("garerPourValidation null : erreur affichée, rien d'envoyé", async () => {
    m.garer.mockResolvedValue(null);
    const sortie = await lancer();
    expect(sortie).toContain("rien n'a été envoyé");
    expect(sortie).toContain("erreur=");
  });

  it("rien à relancer quand tout est arrivé", async () => {
    m.suivi.mockResolvedValue({
      get: () => ({
        suivi: {
          dirigeant: { nom: "Anne", etat: "recu", role: "dirigeant", sourceNom: "equipe" },
          collaborateurs: [ligne("Paul", "recu")],
          referents: [],
          total: { attendus: 2, recus: 2 },
        },
      }),
    });
    expect(await lancer()).toContain("rien à relancer");
    expect(m.garer).not.toHaveBeenCalled();
  });

  it("n'importe aucun moyen d'envoi direct", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/features/dossier-client/fiche/actions-relance-equipe.ts", "utf8");
    expect(src).not.toMatch(/enqueueEmail\(|sendMail|nodemailer|resend|queues"/i);
  });
});
