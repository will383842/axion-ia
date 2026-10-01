/**
 * Le mode auditeur DIT, à l'écran, ce que le manifeste porte : le motif d'un
 * indicateur non applicable, le régime de l'audit initial, les pages du site
 * public, et le renvoi calculé de l'indicateur 22. Audit initial, 2026-10-01.
 *
 * Rendu statique (Server Component pur, 0 JS client).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { IndicateurManifeste } from "@/server/qualiopi/conformite/audit-dossier";
import { MOTIFS_NON_APPLICABLE } from "@/server/qualiopi/conformite/indicateurs-registre";
import { MENTION_AUDIT_INITIAL } from "@/server/qualiopi/conformite/reperes-audit-initial";

import { MatriceIndicateurs, type MatriceVue } from "./MatriceIndicateurs";

function indicateur(
  partiel: Partial<IndicateurManifeste> & { numero: number },
): IndicateurManifeste {
  return {
    critere: 1,
    libelle: `Libellé officiel ${partiel.numero}`,
    super: false,
    statut: "a_completer",
    preuves: [],
    documents: [],
    ...partiel,
  };
}

const INDICATEURS: IndicateurManifeste[] = [
  indicateur({
    numero: 1,
    liensPublics: [
      { url: "https://axion-ia.com/fr/formations", libelle: "Catalogue public des formations" },
    ],
  }),
  indicateur({ numero: 2, reperes: [MENTION_AUDIT_INITIAL] }),
  indicateur({
    numero: 3,
    statut: "non_applicable",
    motifNonApplicable: MOTIFS_NON_APPLICABLE.cert,
  }),
  indicateur({
    numero: 22,
    critere: 5,
    super: true,
    ouVerifier: [
      {
        chemin: "/qualiopi/formateurs/abc#developpement-competences",
        libelle: "Actions de développement des compétences, datées — fiche de Ada Lovelace",
      },
    ],
  }),
];

function rendre(vue: MatriceVue): string {
  return renderToStaticMarkup(
    <MatriceIndicateurs indicateurs={INDICATEURS} vue={vue} baseHref="/fr/console" />,
  );
}

describe.each<MatriceVue>(["tableau", "manifeste"])("MatriceIndicateurs — vue %s", (vue) => {
  it("dit le MOTIF d'un indicateur non applicable", () => {
    expect(rendre(vue)).toContain(
      `Non applicable — ${MOTIFS_NON_APPLICABLE.cert.replace(/'/g, "&#x27;")}`,
    );
  });

  it("affiche le régime de l'audit initial à côté de l'indicateur", () => {
    expect(rendre(vue)).toContain(
      "vérifie à l&#x27;audit initial que le processus est défini et formalisé",
    );
  });

  it("ouvre le site public dans un nouvel onglet, en lien absolu", () => {
    const html = rendre(vue);
    expect(html).toMatch(
      /<a href="https:\/\/axion-ia\.com\/fr\/formations" target="_blank" rel="noopener noreferrer"/,
    );
  });

  it("indicateur 22 : le renvoi calculé mène à la section de la fiche", () => {
    expect(rendre(vue)).toContain(
      'href="/fr/console/qualiopi/formateurs/abc#developpement-competences"',
    );
  });
});

describe("MatriceIndicateurs — l'étoile d'une ligne garde sa couleur et sa marge", () => {
  // 🔴 2026-10-01 — `ml-1text-[…]` : une espace perdue fondait les deux classes
  // en une seule, inconnue de Tailwind. L'étoile perdait couleur et marge sur
  // chaque ligne de l'écran du certificateur.
  it.each<MatriceVue>(["tableau", "manifeste"])("vue %s", (vue) => {
    const html = rendre(vue);
    const etoiles = [...html.matchAll(/<span title="[^"]*" role="img" class="([^"]*)"/g)].map((m) =>
      (m[1] ?? "").split(" "),
    );
    // Au moins l'étoile de la ligne 22 (super) et celle de la légende.
    expect(etoiles.length).toBeGreaterThanOrEqual(2);
    const ligne = etoiles.find((classes) => classes.includes("ml-1"));
    expect(ligne).toEqual(["ml-1", "text-[color:var(--color-admin-destructive)]"]);
    for (const classes of etoiles) {
      expect(classes).toContain("text-[color:var(--color-admin-destructive)]");
    }
  });
});

describe("MatriceIndicateurs — aucun jargon interne devant le certificateur", () => {
  it.each<MatriceVue>(["tableau", "manifeste"])(
    "vue %s : ni « NC », ni « OF », ni « off.N », ni « Indicateur super »",
    (vue) => {
      const texte = rendre(vue).replace(/<[^>]+>/g, " ");
      const attributs = rendre(vue).match(/(?:title|aria-label)="[^"]*"/g) ?? [];
      for (const morceau of [texte, ...attributs]) {
        expect(morceau).not.toMatch(/\bNC\b|\bOF\b|\boff\.\d|Indicateur super/);
      }
    },
  );

  it("la légende dit le sens de l'étoile en clair, sans « = » orphelin", () => {
    const html = rendre("tableau");
    expect(html).toContain("Indicateur dont la non-couverture est une non-conformité majeure");
    expect(html.replace(/<[^>]+>/g, "")).not.toMatch(/(^|\s)=\s*Indicateur/);
  });
});
