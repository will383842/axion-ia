import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { fusionnerReponses, reponsesTexte } from "../complement";
import { preparerEnvois } from "@/features/admin-job-applications/reponse-en-masse";
import { remplirModele } from "@/content/recrutement/modeles-reponse";

const Q = [
  { id: "prix_vertical_30", type: "price" as const, required: true },
  { id: "exemples", required: false },
];

describe("fusion des réponses complétées en ligne", () => {
  it("n'écrit que les questions de l'offre — un champ forgé est ignoré", () => {
    expect(fusionnerReponses(Q, {}, { prix_vertical_30: "70", status: "hired" })).toEqual({
      prix_vertical_30: "70",
    });
  });

  it("une question laissée vide n'efface pas une réponse du dépôt", () => {
    expect(
      fusionnerReponses(Q, { exemples: "https://a" }, { prix_vertical_30: "70", exemples: "  " }),
    ).toEqual({ exemples: "https://a", prix_vertical_30: "70" });
  });

  it("ne garde que les valeurs texte stockées", () => {
    expect(reponsesTexte({ a: "1", b: 2, c: null })).toEqual({ a: "1" });
    expect(reponsesTexte(null)).toEqual({});
  });
});

describe("{lien_complement} dans l'envoi groupé", () => {
  const modele = { objet: "Tes tarifs", corps: "Bonjour {prenom}, [ici]({lien_complement})" };

  it("chaque destinataire reçoit SON lien", () => {
    const r = preparerEnvois(
      [
        { id: "a", prenom: "Ana", poste: "Monteur", lienComplement: "https://x/a" },
        { id: "b", prenom: "Bo", poste: "Monteur", lienComplement: "https://x/b" },
      ],
      modele,
      remplirModele,
    );
    expect(r.envois.map((e) => e.corps)).toEqual([
      "Bonjour Ana, [ici](https://x/a)",
      "Bonjour Bo, [ici](https://x/b)",
    ]);
  });

  it("sans lien (offre sans questions), le destinataire est ÉCARTÉ, jamais servi d'un lien vide", () => {
    const r = preparerEnvois(
      [{ id: "a", prenom: "Ana", poste: "Monteur", lienComplement: null }],
      modele,
      remplirModele,
    );
    expect(r.envois).toHaveLength(0);
    expect(r.ecartes).toEqual([
      { id: "a", motif: "variable_non_resolue", variables: ["lien_complement"] },
    ]);
  });
});
