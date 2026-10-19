/**
 * L09 — dépôt public d'une réclamation : relecture sécurité par les tests.
 *
 * Route publique : on vérifie l'ordre des gardes (interrupteur avant tout,
 * limite de fréquence avant la lecture du formulaire), le leurre silencieux,
 * la validation, le rattachement qui n'accepte QUE les inscriptions du
 * stagiaire connecté, et l'absence de fuite dans les messages.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  etat: "eteint" as "eteint" | "essai" | "actif",
  limiteOk: true,
  cookie: null as string | null,
  traineeId: "trainee-1",
  /** Le stagiaire à qui appartient l'inscription simulée. */
  proprietaire: "trainee-1",
  inscription: null as null | {
    id: string;
    estTestInterne: boolean;
    session: { estTestInterne: boolean };
  },
  deposer: vi.fn(async () => ({ id: "rec-1", numero: "AXI-REC-2026-007", accuse: "envoye" })),
  rateLimit: vi.fn(),
  findFirst: vi.fn(),
  honeypot: vi.fn(async () => undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { enrollment: { findFirst: h.findFirst } },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: h.rateLimit,
}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: vi.fn(async () => true) }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: vi.fn((e: string) => `empreinte-${e}`),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn(async () => "203.0.113.9") }));
vi.mock("@/lib/security/honeypot-observable", () => ({ signalerHoneypot: h.honeypot }));
vi.mock("@/server/qualiopi/portail/cookie", () => ({
  getPortailToken: vi.fn(async () => h.cookie),
}));
vi.mock("@/server/qualiopi/portail/portail-service", () => ({
  verifierToken: vi.fn(async (t: string) =>
    t === "bon-jeton" ? { traineeId: h.traineeId } : null,
  ),
}));
vi.mock("@/server/qualiopi/reclamations/cycle-service", () => ({ deposerReclamation: h.deposer }));
vi.mock("@/server/qualiopi/reclamations/interrupteur", () => ({
  lireInterrupteurReclamations: vi.fn(async () => h.etat),
}));

import { deposerReclamationPubliqueAction } from "@/server/actions/qualiopi/reclamation-publique";
import { MESSAGE_REFUS_DEPOT, cleLimiteAdresse, nettoyerTexte } from "../depot-public";

const INSCRIPTION = "550e8400-e29b-41d4-a716-446655440077";

function formulaire(champs: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    qualite: "formateur",
    nom: "Prénom Formateur",
    email: "Formateur@Example.test",
    objet: "Salle indisponible",
    description: "La salle réservée était occupée à notre arrivée.",
    consentement: "on",
    ...champs,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

const INITIAL = { etat: "initial" } as const;

beforeEach(() => {
  h.etat = "actif";
  h.cookie = null;
  h.inscription = null;
  vi.clearAllMocks();
  h.rateLimit.mockImplementation(async () => ({ allowed: h.limiteOk }));
  h.findFirst.mockImplementation(async ({ where }: { where: { id: string; traineeId: string } }) =>
    h.inscription && where.id === h.inscription.id && where.traineeId === h.proprietaire
      ? h.inscription
      : null,
  );
  h.limiteOk = true;
  h.traineeId = "trainee-1";
  h.proprietaire = "trainee-1";
});

describe("dépôt public — interrupteur", () => {
  it("🔴 éteint : refus avant toute autre lecture, rien n'est déposé", async () => {
    h.etat = "eteint";
    const r = await deposerReclamationPubliqueAction(INITIAL, formulaire());
    expect(r).toEqual({ etat: "erreur", message: MESSAGE_REFUS_DEPOT });
    expect(h.rateLimit).not.toHaveBeenCalled();
    expect(h.deposer).not.toHaveBeenCalled();
  });

  it("essai : refus hors banc d'essai, avec le MÊME message (aucune fuite)", async () => {
    h.etat = "essai";
    const r = await deposerReclamationPubliqueAction(INITIAL, formulaire());
    expect(r).toEqual({ etat: "erreur", message: MESSAGE_REFUS_DEPOT });
    expect(h.deposer).not.toHaveBeenCalled();
  });

  it("essai : accepté pour un stagiaire connecté, inscrit au banc d'essai", async () => {
    h.etat = "essai";
    h.cookie = "bon-jeton";
    h.inscription = { id: INSCRIPTION, estTestInterne: false, session: { estTestInterne: true } };
    const r = await deposerReclamationPubliqueAction(
      INITIAL,
      formulaire({ qualite: "stagiaire", enrollmentId: INSCRIPTION }),
    );
    expect(r).toEqual({ etat: "recue", numero: "AXI-REC-2026-007" });
  });
});

describe("dépôt public — anti-abus", () => {
  it("limite de fréquence par IP, avant la lecture du formulaire", async () => {
    h.limiteOk = false;
    const r = await deposerReclamationPubliqueAction(INITIAL, formulaire());
    expect(r.etat).toBe("erreur");
    expect(h.rateLimit).toHaveBeenCalledWith("reclamation-publique:203.0.113.9", {
      limit: 3,
      windowSec: 600,
    });
    expect(h.deposer).not.toHaveBeenCalled();
  });

  it("limite par adresse (empreinte, jamais l'adresse en clair) : 3 par 24 h", async () => {
    h.rateLimit.mockImplementation(async (cle: string) => ({
      allowed: !cle.startsWith("reclamation-publique-adresse:"),
    }));
    const r = await deposerReclamationPubliqueAction(INITIAL, formulaire());
    expect(r.etat).toBe("erreur");
    expect(h.rateLimit).toHaveBeenCalledWith(
      "reclamation-publique-adresse:empreinte-formateur@example.test",
      { limit: 3, windowSec: 86_400 },
    );
    expect(h.deposer).not.toHaveBeenCalled();
  });

  it("leurre rempli : succès silencieux, rien n'est enregistré", async () => {
    const r = await deposerReclamationPubliqueAction(
      INITIAL,
      formulaire({ website: "https://spam.example" }),
    );
    expect(r).toEqual({ etat: "recue", numero: null });
    expect(h.honeypot).toHaveBeenCalledOnce();
    expect(h.deposer).not.toHaveBeenCalled();
  });

  it.each([
    ["sans consentement", { consentement: "" }],
    ["adresse invalide", { email: "pas-une-adresse" }],
    ["description trop courte", { description: "court" }],
    ["description trop longue", { description: "x".repeat(5001) }],
    ["qualité inconnue", { qualite: "administrateur" }],
    ["inscription mal formée", { enrollmentId: "'; DROP TABLE reclamations; --" }],
  ])("refuse : %s, sans rien déposer", async (_cas, champs) => {
    const r = await deposerReclamationPubliqueAction(INITIAL, formulaire(champs));
    expect(r.etat).toBe("erreur");
    expect(h.deposer).not.toHaveBeenCalled();
  });
});

describe("dépôt public — enregistrement", () => {
  it("dépose avec la date serveur, l'adresse normalisée et l'auteur « formulaire public »", async () => {
    const avant = Date.now();
    const r = await deposerReclamationPubliqueAction(
      INITIAL,
      formulaire({ formationConcernee: "Atelier IA du 12 octobre" }),
    );
    expect(r).toEqual({ etat: "recue", numero: "AXI-REC-2026-007" });
    const depot = (h.deposer.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(depot).toMatchObject({
      qualite: "formateur",
      reclamantEmail: "formateur@example.test",
      canal: "formulaire_public",
      auteur: { id: null, nom: "Formulaire public de réclamation" },
    });
    expect((depot["dateReception"] as Date).getTime()).toBeGreaterThanOrEqual(avant);
    expect(depot["description"]).toMatch(
      /Formation concernée \(indiquée par la personne\) : Atelier IA/,
    );
    expect(depot["enrollmentId"]).toBeUndefined();
  });

  it("🔴 une inscription n'est rattachée que si elle appartient au stagiaire connecté", async () => {
    // Sans cookie : l'identifiant posté est ignoré.
    await deposerReclamationPubliqueAction(INITIAL, formulaire({ enrollmentId: INSCRIPTION }));
    expect(
      (h.deposer.mock.calls[0] as unknown as [Record<string, unknown>])[0]["enrollmentId"],
    ).toBeUndefined();
    expect(h.findFirst).not.toHaveBeenCalled();

    // Avec cookie, mais l'inscription d'un AUTRE stagiaire : ignorée aussi.
    h.cookie = "bon-jeton";
    h.inscription = { id: INSCRIPTION, estTestInterne: false, session: { estTestInterne: false } };
    h.proprietaire = "trainee-autre";
    await deposerReclamationPubliqueAction(INITIAL, formulaire({ enrollmentId: INSCRIPTION }));
    const second = (h.deposer.mock.calls[1] as unknown as [Record<string, unknown>])[0];
    expect(second["enrollmentId"]).toBeUndefined();
    expect(second["canal"]).toBe("espace_stagiaire");

    // La sienne : rattachée.
    h.proprietaire = "trainee-1";
    await deposerReclamationPubliqueAction(INITIAL, formulaire({ enrollmentId: INSCRIPTION }));
    expect(
      (h.deposer.mock.calls[2] as unknown as [Record<string, unknown>])[0]["enrollmentId"],
    ).toBe(INSCRIPTION);
  });

  it("une panne d'écriture rend un message générique, sans détail technique", async () => {
    h.deposer.mockRejectedValueOnce(new Error("relation reclamations does not exist"));
    const r = await deposerReclamationPubliqueAction(INITIAL, formulaire());
    expect(r.etat).toBe("erreur");
    expect(JSON.stringify(r)).not.toMatch(/relation|reclamations does/);
  });
});

describe("nettoyerTexte", () => {
  it("retire les caractères de contrôle, garde les sauts de ligne d'un texte long", () => {
    expect(nettoyerTexte("  a\u0000b\nc  ")).toBe("a b c");
    expect(nettoyerTexte("a\u0007b\nc", true)).toBe("ab\nc");
    expect(nettoyerTexte(undefined)).toBeUndefined();
  });
});

describe("cleLimiteAdresse — la limite par adresse ne se contourne pas avec un « + »", () => {
  it("coupe la partie locale au premier « + » et normalise", () => {
    expect(cleLimiteAdresse("Victime+1@Exemple.fr")).toBe("victime@exemple.fr");
    expect(cleLimiteAdresse(" victime+2+x@exemple.fr ")).toBe("victime@exemple.fr");
    expect(cleLimiteAdresse("victime@exemple.fr")).toBe("victime@exemple.fr");
  });
});
