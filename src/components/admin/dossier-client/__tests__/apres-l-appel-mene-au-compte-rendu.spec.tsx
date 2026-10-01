// @vitest-environment node
/**
 * UX-01 (relecture) : « Après l'appel » mène au compte rendu à valider. Quand
 * un compte rendu existe, un lien « Voir le compte rendu » ouvre la page du
 * rendez-vous (vue du compte rendu) ; sans compte rendu, pas de lien mort.
 *
 * Mutation qui fait rougir : retirer le lien, ou l'afficher sans compte rendu.
 * Rendu RÉEL du composant serveur, lectures de la base simulées.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/dossier-client/actions-rencontres", () => ({
  creerProspectAction: vi.fn(),
  rangerRencontreAction: vi.fn(),
  validerApresLAppelAction: vi.fn(),
}));
vi.mock("@/features/dossier-client/queries-rencontres", () => ({
  lireProjetsCourts: vi.fn(async () => []),
  lireFichesVivantes: vi.fn(async () => []),
}));
vi.mock("@/features/dossier-client/recherche-entreprises", () => ({
  rechercherSiren: vi.fn(async () => null),
}));

import { ApresLAppelVue } from "../ApresLAppelVue";
import { lireFichesVivantes } from "@/features/dossier-client/queries-rencontres";
import type { RencontreDetaillee } from "@/features/dossier-client/queries-rencontres";

const ID = "00000000-0000-4000-8000-000000000005";

function rencontre(comptesRendus: RencontreDetaillee["comptesRendus"]): RencontreDetaillee {
  return {
    id: ID,
    titre: "Discutons de votre projet IA",
    type: "visio",
    source: "calendly",
    debutPrevu: null,
    finPrevue: null,
    statut: null,
    estTestInterne: false,
    repriseHistorique: false,
    rattachementStatut: "valide",
    client: { id: "c1", numero: "AXI-CLI-001", raisonSociale: "Fiche Fictive" },
    clientPropose: null,
    motifProposition: null,
    projetId: null,
    calendlyEventId: null,
    titulaire: null,
    entrepriseDeclaree: { nom: null, ville: null },
    reponsesFormulaire: [],
    debriefs: [],
    participants: [],
    suivi: null,
    comptesRendus,
    faits: [],
    evocations: null,
  };
}

async function rendu(
  r: RencontreDetaillee,
  compteRendu: "aucun" | "en_preparation" | "pret" = "aucun",
): Promise<string> {
  const el = await ApresLAppelVue({ r, locale: "fr", adminPrefix: "x", erreur: null, compteRendu });
  return renderToStaticMarkup(el);
}

describe("« Après l'appel » mène au compte rendu", () => {
  it("un compte rendu existe : lien vers la page du rendez-vous", async () => {
    const html = await rendu(
      rencontre([
        {
          id: "cr1",
          version: 1,
          origine: "enregistrement",
          statut: "a_valider",
          valideLe: null,
          champs: [],
        },
      ]),
    );
    expect(html).toContain("Voir le compte rendu");
    expect(html).toContain(`href="/fr/x/rendez-vous/rencontres/${ID}"`);
  });

  it("contre-témoin : sans compte rendu, pas de lien", async () => {
    expect(await rendu(rencontre([]))).not.toContain("Voir le compte rendu");
  });

  it("un projet évoqué sans intitulé s'annonce en clair, jamais par sa référence", async () => {
    const fait = (id: string) => ({
      id,
      type: "besoin" as const,
      portee: "a_ranger" as const,
      projetId: null,
      statut: "propose" as const,
      confiance: "haute" as const,
      certitude: "dit_explicitement" as const,
      enonce: "Former l'équipe",
      question: null,
    });
    const html = await rendu({
      ...rencontre([]),
      faits: [fait("f1"), fait("f3")],
      evocations: {
        projets: [{ ref: "J1", intitule: "Formation", proposition: null }],
        projetDuFait: { f1: "J1", f3: "J3" },
        principal: "J1",
      },
    });
    expect(html).toContain("Autre projet évoqué");
    expect(html).not.toContain("« J3 »");
  });

  it("M-2 : visio enregistrée, compte rendu en préparation — le bandeau le dit, la note est facultative", async () => {
    const html = await rendu(rencontre([]), "en_preparation");
    expect(html).toContain("est en préparation : revenez ici quand il");
    expect(html).toContain("Note (facultative)");
    expect(html).not.toContain("pas d&#x27;enregistrement");
  });

  it("M-2 contre-témoin : sans enregistrement, ni bandeau ni « facultative »", async () => {
    const html = await rendu(rencontre([]));
    expect(html).not.toContain("en préparation");
    expect(html).toContain("Note (pas d&#x27;enregistrement)");
  });

  it("M-1 : rencontre de test — aucun client proposé, seules les fiches fictives sont listées", async () => {
    vi.mocked(lireFichesVivantes).mockClear();
    const html = await rendu({
      ...rencontre([]),
      client: null,
      estTestInterne: true,
      rattachementStatut: "propose",
      clientPropose: { id: "c9", numero: "AXI-CLI-009", raisonSociale: "Vraie Fiche Fictive" },
      motifProposition: "email_calendly",
    });
    expect(html).not.toContain("Confirmer le client proposé");
    expect(lireFichesVivantes).toHaveBeenCalledWith({ fictivesSeulement: true });
  });

  const faitDe = (id: string, statut: "propose" | "valide") => ({
    id,
    type: "besoin" as const,
    portee: statut === "valide" ? ("entreprise" as const) : ("a_ranger" as const),
    projetId: null,
    statut,
    confiance: "haute" as const,
    certitude: "dit_explicitement" as const,
    enonce: "Former l'équipe",
    question: null,
  });

  it("m-1 : sans proposition, le titre du nouveau projet reprend le projet évoqué", async () => {
    const html = await rendu({
      ...rencontre([]),
      faits: [faitDe("f1", "propose")],
      evocations: {
        projets: [{ ref: "J1", intitule: "Formation RH", proposition: null }],
        projetDuFait: { f1: "J1" },
        principal: "J1",
      },
    });
    expect(html).toContain('value="Formation RH"');
    expect(html).not.toContain('value="Projet Fiche Fictive"');
  });

  it("m-2 : tous les faits déjà validés — pas de section « à valider » vide", async () => {
    const html = await rendu({ ...rencontre([]), faits: [faitDe("f1", "valide")] });
    expect(html).not.toContain("Ce que le client a dit");
    expect(html).toContain("3. Note");
  });
});
