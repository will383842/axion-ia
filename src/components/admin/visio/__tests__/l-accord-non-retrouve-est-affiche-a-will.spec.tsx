/**
 * ⛔ L'ACCORD NON RETROUVÉ EST AFFICHÉ À WILL, ET LA CORRESPONDANCE DES VOIX
 * PEUT TOUJOURS ÊTRE COMPLÉTÉE (G16 et plan §3.13, sur la page du rendez-vous).
 *
 * Le signal « accord d'une personne non retrouvé » (posé par `precontroler`,
 * `deux-voix-client-exigent-deux-accords.spec.ts`) s'affiche en tête du
 * compte rendu, avec la case « Je confirme… » : sans elle, aucune validation
 * ne passe. Les preuves d'accord sont montrées en français. Et quand
 * plusieurs voix ont parlé côté client, chaque voix propose : une personne
 * présente, « Ajouter comme contact » (personne imprévue), ou « C'est ma
 * voix (écho) ».
 *
 * Mutations qui rougissent : ne plus afficher la carte du signal ; retirer le
 * formulaire « Ajouter comme contact » ou « C'est ma voix ». Contre-témoin :
 * sans signal, aucune case de confirmation ; une seule voix, pas de carte
 * « Qui a parlé ». Angle mort : l'action serveur elle-même (session,
 * redirection) n'est pas exécutée ici.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/dossier-client/actions-rencontres", () => ({
  gesteCompteRenduAction: async () => undefined,
}));

import { VueCompteRendu } from "@/components/admin/visio/VueCompteRendu";
import type { VueCompteRendu as Vue } from "@/features/dossier-client/compte-rendu";

const RENCONTRE = "00000000-0000-4000-8000-000000000001";
const LE = new Date("2026-10-06T11:00:00Z");

function vue(p: Partial<Vue> = {}): Vue {
  return {
    rencontre: {
      id: RENCONTRE,
      titre: "Échange",
      debut: LE,
      clientId: "c1",
      rattachementStatut: "valide",
    },
    courant: null,
    document: null,
    etat: null,
    versions: [],
    faits: [],
    voix: { voixClient: ["A"], nonAttribuees: [], attribueeA: { A: null }, participants: [] },
    accordAConfirmer: false,
    etapes: [],
    enregistrements: [],
    accords: [{ type: "declaration_axion", survenuLe: LE }],
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

describe("l'accord non retrouvé est affiché à Will", () => {
  it("le signal est affiché, avec la confirmation à la main ; les preuves sont en français", () => {
    const html = rendu(vue({ accordAConfirmer: true }));
    expect(html).toContain("Accord d&#x27;une personne non retrouvé");
    expect(html).toContain('value="confirmer_accord"');
    expect(html).toContain("Accord déclaré par vous");
  });

  it("plusieurs voix : chacune peut aller à une personne présente, à un nouveau contact, ou à Williams", () => {
    const html = rendu(
      vue({
        voix: {
          voixClient: ["A", "B"],
          nonAttribuees: ["B"],
          attribueeA: { A: "p1", B: null },
          participants: [{ id: "p1", nom: "Gérante Exemple", estWilliams: false }],
        },
      }),
    );
    expect(html).toContain("Qui a parlé côté client ?");
    expect(html).toContain("CLIENT_1 : Gérante Exemple");
    expect(html).toContain('value="voix_nouvelle_personne"');
    expect(html).toContain("Ajouter comme contact");
    expect(html).toContain('value="voix_williams"');
    expect(html).not.toContain("depuis « Après l&#x27;appel »");
  });

  it("contre-témoin : sans signal ni deuxième voix, ni case ni carte des voix", () => {
    const html = rendu(vue());
    expect(html).not.toContain("confirmer_accord");
    expect(html).not.toContain("Qui a parlé côté client ?");
  });
});
