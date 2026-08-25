/**
 * Console éditoriale — tests du plan de production en PDF.
 *
 * 🔑 Deux niveaux, parce qu'aucun des deux seul ne suffit :
 *
 *   - **l'arbre**, avant rendu — c'est là qu'on voit qu'un type commence bien
 *     sur une page neuve, et qu'un asset sans brief n'a pas disparu ;
 *   - **le binaire**, après rendu — c'est là, et LÀ SEULEMENT, qu'on voit un
 *     caractère mal imprimé. Un `%PDF` en tête de buffer n'a jamais prouvé
 *     qu'un document était lisible (leçon du 2026-07-26 : tout montant
 *     ≥ 1 000 € sortait « 1/440,00 € » sous 19 000 tests verts).
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { PlanProductionPdf, rendrePlanEnPdf, compterNonImprimables } from "./plan-production-pdf";
import {
  collectPdfText,
  collectPdfTextNormalized,
} from "@/server/qualiopi/documents/collect-pdf-text";
import type { AssetPlan } from "./plan-production";

function asset(p: Partial<AssetPlan> & { id: string; type: string }): AssetPlan {
  return {
    libelle: `Asset ${p.id}`,
    statut: "a_produire",
    datePost: null,
    heurePost: null,
    titrePost: null,
    responsable: null,
    post: null,
    segments: [],
    ...p,
  };
}

const CONTEXTE = { titre: "Plan de production — Carrousels", periode: "Période 2026-10" };

/** Compte les `<Page>` de l'arbre — les hôtes @react-pdf sont typés par chaîne. */
function compterPages(node: React.ReactNode): number {
  if (node === null || node === undefined || typeof node === "boolean") return 0;
  if (typeof node === "string" || typeof node === "number") return 0;
  if (Array.isArray(node)) return node.reduce<number>((n, e) => n + compterPages(e), 0);
  if (!React.isValidElement(node)) return 0;

  const element = node as React.ReactElement<Record<string, unknown>>;
  if (typeof element.type === "function") {
    const rendu = (element.type as (props: unknown) => React.ReactNode)(element.props);
    return compterPages(rendu);
  }
  const soi = element.type === "PAGE" ? 1 : 0;
  return soi + compterPages(element.props.children as React.ReactNode);
}

describe("PlanProductionPdf — la structure imprimable", () => {
  it("🔑 ouvre une PAGE NEUVE par type, en plus de la couverture", () => {
    // C'est tout l'intérêt du format : imprimer « les carrousels » sans
    // emporter la fin des vidéos. Sur un flux continu, la plage de pages
    // demandée couperait au milieu d'un asset.
    const pages = compterPages(
      <PlanProductionPdf
        assets={[
          asset({ id: "v1", type: "video" }),
          asset({ id: "c1", type: "carrousel" }),
          asset({ id: "c2", type: "carrousel" }),
        ]}
        contexte={CONTEXTE}
      />,
    );
    expect(pages).toBe(3); // couverture + vidéos + carrousels
  });

  it("n'ouvre PAS de page pour un type absent", () => {
    const pages = compterPages(
      <PlanProductionPdf assets={[asset({ id: "v1", type: "video" })]} contexte={CONTEXTE} />,
    );
    expect(pages).toBe(2);
  });

  it("🔴 sort un type INCONNU du référentiel au lieu de le faire disparaître", () => {
    // Un asset qu'aucune section n'accueille serait un travail à faire que
    // le plan ne montre pas — la pire des sorties silencieuses.
    const arbre = (
      <PlanProductionPdf
        assets={[asset({ id: "x", type: "podcast_live", libelle: "Live du jeudi" })]}
        contexte={CONTEXTE}
      />
    );
    expect(compterPages(arbre)).toBe(2);
    expect(collectPdfTextNormalized(arbre)).toContain("Live du jeudi");
  });

  it("rend une couverture seule quand il n'y a rien à produire", () => {
    const arbre = <PlanProductionPdf assets={[]} contexte={CONTEXTE} />;
    expect(compterPages(arbre)).toBe(1);
    expect(collectPdfTextNormalized(arbre)).toContain("Rien à produire");
  });
});

describe("PlanProductionPdf — ce que la feuille doit porter", () => {
  const arbre = (
    <PlanProductionPdf
      assets={[
        asset({
          id: "c1",
          type: "carrousel",
          libelle: "Carrousel — les 5 pièges de l'IA",
          datePost: "2026-10-12",
          heurePost: "09:00",
          titrePost: "Post du 12 octobre",
          segments: [
            {
              ordre: 1,
              role: "slide",
              titre: "Slide 1",
              contenu: "L'IA ne remplace pas l'humain",
              prompt: "fond ivoire, dégradé terracotta, aucun texte",
              fait: false,
            },
            {
              ordre: 2,
              role: "legende",
              titre: null,
              contenu: "Trois minutes pour comprendre.",
              prompt: null,
              fait: true,
            },
          ],
        }),
        asset({ id: "c2", type: "carrousel", libelle: "Carrousel sans brief" }),
      ]}
      contexte={{ ...CONTEXTE, avertissement: "Ce plan est TRONQUÉ." }}
    />
  );
  const texte = collectPdfTextNormalized(arbre);

  it("porte le libellé, l'échéance et le post attendu", () => {
    expect(texte).toContain("Carrousel — les 5 pièges de l'IA");
    expect(texte).toContain("12/10/2026");
    expect(texte).toContain("Post du 12 octobre");
  });

  it("porte le contenu ET le prompt de chaque segment", () => {
    expect(texte).toContain("L'IA ne remplace pas l'humain");
    expect(texte).toContain("fond ivoire, dégradé terracotta, aucun texte");
  });

  it("nomme le prompt d'une slide « Graphisme », et « Prompt » ailleurs", () => {
    // La règle du dossier : un prompt ne contient AUCUN texte à afficher.
    // Le libellé le rappelle à celui qui fabrique.
    expect(texte).toContain("Graphisme");
  });

  it("🔴 dit « aucun brief » au lieu de rendre un bloc vide", () => {
    expect(texte).toContain("Carrousel sans brief");
    expect(texte).toContain("Aucun brief importé");
  });

  it("🔴 imprime l'avertissement de troncature — un plan amputé doit le dire", () => {
    expect(texte).toContain("Attention");
    expect(texte).toContain("TRONQUÉ");
  });

  it("affiche l'avancement en clair, pas seulement une case cochée", () => {
    expect(texte).toContain("1 / 2");
  });
});

describe("PlanProductionPdf — les emoji retirés, le texte gardé", () => {
  // Le pendant du test binaire : celui-ci vérifie que RETIRER l'emoji n'a pas
  // emporté la phrase avec lui. Il se fait sur l'arbre, où le texte est exact.
  const FUSEE = "\u{1F680}";
  const DOIGT = "\u{1F447}";
  const arbre = (
    <PlanProductionPdf
      assets={[
        asset({
          id: "c1",
          type: "carrousel",
          libelle: "Carrousel du jeudi",
          titrePost: `Post du 3 octobre ${FUSEE}`,
          segments: [
            {
              ordre: 1,
              role: "legende",
              titre: null,
              contenu: `Réponse en 5 slides. ${DOIGT}`,
              prompt: null,
              fait: false,
            },
          ],
        }),
      ]}
      contexte={CONTEXTE}
    />
  );
  const texte = collectPdfTextNormalized(arbre);

  it("garde la phrase entière, sans son emoji", () => {
    expect(texte).toContain("Post du 3 octobre");
    expect(texte).toContain("Réponse en 5 slides.");
    expect(texte).not.toContain(FUSEE);
    expect(texte).not.toContain(DOIGT);
  });

  it("annonce le compte exact de ce qui a été retiré", () => {
    expect(texte).toContain("2 caractère(s) décoratif(s)");
  });
});

describe("PlanProductionPdf — les glyphes réellement imprimables", () => {
  /**
   * Codepoints qu'aucune des huit polices du dossier ne couvre. @react-pdf
   * bascule alors le fragment sur Helvetica WinAnsi et imprime l'octet de
   * poids faible : U+202F devient « / », U+2610 ne donne rien.
   *
   * ⚠️ On travaille sur le texte BRUT, jamais normalisé : `\s` matche U+202F
   * en JavaScript, et `collectPdfTextNormalized` l'écraserait avant toute
   * assertion. C'est exactement ce qui a rendu 19 000 tests aveugles.
   */
  const INTERDITS: ReadonlyArray<readonly [number, string]> = [
    [0x202f, "fine insécable"],
    [0x2009, "espace fine"],
    [0x2060, "gluon de mots"],
    [0x2610, "case à cocher vide"],
    [0x2713, "coche"],
  ];

  it("🔴 le gabarit n'écrit AUCUN glyphe absent des polices", () => {
    const brut = collectPdfText(
      <PlanProductionPdf
        assets={[
          asset({ id: "c1", type: "carrousel", datePost: "2026-10-12", heurePost: "09:00" }),
        ]}
        contexte={CONTEXTE}
      />,
    );
    const trouves = INTERDITS.filter(([cp]) => brut.includes(String.fromCodePoint(cp))).map(
      ([cp, nom]) => `U+${cp.toString(16).toUpperCase()} — ${nom}`,
    );
    expect(trouves).toEqual([]);
  });

  it("🔴 assainit la fine insécable VENUE DU CONTENU, pas seulement du gabarit", () => {
    // Un brief tapé dans un traitement de texte porte des U+202F. Sans
    // assainissement, chacune s'imprimerait « / » au milieu d'une phrase.
    // ⚠️ Le caractère est construit par ÉCHAPPEMENT, jamais collé : un
    // U+202F et une espace ordinaire sont indiscernables à la relecture, et
    // un test qu'on ne peut pas relire ne prouve rien.
    const FINE = String.fromCodePoint(0x202f);
    const brut = collectPdfText(
      <PlanProductionPdf
        assets={[
          asset({
            id: "c1",
            type: "carrousel",
            libelle: `Budget : 1${FINE}440${FINE}€`,
            segments: [
              {
                ordre: 1,
                role: "slide",
                titre: null,
                contenu: `Durée : 3${FINE}min`,
                prompt: `ratio 4${FINE}/${FINE}5`,
                fait: false,
              },
            ],
          }),
        ]}
        contexte={CONTEXTE}
      />,
    );
    expect(brut.includes(FINE)).toBe(false);
    // …et le texte n'a pas été perdu au passage : c'est le témoin négatif,
    // sans lequel « supprimer tout le contenu » passerait aussi.
    expect(brut.replace(/\s+/g, " ")).toContain("Budget : 1 440 €");
    expect(brut.replace(/\s+/g, " ")).toContain("Durée : 3 min");
  });
});

/**
 * Extrait le texte du PDF RENDU, page par page.
 *
 * ⚠️ L'extraction est APPROXIMATIVE, et c'est mesuré : pdfjs échoue parfois à
 * charger le sous-ensemble de police embarqué (« Cannot substitute the font
 * because of its name: QSJRRX+Manrope-Bold ») et remappe alors quelques
 * glyphes — on a vu « octobre » ressortir « octo8re » et « . » ressortir « / »
 * sur un document par ailleurs parfaitement imprimé.
 *
 * Les assertions faites sur ce texte restent donc GROSSIÈRES : présence d'un
 * témoin en capitales, chiffres de pagination, absence d'un artefact connu.
 * Le contenu fin se vérifie sur l'ARBRE, avant rendu, où rien n'est remappé.
 */
async function texteDuPdf(buffer: Buffer): Promise<string[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(doc, { mergePages: false });
  return (Array.isArray(text) ? text : [String(text)]).map((t) => t.replace(/\s+/g, " "));
}

describe("rendrePlanEnPdf — le binaire", () => {
  /**
   * 🔴 La garde du pied de page, et le seul test qui pouvait l'attraper.
   *
   * MESURÉ le 2026-08-25 : avec `lineHeight` sur le style de la `Page`,
   * @react-pdf jette le pied `fixed` EN ENTIER — périmètre et numéro de page —
   * dès qu'il contient un `<Text render={…}>`. Le composant est invoqué, ses
   * styles sont justes, rien ne throw : le texte n'arrive simplement jamais
   * dans le document.
   *
   * Aucun test d'arbre ne peut le voir : avant rendu, le pied EST là.
   * `expect(buffer[0..4]).toBe("%PDF-")` ne le voit pas non plus. Il faut
   * extraire le texte du binaire — c'est la leçon du « 1/440,00 € ».
   */
  it("🔴 répète le pied de page et sa pagination sur CHAQUE feuille", async () => {
    const buffer = await rendrePlanEnPdf(
      [asset({ id: "v1", type: "video" }), asset({ id: "c1", type: "carrousel" })],
      { titre: "PERIMETRE-TEMOIN", periode: "Période 2026-10" },
    );
    const pages = await texteDuPdf(buffer);
    expect(pages).toHaveLength(3); // couverture + vidéos + carrousels

    pages.forEach((texte, i) => {
      expect(texte, `page ${i + 1} sans son périmètre en pied`).toContain("PERIMETRE-TEMOIN");
      expect(texte, `page ${i + 1} sans sa pagination`).toContain(`${i + 1} / 3`);
    });
  }, 30_000);

  it("🔴 n'imprime aucun emoji en octets faux — il les retire et le DIT", async () => {
    const buffer = await rendrePlanEnPdf(
      [
        asset({
          id: "c1",
          type: "carrousel",
          libelle: "Carrousel du jeudi",
          titrePost: "Post du 3 octobre \u{1F680}",
          segments: [
            {
              ordre: 1,
              role: "legende",
              titre: null,
              contenu: "Réponse en 5 slides. \u{1F447}",
              prompt: null,
              fait: false,
            },
          ],
        }),
      ],
      CONTEXTE,
    );
    const texte = (await texteDuPdf(buffer)).join(" ");

    // Les octets faux réellement observés avant le correctif : U+1F680 sortait
    // « =€ » et U+1F447 sortait « =G ».
    expect(texte).not.toContain("=€");
    expect(texte).not.toContain("=G");
    // …et le retrait est ANNONCÉ, avec son compte. Le témoin est réduit à ce
    // que l'extraction rend fidèlement (chiffre + racine du mot).
    expect(texte).toMatch(/2 caract/);
  }, 30_000);

  it("rend un PDF non vide", async () => {
    const buffer = await rendrePlanEnPdf(
      [
        asset({
          id: "c1",
          type: "carrousel",
          libelle: "Carrousel de recette",
          datePost: "2026-10-12",
          segments: [
            {
              ordre: 1,
              role: "slide",
              titre: "Slide 1",
              contenu: "Trois idées reçues",
              prompt: "fond ivoire",
              fait: false,
            },
          ],
        }),
      ],
      CONTEXTE,
    );
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.byteLength).toBeGreaterThan(2000);
  }, 30_000);
});

describe("PlanProductionPdf — la copie du post sur la feuille", () => {
  const arbre = (
    <PlanProductionPdf
      assets={[
        asset({
          id: "c1",
          type: "carrousel",
          libelle: "Carrousel du jeudi",
          titrePost: "Post du 12",
          responsable: "Williams",
          post: {
            accroche: "Trois pièges de l'IA",
            corps: "Le premier est le plus coûteux.",
            premierCommentaire: "Le lien est en commentaire.",
            tags: ["ia", "formation"],
          },
        }),
      ]}
      contexte={CONTEXTE}
    />
  );
  const texte = collectPdfTextNormalized(arbre);

  it("🔑 imprime le TEXTE du post, pas seulement son titre interne", () => {
    // C'est le manque de la première version : il fallait rouvrir la console
    // pour savoir de quoi le visuel qu'on fabrique parle.
    expect(texte).toContain("Le post qui accompagne ce visuel");
    expect(texte).toContain("Trois pièges de l'IA");
    expect(texte).toContain("Le premier est le plus coûteux.");
    expect(texte).toContain("Le lien est en commentaire.");
    expect(texte).toContain("#ia #formation");
  });

  it("nomme le responsable", () => {
    expect(texte).toContain("Williams");
  });

  it("🔴 écrit « non attribué » quand personne n'est désigné", () => {
    const sans = collectPdfTextNormalized(
      <PlanProductionPdf assets={[asset({ id: "x", type: "image" })]} contexte={CONTEXTE} />,
    );
    expect(sans).toContain("non attribué");
  });

  it("🔴 SIGNALE un post rattaché dont la copie est vide", () => {
    const vide = collectPdfTextNormalized(
      <PlanProductionPdf
        assets={[asset({ id: "x", type: "image", titrePost: "Post du 12", post: null })]}
        contexte={CONTEXTE}
      />,
    );
    expect(vide).toContain("Aucun texte rédigé pour ce post.");
  });

  it("ne signale RIEN pour un asset rattaché à aucun post", () => {
    const orphelin = collectPdfTextNormalized(
      <PlanProductionPdf assets={[asset({ id: "x", type: "image" })]} contexte={CONTEXTE} />,
    );
    expect(orphelin).not.toContain("Aucun texte rédigé");
  });
});

describe("compterNonImprimables — le compte doit couvrir la COPIE", () => {
  it("🔴 compte les emoji du corps du post, pas seulement ceux du brief", () => {
    // Le corps d'un post LinkedIn porte plus d'emoji que tout le reste de la
    // feuille réuni. Un compte qui l'ignore annonce « 2 retirés » sur un
    // document qui en a perdu quarante — et un compte faux est pire qu'une
    // absence de compte : il fait croire qu'on a vérifié.
    const n = compterNonImprimables([
      asset({
        id: "c1",
        type: "carrousel",
        post: {
          accroche: "Trois pièges \u{1F680}",
          corps: "Le corps \u{1F447} et encore \u{1F525}",
          premierCommentaire: null,
          tags: [],
        },
      }),
    ]);
    expect(n).toBe(3);
  });

  it("compte ZÉRO sur une copie sans emoji — le témoin négatif", () => {
    // Sans lui, une fonction qui renverrait toujours 3 passerait le test
    // précédent.
    const n = compterNonImprimables([
      asset({
        id: "c1",
        type: "carrousel",
        post: { accroche: "Trois pièges", corps: "Le corps", premierCommentaire: null, tags: [] },
      }),
    ]);
    expect(n).toBe(0);
  });
});
