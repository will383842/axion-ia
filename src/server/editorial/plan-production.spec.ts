/**
 * Console éditoriale — tests du plan de production.
 *
 * 🔑 Même règle que partout ici : « le test qui compte est celui du cas
 * refusé ». Pour un export, le cas refusé est celui où une donnée DISPARAÎT
 * sans bruit — un asset sans brief qu'on oublierait de sortir, une slide
 * aplatie avec ses voisines, un prompt collé au texte qu'il ne doit pas
 * contenir.
 */

import { describe, it, expect } from "vitest";
import {
  trierPourProduction,
  construireMarkdown,
  construireCsvPlan,
  nomFichierPlan,
  avancement,
  partsDuPost,
  formaterTags,
  SANS_RESPONSABLE,
  COLONNES_PLAN,
  type AssetPlan,
} from "./plan-production";

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

describe("trierPourProduction", () => {
  it("groupe par type avant de trier par date", () => {
    // C'est le geste de la journée qui commande : on ne tourne pas une vidéo
    // et on ne monte pas un carrousel dans la même séance.
    const tries = trierPourProduction([
      asset({ id: "c", type: "carrousel", datePost: "2026-09-01" }),
      asset({ id: "v", type: "video", datePost: "2026-12-01" }),
    ]);
    expect(tries.map((a) => a.id)).toEqual(["v", "c"]);
  });

  it("à type égal, trie par échéance croissante", () => {
    const tries = trierPourProduction([
      asset({ id: "tard", type: "video", datePost: "2026-11-20" }),
      asset({ id: "tot", type: "video", datePost: "2026-09-02" }),
    ]);
    expect(tries.map((a) => a.id)).toEqual(["tot", "tard"]);
  });

  it("🔴 relègue en DERNIER un asset sans date, au lieu de le faire remonter", () => {
    // Une chaîne vide se trie avant « 2026-… ». Sans garde explicite, l'asset
    // sans échéance passerait devant celui qui part demain.
    const tries = trierPourProduction([
      asset({ id: "sans", type: "video", datePost: null }),
      asset({ id: "avec", type: "video", datePost: "2026-09-02" }),
    ]);
    expect(tries.map((a) => a.id)).toEqual(["avec", "sans"]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const entree = [asset({ id: "b", type: "carrousel" }), asset({ id: "a", type: "video" })];
    trierPourProduction(entree);
    expect(entree.map((a) => a.id)).toEqual(["b", "a"]);
  });
});

describe("avancement", () => {
  it("compte les segments faits sur le total", () => {
    const a = asset({
      id: "x",
      type: "carrousel",
      segments: [
        { ordre: 1, role: "slide", titre: null, contenu: "a", prompt: null, fait: true },
        { ordre: 2, role: "slide", titre: null, contenu: "b", prompt: null, fait: false },
      ],
    });
    expect(avancement(a)).toEqual({ faits: 1, total: 2 });
  });
});

describe("construireMarkdown", () => {
  const carrousel = asset({
    id: "c1",
    type: "carrousel",
    libelle: "Production carrousel 1",
    datePost: "2026-09-05",
    heurePost: "09:30",
    titrePost: "On te dit que tu es en retard",
    segments: [
      {
        ordre: 0,
        role: "legende",
        titre: "Légende du post",
        contenu: "La légende.",
        prompt: null,
        fait: false,
      },
      {
        ordre: 1,
        role: "slide",
        titre: "Slide 1",
        contenu: "TU N'ES PAS EN RETARD.",
        prompt: "Silhouette de dos face à un mur de câbles",
        fait: true,
      },
    ],
  });

  it("met la date en tête, au format français", () => {
    expect(construireMarkdown([carrousel], { titre: "T", periode: "P" })).toContain(
      "## 05/09/2026 09:30 — Production carrousel 1",
    );
  });

  it("ouvre sur un sommaire qui compte chaque type", () => {
    // C'est lui qui permet de décider « je fais les carrousels aujourd'hui »
    // AVANT d'avoir lu les cent pages qui suivent.
    const md = construireMarkdown([carrousel], { titre: "T", periode: "P" });
    expect(md).toMatch(/\| Carrousels \| 1 \| 2 \| 1 \|/);
  });

  it("coche les segments faits, en Markdown cochable", () => {
    const md = construireMarkdown([carrousel], { titre: "T", periode: "P" });
    expect(md).toContain("### [x] Slide — Slide 1");
    expect(md).toContain("### [ ] Légende du post — Légende du post");
  });

  it("🔴 isole le prompt dans son propre bloc encadré", () => {
    // Un prompt se colle tel quel : une espace avalée change l'image. Et il
    // ne partage jamais son bloc avec le texte de la slide — la règle du
    // dossier est qu'un prompt ne contient AUCUN texte à afficher.
    const md = construireMarkdown([carrousel], { titre: "T", periode: "P" });
    const bloc = md.match(/```\n([\s\S]*?)\n```/);
    expect(bloc?.[1]).toBe("Silhouette de dos face à un mur de câbles");
    expect(bloc?.[1]).not.toContain("TU N'ES PAS EN RETARD");
  });

  it("🔴 signale un asset SANS brief au lieu de le taire", () => {
    // « rien à faire » et « rien d'importé » sont deux situations opposées.
    // Un asset muet dans le plan se lit comme la première.
    const md = construireMarkdown([asset({ id: "nu", type: "image" })], {
      titre: "T",
      periode: "P",
    });
    expect(md).toContain("Aucun brief importé pour cet asset.");
  });

  it("dit clairement quand il n'y a rien, plutôt que de rendre une page vide", () => {
    expect(construireMarkdown([], { titre: "T", periode: "P" })).toContain(
      "Rien à produire sur ce périmètre.",
    );
  });
});

describe("construireCsvPlan", () => {
  const carrousel = asset({
    id: "c1",
    type: "carrousel",
    libelle: "Carrousel 1",
    datePost: "2026-09-05",
    segments: [
      {
        ordre: 1,
        role: "slide",
        titre: "Slide 1",
        contenu: "Texte 1",
        prompt: "Graph 1",
        fait: false,
      },
      {
        ordre: 2,
        role: "slide",
        titre: "Slide 2",
        contenu: "Texte 2",
        prompt: "Graph 2",
        fait: true,
      },
    ],
  });

  it("🔴 rend une ligne par SEGMENT, pas par asset", () => {
    // Aplati sur une ligne, un carrousel de dix slides n'offre rien à cocher.
    const lignes = construireCsvPlan([carrousel]).trim().split("\r\n");
    expect(lignes).toHaveLength(3); // en-tête + 2 slides
    expect(lignes[0]).toBe(COLONNES_PLAN.join(";"));
  });

  it("🔴 garde une ligne pour un asset sans brief", () => {
    // Sans elle, l'asset disparaîtrait du plan — et « rien à faire » se
    // confondrait avec « rien d'importé ».
    const lignes = construireCsvPlan([asset({ id: "nu", type: "image", libelle: "Nu" })])
      .trim()
      .split("\r\n");
    expect(lignes).toHaveLength(2);
    expect(lignes[1]).toContain("Nu");
  });

  it("ouvre par un BOM et sépare par CRLF, pour qu'Excel lise l'UTF-8", () => {
    const csv = construireCsvPlan([carrousel]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("\r\n");
  });

  it("🔴 neutralise une cellule qui commencerait par « = »", () => {
    // Une injection de formule dans un tableur : le CSV d'export mensuel s'en
    // garde déjà, celui-ci passe par la même fonction et doit s'en garder aussi.
    const piege = asset({
      id: "p",
      type: "image",
      libelle: "=1+1",
      segments: [
        { ordre: 1, role: "prompt", titre: null, contenu: null, prompt: "=SOMME(A1)", fait: false },
      ],
    });
    const csv = construireCsvPlan([piege]);
    expect(csv).not.toMatch(/;=1\+1;/);
    expect(csv).not.toMatch(/;=SOMME/);
  });
});

describe("nomFichierPlan", () => {
  it("produit un nom lisible, triable et sans accent", () => {
    expect(nomFichierPlan("carrousel", "2026-10", "md")).toBe(
      "plan-production-carrousel-2026-10.md",
    );
  });

  it("aplanit ce qui casserait un nom de fichier", () => {
    expect(nomFichierPlan("Vidéos courtes", "tout", "csv")).toBe(
      "plan-production-videos-courtes-tout.csv",
    );
  });

  it("nomme aussi le PDF, celui qu'on imprime", () => {
    expect(nomFichierPlan("carrousel", "2026-10", "pdf")).toBe(
      "plan-production-carrousel-2026-10.pdf",
    );
  });

  it("🔴 marque la troncature DANS LE NOM — le seul avertissement qu'un CSV porte", () => {
    // Une ligne de commentaire casserait le tableur ; le nom, lui, survit au
    // téléchargement, au classement et à la réouverture six mois plus tard.
    expect(nomFichierPlan("carrousel", "tout", "csv", true)).toBe(
      "plan-production-carrousel-tout-tronque.csv",
    );
    expect(nomFichierPlan("carrousel", "tout", "csv", false)).toBe(
      "plan-production-carrousel-tout.csv",
    );
  });
});

describe("construireMarkdown — l'avertissement", () => {
  it("🔴 imprime l'avertissement en tête, avant la première section", () => {
    const md = construireMarkdown([asset({ id: "a", type: "video" })], {
      titre: "Plan",
      periode: "Toutes périodes",
      avertissement: "Ce plan est TRONQUÉ.",
    });
    expect(md).toContain("Ce plan est TRONQUÉ.");
    // Avant le premier titre de section : un avertissement placé après les
    // cent pages du plan n'avertit personne.
    expect(md.indexOf("Ce plan est TRONQUÉ.")).toBeLessThan(md.indexOf("# Vidéos"));
  });

  it("n'écrit RIEN quand il n'y a rien à signaler", () => {
    const md = construireMarkdown([asset({ id: "a", type: "video" })], {
      titre: "Plan",
      periode: "Toutes périodes",
    });
    // Le témoin négatif : sans lui, un avertissement toujours vide passerait.
    expect(md).not.toContain("⚠️");
  });
});

describe("partsDuPost — la copie du post", () => {
  const post = {
    accroche: "Trois pièges de l'IA",
    corps: "Le premier est le plus coûteux.",
    premierCommentaire: "Le lien est ici.",
    tags: ["ia", "formation"],
  };

  it("rend les parts dans l'ordre de lecture", () => {
    expect(partsDuPost(post).map((p) => p.libelle)).toEqual([
      "Accroche",
      "Corps du post",
      "Premier commentaire",
      "Tags",
    ]);
  });

  it("🔴 ÉCARTE les champs vides au lieu d'imprimer un intitulé suivi de rien", () => {
    const parts = partsDuPost({ ...post, corps: null, premierCommentaire: "" });
    expect(parts.map((p) => p.libelle)).toEqual(["Accroche", "Tags"]);
  });

  it("🔴 traite une chaîne d'ESPACES comme vide", () => {
    // Un champ « rempli » d'une espace est un champ vide qui ne se voit pas.
    const parts = partsDuPost({ ...post, accroche: "   \n  ", corps: null, tags: [] });
    expect(parts.map((p) => p.libelle)).toEqual(["Premier commentaire"]);
  });

  it("rend une liste VIDE quand l'asset n'est rattaché à aucun post", () => {
    // Distinct d'un post rattaché mais non rédigé — que l'appelant signale.
    expect(partsDuPost(null)).toEqual([]);
  });

  it("préfixe les tags d'un croisillon, une seule fois", () => {
    expect(partsDuPost(post).at(-1)?.texte).toBe("#ia #formation");
  });
});

describe("formaterTags", () => {
  it("🔴 écarte les tags vides plutôt que d'écrire un croisillon seul", () => {
    expect(formaterTags(["ia", "", "  ", "formation"])).toBe("#ia #formation");
  });

  it("rend une chaîne vide sur une liste vide, jamais un croisillon orphelin", () => {
    expect(formaterTags([])).toBe("");
  });
});

describe("construireMarkdown — la copie et le responsable", () => {
  const avecPost = asset({
    id: "c1",
    type: "carrousel",
    libelle: "Carrousel",
    titrePost: "Post du 12",
    responsable: "Williams",
    post: {
      accroche: "Trois pièges",
      corps: "Ligne une\nLigne deux",
      premierCommentaire: null,
      tags: ["ia"],
    },
  });

  it("🔑 porte le TEXTE du post, pas seulement son titre interne", () => {
    const md = construireMarkdown([avecPost], { titre: "T", periode: "P" });
    expect(md).toContain("Le post qui accompagne ce visuel");
    expect(md).toContain("Trois pièges");
    expect(md).toContain("Ligne une");
    expect(md).toContain("#ia");
  });

  it("🔴 préfixe CHAQUE ligne du corps — sinon la citation se referme à la première", () => {
    const md = construireMarkdown([avecPost], { titre: "T", periode: "P" });
    expect(md).toContain("> Ligne une");
    expect(md).toContain("> Ligne deux");
  });

  it("nomme le responsable", () => {
    expect(construireMarkdown([avecPost], { titre: "T", periode: "P" })).toContain(
      "*Responsable :* Williams",
    );
  });

  it("🔴 ÉCRIT « non attribué » au lieu de laisser un blanc", () => {
    // Un blanc se lit comme un oubli d'impression ; ces mots se lisent comme
    // une ligne à attribuer.
    const md = construireMarkdown([asset({ id: "x", type: "image" })], {
      titre: "T",
      periode: "P",
    });
    expect(md).toContain(`*Responsable :* ${SANS_RESPONSABLE}`);
  });

  it("🔴 SIGNALE un post rattaché dont la copie est vide", () => {
    // On s'apprête à fabriquer le visuel d'un texte qui n'existe pas encore.
    const md = construireMarkdown(
      [asset({ id: "x", type: "image", titrePost: "Post du 12", post: null })],
      { titre: "T", periode: "P" },
    );
    expect(md).toContain("Aucun texte rédigé pour ce post.");
  });

  it("ne signale RIEN pour un asset rattaché à aucun post", () => {
    // Son absence d'échéance le dit déjà ; l'avertir serait du bruit.
    const md = construireMarkdown([asset({ id: "x", type: "image" })], {
      titre: "T",
      periode: "P",
    });
    expect(md).not.toContain("Aucun texte rédigé");
  });
});

describe("construireCsvPlan — les colonnes de la copie", () => {
  it("🔴 ajoute les nouvelles colonnes EN FIN, sans décaler les anciennes", () => {
    // Une colonne insérée au milieu ferait lire les prompts dans la colonne
    // des statuts à toute feuille de suivi déjà ouverte.
    expect(COLONNES_PLAN.slice(0, 12)).toEqual([
      "date_post",
      "heure_post",
      "type",
      "asset",
      "statut_asset",
      "rang",
      "role",
      "titre",
      "contenu",
      "prompt",
      "fait",
      "titre_post",
    ]);
    expect(COLONNES_PLAN.slice(12)).toEqual([
      "responsable",
      "accroche",
      "corps",
      "premier_commentaire",
      "tags",
    ]);
  });

  it("porte la copie et le responsable sur chaque ligne de segment", () => {
    const csv = construireCsvPlan([
      asset({
        id: "c1",
        type: "carrousel",
        responsable: "Williams",
        post: {
          accroche: "Trois pièges",
          corps: "Le corps",
          premierCommentaire: "Le lien",
          tags: ["ia", "formation"],
        },
        segments: [
          { ordre: 1, role: "slide", titre: null, contenu: null, prompt: null, fait: false },
        ],
      }),
    ]);
    expect(csv).toContain("Williams");
    expect(csv).toContain("Trois pièges");
    expect(csv).toContain("#ia #formation");
  });

  it("laisse les cellules VIDES quand il n'y a pas de post, sans écrire « null »", () => {
    const csv = construireCsvPlan([asset({ id: "nu", type: "image", libelle: "Nu" })]);
    expect(csv).not.toContain("null");
    expect(csv).not.toContain("undefined");
  });
});
