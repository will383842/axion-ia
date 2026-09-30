/**
 * CHAQUE QUESTION À WILL A SON BOUTON, QUI VISE SON ENREGISTREMENT (M1-bis).
 *
 * « Enregistrement court » et « session interrompue » sont deux questions :
 * deux cartes, deux gestes (`court`, `fenetres`), chacun portant
 * l'identifiant de l'enregistrement en attente. Formulaires serveur, sans
 * JavaScript. Mutation qui rougit : une seule carte « moins de 90 s ».
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/dossier-client/actions-rencontres", () => ({
  gesteCompteRenduAction: async () => undefined,
}));

import { VueCompteRendu } from "@/components/admin/visio/VueCompteRendu";
import type { VueCompteRendu as Vue } from "@/features/dossier-client/compte-rendu";

const RENCONTRE = "00000000-0000-4000-8000-000000000001";
const ENR = "00000000-0000-4000-8000-0000000000e1";

function vue(p: Partial<Vue>): Vue {
  return {
    rencontre: {
      id: RENCONTRE,
      titre: "Échange",
      debut: null,
      clientId: null,
      rattachementStatut: "valide",
    },
    courant: null,
    document: null,
    etat: null,
    versions: [],
    faits: [],
    voix: { voixClient: [], nonAttribuees: [], attribueeA: {}, participants: [] },
    accordAConfirmer: false,
    etapes: [
      {
        etape: "transcrire",
        statut: "suspendu",
        classeErreur: null,
        derniereErreur: null,
        prochaineTentativeLe: null,
      },
    ],
    enregistrements: [],
    accords: [],
    questionsAWill: [],
    ...p,
  };
}

const rendu = (v: Vue) =>
  renderToStaticMarkup(
    <VueCompteRendu
      vue={v}
      rencontreId={RENCONTRE}
      retour={`/fr/x/rendez-vous/rencontres/${RENCONTRE}`}
    />,
  );

describe("chaque question à Will a son bouton", () => {
  it("court ET interrompue : deux cartes, deux gestes, l'enregistrement visé", () => {
    const html = rendu(
      vue({
        questionsAWill: [
          { enregistrementId: ENR, question: "court" },
          { enregistrementId: ENR, question: "interrompue" },
        ],
      }),
    );
    expect(html).toContain("Enregistrement de moins de 90 secondes");
    expect(html).toContain("Session interrompue avant la fin");
    expect(html).toContain("Personne sans accord : lancer la transcription");
    expect(html).toContain('value="court"');
    expect(html).toContain('value="fenetres"');
    expect(html.split(`value="${ENR}"`).length - 1).toBe(2);
  });

  it("contre-témoin : sans étape en attente, aucune carte", () => {
    const html = rendu(
      vue({ etapes: [], questionsAWill: [{ enregistrementId: ENR, question: "interrompue" }] }),
    );
    expect(html).not.toContain("Session interrompue avant la fin");
  });
});
