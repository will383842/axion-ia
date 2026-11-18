import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ lire: vi.fn(), outbox: vi.fn() }));
vi.mock("@/features/dossier-client/questionnaires-de-la-fiche", () => ({
  lireQuestionnairesDeLaFiche: m.lire,
}));
vi.mock("@/lib/prisma", () => ({ prisma: { emailOutbox: { findFirst: m.outbox } } }));
vi.mock("@/features/dossier-client/fiche/actions-relance-equipe", () => ({
  demanderAuDirigeantDeRelancerSonEquipeAction: async () => {},
}));

import { suiviReel } from "@/features/dossier-client/fiche/__tests__/suivi-reel.fixture";
import type { ContexteFiche } from "../contexte";
import { questionnaireEnBref } from "../QuestionnaireEnBref";

const ligne = (nom: string, etat: string) => ({
  nom,
  etat,
  role: "collaborateur",
  sourceNom: "equipe",
});
// Horloge figée : l'expiration (5 nov. 10 h UTC) est comparée à l'heure, jamais à la date réelle.
const MAINTENANT = new Date("2026-11-01T10:00:00Z");
const questionnaire = (collabs: ReturnType<typeof ligne>[], recus: number) => ({
  id: "q1",
  envoyeLe: new Date("2026-10-28T10:00:00Z"),
  closLe: null,
  expireLe: new Date("2026-11-05T10:00:00Z"),
  parPersonne: {
    suivi: {
      dirigeant: { nom: "Anne Durand", etat: "recu", role: "dirigeant", sourceNom: "equipe" },
      collaborateurs: collabs,
      referents: [],
      total: { attendus: collabs.length + 1, recus },
    },
  },
});
const ctx = (role: string, voit = true, maintenant = MAINTENANT): ContexteFiche =>
  ({
    clientId: "c1",
    qBase: "/fr/x/qualiopi",
    role,
    voitEchanges: voit,
    maintenant,
  }) as unknown as ContexteFiche;

const rendre = async (c: ContexteFiche) => {
  const el = await questionnaireEnBref(c);
  return el === null ? "" : renderToStaticMarkup(el);
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MAINTENANT);
  delete process.env["QUESTIONNAIRE_RELANCES_ENABLED"];
  m.outbox.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env["QUESTIONNAIRE_RELANCES_ENABLED"];
});

describe("QuestionnaireEnBref", () => {
  it("dit la réponse en une ligne, la date limite et propose la demande au dirigeant", async () => {
    m.lire.mockResolvedValue([
      questionnaire([ligne("Paul Martin", "pas_de_nouvelles"), ligne("Léa Roux", "recu")], 2),
    ]);
    const html = await rendre(ctx("super_admin"));
    expect(html).toContain("2 réponses sur 3. Il manque Paul.");
    expect(html).toContain("Jusqu&#x27;au 5 nov.");
    expect(html).toContain("Demander à Anne de relancer son équipe");
    // Aucun bouton de relance d'un collaborateur, aucun envoi du questionnaire à un collaborateur.
    expect(html).not.toMatch(/Relancer Paul|Relancer Léa|Envoyer le questionnaire/);
    expect(html).not.toContain("admin-button-primary");
  });

  it("relances allumées : la phrase des relances automatiques est affichée", async () => {
    process.env["QUESTIONNAIRE_RELANCES_ENABLED"] = "true";
    m.lire.mockResolvedValue([questionnaire([ligne("Paul", "pas_de_nouvelles")], 1)]);
    const html = await rendre(ctx("super_admin"));
    expect(html).toContain("J+2, J+5, J+10");
    expect(html).not.toContain("éteintes");
  });

  it("relances éteintes (interrupteur absent) : « éteintes pour le moment », aucune promesse", async () => {
    m.lire.mockResolvedValue([questionnaire([ligne("Paul", "pas_de_nouvelles")], 1)]);
    const html = await rendre(ctx("super_admin"));
    expect(html).toContain("Les relances automatiques sont éteintes pour le moment.");
    expect(html).not.toContain("J+2");
  });

  it("un message déjà prêt : lien pour le relire, pas de second bouton", async () => {
    m.lire.mockResolvedValue([questionnaire([ligne("Paul", "pas_de_nouvelles")], 1)]);
    m.outbox.mockResolvedValue({ id: "o1" });
    const html = await rendre(ctx("super_admin"));
    expect(html).toContain("Relire le message prêt");
    expect(html).toContain("min-h-[44px]");
    expect(html).not.toContain("de relancer son équipe");
  });

  it("complet : phrase de fin, aucun bouton", async () => {
    m.lire.mockResolvedValue([questionnaire([ligne("Paul", "recu")], 2)]);
    const html = await rendre(ctx("super_admin"));
    expect(html).toContain("Toutes les réponses sont arrivées.");
    expect(html).not.toContain("<button");
  });

  it("vrai suivi tout reçu avec ligne référent vide : fin, aucun bouton", async () => {
    m.lire.mockResolvedValue([
      { ...questionnaire([], 0), parPersonne: { suivi: suiviReel({ recus: [0, 1, 2] }) } },
    ]);
    const html = await rendre(ctx("super_admin"));
    expect(html).toContain("Toutes les réponses sont arrivées.");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Il manque");
  });

  it("une personne écartée n'est pas nommée", async () => {
    m.lire.mockResolvedValue([
      { ...questionnaire([], 0), parPersonne: { suivi: suiviReel({ recus: [0], ecartes: [1] }) } },
    ]);
    const html = await rendre(ctx("super_admin"));
    expect(html).toContain("Il manque Chloé.");
    expect(html).not.toContain("Bruno");
  });

  it("lien expiré non clos : « Lien expiré le … », aucun bouton", async () => {
    m.lire.mockResolvedValue([
      {
        ...questionnaire([ligne("Paul", "pas_de_nouvelles")], 1),
        expireLe: new Date("2020-01-01T10:00:00Z"),
      },
    ]);
    const html = await rendre(ctx("super_admin"));
    expect(html).toContain("Lien expiré le 1 janvier.");
    expect(html).not.toContain("<button");
  });

  it("le jour même, avant l'heure d'expiration : lien encore valide, bouton proposé", async () => {
    m.lire.mockResolvedValue([questionnaire([ligne("Paul", "pas_de_nouvelles")], 1)]);
    const html = await rendre(ctx("super_admin", true, new Date("2026-11-05T09:00:00Z")));
    expect(html).not.toContain("Lien expiré");
    expect(html).toContain("de relancer son équipe");
  });

  it("le jour même, une heure après l'expiration : lien expiré, aucun bouton", async () => {
    m.lire.mockResolvedValue([questionnaire([ligne("Paul", "pas_de_nouvelles")], 1)]);
    const html = await rendre(ctx("super_admin", true, new Date("2026-11-05T11:00:00Z")));
    expect(html).toContain("Lien expiré le 5 novembre.");
    expect(html).not.toContain("<button");
  });

  it("seul le dirigeant manque : annoncé une fois, aucun bouton", async () => {
    const q = questionnaire([ligne("Paul", "recu")], 1);
    q.parPersonne.suivi.dirigeant.etat = "pas_de_nouvelles";
    m.lire.mockResolvedValue([q]);
    const html = await rendre(ctx("super_admin"));
    expect(html).toContain("Il manque le dirigeant.");
    expect(html).not.toContain("n&#x27;a pas encore répondu");
    expect(html).not.toContain("<button");
  });

  it("un autre rôle voit la phrase mais pas le bouton", async () => {
    m.lire.mockResolvedValue([questionnaire([ligne("Paul", "pas_de_nouvelles")], 1)]);
    const html = await rendre(ctx("admin"));
    expect(html).toContain("Il manque Paul");
    expect(html).not.toContain("<button");
  });

  it("sans droit sur les échanges : rien", async () => {
    expect(await rendre(ctx("admin", false))).toBe("");
    expect(m.lire).not.toHaveBeenCalled();
  });

  it("suivi en panne : « Lecture impossible », jamais « rien »", async () => {
    m.lire.mockResolvedValue([
      { ...questionnaire([], 0), parPersonne: null, parPersonneEnPanne: true },
    ]);
    expect(await rendre(ctx("super_admin"))).toContain("Lecture impossible");
  });
});
