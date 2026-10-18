import { describe, it, expect } from "vitest";
import {
  controlerContenu,
  contientAffirmationQualiopi,
  listeNoireDepuisEnv,
} from "../gardes-contenu";
import { publicationValide } from "./fixtures";

const REGLAGES = {
  qualiopiCertificationObtenue: false,
  ofPublicDisclosure: true,
  nomsClientsInterdits: [] as string[],
};

function regles(over: Record<string, unknown>, reglages = REGLAGES) {
  return controlerContenu(publicationValide(over), reglages).map((v) => v.regle);
}

describe("gardes de contenu (§3.6)", () => {
  it("une publication propre passe", () => {
    expect(controlerContenu(publicationValide(), REGLAGES)).toEqual([]);
  });

  it("« Grenoble » refusé, quelle que soit la casse, dans n'importe quel champ", () => {
    expect(regles({ titre: "Automatiser ses relances depuis GRENOBLE en une heure" })).toContain(
      "grenoble",
    );
    expect(
      regles({
        questions: [
          {
            question: "Faut-il être à Grenoble pour commencer ?",
            reponse: "Non, la méthode fonctionne partout, à distance comme sur place.",
          },
          {
            question: "Combien de relances au maximum ?",
            reponse:
              "Deux ou trois relances espacées suffisent dans la plupart des cas rencontrés.",
          },
        ],
      }),
    ).toContain("grenoble");
    expect(regles({ transcription: "bonjour de grenoble" })).toContain("grenoble");
  });

  it("« aucun gain garanti » refusé", () => {
    expect(
      regles({
        aRetenir: [
          "Aucun   gain garanti, mais un vrai travail utile.",
          "Deuxième point à retenir bien rédigé.",
          "Troisième point à retenir bien rédigé.",
        ],
      }),
    ).toContain("aucun_gain_garanti");
  });

  it("« certifié Qualiopi » refusé tant que le réglage est false", () => {
    expect(regles({ titre: "Notre organisme est certifié Qualiopi depuis peu" })).toContain(
      "qualiopi",
    );
    expect(regles({ titre: "Qualiopi : nous sommes certifiés depuis peu de temps" })).toContain(
      "qualiopi",
    );
    expect(regles({ titre: "Organisme certifiée Qualiopi : ce que cela change" })).toContain(
      "qualiopi",
    );
  });

  it("« certifié Qualiopi » accepté quand le réglage est true", () => {
    expect(
      regles(
        { titre: "Notre organisme est certifié Qualiopi depuis peu" },
        { ...REGLAGES, qualiopiCertificationObtenue: true },
      ),
    ).not.toContain("qualiopi");
  });

  it("une simple mention de Qualiopi sans certification n'est pas refusée", () => {
    expect(
      regles({ titre: "Qualiopi et formation : les questions à se poser avant" }),
    ).not.toContain("qualiopi");
  });

  it("financements refusés quand la divulgation OF est éteinte, acceptés sinon", () => {
    const titre = "Financer sa formation avec le CPF ou un OPCO en toute simplicité";
    expect(regles({ titre }, { ...REGLAGES, ofPublicDisclosure: false })).toContain("financement");
    expect(regles({ titre }, { ...REGLAGES, ofPublicDisclosure: true })).not.toContain(
      "financement",
    );
  });

  it("nom de client de la liste noire refusé (insensible à la casse)", () => {
    expect(
      regles(
        { titre: "Comment Dupontex a automatisé ses relances en deux semaines" },
        { ...REGLAGES, nomsClientsInterdits: ["dupontex"] },
      ),
    ).toContain("nom_de_client");
  });

  it("l'attestation absente ou fausse est refusée par le contrat (pas ici)", () => {
    // contrat.spec.ts couvre `attestations.aucunNomNiLogoDeClient !== true` ; ici la garde
    // de contenu ne rend jamais « nom_de_client » faute de liste.
    expect(regles({}, REGLAGES)).toEqual([]);
  });

  it("chaque violation nomme le champ fautif", () => {
    const v = controlerContenu(
      publicationValide({ titre: "Relances à Grenoble pour les petites équipes" }),
      REGLAGES,
    );
    expect(v).toEqual([{ regle: "grenoble", champ: "titre" }]);
  });
});

describe("contientAffirmationQualiopi — relue au rendu", () => {
  it("détecte les deux ordres", () => {
    expect(contientAffirmationQualiopi("nous sommes certifiés Qualiopi")).toBe(true);
    expect(contientAffirmationQualiopi("Qualiopi, c'est acquis : certifiée")).toBe(true);
    expect(contientAffirmationQualiopi("Parlons de qualité")).toBe(false);
  });
});

describe("listeNoireDepuisEnv (D9)", () => {
  it("sépare par « ; », ignore les vides et les noms trop courts", () => {
    expect(listeNoireDepuisEnv(" Dupontex ; ;Martin SA;ab ")).toEqual(["dupontex", "martin sa"]);
  });
  it("absente → liste vide", () => {
    expect(listeNoireDepuisEnv(undefined)).toEqual([]);
  });
});
