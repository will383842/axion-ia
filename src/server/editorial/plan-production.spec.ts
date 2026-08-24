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
});
