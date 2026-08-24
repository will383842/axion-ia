/**
 * Console éditoriale — tests de l'analyse de la couche production.
 *
 * 🔑 Même règle que pour `linkedin-q4.spec.ts` : « le test qui compte est
 * celui du cas refusé ». Chaque lecteur a donc son cas où il NE doit PAS
 * ramasser quelque chose — et le plus important de tous est le prompt périmé,
 * que le dossier marque « NE PAS UTILISER ».
 */

import { describe, it, expect } from "vitest";
import {
  lireVideos,
  lireCarrousels,
  lireImages,
  lirePhotos,
  premierBlocEncadre,
  refSegment,
  lireSeries,
  slugSerie,
} from "./production-q4";

describe("premierBlocEncadre", () => {
  it("rend le contenu du bloc, sans les délimiteurs", () => {
    expect(premierBlocEncadre("avant\n```\nle texte\n```\naprès")).toBe("le texte");
  });

  it("rend null quand il n'y a pas de bloc", () => {
    expect(premierBlocEncadre("juste de la prose")).toBeNull();
  });
});

describe("lireVideos", () => {
  const md = [
    "# 🎬 VIDÉO 1 — POST #7 — **Mardi 1er septembre, 7 h 45**",
    "## Manifeste · **R2 plan-séquence**",
    "",
    "### 🎯 HOOK — 3 secondes",
    "",
    "Tu marches vers la caméra.",
    "",
    "### Production",
    "",
    "Registre R2, extérieur, fin de journée.",
    "",
    "### Script — trame problème → solution",
    "",
    "Le texte que tu dis face caméra.",
    "",
    "### Montage",
    "",
    "Insert B-roll à 0:18.",
    "",
  ].join("\n");

  it("se cale sur le numéro de POST, pas sur celui de la vidéo", () => {
    // La numérotation des vidéos est interne au dossier de tournage. C'est le
    // post qui existe au calendrier — s'indexer sur « vidéo 1 » rattacherait
    // le script au mauvais jour.
    const briefs = lireVideos(md);
    expect(briefs).toHaveLength(1);
    expect(briefs[0]!.numeroPost).toBe(7);
  });

  it("🔴 ne classe en `script` QUE le script", () => {
    // Le piège : tout passer en script ferait lire à voix haute des
    // indications de cadrage et de montage.
    const roles = lireVideos(md)[0]!.segments.map((s) => `${s.titre} → ${s.role}`);
    expect(roles).toEqual([
      "HOOK — 3 secondes → consigne",
      "Production → consigne",
      "Script — trame problème → solution → script",
      "Montage → consigne",
    ]);
  });

  it("vise l'asset de production, jamais la photo", () => {
    expect(lireVideos(md)[0]!.cible).toBe("production");
  });

  it("rend une liste vide sur un fichier sans section vidéo", () => {
    expect(lireVideos("# Doctrine\n\nDu texte.\n")).toEqual([]);
  });
});

describe("lireCarrousels", () => {
  const md = [
    "# 🎠 CARROUSEL 1 — POST #3 — Samedi 5 septembre",
    "## « Tu n'es pas en retard » — 8 slides",
    "",
    "### Légende du post",
    "",
    "```",
    "On te dit que tu es en retard.",
    "",
    "Swipe : les 6 raisons. 👇",
    "```",
    "",
    "### Slides",
    "",
    "| # | Texte exact | Graphisme |",
    "|---|---|---|",
    "| **1** | « TU N'ES PAS EN RETARD. » | Silhouette de dos face à un mur de câbles |",
    "| **2** | [pill] Raison n°1 · « Il sort un outil par semaine. » | Fond mocha, pill terracotta |",
    "| **3** | « Aucune n'est une excuse. » | **Rupture** : photo réelle, overlay 60 % |",
    "",
  ].join("\n");

  it("rend une slide par ligne de tableau, numérotée comme la slide", () => {
    const slides = lireCarrousels(md)[0]!.segments.filter((s) => s.role === "slide");
    expect(slides.map((s) => s.ordre)).toEqual([1, 2, 3]);
    expect(slides[0]!.titre).toBe("Slide 1");
  });

  it("🔴 sépare le TEXTE de la slide de sa consigne de GRAPHISME", () => {
    // Les mélanger fait coller la consigne de fabrication dans le visuel, ou
    // le texte dans le générateur. Deux colonnes, deux champs.
    const slide1 = lireCarrousels(md)[0]!.segments.find((s) => s.ordre === 1 && s.role === "slide");
    expect(slide1!.contenu).toBe("« TU N'ES PAS EN RETARD. »");
    expect(slide1!.prompt).toBe("Silhouette de dos face à un mur de câbles");
  });

  it("prend la légende dans son bloc encadré", () => {
    const legende = lireCarrousels(md)[0]!.segments.find((s) => s.role === "legende");
    expect(legende!.contenu).toBe("On te dit que tu es en retard.\n\nSwipe : les 6 raisons. 👇");
  });

  it("🔴 la légende ne prend PAS le rang de la slide 1", () => {
    // Défaut trouvé au premier import réel : la légende et la slide 1
    // portaient toutes deux le rang 1, donc la MÊME référence d'idempotence.
    // Sept slides d'accroche — celles qui déclenchent le swipe — ont été
    // refusées en silence comme doublons.
    const segments = lireCarrousels(md)[0]!.segments;
    const rangs = segments.map((s) => refSegment("carrousels", 3, s.ordre));
    expect(new Set(rangs).size, `rangs en double : ${rangs.join(", ")}`).toBe(rangs.length);

    const legende = segments.find((s) => s.role === "legende");
    expect(legende!.ordre).toBe(0);
    expect(segments.filter((s) => s.ordre === 1)).toHaveLength(1);
  });

  it("🔴 ne prend PAS la ligne de séparation du tableau pour une slide", () => {
    // `|---|---|---|` n'a pas de `**N**` en première cellule : elle doit
    // rester dehors, sinon chaque carrousel gagne une slide fantôme.
    const slides = lireCarrousels(md)[0]!.segments.filter((s) => s.role === "slide");
    expect(slides).toHaveLength(3);
    for (const s of slides) expect(s.contenu).not.toMatch(/^-+$/);
  });
});

describe("lireImages", () => {
  const md = [
    "## 🖼️ #2 · 3 septembre — Cover AI Act #1",
    "",
    "**Ce que le dirigeant doit ressentir** : *un texte a changé.*",
    "",
    "```",
    "[BLOC DE STYLE]",
    "",
    "Une page de document officiel posée à plat.",
    "```",
    "",
    "**Incrustation** : « Le 27 juillet » (ivoire), en bas à gauche.",
    "",
    "---",
    "",
    "### 🗑️ Ancien prompt du post #2, conservé pour mémoire — NE PAS UTILISER",
    "",
    "```",
    "Deux silhouettes architecturales abstraites.",
    "```",
    "",
  ].join("\n");

  it("🔴 IGNORE le prompt périmé que le dossier dit de ne pas utiliser", () => {
    // Trois posts en portent un. Les importer donnerait deux prompts
    // contradictoires sur le même visuel, sans rien pour départager.
    const seg = lireImages(md)[0]!.segments[0]!;
    expect(seg.prompt).toMatch(/document officiel/);
    expect(seg.prompt).not.toMatch(/silhouettes architecturales/);
  });

  it("garde l'incrustation à part du prompt", () => {
    // La typo s'ajoute APRÈS génération : dans le prompt, elle ferait
    // produire des lettres déformées — ce que le dossier interdit.
    const seg = lireImages(md)[0]!.segments[0]!;
    expect(seg.contenu).toMatch(/^Incrustation : « Le 27 juillet »/);
    expect(seg.prompt).not.toMatch(/Incrustation/);
  });

  it("se cale sur le numéro de post de l'intitulé", () => {
    expect(lireImages(md)[0]!.numeroPost).toBe(2);
  });

  it("🔴 saute une entrée sans bloc de prompt plutôt que d'en inventer un", () => {
    expect(lireImages("## 🖼️ #9 · 17 septembre — Sans prompt\n\nJuste une note.\n")).toEqual([]);
  });
});

describe("lirePhotos", () => {
  const md = [
    "# 2. LES 4 REGISTRES",
    "",
    "| | Registre | Décor | Lumière |",
    "|---|---|---|---|",
    "| **A** | Statut | Fond nu | Dure |",
    "",
    "## Septembre — octobre",
    "",
    "| # | Date | Registre | Ce qu'on voit exactement |",
    "|---|---|---|---|",
    "| **#4** | 07/09 | **C** | Trois-quarts devant l'écran, écran illisible |",
    "| **#5** | 09/09 | **A + pancarte** | Mi-corps, pancarte kraft à deux mains |",
    "",
  ].join("\n");

  it("vise l'asset PHOTO, pas celui de production", () => {
    // La colonne `photo_will` du calendrier crée son propre asset. Coller le
    // brief photo sur la production mélangerait deux tournages.
    for (const b of lirePhotos(md)) expect(b.cible).toBe("photo");
  });

  it("lit le registre et la description", () => {
    const b = lirePhotos(md).find((x) => x.numeroPost === 4)!;
    expect(b.segments[0]!.titre).toBe("Registre C");
    expect(b.segments[0]!.contenu).toMatch(/Trois-quarts devant l'écran/);
  });

  it("🔴 ignore le tableau des registres, qui n'est pas une liste de posts", () => {
    // Sa première cellule est `**A**`, pas `**#4**` : sans cette exigence,
    // les quatre registres deviendraient quatre briefs fantômes.
    expect(lirePhotos(md).map((b) => b.numeroPost)).toEqual([4, 5]);
  });
});

describe("refSegment", () => {
  it("produit une référence stable et lisible", () => {
    expect(refSegment("carrousels", 3, 7)).toBe("linkedin-2026-q4-carrousels-03-07");
  });

  it("🔴 ne collisionne pas entre deux sources sur le même post", () => {
    // Treize posts portent à la fois un carrousel et un prompt d'image. Sans
    // la source dans la clé, le second écraserait le premier.
    expect(refSegment("carrousels", 3, 1)).not.toBe(refSegment("images", 3, 1));
  });
});

describe("lireSeries", () => {
  const md = [
    "## #2 — Jeudi 3 septembre — 📝 Texte + cover — 📣 Écho — **AI Act #1**",
    "",
    "Corps.",
    "",
    "## #5 — Mercredi 9 septembre — 🖼️ Image — Recrutement",
    "",
    "Corps.",
    "",
    "## #7 — Dimanche 13 septembre — 🎬 Vidéo — **Sous le capot #1**",
    "",
    "Corps.",
    "",
    "## #12 — Lundi 21 septembre — 🖼️ Image — Punchline",
    "",
    "Corps.",
    "",
    "## #51 — Jeudi 10 décembre — 🖼️ Image — **Recrutement #4** — 📣 Écho",
    "",
    "Corps.",
    "",
  ].join("\n");

  it("lit les séries de la forme numérotée", () => {
    const noms = lireSeries(md)
      .map((s) => s.nom)
      .sort();
    expect(noms).toEqual(["AI Act", "Recrutement", "Sous le capot"]);
  });

  it("🔴 retrouve les mentions NUES d'une série déjà déclarée", () => {
    // Le dossier écrit « Recrutement » trois fois en clair et une fois
    // numérotée. Une seule passe n'en trouverait qu'UN sur quatre, et le
    // rang 4 isolé donnerait l'impression d'une série amputée.
    const recrutement = lireSeries(md).find((s) => s.nom === "Recrutement");
    expect(recrutement?.posts.map((p) => p.numeroPost)).toEqual([5, 51]);
    expect(recrutement?.posts.find((p) => p.numeroPost === 5)?.rang).toBeNull();
    expect(recrutement?.posts.find((p) => p.numeroPost === 51)?.rang).toBe(4);
  });

  it("🔴 n'INVENTE aucune série à partir d'un mot isolé", () => {
    // « Punchline », « Image » ou « Écho » apparaissent entre deux tirets sans
    // avoir jamais été déclarés en forme numérotée. Les promouvoir en séries
    // remplirait le référentiel de faux, et un faux référentiel est pire
    // qu'un référentiel vide : on s'y fie.
    const noms = lireSeries(md).map((s) => s.nom);
    expect(noms).not.toContain("Punchline");
    expect(noms).not.toContain("Image");
    expect(noms).not.toContain("Écho");
  });

  it("range les épisodes par numéro de post, pas par rang", () => {
    // Un épisode non numéroté n'a pas de rang ; c'est le calendrier qui
    // tranche l'ordre de diffusion.
    const r = lireSeries(md).find((s) => s.nom === "Recrutement");
    expect(r?.posts.map((p) => p.numeroPost)).toEqual([5, 51]);
  });

  it("rend une liste vide sur un fichier sans série", () => {
    expect(lireSeries("## #1 — Mardi — Image\n\nCorps.\n")).toEqual([]);
  });
});

describe("slugSerie", () => {
  it("produit une clé naturelle stable, sans accent ni espace", () => {
    expect(slugSerie("Sous le capot")).toBe("sous-le-capot");
    expect(slugSerie("Maison témoin")).toBe("maison-temoin");
    expect(slugSerie("AI Act")).toBe("ai-act");
  });
});
