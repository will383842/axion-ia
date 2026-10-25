/**
 * Le suivi du questionnaire avant audit se voit sur la fiche de la rencontre (2026-10-26) :
 * case des relances COCHÉE par défaut avec ses dates, date et lieu de l'audit, aperçus des
 * e-mails de suivi, « M'envoyer un essai », journal et « Arrêter les relances ».
 * Rien n'est envoyé d'ici : les actions sont simulées.
 */

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  suivi: vi.fn(),
  questionnaire: vi.fn(),
}));

vi.mock("@/features/questionnaire-preaudit/actions", () => ({
  arreterRelancesAction: vi.fn(),
  cloreQuestionnaireAction: vi.fn(),
  demanderEssaiAction: vi.fn(),
  deposerQuestionnaireAction: vi.fn(),
  envoyerQuestionnaireAction: vi.fn(),
  marquerQuestionnaireLuAction: vi.fn(),
  ecarterReponsesMembreAction: vi.fn(),
  effacerReponsesMembreAction: vi.fn(),
}));
vi.mock("@/features/questionnaire-preaudit/serveur", () => ({
  cheminEssaiPreaudit: () => "/questionnaire/preaudit/x/y?essai=1",
  // Même règle que le module réel : ni clos, ni expiré.
  essaiPermis: (q: { closLe: Date | null; expireLe: Date | null }) =>
    q.closLe === null && (q.expireLe === null || q.expireLe.getTime() > Date.now()),
  lireDeLaRencontre: m.questionnaire,
  lireReponses: async () => [],
}));
vi.mock("@/features/questionnaire-preaudit/suivi-console", () => ({ lireSuivi: m.suivi }));
vi.mock("@/features/questionnaire-preaudit/envoyer", () => ({
  apercuEnvoi: async () => ({ subject: "Votre questionnaire avant audit", html: "<p>x</p>" }),
  apercusSuivi: async () => [
    {
      libelle: "Relance 1",
      email: { subject: "Votre questionnaire vous attend", html: "<p>r</p>" },
    },
  ],
}));

import { QuestionnairePreaudit } from "@/components/admin/dossier-client/QuestionnairePreaudit";

const Q = {
  id: "11111111-1111-4111-8111-111111111111",
  ref: "Q-1",
  creeLe: new Date("2026-10-25T08:00:00Z"),
  envoyeLe: null,
  luLe: null,
  closLe: null,
  expireLe: null,
};

const rendre = async (apercu: boolean) =>
  render(
    await QuestionnairePreaudit({
      rencontreId: "22222222-2222-4222-8222-222222222222",
      peutDeposer: true,
      titulaire: { nom: "Sam Martin", email: "sam@exemple-fictif.fr" },
      debutPrevu: new Date("2099-11-06T07:30:00Z"),
      societe: "Société fictive",
      apercu: apercu
        ? {
            email: "sam@exemple-fictif.fr",
            prenom: "Sam",
            date: "2099-11-06T08:30",
            lieu: "dans vos locaux",
          }
        : null,
    }),
  );

beforeEach(() => {
  process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] = "true";
  delete process.env["QUESTIONNAIRE_RELANCES_ENABLED"];
  m.questionnaire.mockResolvedValue(Q);
  m.suivi.mockResolvedValue(null);
});

describe("le suivi du questionnaire se voit", () => {
  it("avant l'envoi : case des relances cochée, dates prévues, aperçus, mention « éteintes »", async () => {
    const { container } = await rendre(true);
    const envoi = container.querySelector('[data-bloc="envoi-questionnaire"]')!;
    const caseRelances = envoi.querySelector('input[name="relances"]') as HTMLInputElement;
    expect(caseRelances.defaultChecked).toBe(true);
    expect(envoi.textContent).toContain("Programmer les 3 relances automatiques");
    // Une phrase lisible, jamais un nom de variable (vérification E1).
    expect(envoi.textContent).not.toContain("QUESTIONNAIRE_RELANCES_ENABLED");
    expect(envoi.querySelector("[data-etat-relances]")?.getAttribute("data-etat-relances")).toBe(
      "eteint",
    );
    expect(envoi.textContent).toContain("Relances éteintes pour le moment");
    expect((envoi.querySelector('input[name="lieu_audit"]') as HTMLInputElement).value).toBe(
      "dans vos locaux",
    );
    expect(container.querySelector('[data-bloc="apercus-suivi"]')?.textContent).toContain(
      "Relance 1",
    );
    expect(container.querySelector('[data-bloc="essai-suivi"]')?.textContent).toContain(
      "M'envoyer un essai",
    );
  });

  it("la date de l'audit est préremplie avec le rendez-vous à venir", async () => {
    const { container } = await rendre(false);
    const date = container.querySelector('input[name="pa_date"]') as HTMLInputElement;
    expect(date.defaultValue).toBe("2099-11-06T08:30");
  });

  it("après l'envoi : journal, prochaine relance, bouton d'arrêt", async () => {
    m.suivi.mockResolvedValue({
      relancesDemandees: true,
      dateAudit: null,
      lieuAudit: null,
      premierEnvoiLe: new Date("2026-10-26T09:00:00Z"),
      relancesArreteesLe: null,
      relancesArretMotif: null,
      prochaine: new Date("2026-10-28T08:30:00Z"),
      journal: [
        {
          id: "c1",
          nature: "relance_1",
          essaiDe: null,
          statut: "prevu",
          prevuLe: new Date("2026-10-28T08:30:00Z"),
          faitLe: null,
          motif: null,
        },
      ],
    });
    const { container } = await rendre(false);
    const bloc = container.querySelector('[data-bloc="suivi-questionnaire"]')!;
    expect(bloc.textContent).toContain("Prochaine relance");
    expect(bloc.textContent).toContain("Relance 1");
    expect(bloc.textContent).toContain("prévu");
    expect(bloc.textContent).toContain("Arrêter les relances");
  });

  it("relances arrêtées : le motif en clair, plus de bouton", async () => {
    m.suivi.mockResolvedValue({
      relancesDemandees: true,
      dateAudit: null,
      lieuAudit: null,
      premierEnvoiLe: new Date("2026-10-26T09:00:00Z"),
      relancesArreteesLe: new Date("2026-10-27T10:00:00Z"),
      relancesArretMotif: "reponse_dirigeant",
      prochaine: null,
      journal: [],
    });
    const { container } = await rendre(false);
    const bloc = container.querySelector('[data-bloc="suivi-questionnaire"]')!;
    expect(bloc.textContent).toContain("le dirigeant a répondu");
    expect(bloc.textContent).not.toContain("Arrêter les relances");
  });

  it("lien clos ou expiré : plus de lien « Essayer » (la page répondrait 404)", async () => {
    const ouvert = await rendre(false);
    expect(ouvert.container.querySelector("[data-lien-essai]")).not.toBeNull();
    ouvert.unmount();
    m.questionnaire.mockResolvedValue({ ...Q, closLe: new Date("2026-10-27T10:00:00Z") });
    const clos = await rendre(false);
    expect(clos.container.querySelector("[data-lien-essai]")).toBeNull();
    clos.unmount();
    m.questionnaire.mockResolvedValue({ ...Q, expireLe: new Date("2020-01-01T00:00:00Z") });
    const expire = await rendre(false);
    expect(expire.container.querySelector("[data-lien-essai]")).toBeNull();
  });

  it("questionnaire éteint : aucun bouton d'essai", async () => {
    process.env["QUESTIONNAIRE_AVANT_AUDIT_ENABLED"] = "false";
    const { container } = await rendre(false);
    expect(container.querySelector('[data-bloc="essai-suivi"]')).toBeNull();
  });
});
