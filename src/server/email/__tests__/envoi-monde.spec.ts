// FAC-1 — Le module d'envoi « monde » : ce que chaque réseau (apporteurs aujourd'hui)
// partage pour enfiler ses e-mails, sans condition sur le monde (R-C2) et sans rien
// changer à la sortie des apporteurs (R-C3).
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getJob: vi.fn(),
  render: vi.fn(),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(),
  emailsQueue: { getJob: (...a: unknown[]) => h.getJob(...a) },
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => h.render(...a),
}));

import {
  apercuGabarit,
  avecLienEspaceRecalcule,
  avecTexteLibre,
  jobIdSansDeuxPoints,
  resultatDeLEnfilage,
  retirerEnvoiEchoue,
} from "../envoi-monde";
import * as apporteurs from "@/features/apporteurs-reseau/envois";

beforeEach(() => {
  vi.clearAllMocks();
  h.render.mockResolvedValue({ subject: "Objet", html: "<p>corps</p>" });
});

describe("une seule source pour les deux mondes", () => {
  it("les apporteurs ré-exportent les fonctions communes, sans copie", () => {
    expect(apporteurs.avecTexteLibre).toBe(avecTexteLibre);
    expect(apporteurs.retirerEnvoiEchoue).toBe(retirerEnvoiEchoue);
  });
});

describe("avecTexteLibre", () => {
  it("ajoute le texte réécrit, et rend le payload tel quel sans texte", () => {
    const p = { a: 1 };
    expect(avecTexteLibre(p, "Bonjour")).toEqual({ a: 1, texteLibre: "Bonjour" });
    expect(avecTexteLibre(p, undefined)).toBe(p);
    expect(avecTexteLibre(p, "")).toBe(p);
  });
});

describe("resultatDeLEnfilage", () => {
  it("traduit la réponse d'enqueueEmail dans le même ordre que les apporteurs", () => {
    expect(resultatDeLEnfilage({ enqueued: false, garePourValidation: true })).toBe(
      "en-validation",
    );
    expect(resultatDeLEnfilage({ enqueued: true })).toBe("envoye");
    expect(resultatDeLEnfilage({ enqueued: false, retenu: true })).toBe("retenu");
    expect(resultatDeLEnfilage({ enqueued: false })).toBe("indisponible");
  });
});

describe("jobIdSansDeuxPoints", () => {
  it("remplace les deux-points (interdits par BullMQ) et laisse l'absence telle quelle", () => {
    expect(jobIdSansDeuxPoints("a:b:c")).toBe("a-b-c");
    expect(jobIdSansDeuxPoints("apporteur-invit-relance-1-x")).toBe("apporteur-invit-relance-1-x");
    expect(jobIdSansDeuxPoints(undefined)).toBeUndefined();
  });
});

describe("retirerEnvoiEchoue", () => {
  it("retire un job échoué, ne touche jamais un job vivant, ne lève jamais", async () => {
    const remove = vi.fn();
    h.getJob.mockResolvedValueOnce({ isFailed: async () => true, remove });
    await retirerEnvoiEchoue("x");
    expect(remove).toHaveBeenCalledTimes(1);

    const remove2 = vi.fn();
    h.getJob.mockResolvedValueOnce({ isFailed: async () => false, remove: remove2 });
    await retirerEnvoiEchoue("y");
    expect(remove2).not.toHaveBeenCalled();

    h.getJob.mockRejectedValueOnce(new Error("redis"));
    await expect(retirerEnvoiEchoue("z")).resolves.toBeUndefined();
  });
});

describe("avecLienEspaceRecalcule — le lien n'est JAMAIS repris du payload", () => {
  it("écrase un lien reçu par le lien recalculé", async () => {
    const p = await avecLienEspaceRecalcule(
      { a: 1, lienEspace: "https://pirate" },
      async () => "https://bon",
    );
    expect(p).toEqual({ a: 1, lienEspace: "https://bon" });
  });
  it("retire un lien reçu quand l'adaptateur n'en donne aucun", async () => {
    const p = await avecLienEspaceRecalcule(
      { a: 1, lienEspace: "https://pirate" },
      async () => null,
    );
    expect(p).toEqual({ a: 1 });
  });
  it("fail-soft : une erreur de l'adaptateur rend le payload sans lien", async () => {
    const p = await avecLienEspaceRecalcule({ a: 1, lienEspace: "https://pirate" }, async () => {
      throw new Error("base");
    });
    expect(p).toEqual({ a: 1 });
  });
});

describe("apercuGabarit", () => {
  it("rend l'e-mail exact et le texte par défaut calculé SANS le texte réécrit", async () => {
    const texte = vi.fn(() => "défaut");
    const r = await apercuGabarit(
      { gabarit: "g-test", destinataire: "a@b.fr", payload: { x: 1, texteLibre: "réécrit" } },
      texte,
    );
    expect(h.render).toHaveBeenCalledWith(
      "g-test",
      "fr",
      { x: 1, texteLibre: "réécrit" },
      { destinataire: "a@b.fr" },
    );
    expect(texte).toHaveBeenCalledWith("g-test", { x: 1 });
    expect(r).toEqual({
      gabarit: "g-test",
      sujet: "Objet",
      html: "<p>corps</p>",
      destinataire: "a@b.fr",
      texteDefaut: "défaut",
    });
  });
  it("sans texte modifiable, aucune clé texteDefaut", async () => {
    const r = await apercuGabarit(
      { gabarit: "g", destinataire: "a@b.fr", payload: {} },
      () => null,
    );
    expect("texteDefaut" in r).toBe(false);
  });
});
