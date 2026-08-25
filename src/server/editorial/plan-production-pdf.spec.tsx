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
import {
  PlanProductionPdf,
  rendrePlanEnPdf,
  compterNonImprimables,
  styles,
} from "./plan-production-pdf";
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
 * Les `<Page>` de l'arbre, sous-arbres dépliés.
 *
 * Même marche que `compterPages` : les composants fonction sont INVOQUÉS, car
 * `Pied` en est un et son contenu n'existe pas avant l'appel.
 */
function deplier(node: React.ReactNode): React.ReactElement[] {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") return [];
  if (Array.isArray(node)) return node.flatMap(deplier);
  if (!React.isValidElement(node)) return [];

  const element = node as React.ReactElement<Record<string, unknown>>;
  if (typeof element.type === "function") {
    const rendu = (element.type as (props: unknown) => React.ReactNode)(element.props);
    return deplier(rendu);
  }
  return [element, ...deplier(element.props.children as React.ReactNode)];
}

/** Vrai si le sous-arbre porte un bloc `fixed` contenant un texte paginé. */
function aUnPiedPagine(node: React.ReactNode): boolean {
  const elements = deplier(node);
  return elements.some(
    (e) =>
      (e.props as Record<string, unknown>).fixed === true &&
      deplier((e.props as Record<string, unknown>).children as React.ReactNode).some(
        (enfant) => typeof (enfant.props as Record<string, unknown>).render === "function",
      ),
  );
}

describe("PlanProductionPdf — le pied répété, sous garde", () => {
  /**
   * 🔴 La régression visée, et pourquoi elle se garde AINSI.
   *
   * MESURÉ le 2026-08-25 : avec un `lineHeight` sur le style de la `Page`,
   * @react-pdf jette le pied `fixed` EN ENTIER — périmètre et pagination —
   * dès qu'il contient un `<Text render={…}>`. Le composant est invoqué, ses
   * styles sont justes, rien ne throw : le texte n'arrive simplement jamais
   * dans le document produit.
   *
   * ⚠️ Ce défaut ne se voit NI sur l'arbre (le pied y est), NI sur un
   * `expect(buffer).toStartWith("%PDF-")`. La première version de ce test
   * extrayait donc le texte du binaire avec pdfjs — et c'était un mauvais
   * instrument : sur un runner CI **sans polices système**, pdfjs ne sait
   * substituer aucune des huit polices sous-ensemblées du document et rend un
   * texte VIDE. Le test rougissait sur un PDF parfaitement imprimé. Un
   * instrument qui ne mesure pas là où il tourne ne garde rien : il bloque.
   *
   * Deux gardes déterministes le remplacent, qui tiennent partout :
   *   1. le style de `Page` ne porte AUCUN `lineHeight` — la cause exacte ;
   *   2. chaque `<Page>` porte bien un pied `fixed` avec un texte paginé.
   *
   * Elles ne prouvent pas que l'encre arrive sur la feuille. Elles verrouillent
   * la cause connue et la structure — et elles le disent, au lieu de laisser
   * croire à une vérification de bout en bout qui n'a jamais tourné en CI.
   */
  it("🔴 le style de Page ne porte AUCUN lineHeight", () => {
    expect(styles.page).not.toHaveProperty("lineHeight");
  });

  it("l'interligne est bien porté par les styles de TEXTE — témoin négatif", () => {
    // Sans lui, supprimer tout `lineHeight` du fichier passerait aussi.
    expect(styles.sousTitre).toHaveProperty("lineHeight");
    expect(styles.segmentTexte).toHaveProperty("lineHeight");
  });

  it("🔴 CHAQUE page porte un pied fixe avec sa pagination", () => {
    const arbre = (
      <PlanProductionPdf
        assets={[asset({ id: "v1", type: "video" }), asset({ id: "c1", type: "carrousel" })]}
        contexte={CONTEXTE}
      />
    );
    const pages = deplier(arbre).filter((e) => e.type === "PAGE");
    expect(pages).toHaveLength(3); // couverture + vidéos + carrousels
    pages.forEach((page, i) => {
      expect(aUnPiedPagine(page), `page ${i + 1} sans son pied paginé`).toBe(true);
    });
  });

  it("porte le périmètre du plan dans le pied — une feuille détachée le dit encore", () => {
    const texte = collectPdfTextNormalized(
      <PlanProductionPdf
        assets={[asset({ id: "v1", type: "video" })]}
        contexte={{ titre: "PERIMETRE-TEMOIN", periode: "Période 2026-10" }}
      />,
    );
    expect(texte).toContain("PERIMETRE-TEMOIN");
  });
});

describe("rendrePlanEnPdf — le binaire", () => {
  /**
   * Ce qui reste vérifié sur le document RENDU.
   *
   * Volontairement grossier, et c'est la leçon apprise plus haut : tout ce qui
   * demande de DÉCODER les polices embarquées dépend de l'environnement. Le
   * nombre de pages, lui, se lit dans la structure du PDF et tient partout.
   */
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

  it("🔑 ouvre bien une page par type DANS LE DOCUMENT PRODUIT, pas seulement dans l'arbre", async () => {
    // Le découpage par type est la raison d'être du format : il se vérifie sur
    // le PDF réel. La pagination se lit sans toucher aux polices.
    const buffer = await rendrePlanEnPdf(
      [asset({ id: "v1", type: "video" }), asset({ id: "c1", type: "carrousel" })],
      CONTEXTE,
    );
    const { getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(new Uint8Array(buffer));
    expect(doc.numPages).toBe(3);
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
