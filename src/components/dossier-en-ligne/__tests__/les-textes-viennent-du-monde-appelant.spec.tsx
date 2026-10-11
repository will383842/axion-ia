// FAC-10 — Les composants communs du dossier en ligne n'écrivent aucun texte d'un monde :
// ils rendent ceux qu'on leur donne.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { Coquille, EcranInvalide } from "../Coquille";
import { DepotPiece, type TextesDepotPiece } from "../DepotPiece";

const DEPOT: TextesDepotPiece = {
  connexionPerdue: "x",
  facultatif: "si vous l'avez",
  conforme: "Validée",
  ajoutee: "Reçue",
  aRetransmettre: (m) => `Merci de la renvoyer : ${m}`,
  apercuDe: (p) => `Vue : ${p}`,
  voirLePdf: "Voir",
  dateDelivrance: "Date",
  envoi: "Envoi…",
  remplacer: "Changer",
};

describe("aucun texte apporteur dans les composants communs", () => {
  it("la coquille rend la marque, le surtitre et l'astuce donnés", () => {
    const html = renderToStaticMarkup(
      <Coquille
        textes={{ marque: "Axion-IA", surtitre: "Votre dossier de test", astuce: "Conseil." }}
        titre="T"
      >
        <p />
      </Coquille>,
    );
    expect(html).toContain("Votre dossier de test");
    expect(html).toContain("Conseil.");
    expect(html).not.toContain("apporteur");
  });
  it("l'écran neutre rend les textes et l'adresse donnés", () => {
    const html = renderToStaticMarkup(
      <EcranInvalide
        textes={{
          invalidePastille: "P",
          invalideTitre: "T",
          invalideLigne: "L",
          nousEcrire: "Écrire",
        }}
        adresseContact="contact@exemple.invalid"
      />,
    );
    expect(html).toContain("mailto:contact@exemple.invalid");
    expect(html).toContain("Écrire");
  });
  it("le dépôt rend les textes donnés", () => {
    const html = renderToStaticMarkup(
      <DepotPiece
        action={vi.fn()}
        textes={DEPOT}
        id="i"
        jeton="j"
        type="cv"
        libelle="CV"
        aide="aide"
        facultatif
        piece={{ statut: "a_retransmettre", motif: "m", nomFichier: "a.pdf" }}
        motifLibelle="illisible"
      />,
    );
    expect(html).toContain("Merci de la renvoyer : illisible");
    expect(html).toContain("si vous l&#x27;avez");
  });
});
