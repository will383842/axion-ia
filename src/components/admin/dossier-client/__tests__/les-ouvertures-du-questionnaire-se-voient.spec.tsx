/**
 * Ouvertures et avancée du questionnaire sur la fiche client (2026-10-27) : onglet Questionnaire
 * et bandeau « Où en est ce client ». Questionnaire jamais ouvert / ouvert non commencé / commencé,
 * drapeau éteint (rien), bouton « Lire le brouillon » pour le super-administrateur seulement.
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/questionnaire-preaudit/actions-suivi-ouvertures", () => ({
  lireBrouillonAction: vi.fn(),
}));

import { construireBandeau } from "@/features/dossier-client/bandeau-ou-en-est";
import type { QuestionnaireDeLaFiche } from "@/features/dossier-client/questionnaires-de-la-fiche";
import type { SuiviOuvertures } from "@/features/questionnaire-preaudit/ouvertures";

import { BlocQuestionnaireFiche } from "../BlocQuestionnaireFiche";

const ENVOYE = new Date("2026-10-25T09:00:00Z");
const T = new Date("2026-10-27T16:30:00Z");

function q(suivi: SuiviOuvertures | null, extra: Partial<QuestionnaireDeLaFiche> = {}) {
  return {
    id: "q1",
    rencontreId: null,
    rencontreTitre: null,
    rencontreDebut: null,
    creeLe: ENVOYE,
    envoyeLe: ENVOYE,
    expireLe: null,
    closLe: null,
    reponses: { dirigeant: 0, referentInformatique: 0, collaborateurs: 0, aTraiter: 0 },
    invitationEmailLogId: null,
    invitationStatut: null,
    suivi,
    suiviEnPanne: false,
    ...extra,
  } satisfies QuestionnaireDeLaFiche;
}

const JAMAIS: SuiviOuvertures = { ouvertures: [], brouillons: [] };
const OUVERT: SuiviOuvertures = {
  ouvertures: [
    {
      mode: "main",
      membre: "",
      premiereOuverture: T,
      derniereOuverture: T,
      nombre: 2,
      derniereEtapeAtteinte: 1,
    },
  ],
  brouillons: [],
};
const COMMENCE: SuiviOuvertures = {
  ouvertures: OUVERT.ouvertures,
  brouillons: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      mode: "main",
      membre: "",
      majLe: T,
      avancee: { remplies: 30, total: 60, pourcentage: 50 },
    },
  ],
};

const bloc = (s: SuiviOuvertures | null, o: { ouv?: boolean; lire?: boolean } = {}) =>
  render(
    <BlocQuestionnaireFiche
      questionnaires={[q(s)]}
      adminPrefix="console"
      ficheHref="/fr/console/qualiopi/clients/c1"
      afficherOuvertures={o.ouv ?? true}
      peutLireBrouillon={o.lire ?? false}
    />,
  ).container.textContent ?? "";

const bandeau = (s: SuiviOuvertures | null, allume = true) =>
  construireBandeau({
    maintenant: T,
    rendezVous: [],
    questionnaires: [q(s)],
    fil: [],
    prestations: [],
    nbDevis: 0,
    suiviOuvertures: allume,
  }).find((l) => l.cle === "questionnaire")!.texte;

describe("onglet Questionnaire", () => {
  it("jamais ouvert", () => {
    expect(bloc(JAMAIS)).toContain("Aucune ouverture notée pour l'instant");
  });
  it("ouvert, non commencé", () => {
    const t = bloc(OUVERT);
    expect(t).toContain("Dirigeant : ouvert 2 fois");
    expect(t).toContain("n'a vu que la page d'accueil");
    expect(t).toContain("aucun brouillon enregistré (la personne n'a peut-être rien rempli");
  });
  it("commencé, avec l'avancée", () => {
    expect(bloc(COMMENCE)).toContain("30 réponses remplies sur 60 questions (50 %)");
  });
  it("drapeau éteint : rien", () => {
    expect(bloc(COMMENCE, { ouv: false })).not.toMatch(/ouvert|brouillon/i);
  });
  it("« Lire le brouillon » : seulement quand la fiche l'autorise (super-administrateur)", () => {
    expect(bloc(COMMENCE)).not.toContain("Lire le brouillon");
    expect(bloc(COMMENCE, { lire: true })).toContain("Lire le brouillon");
  });
  it("lecture en panne : dit, jamais « jamais ouvert »", () => {
    const t = render(
      <BlocQuestionnaireFiche
        questionnaires={[q(null, { suiviEnPanne: true })]}
        adminPrefix="console"
        ficheHref="/f"
        afficherOuvertures
      />,
    ).container.textContent;
    expect(t).toContain("lecture impossible");
    expect(t).not.toContain("Aucune ouverture");
  });
});

describe("bandeau « Où en est ce client »", () => {
  it("jamais ouvert / ouvert / commencé", () => {
    expect(bandeau(JAMAIS)).toBe("envoyé le 25 oct. · pas de réponse · jamais ouvert");
    expect(bandeau(OUVERT)).toBe(
      "envoyé le 25 oct. · pas de réponse · ouvert 2 fois, dernière fois le 27 oct.",
    );
    expect(bandeau(COMMENCE)).toContain("commencé (50 %)");
  });
  it("drapeau éteint : la ligne d'avant, inchangée", () => {
    expect(bandeau(COMMENCE, false)).toBe("envoyé le 25 oct. · pas de réponse");
  });
});
