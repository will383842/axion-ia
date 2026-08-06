/**
 * Rendu OOXML d'un `Deck` en fichier .pptx.
 *
 * ## Pourquoi écrire l'OOXML à la main
 *
 * Un .pptx est une archive ZIP de XML, et `jszip` est déjà installé — il sert à
 * l'import des kits documentaires. Ajouter une bibliothèque de génération aurait
 * imposé un `pnpm add` dans un dépôt dont le `node_modules` est un LIEN vers
 * celui du dépôt principal : l'installation aurait pu élaguer des paquets
 * absents de cette branche et casser l'autre copie de travail pendant qu'on y
 * travaille. Le coût réel est faible — un deck de texte n'utilise qu'une
 * poignée de formes — et le bénéfice est un contrôle exact de la charte, là où
 * une bibliothèque impose ses propres gabarits.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne décide RIEN du contenu : quelle idée va sur quelle slide, ce qui se
 * projette et ce qui reste au formateur, tout cela est tranché dans `deck.ts`.
 * Ici on ne fait que poser des rectangles et du texte.
 *
 * ## Polices
 *
 * ⚠️ Le fichier DÉCLARE Fraunces, Manrope et Inconsolata ; il ne les embarque
 * pas. Sur un poste où elles ne sont pas installées, PowerPoint substitue et le
 * rendu s'écarte de la charte. C'est un compromis assumé : l'incorporation de
 * polices dans un .pptx dépend de leur licence et alourdit chaque fichier de
 * plusieurs mégaoctets, pour un document qui est projeté depuis le poste du
 * formateur — poste sur lequel la charte doit de toute façon être installée.
 */

import JSZip from "jszip";

import type { Deck, FondSlide, Slide } from "./deck";

// ─────────────────────────────────────────────────────────────────────────────
// Géométrie et charte
// ─────────────────────────────────────────────────────────────────────────────

/** 1 pouce = 914 400 EMU. Diapositive 16:9 de 13,333 × 7,5 pouces. */
const LARGEUR = 12192000;
const HAUTEUR = 6858000;
const MARGE = 838200; // 0,917"

/** Miroir de `brand-tokens.ts`. Sans le « # » : OOXML n'en veut pas. */
const COULEURS = {
  ivoire: "FAF8F3",
  sable: "F0E9DA",
  mocha: "2A2520",
  mochaFg: "F7F3EA",
  fg: "1A1815",
  fgMuted: "5A4F44",
  terracotta: "B23F16",
  borderStrong: "C8BDA0",
} as const;

const POLICES = { serif: "Fraunces", sans: "Manrope", mono: "Inconsolata" } as const;

/** Fond et couleurs de texte associées, par variante de slide. */
const THEME_FOND: Record<FondSlide, { fond: string; titre: string; corps: string }> = {
  ivoire: { fond: COULEURS.ivoire, titre: COULEURS.fg, corps: COULEURS.fgMuted },
  sable: { fond: COULEURS.sable, titre: COULEURS.fg, corps: COULEURS.fgMuted },
  mocha: { fond: COULEURS.mocha, titre: COULEURS.mochaFg, corps: COULEURS.mochaFg },
};

// ─────────────────────────────────────────────────────────────────────────────
// XML
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Échappement XML.
 *
 * ⚠️ Indispensable et non négociable : le contenu pédagogique est plein de
 * guillemets français, d'apostrophes et d'esperluettes. Une seule « & » non
 * échappée rend l'archive entière illisible par PowerPoint, sans message
 * d'erreur exploitable.
 */
function esc(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface OptionsTexte {
  taille: number; // en points
  couleur: string;
  police: keyof typeof POLICES;
  gras?: boolean;
  espacement?: number; // interlettrage, en centièmes de point
  aligne?: "l" | "ctr";
  interligne?: number; // en pourcentage (90 = 90 %)
}

/** Paragraphes d'un corps de texte, un par ligne d'entrée. */
function paragraphes(lignes: string[], o: OptionsTexte): string {
  const props =
    `<a:pPr algn="${o.aligne ?? "l"}"` +
    (o.interligne !== undefined
      ? `><a:lnSpc><a:spcPct val="${o.interligne * 1000}"/></a:lnSpc></a:pPr>`
      : "/>");
  const rPr =
    `<a:rPr lang="fr-FR" sz="${Math.round(o.taille * 100)}" b="${o.gras === true ? 1 : 0}" dirty="0"` +
    (o.espacement !== undefined ? ` spc="${o.espacement}"` : "") +
    `><a:solidFill><a:srgbClr val="${o.couleur}"/></a:solidFill>` +
    `<a:latin typeface="${POLICES[o.police]}"/></a:rPr>`;

  return lignes
    .map((ligne) =>
      ligne
        .split("\n")
        .map((l) => `<a:p>${props}<a:r>${rPr}<a:t>${esc(l)}</a:t></a:r></a:p>`)
        .join(""),
    )
    .join("");
}

/** Une zone de texte positionnée. */
function zoneTexte(
  id: number,
  nom: string,
  x: number,
  y: number,
  w: number,
  h: number,
  contenu: string,
  ancrage: "t" | "ctr" | "b" = "t",
): string {
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(nom)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" anchor="${ancrage}"><a:normAutofit/></a:bodyPr><a:lstStyle/>${contenu}</p:txBody></p:sp>`
  );
}

/** Un rectangle plein — sert au filet d'accent et aux aplats. */
function rectangle(
  id: number,
  x: number,
  y: number,
  w: number,
  h: number,
  couleur: string,
): string {
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Filet ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `<a:solidFill><a:srgbClr val="${couleur}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composition d'une slide
// ─────────────────────────────────────────────────────────────────────────────

const LARGEUR_UTILE = LARGEUR - 2 * MARGE;

/** Corps d'une slide, selon son layout. */
function formesDeSlide(slide: Slide): string {
  const t = THEME_FOND[slide.fond];
  const formes: string[] = [];
  let id = 2;

  // Filet d'accent terracotta, en haut à gauche. Constant sur tout le deck :
  // c'est lui qui fait qu'une slide se reconnaît comme étant du même document.
  formes.push(rectangle(id++, MARGE, 548640, 274320, 45720, COULEURS.terracotta));

  if (slide.eyebrow !== undefined) {
    formes.push(
      zoneTexte(
        id++,
        "Surtitre",
        MARGE,
        731520,
        LARGEUR_UTILE,
        365760,
        paragraphes([slide.eyebrow.toUpperCase()], {
          taille: 12,
          couleur: slide.fond === "mocha" ? COULEURS.mochaFg : COULEURS.terracotta,
          police: "sans",
          gras: true,
          espacement: 150,
        }),
      ),
    );
  }

  switch (slide.layout) {
    case "couverture": {
      formes.push(
        zoneTexte(
          id++,
          "Titre",
          MARGE,
          2011680,
          LARGEUR_UTILE,
          2286000,
          paragraphes([slide.titre], {
            taille: 40,
            couleur: t.titre,
            police: "serif",
            gras: true,
            interligne: 105,
          }),
          "ctr",
        ),
      );
      if (slide.corps !== undefined) {
        formes.push(
          zoneTexte(
            id++,
            "Sous-titre",
            MARGE,
            4389120,
            LARGEUR_UTILE,
            548640,
            paragraphes(slide.corps, { taille: 18, couleur: t.corps, police: "sans" }),
          ),
        );
      }
      break;
    }

    case "enonce": {
      formes.push(
        zoneTexte(
          id++,
          "Énoncé",
          MARGE,
          1462080,
          LARGEUR_UTILE,
          3200400,
          paragraphes([slide.titre], {
            taille: 28,
            couleur: t.titre,
            police: "serif",
            interligne: 120,
          }),
        ),
      );
      if (slide.corps !== undefined && slide.corps.length > 0) {
        formes.push(
          zoneTexte(
            id++,
            "Complément",
            MARGE,
            5029200,
            LARGEUR_UTILE,
            914400,
            paragraphes(slide.corps, { taille: 16, couleur: t.corps, police: "sans" }),
          ),
        );
      }
      break;
    }

    case "contraste": {
      const colonne = (LARGEUR_UTILE - 457200) / 2;
      const xDroite = MARGE + colonne + 457200;
      formes.push(
        zoneTexte(
          id++,
          "Titre",
          MARGE,
          1371600,
          LARGEUR_UTILE,
          640080,
          paragraphes([slide.titre], { taille: 26, couleur: t.titre, police: "serif", gras: true }),
        ),
      );
      const c = slide.contraste;
      if (c !== undefined) {
        for (const [x, titre, corps] of [
          [MARGE, c.gaucheTitre, c.gauche],
          [xDroite, c.droiteTitre, c.droite],
        ] as const) {
          formes.push(
            zoneTexte(
              id++,
              titre,
              x,
              2286000,
              colonne,
              457200,
              paragraphes([titre.toUpperCase()], {
                taille: 12,
                couleur: COULEURS.terracotta,
                police: "sans",
                gras: true,
                espacement: 150,
              }),
            ),
          );
          formes.push(
            zoneTexte(
              id++,
              `${titre} — corps`,
              x,
              2743200,
              colonne,
              2286000,
              paragraphes([corps], {
                taille: 15,
                couleur: t.corps,
                police: "sans",
                interligne: 130,
              }),
            ),
          );
        }
      }
      break;
    }

    case "chiffre": {
      const c = slide.chiffre;
      formes.push(
        zoneTexte(
          id++,
          "Titre",
          MARGE,
          1371600,
          LARGEUR_UTILE,
          640080,
          paragraphes([slide.titre], { taille: 24, couleur: t.corps, police: "sans" }),
        ),
      );
      if (c !== undefined) {
        formes.push(
          zoneTexte(
            id++,
            "Chiffre",
            MARGE,
            2377440,
            LARGEUR_UTILE,
            1828800,
            paragraphes([`${c.avant}  →  ${c.apres}`], {
              taille: 66,
              couleur: COULEURS.terracotta,
              police: "serif",
              gras: true,
              aligne: "ctr",
            }),
            "ctr",
          ),
        );
      }
      break;
    }

    case "prompt": {
      formes.push(
        zoneTexte(
          id++,
          "Titre",
          MARGE,
          1371600,
          LARGEUR_UTILE,
          548640,
          paragraphes([slide.titre], { taille: 22, couleur: t.corps, police: "sans" }),
        ),
      );
      // Cartouche : le prompt doit se distinguer d'un discours. C'est un objet
      // à recopier, pas une phrase à écouter.
      formes.push(rectangle(id++, MARGE, 2011680, LARGEUR_UTILE, 3474720, COULEURS.ivoire));
      formes.push(rectangle(id++, MARGE, 2011680, 45720, 3474720, COULEURS.borderStrong));
      formes.push(
        zoneTexte(
          id++,
          "Prompt",
          MARGE + 274320,
          2194560,
          LARGEUR_UTILE - 548640,
          3108960,
          paragraphes(slide.corps ?? [], {
            taille: 13,
            couleur: COULEURS.fg,
            police: "mono",
            interligne: 135,
          }),
        ),
      );
      break;
    }

    case "points":
    case "sommaire": {
      formes.push(
        zoneTexte(
          id++,
          "Titre",
          MARGE,
          1371600,
          LARGEUR_UTILE,
          640080,
          paragraphes([slide.titre], { taille: 26, couleur: t.titre, police: "serif", gras: true }),
        ),
      );
      const lignes = slide.corps ?? [];
      // Une ligne par entrée, espacées : c'est l'air entre les lignes qui rend
      // une liste lisible de loin, pas la taille du texte.
      const hauteurLigne = 640080;
      for (const [i, ligne] of lignes.entries()) {
        formes.push(
          zoneTexte(
            id++,
            `Point ${i + 1}`,
            MARGE,
            2377440 + i * hauteurLigne,
            LARGEUR_UTILE,
            hauteurLigne,
            paragraphes([ligne], {
              taille: slide.layout === "points" ? 19 : 16,
              couleur: t.corps,
              police: "sans",
              interligne: 120,
            }),
          ),
        );
      }
      break;
    }
  }

  return formes.join("");
}

/** XML complet d'une slide. */
function xmlSlide(slide: Slide): string {
  const fond = THEME_FOND[slide.fond].fond;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
    `xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${fond}"/></a:solidFill>` +
    `<a:effectLst/></p:bgPr></p:bg>` +
    `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>` +
    `<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
    formesDeSlide(slide) +
    `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
  );
}

/** XML d'une page de notes du présentateur. */
function xmlNotes(notes: string, numero: number): string {
  const corps = notes
    .split("\n")
    .map(
      (l) => `<a:p><a:r><a:rPr lang="fr-FR" sz="1200" dirty="0"/><a:t>${esc(l)}</a:t></a:r></a:p>`,
    )
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
    `xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr/>` +
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes ${numero}"/>` +
    `<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>` +
    `<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/>${corps}</p:txBody></p:sp>` +
    `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pièces fixes de l'archive
// ─────────────────────────────────────────────────────────────────────────────

const NS_P = `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"`;
const REL_NS = `xmlns="http://schemas.openxmlformats.org/package/2006/relationships"`;
const OD = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** Thème minimal — PowerPoint refuse d'ouvrir un fichier qui n'en a pas. */
function xmlTheme(): string {
  const couleur = (n: string, v: string) => `<a:${n}><a:srgbClr val="${v}"/></a:${n}>`;
  const police = (balise: string, nom: string) =>
    `<a:${balise}><a:latin typeface="${nom}"/><a:ea typeface=""/><a:cs typeface=""/></a:${balise}>`;
  const remplissage = `<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>`;
  const traits = `<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>`;
  const effets = `<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>`;
  const fonds = `<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Axion-IA">` +
    `<a:themeElements><a:clrScheme name="Axion-IA">` +
    `<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>` +
    `<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>` +
    couleur("dk2", COULEURS.mocha) +
    couleur("lt2", COULEURS.ivoire) +
    couleur("accent1", COULEURS.terracotta) +
    couleur("accent2", COULEURS.mocha) +
    couleur("accent3", COULEURS.sable) +
    couleur("accent4", COULEURS.fgMuted) +
    couleur("accent5", COULEURS.borderStrong) +
    couleur("accent6", COULEURS.fg) +
    couleur("hlink", COULEURS.terracotta) +
    couleur("folHlink", COULEURS.fgMuted) +
    `</a:clrScheme><a:fontScheme name="Axion-IA">` +
    police("majorFont", POLICES.serif) +
    police("minorFont", POLICES.sans) +
    `</a:fontScheme><a:fmtScheme name="Axion-IA">${remplissage}${traits}${effets}${fonds}</a:fmtScheme>` +
    `</a:themeElements></a:theme>`
  );
}

/** Masque et disposition vides : on positionne tout explicitement par slide. */
function xmlSlideMaster(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<p:sldMaster ${NS_P}><p:cSld><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>` +
    `</p:spTree></p:cSld>` +
    `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" ` +
    `accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
    `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>` +
    `</p:sldMaster>`
  );
}

function xmlSlideLayout(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<p:sldLayout ${NS_P} type="blank" preserve="1"><p:cSld name="Vide"><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>` +
    `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`
  );
}

function xmlNotesMaster(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<p:notesMaster ${NS_P}><p:cSld><p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>` +
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Zone de notes"/>` +
    `<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>` +
    `<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>` +
    `</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" ` +
    `accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" ` +
    `hlink="hlink" folHlink="folHlink"/></p:notesMaster>`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assemblage de l'archive
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rend le deck en archive .pptx.
 *
 * L'ordre des pièces n'a pas d'importance dans un ZIP, mais leur COHÉRENCE en a
 * une absolue : chaque slide doit être déclarée dans `[Content_Types].xml`, dans
 * les relations de la présentation ET dans `sldIdLst`. Un oubli dans l'une des
 * trois donne un fichier que PowerPoint refuse d'ouvrir en disant seulement
 * qu'il est « endommagé ».
 */
export async function rendreDeckEnPptx(deck: Deck): Promise<Buffer> {
  const zip = new JSZip();
  const slides = deck.slides;
  /** Slides portant des notes : elles seules ont une page de notes. */
  const avecNotes = slides.map((s) => s.notes !== undefined && s.notes.length > 0);

  // [Content_Types].xml
  const overrides = [
    `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>`,
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>`,
    `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`,
    `<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>`,
    `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`,
    ...slides.map(
      (_, i) =>
        `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
    ),
    ...slides
      .map((_, i) =>
        avecNotes[i] === true
          ? `<Override PartName="/ppt/notesSlides/notesSlide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`
          : "",
      )
      .filter((x) => x !== ""),
  ].join("");

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `${overrides}</Types>`,
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ${REL_NS}>` +
      `<Relationship Id="rId1" Type="${OD}/officeDocument" Target="ppt/presentation.xml"/>` +
      `</Relationships>`,
  );

  // presentation.xml — le masque, le masque de notes, puis les slides.
  const idMaster = 1;
  const idNotesMaster = 2;
  const premierIdSlide = 3;
  const sldIdLst = slides
    .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${premierIdSlide + i}"/>`)
    .join("");

  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<p:presentation ${NS_P} saveSubsetFonts="1">` +
      `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId${idMaster}"/></p:sldMasterIdLst>` +
      `<p:notesMasterIdLst><p:notesMasterId r:id="rId${idNotesMaster}"/></p:notesMasterIdLst>` +
      `<p:sldIdLst>${sldIdLst}</p:sldIdLst>` +
      `<p:sldSz cx="${LARGEUR}" cy="${HAUTEUR}"/><p:notesSz cx="6858000" cy="9144000"/>` +
      `</p:presentation>`,
  );

  const relsPresentation = [
    `<Relationship Id="rId${idMaster}" Type="${OD}/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
    `<Relationship Id="rId${idNotesMaster}" Type="${OD}/notesMaster" Target="notesMasters/notesMaster1.xml"/>`,
    ...slides.map(
      (_, i) =>
        `<Relationship Id="rId${premierIdSlide + i}" Type="${OD}/slide" Target="slides/slide${i + 1}.xml"/>`,
    ),
    `<Relationship Id="rId${premierIdSlide + slides.length}" Type="${OD}/theme" Target="theme/theme1.xml"/>`,
  ].join("");

  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ${REL_NS}>${relsPresentation}</Relationships>`,
  );

  zip.file("ppt/theme/theme1.xml", xmlTheme());
  zip.file("ppt/slideMasters/slideMaster1.xml", xmlSlideMaster());
  zip.file(
    "ppt/slideMasters/_rels/slideMaster1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ${REL_NS}>` +
      `<Relationship Id="rId1" Type="${OD}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
      `<Relationship Id="rId2" Type="${OD}/theme" Target="../theme/theme1.xml"/>` +
      `</Relationships>`,
  );
  zip.file("ppt/slideLayouts/slideLayout1.xml", xmlSlideLayout());
  zip.file(
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ${REL_NS}>` +
      `<Relationship Id="rId1" Type="${OD}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>` +
      `</Relationships>`,
  );
  zip.file("ppt/notesMasters/notesMaster1.xml", xmlNotesMaster());
  zip.file(
    "ppt/notesMasters/_rels/notesMaster1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ${REL_NS}>` +
      `<Relationship Id="rId1" Type="${OD}/theme" Target="../theme/theme1.xml"/>` +
      `</Relationships>`,
  );

  for (const [i, slide] of slides.entries()) {
    const n = i + 1;
    zip.file(`ppt/slides/slide${n}.xml`, xmlSlide(slide));

    const rels = [
      `<Relationship Id="rId1" Type="${OD}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`,
    ];
    if (avecNotes[i] === true) {
      rels.push(
        `<Relationship Id="rId2" Type="${OD}/notesSlide" Target="../notesSlides/notesSlide${n}.xml"/>`,
      );
      zip.file(`ppt/notesSlides/notesSlide${n}.xml`, xmlNotes(slide.notes ?? "", n));
      zip.file(
        `ppt/notesSlides/_rels/notesSlide${n}.xml.rels`,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ${REL_NS}>` +
          `<Relationship Id="rId1" Type="${OD}/notesMaster" Target="../notesMasters/notesMaster1.xml"/>` +
          `<Relationship Id="rId2" Type="${OD}/slide" Target="../slides/slide${n}.xml"/>` +
          `</Relationships>`,
      );
    }
    zip.file(
      `ppt/slides/_rels/slide${n}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ${REL_NS}>${rels.join("")}</Relationships>`,
    );
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
