/**
 * DÉPLIANT FORMATIONS — A3 ouvert, A4 fermé, 4 pages.
 *
 * POURQUOI CE SCRIPT (2026-08-25, demande Will)
 *
 * Le catalogue 48 pages et le flyer A5 sont fabriqués dans un dépôt séparé
 * (`Catalogue_formations_Axion_IA/`), qui vit sur le poste de fabrication. Ce
 * dépliant-ci est fabriqué DEPUIS LE DÉPÔT, et c'est délibéré : ses prix et ses
 * 22 intitulés sont DÉRIVÉS de la SSOT (`catalog-v2.ts` × `pricing.ts`), jamais
 * recopiés. Un imprimé se corrige au retirage, pas au déploiement — un prix faux
 * distribué en main propre ne se rattrape pas.
 *
 * CE QU'IL PRODUIT
 *
 *   public/imprimes/depliant-formations-axion-ia.pdf      4 pages A4, à lire et à envoyer
 *   public/imprimes/depliant-formations-axion-ia-A3.pdf   2 planches A3, pour plier
 *
 * ⚠️ AUCUN DES DEUX N'EST UN FICHIER IMPRIMEUR. Ils sont en RVB, sans fond perdu
 * et sans repère de coupe. La planche A3 sert au tirage bureautique et au
 * contrôle du pliage ; un vrai tirage offset demande une reprise CMJN avec fond
 * perdu, qui relève du dépôt de fabrication.
 *
 * IMPOSITION — pliage simple, une seule pliure au centre de l'A3 :
 *   Planche recto  : [ page 4 | page 1 ]   ← p1 à droite = la couverture
 *   Planche verso  : [ page 2 | page 3 ]
 *
 * Lancer :  pnpm tsx scripts/build-depliant-formations.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import QRCode from "qrcode";
import sharp from "sharp";
import { chromium } from "playwright";

import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import { CLIENT_LOGOS } from "@/content/home-data";
import { getPageImages } from "@/lib/seo/page-images";
import { formatAmount, getFormationPrice } from "@/content/pricing";
import type { FormationCategorie, FormationDuree } from "@/content/pricing";

const RACINE = process.cwd();
const SORTIE = join(RACINE, "public", "imprimes");

// ────────────────────────────────────────────────────────────────────────────
// CIBLES DES QR
//
// URL canoniques, PAS des `/qr/<slug>`. Les slugs vivent en base (modèle
// QrLink) : en inventer un ici produirait un QR mort sur du papier, ce qui est
// exactement le défaut qu'un QR pilotable est censé éviter. Le jour où les
// slugs sont créés dans la console, il n'y a que ces trois lignes à changer.
// ────────────────────────────────────────────────────────────────────────────
const QR = {
  formations: "https://axion-ia.com/formations",
  appel: "https://axion-ia.com/appel",
  catalogue: "https://axion-ia.com/catalogue",
  avis: "https://axion-ia.com/avis",
};

// ────────────────────────────────────────────────────────────────────────────
// MENTIONS LÉGALES
//
// Reprises VERBATIM de la page 47 du catalogue 48 p. déjà validé et imprimé.
// Elles ne sont pas importées de `lib/legal-identity.ts` : ce resolver lit le
// SiteSetting `legal_overrides` en base au runtime, inaccessible depuis un
// script de fabrication. Si l'identité légale change, elle change ICI et dans
// la console — et le dépliant se refabrique.
// ────────────────────────────────────────────────────────────────────────────
const MENTIONS =
  "AXION IA SAS, société par actions simplifiée · Siège social : ELITE BUREAUX — boîte 53, " +
  "11 avenue Paul Verlaine, 38100 Grenoble · RCS Grenoble, SIREN 108 018 631 · " +
  "SIRET (siège) 108 018 631 00011 · TVA intracommunautaire FR51 108 018 631 · " +
  "Directeur de la publication : Williams Jullin, président · contact@axion-ia.com";

const QUALIOPI_MENTION =
  "La certification qualité a été délivrée au titre de la catégorie d'actions suivante : " +
  "ACTIONS DE FORMATION.";

// ────────────────────────────────────────────────────────────────────────────
// PALETTE — prélevée au pixel sur le catalogue imprimé (p01/p15 du feuilletoir)
// ────────────────────────────────────────────────────────────────────────────
const C = {
  encre: "#19100B",
  encreDoux: "#2A2521",
  creme: "#ECE0C8",
  cremeClair: "#F5EFE3",
  blanc: "#FFFFFD",
  terracotta: "#C34A1B",
  terracottaVif: "#E2601F",
  olive: "#5E6C55",
  oliveClair: "#7B8A70",
  sable: "#DCCFB2",
  peche: "#F8E4D7",
};

// ────────────────────────────────────────────────────────────────────────────
// FONTES — Fraunces (titres) + Manrope (texte), auto-hébergées dans le dépôt.
// Embarquées en base64 : le rendu ne doit dépendre d'aucun réseau.
// ────────────────────────────────────────────────────────────────────────────
function fonte(fichier: string): string {
  const buf = readFileSync(join(RACINE, "public", "fonts", fichier));
  return `data:font/ttf;base64,${buf.toString("base64")}`;
}

// ────────────────────────────────────────────────────────────────────────────
// IMAGES
// ────────────────────────────────────────────────────────────────────────────
async function png64(buf: Buffer): Promise<string> {
  return `data:image/png;base64,${buf.toString("base64")}`;
}

interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Boîte englobante réelle de l'encre d'un PNG, calculée pixel par pixel.
 *
 * ⚠️ NE PAS remplacer par `sharp().trim()`. Essayé, mesuré, inutile ici : le
 * lockup porte un damier de transparence TRÈS PÂLE incrusté dans les pixels,
 * donc sa bordure n'est pas d'une couleur unique et `trim()` ne rogne RIEN
 * (mesure : 737 × 1017 rendus sur un extrait de 737 × 1024 — zéro pixel ôté).
 * Le symptôme n'était pas une erreur mais une laideur : logo réduit à un
 * timbre-poste et carte Qualiopi deux fois trop haute, toutes deux gonflées
 * de vide. On cherche donc l'encre — un pixel opaque ET assez loin du blanc.
 */
async function boiteEncre(buf: Buffer): Promise<Region> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      // `noUncheckedIndexedAccess` : ces quatre lectures sont dans les bornes
      // par construction (i < data.length), mais le compilateur ne le sait pas.
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 0;
      if (a < 48) continue;
      // Le damier vit entre #FFFFFF et ~#F0F0F0 : 45 de marge le laisse dehors
      // sans manger l'antialiasing des lettres.
      if (255 - Math.min(r, g, b) < 45) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }

  if (x1 < 0) return { left: 0, top: 0, width, height };
  const marge = 4;
  const left = Math.max(0, x0 - marge);
  const top = Math.max(0, y0 - marge);
  return {
    left,
    top,
    width: Math.min(width - left, x1 - x0 + 1 + marge * 2),
    height: Math.min(height - top, y1 - y0 + 1 + marge * 2),
  };
}

async function detourer(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .extract(await boiteEncre(buf))
    .png()
    .toBuffer();
}

/** Découpe le lockup `public/email/axion-qualiopi-lockup.png` en ses deux moitiés. */
async function decouperLockup() {
  const src = join(RACINE, "public", "email", "axion-qualiopi-lockup.png");
  const { width = 1536, height = 1024 } = await sharp(src).metadata();

  const qualiopi = await detourer(
    await sharp(src)
      .extract({ left: 0, top: 0, width: Math.round(width * 0.47), height })
      .png()
      .toBuffer(),
  );

  const logo = await detourer(
    await sharp(src)
      .extract({
        left: Math.round(width * 0.51),
        top: 0,
        width: width - Math.round(width * 0.51),
        height,
      })
      .png()
      .toBuffer(),
  );

  console.log(
    `  détourage — qualiopi ${(await sharp(qualiopi).metadata()).width}px, ` +
      `logo ${(await sharp(logo).metadata()).width}px`,
  );

  return { qualiopi: await png64(qualiopi), logo: await png64(logo) };
}

/**
 * Bandeau photo de couverture, recadré dans le rendu web du catalogue.
 *
 * ⚠️ LA FENÊTRE DE DÉCOUPE EST ÉTROITE, ET C'EST OBLIGATOIRE. `p01.jpg` est la
 * couverture COMPOSÉE du catalogue 48 p. : elle porte déjà, incrustés dans les
 * pixels, le logo et la pastille de millésime en haut (y ≈ 0,03–0,08) et le
 * titre « L'IA, de l'idée à l'impact » en bas (y ≈ 0,25 et suivants). Un
 * recadrage plus généreux les réimporte : le premier jet prenait 0 → 0,415 et
 * la couverture affichait un « L'IA, » fantôme derrière le vrai titre, plus un
 * second logo sous le nôtre. On ne garde donc que la bande de visages
 * comprise ENTRE les deux — d'où un bandeau haut, et non un fond de titre.
 *
 * ⚠️ ~1 900 px de large, soit ~230 dpi à 210 mm. Correct pour un tirage
 * bureautique, EN DESSOUS des 300 dpi d'un offset : l'original haute
 * définition vit dans le dépôt de fabrication, pas ici. C'est le seul élément
 * du dépliant qui ne soit pas vectoriel ou dérivé de la SSOT.
 */
const PHOTO_HAUT = 0.108;
const PHOTO_BAS = 0.245;

async function photoCouverture(): Promise<string> {
  const src = join(RACINE, "public", "catalogue", "pages-web", "p01.jpg");
  const { width = 1909, height = 2696 } = await sharp(src).metadata();
  const buf = await sharp(src)
    .extract({
      left: 0,
      top: Math.round(height * PHOTO_HAUT),
      width,
      height: Math.round(height * (PHOTO_BAS - PHOTO_HAUT)),
    })
    .jpeg({ quality: 88 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

/**
 * Les logos clients, lus dans la SSOT `CLIENT_LOGOS` (home-data.ts).
 *
 * ⚠️ CE SONT DES MARQUES DE TIERS SUR DU PAPIER. On ne les imprime que parce
 * que la SSOT documente noir sur blanc que Will a « obtenu l'accord écrit
 * d'affichage en tant que clients » pour ces 17 marques — c'est la même
 * affirmation que la bande de la page d'accueil, pas une nouvelle. Si cet
 * accord venait à changer pour l'une d'elles, elle sort de `CLIENT_LOGOS` et
 * disparaît d'ici au prochain build : rien à corriger dans ce script.
 *
 * Le SVG part en `data:` : le PDF ne doit dépendre d'aucun fichier externe.
 */
function logosClients(): Array<{ nom: string; src: string }> {
  return CLIENT_LOGOS.map((l) => {
    const chemin = join(RACINE, "public", l.src.replace(/^\//, ""));
    const svg = readFileSync(chemin, "utf8");
    return {
      nom: l.name,
      src: `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`,
    };
  });
}

/**
 * Le portrait du fondateur, en médaillon rond sur la couverture.
 *
 * ⚠️ LA SOURCE EST LE MANIFESTE, PAS UN CHEMIN ÉCRIT À LA MAIN. Le fichier est
 * celui que `getPageImages("/formations")` désigne au slot `portrait` — donc
 * exactement la photo servie sur axion-ia.com/fr/formations, demande Will.
 * Un `grep` sur le manifeste renvoyait `home-founder-william.avif`, qui
 * appartient au bloc d'UNE AUTRE page : c'est en interrogeant la fonction
 * qu'on obtient le bon fichier. Le jour où la photo de la page change, celle
 * du dépliant suit au prochain build.
 *
 * Recadrage carré tête-et-épaules : l'original est un portrait 3:4 en pied,
 * illisible réduit à 20 mm de diamètre.
 */
function portraitFondateur(): { src: Promise<string>; alt: string } {
  const entree = getPageImages("/formations").find((p) => p.slot === "portrait");
  if (!entree) {
    throw new Error(
      "Aucune image au slot `portrait` pour /formations — le manifeste page-images.ts a changé.",
    );
  }

  const chemin = join(RACINE, "public", entree.src.replace(/^\//, ""));

  const src = (async () => {
    const { width = 1086, height = 1448 } = await sharp(chemin).metadata();
    // Fenêtre calée sur la tête et les épaules. Un premier essai à 0,76 × la
    // largeur laissait le buste entier dans le cadre : réduit à 17 mm de
    // diamètre, le visage devenait indéchiffrable — un médaillon illisible ne
    // sert à rien. Le sujet est légèrement à droite du centre de l'image,
    // d'où un décalage horizontal plutôt qu'un centrage strict.
    const cote = Math.round(width * 0.64);
    const buf = await sharp(chemin)
      .extract({
        left: Math.round(width * 0.19),
        top: Math.round(height * 0.035),
        width: cote,
        height: Math.min(cote, height - Math.round(height * 0.035)),
      })
      .resize(520, 520, { fit: "cover" })
      .jpeg({ quality: 88 })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  })();

  return { src, alt: entree.altFr };
}

async function qr(url: string, sombre = C.encre): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 0,
    width: 700,
    errorCorrectionLevel: "M",
    color: { dark: sombre, light: "#FFFFFF" },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// DONNÉES — dérivées de la SSOT, jamais recopiées
// ────────────────────────────────────────────────────────────────────────────
interface Ligne {
  titre: string;
  duree: string;
  prix: string;
}

const LIBELLE_DUREE: Record<string, string> = {
  "4h": "4 h",
  "1j": "1 j",
  "2j": "2 j",
  "3j": "3 j",
};

function lignes(categorie: FormationCategorie): Ligne[] {
  return FORMATIONS_V2.filter((f) => f.categorie === categorie).map((f) => {
    const prix = getFormationPrice(f.categorie as FormationCategorie, f.duree as FormationDuree);
    return {
      // ⚠️ NE PAS retirer purement et simplement le suffixe « — journée
      // complète ». Essayé au premier jet, au motif que la pastille de durée
      // le dit déjà : la colonne « Offres générales » affichait alors DEUX
      // « IA pour bien commencer » d'affilée, qui se lisaient comme un doublon
      // de mise en page. La pastille distingue les deux lignes pour qui la
      // lit ; l'œil, lui, voit d'abord le titre. On raccourcit sans effacer.
      titre: f.titreFr.replace(/\s*—\s*journée complète$/, " · la journée"),
      duree: LIBELLE_DUREE[f.duree] ?? f.duree,
      prix: prix === undefined ? "sur devis" : formatAmount(prix, "fr", { compact: true }),
    };
  });
}

/** Fourchette « de X à Y » d'une catégorie, pour l'en-tête de colonne. */
function fourchette(categorie: FormationCategorie): string {
  const prix = FORMATIONS_V2.filter((f) => f.categorie === categorie)
    .map((f) => getFormationPrice(f.categorie as FormationCategorie, f.duree as FormationDuree))
    .filter((p): p is number => typeof p === "number");
  const min = Math.min(...prix);
  const max = Math.max(...prix);
  const f = (n: number) => formatAmount(n, "fr", { compact: true });
  return min === max ? `${f(min)} HT` : `${f(min)} à ${f(max)} HT`;
}

/**
 * Ce que la formation change, SECTEUR PAR SECTEUR.
 *
 * POURQUOI CE BLOC EXISTE (2026-08-25, objection Will). Les huit barres de la
 * page 2 sont toutes des tâches de BUREAU — e-mail, compte rendu, tri de CV,
 * reporting. Un dirigeant du BTP, de la santé ou de l'industrie ne s'y
 * reconnaissait nulle part et pouvait conclure, à raison, que l'offre ne
 * parlait pas de son métier. Les barres restent (elles sont vraies et
 * universelles), mais elles ne peuvent plus être le seul cadrage de la page.
 *
 * ⚠️ AUCUN CHIFFRE DE TEMPS ICI, et c'est délibéré. Les minutes des barres
 * viennent de la page 4 du catalogue 48 p., mesurées et validées. Rien
 * d'équivalent n'existe pour « un devis de chantier » : inventer un
 * « 45 min → 5 min » sectoriel serait fabriquer une mesure. On prend donc le
 * `avantApresFr` de la SSOT, qui est qualitatif — et vrai.
 */
/** Première lettre en capitale, le reste intact (jamais de `toLowerCase` : « BTP » et « IT » doivent rester tels quels). */
function capitaliser(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function secteurs(): Array<{ nom: string; apres: string }> {
  return FORMATIONS_V2.filter((f) => f.categorie === "secteur").map((f) => ({
    // « IA pour le BTP » → « BTP ». Le préfixe est le même sur les 8 lignes :
    // répété, il mange la place sans rien distinguer.
    //
    // Deux nettoyages qui suivent, chacun pour un défaut constaté au rendu :
    //   • « et la / et l' » → « & », sinon « IA pour le transport et la
    //     logistique » sort une étiquette de 27 caractères qui empiète sur la
    //     colonne voisine ;
    //   • capitale initiale, sinon le retrait de l'article laisse « santé »,
    //     « commerce », « industrie » en bas de casse au milieu d'un tableau
    //     de noms propres — ça se lit comme une coquille.
    nom: capitaliser(
      f.titreFr
        .replace(/^IA pour (l'|la |le |les )?/i, "")
        .replace(/\s+et\s+(l'|la |le |les )?/i, " & "),
    ),
    apres: (f.avantApresFr?.apres ?? "").trim(),
  }));
}

const GENERALES = lignes("generale");
const METIERS = lignes("metier");
const SECTEURS = lignes("secteur");

/** Les six raccourcis « je veux… » — repris de la page 7 du catalogue 48 p. */
const OBJECTIFS = [
  { veux: "Faire découvrir l'IA à toute l'équipe", vers: "IA pour bien commencer · 4 h" },
  { veux: "Ancrer la pratique en une journée", vers: "IA pour les équipes · 1 j" },
  { veux: "Automatiser les tâches répétitives", vers: "IA pour l'automatisation · 2 j" },
  { veux: "Outiller une fonction (RH, vente, finance…)", vers: "Une formation par métier" },
  { veux: "Parler la langue de votre secteur", vers: "Une formation par secteur" },
  { veux: "Fédérer jusqu'à 50 personnes en 1 jour", vers: "Séminaire IA" },
];

/**
 * Les tâches de la page 2 — reprises de la page 4 du catalogue 48 p.
 *
 * Les MINUTES sont là pour dessiner, pas pour être lues : la barre pleine vaut
 * l'avant, la barre terracotta l'après, à l'échelle de la ligne. C'est ce qui
 * permet de comprendre la page sans en lire un mot — la version précédente
 * alignait huit blocs de texte et se lisait comme un rapport.
 * Le libellé secondaire a sauté : il ajoutait une deuxième ligne à chaque
 * rangée pour une précision que personne ne cherche sur un dépliant.
 */
const TACHES = [
  { t: "Répondre à un e-mail délicat", avant: 20, apres: 3, a: "20 min", b: "3 min" },
  { t: "Compte rendu de réunion", avant: 45, apres: 5, a: "45 min", b: "5 min" },
  { t: "Synthétiser un document de 40 pages", avant: 90, apres: 10, a: "1 h 30", b: "10 min" },
  { t: "Devis & proposition commerciale", avant: 90, apres: 20, a: "1 h 30", b: "20 min" },
  { t: "Relancer chaque client", avant: 30, apres: 5, a: "30 min", b: "5 min" },
  { t: "Post, newsletter, fiche produit", avant: 60, apres: 15, a: "1 h", b: "15 min" },
  { t: "Offre d'emploi & tri des CV", avant: 120, apres: 30, a: "2 h", b: "30 min" },
  { t: "Le reporting mensuel", avant: 480, apres: 120, a: "1 jour", b: "2 h" },
];

/**
 * Le parcours — CINQ étapes, pas six.
 *
 * La page 5 du catalogue 48 p. en porte une sixième, « Visibilité offerte »,
 * dont le premier item est le podcast. Will l'a exclue de ce dépliant. Les
 * interviews de stagiaires, elles, restent — mais au dos, dans leur propre
 * bloc, pas comme une étape du parcours de formation.
 */
const PARCOURS = [
  { n: "1", t: "Appel", d: "30 min, sans engagement" },
  { n: "2", t: "Dossier OPCO", d: "monté par nous, de A à Z" },
  { n: "3", t: "Formation", d: "chez vous, sur vos dossiers" },
  { n: "4", t: "Kit livré", d: "gabarits et prompts, à vous" },
  { n: "5", t: "Attestations", d: "preuves Qualiopi + AI Act" },
];

// ────────────────────────────────────────────────────────────────────────────
// GABARIT
// ────────────────────────────────────────────────────────────────────────────
function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface Actifs {
  qualiopi: string;
  logos: Array<{ nom: string; src: string }>;
  logo: string;
  photo: string;
  qrFormations: string;
  qrAppel: string;
  qrCatalogue: string;
  qrAvis: string;
  portrait: string;
  portraitAlt: string;
}

function styles(): string {
  return `
@font-face { font-family:'Fraunces'; src:url('${fonte("Fraunces-Regular.ttf")}') format('truetype'); font-weight:400; font-style:normal; }
@font-face { font-family:'Fraunces'; src:url('${fonte("Fraunces-Bold.ttf")}') format('truetype'); font-weight:700; font-style:normal; }
@font-face { font-family:'Fraunces'; src:url('${fonte("Fraunces-Italic.ttf")}') format('truetype'); font-weight:400; font-style:italic; }
@font-face { font-family:'Manrope'; src:url('${fonte("Manrope-Regular.ttf")}') format('truetype'); font-weight:400; }
@font-face { font-family:'Manrope'; src:url('${fonte("Manrope-Medium.ttf")}') format('truetype'); font-weight:500; }
@font-face { font-family:'Manrope'; src:url('${fonte("Manrope-Bold.ttf")}') format('truetype'); font-weight:700; }

*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
html, body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body { font-family:'Manrope', system-ui, sans-serif; color:${C.encre}; }

.page {
  width:210mm; height:297mm; position:relative; overflow:hidden;
  background:${C.creme}; page-break-after:always; break-after:page;
}
.page:last-child { page-break-after:auto; break-after:auto; }

/* ── Ossature commune ───────────────────────────────────────────────────── */
.corps { padding:13mm 13mm 11.5mm 13mm; height:100%; display:flex; flex-direction:column; }
.tranche { position:absolute; top:0; right:0; width:5mm; height:100%; background:${C.terracotta}; }
/*
 * Page 2 = volet INTÉRIEUR GAUCHE une fois plié : son bord extérieur est à
 * gauche. Laisser la tranche à droite la plaçait pile dans la pliure, face à
 * celle de la page 3 — deux filets encadrant le pli au lieu de border la
 * double page. Ici, un seul filet à chaque bord extérieur.
 */
.tranche.gauche { right:auto; left:0; }
.pied {
  position:absolute; bottom:0; left:0; right:0; height:9mm; background:${C.encreDoux};
  color:${C.creme}; display:flex; align-items:center; justify-content:space-between;
  padding:0 13mm; font-size:7.4pt; letter-spacing:.01em;
}
.pied strong { color:${C.blanc}; font-weight:700; }
.folio { font-weight:700; letter-spacing:.08em; opacity:.75; }

.entete { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:6mm; }
.entete img { height:11mm; }
.rubrique {
  font-size:7.6pt; font-weight:700; letter-spacing:.18em; text-transform:uppercase;
  color:${C.olive}; text-align:right; padding-top:2mm;
}

h1.titre { font-family:'Fraunces', serif; font-size:25pt; line-height:1.03; font-weight:700; }
h1.titre em { font-style:italic; font-weight:400; color:${C.terracotta}; }
.chapo { font-size:9.2pt; line-height:1.45; color:#4A423C; margin-top:2.5mm; max-width:150mm; }

h2.section {
  font-family:'Fraunces', serif; font-size:13.5pt; font-weight:700; margin-bottom:3mm;
  display:flex; align-items:baseline; gap:2.5mm;
}
h2.section span.compte { font-family:'Manrope'; font-size:8pt; font-weight:700; color:${C.terracotta}; letter-spacing:.06em; }

/* ── Page 1 · couverture ────────────────────────────────────────────────── */
.couv { background:${C.encre}; color:${C.creme}; }
.couv-photo { position:absolute; top:0; left:0; width:100%; height:62mm; object-fit:cover; object-position:center 50%; }
.couv-voile {
  position:absolute; top:0; left:0; width:100%; height:62mm;
  background:linear-gradient(to bottom, rgba(25,16,11,.55) 0%, rgba(25,16,11,.10) 30%,
                             rgba(25,16,11,.20) 72%, rgba(25,16,11,.95) 100%);
}
.couv-marque { position:absolute; top:9mm; left:12mm; }
.couv-marque img { height:12mm; }
.couv-millesime {
  position:absolute; top:10.5mm; right:12mm; background:${C.terracotta}; color:${C.blanc};
  border-radius:99px; padding:1.8mm 5mm; font-size:9pt; font-weight:700; letter-spacing:.14em;
}
.couv-titre { position:absolute; top:70mm; left:12mm; right:12mm; }
.couv-sur {
  font-size:8pt; font-weight:700; letter-spacing:.24em; text-transform:uppercase;
  color:${C.sable}; margin-bottom:3mm;
}
.couv-titre h1 { font-family:'Fraunces', serif; font-size:41pt; line-height:.98; font-weight:700; color:${C.blanc}; }
.couv-titre h1 em { display:block; font-style:italic; font-weight:400; color:${C.terracottaVif}; font-size:39pt; }
.couv-sous { margin-top:4mm; font-size:11.5pt; font-weight:500; color:${C.creme}; }

.couv-bande {
  position:absolute; top:132mm; left:0; right:0; background:${C.terracotta}; color:${C.blanc};
  padding:3mm 12mm; font-size:9.4pt; font-weight:700; letter-spacing:.01em;
}

.couv-bas { position:absolute; left:12mm; right:12mm; top:152mm; }
.couv-argent {
  display:flex; gap:5mm; align-items:stretch;
}
.couv-zero {
  background:${C.terracotta}; border-radius:3mm; padding:5mm 6mm; flex:1;
  display:flex; gap:5mm; align-items:center;
}
.couv-zero .chiffre {
  text-align:center; padding-right:5mm; border-right:1px solid rgba(255,255,255,.35);
  flex-shrink:0;
}
.couv-zero .chiffre b {
  font-family:'Fraunces', serif; font-size:34pt; line-height:1; color:${C.blanc};
  display:block; white-space:nowrap;
}
.couv-zero .chiffre span {
  display:block; font-size:6.6pt; font-weight:700; letter-spacing:.1em;
  color:rgba(255,255,255,.9); margin-top:1.5mm; white-space:nowrap;
}
.couv-zero .texte h3 { font-size:11pt; font-weight:700; color:${C.blanc}; margin-bottom:1.5mm; }
.couv-zero .texte p { font-size:8.4pt; line-height:1.42; color:rgba(255,255,255,.95); }
.couv-qualiopi {
  background:${C.blanc}; border-radius:3mm; padding:4mm; width:52mm;
  display:flex; align-items:center; justify-content:center;
}
.couv-qualiopi img { width:100%; }

.couv-offre { margin-top:6mm; display:flex; align-items:flex-end; justify-content:space-between; gap:8mm; }

/* Médaillon du fondateur — petit, comme demandé : il humanise la couverture
 * sans concurrencer le titre ni le bloc « 0 € ». */
.couv-fondateur { display:flex; align-items:center; gap:3.5mm; margin-bottom:3.5mm; }
.couv-fondateur img {
  width:17mm; height:17mm; border-radius:99px; object-fit:cover;
  border:1.6px solid rgba(236,224,200,.55); flex-shrink:0;
}
.couv-fondateur .cf-txt b {
  display:block; font-size:9.4pt; font-weight:700; color:${C.blanc}; line-height:1.15;
}
.couv-fondateur .cf-txt span {
  display:block; font-size:7.4pt; color:${C.sable}; margin-top:.8mm; letter-spacing:.02em;
}
.couv-offre h2 { font-family:'Fraunces', serif; font-size:19pt; line-height:1.1; color:${C.blanc}; }
.couv-offre h2 em { font-style:italic; color:${C.terracottaVif}; }
.couv-offre p { font-size:8.6pt; line-height:1.45; color:${C.sable}; margin-top:2.5mm; max-width:105mm; }
.couv-qr { text-align:center; flex-shrink:0; }
.couv-qr img { width:24mm; height:24mm; background:${C.blanc}; padding:1.5mm; border-radius:2mm; }
.couv-qr span { display:block; font-size:6.8pt; font-weight:700; color:${C.sable}; margin-top:1.5mm; letter-spacing:.04em; }

.couv-trois {
  margin-top:13mm; display:grid; grid-template-columns:repeat(3,1fr);
  border-top:1px solid rgba(236,224,200,.22); padding-top:5mm;
}
.couv-trois > div { padding:0 5mm; border-left:1px solid rgba(236,224,200,.16); }
.couv-trois > div:first-child { padding-left:0; border-left:none; }
.couv-trois b {
  font-family:'Fraunces', serif; font-size:22pt; line-height:1;
  color:${C.terracottaVif}; display:block;
}
.couv-trois i {
  font-style:normal; display:block; font-size:9pt; font-weight:700;
  color:${C.blanc}; margin-top:2mm;
}
.couv-trois span { display:block; font-size:7.4pt; color:${C.sable}; margin-top:1.2mm; line-height:1.35; }

.couv-note {
  position:absolute; bottom:11mm; left:12mm; right:12mm;
  font-size:6.6pt; line-height:1.4; color:rgba(236,224,200,.62);
}
.couv-pied {
  position:absolute; bottom:0; left:0; right:0; height:7mm; background:${C.terracotta};
}

/* ── Page 2 · pourquoi + comment ────────────────────────────────────────── */
/* ── Barres avant / après ────────────────────────────────────────────────
 * Le cœur visuel de la page 2. Chaque ligne est normalisée SUR ELLE-MÊME :
 * la piste vaut l'avant, la barre terracotta vaut l'après. On lit la
 * proportion épargnée d'un coup d'œil, sans comparer des minutes entre elles
 * — une échelle commune écraserait les sept premières lignes contre la
 * journée de reporting et ne montrerait plus rien.
 */
.barres { display:flex; flex-direction:column; gap:1.8mm; margin-bottom:3.5mm; }
.barre { display:grid; grid-template-columns:58mm 1fr 27mm; align-items:center; gap:4mm; }
.barre .nom { font-size:9pt; font-weight:700; line-height:1.15; }
.barre .piste {
  height:4.8mm; background:${C.sable}; border-radius:99px; position:relative;
}
.barre .plein {
  position:absolute; left:0; top:0; bottom:0; background:${C.terracotta};
  border-radius:99px; min-width:3mm;
}
.barre .tps { text-align:right; white-space:nowrap; }
.barre .tps s { font-size:8pt; color:#8A7F76; }
.barre .tps i { font-style:normal; font-size:8pt; color:${C.terracotta}; font-weight:700; margin:0 1mm; }
.barre .tps b { font-size:11.5pt; font-weight:700; color:${C.olive}; }

/* ── Frise du parcours ─────────────────────────────────────────────────── */
.chemin { display:grid; grid-template-columns:repeat(5,1fr); gap:2mm; position:relative; margin-bottom:3.5mm; }
.chemin::before {
  content:''; position:absolute; top:4.5mm; left:10%; right:10%;
  border-top:1.4px dashed rgba(94,108,85,.45);
}
.jalon { text-align:center; position:relative; }
.jalon .rond {
  width:9mm; height:9mm; border-radius:99px; background:${C.terracotta}; color:${C.blanc};
  font-size:11pt; font-weight:700; display:flex; align-items:center; justify-content:center;
  margin:0 auto 2mm; position:relative; z-index:1;
  box-shadow:0 0 0 2.2mm ${C.creme};
}
.jalon b { display:block; font-size:9pt; font-weight:700; line-height:1.15; }
.jalon span { display:block; font-size:7.2pt; color:#6E645C; margin-top:.8mm; line-height:1.3; }

.kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:3.5mm; margin-bottom:4mm; }
.kpi { background:${C.encreDoux}; color:${C.creme}; border-radius:2.5mm; padding:3.2mm 4mm; }
.kpi b { display:block; font-family:'Fraunces', serif; font-size:20pt; color:${C.terracottaVif}; line-height:1; }
.kpi span { display:block; font-size:7.6pt; line-height:1.35; margin-top:2mm; color:${C.sable}; }

/*
 * AI Act — mis en avant à la demande de Will (2026-08-25). Il était en bande
 * pâle de 8 pt en bas de page : c'est le seul argument du dépliant qui soit
 * une CONTRAINTE plutôt qu'un bénéfice, donc le seul qui crée une échéance.
 *
 * ⚠️ FORMULATION JURIDIQUE — NE PAS DURCIR. L'article 4 impose d'assurer la
 * « littératie IA » des personnes qui utilisent des systèmes d'IA ; il
 * n'impose PAS de suivre une formation certifiée en particulier. Écrire
 * « vous êtes obligé de former vos équipes » sur un imprimé serait un
 * raccourci vendeur mais faux, et invérifiable une fois distribué. Le dépôt
 * porte déjà la bonne formule (keywords/g4-aeo.ts, catalog-v2.ts : art. 4,
 * applicable depuis février 2025) — c'est celle-là, et pas une autre.
 *
 * NB pour qui édite ce bloc : on est DANS un template literal. Un accent
 * grave, même en commentaire, ferme la chaîne — ça a déjà cassé le build deux
 * fois. Citer les fichiers sans les encadrer.
 */
.aiact {
  background:${C.terracotta}; color:${C.blanc}; border-radius:2.5mm;
  padding:3.4mm 4.5mm; display:flex; gap:4.5mm; align-items:center;
}
.aiact .ai-badge {
  flex-shrink:0; text-align:center; padding-right:5mm;
  border-right:1px solid rgba(255,255,255,.35);
}
.aiact .ai-badge b {
  display:block; font-family:'Fraunces', serif; font-size:15pt; line-height:1; color:${C.blanc};
  white-space:nowrap;
}
.aiact .ai-badge span {
  display:block; font-size:6.4pt; font-weight:700; letter-spacing:.1em;
  color:rgba(255,255,255,.9); margin-top:1.4mm; text-transform:uppercase;
}
.aiact .ai-txt b { display:block; font-size:10.5pt; font-weight:700; margin-bottom:1.2mm; }
.aiact .ai-txt p { font-size:7.8pt; line-height:1.38; color:rgba(255,255,255,.95); }

/* ── « Et dans votre secteur » ─────────────────────────────────────────── */
.secteurs { display:grid; grid-template-columns:1fr 1fr; gap:1.2mm 5mm; margin-bottom:4mm; }
.secteur { display:flex; gap:3mm; align-items:baseline; padding-bottom:1.2mm;
  border-bottom:1px dotted rgba(94,108,85,.35); }
.secteur b {
  font-size:8.4pt; font-weight:700; color:${C.terracotta}; white-space:nowrap;
  min-width:37mm;
}
.secteur span { font-size:7.5pt; line-height:1.3; color:#5A5149; }

/* Le rappel que le métier du lecteur est couvert, quel qu'il soit. */
.metiers-rappel {
  background:${C.encreDoux}; color:${C.creme}; border-radius:2mm;
  padding:2.6mm 4mm; margin-bottom:4mm; font-size:7.6pt; line-height:1.4;
}
.metiers-rappel b { color:${C.terracottaVif}; font-weight:700; }
.metiers-rappel i { font-style:normal; color:${C.blanc}; font-weight:700; }

/*
 * « Axion-IA, c'est aussi » — les trois prestations HORS formation.
 *
 * ⚠️ SANS DÉTAIL NI PRIX, volontairement (demande Will). Ce dépliant est un
 * imprimé sur les FORMATIONS : elles seules sont finançables par l'OPCO, et
 * tout le document repose sur ce message. Détailler ici l'audit, le 1-to-1 et
 * l'implémentation — qui sont des prestations de conseil NON finançables —
 * brouillerait la seule chose que le lecteur doit retenir. On signale
 * l'existence, le catalogue complet fait le reste : c'est exactement le rôle
 * du QR de la page.
 */
.aussi {
  border-top:1px solid rgba(94,108,85,.3); padding-top:2.8mm; margin-bottom:3.5mm;
}
.aussi h3 {
  font-size:7.4pt; font-weight:700; letter-spacing:.16em; text-transform:uppercase;
  color:${C.olive}; margin-bottom:2.5mm;
}
.aussi-grille { display:grid; grid-template-columns:repeat(3,1fr); gap:4mm; }
.aussi-item b { display:block; font-size:8.8pt; font-weight:700; margin-bottom:.8mm; }
.aussi-item span { display:block; font-size:7.4pt; line-height:1.35; color:#5A5149; }

/* ── Bande de logos clients ────────────────────────────────────────────── */
.confiance { margin-top:auto; padding-top:2.5mm; }
.confiance h3 {
  font-size:7.6pt; font-weight:700; letter-spacing:.18em; text-transform:uppercase;
  color:${C.olive}; text-align:center; margin-bottom:3mm;
}
.logos {
  display:flex; flex-wrap:wrap; justify-content:center; align-items:center;
  gap:3mm 6mm;
}
/* Hauteur commune, largeur dérivée du ratio du viewBox : c'est la même
 * normalisation que la bande du site (toutes les hauteurs à 60 px), sans quoi
 * un logo large écraserait visuellement les autres. */
.logos img { height:5.6mm; width:auto; max-width:21mm; object-fit:contain; opacity:.85; }
/* ── Page 3 · les formations ────────────────────────────────────────────── */
.colonnes { display:grid; grid-template-columns:1fr 1fr 1fr; gap:4mm; margin-top:1mm; }
.colonne { display:flex; flex-direction:column; }
.col-tete { margin-bottom:2.5mm; padding-bottom:1.8mm; border-bottom:1.6px solid ${C.olive}; }
.col-tete b { display:block; font-family:'Fraunces', serif; font-size:11.5pt; font-weight:700; line-height:1.1; }
.col-tete span { display:block; font-size:7pt; font-weight:700; color:${C.terracotta}; margin-top:1mm; letter-spacing:.03em; }
.col-tete i { display:block; font-style:normal; font-size:6.8pt; color:#6E645C; margin-top:.6mm; }

.formation {
  background:${C.blanc}; border-radius:1.6mm; padding:2.1mm 2.6mm; margin-bottom:1.5mm;
  border-left:2.2px solid ${C.olive};
}
.formation b { display:block; font-size:8.3pt; font-weight:700; line-height:1.2; }
.formation .meta { display:flex; align-items:center; gap:1.8mm; margin-top:1.2mm; }
.formation .duree {
  background:${C.sable}; color:${C.encre}; border-radius:99px; padding:.5mm 1.8mm;
  font-size:6.6pt; font-weight:700;
}
.formation .prix {
  background:${C.olive}; color:${C.blanc}; border-radius:99px; padding:.5mm 2mm;
  font-size:6.8pt; font-weight:700;
}

.seminaire {
  margin-top:3mm; background:${C.encreDoux}; color:${C.creme}; border-radius:2.5mm;
  padding:4.5mm 5.5mm; display:flex; gap:6mm; align-items:center;
}
.seminaire .sem-t { flex:1; }
.seminaire b { font-family:'Fraunces', serif; font-size:14pt; color:${C.blanc}; display:block; }
.seminaire i { font-style:italic; font-family:'Fraunces', serif; color:${C.terracottaVif}; font-size:9.6pt; display:block; margin-top:1mm; }
.seminaire p { font-size:8pt; line-height:1.4; color:${C.sable}; margin-top:1.8mm; }
.seminaire .sem-p {
  flex-shrink:0; text-align:center; border-left:1px solid rgba(236,224,200,.28); padding-left:6mm;
}
.seminaire .sem-p b { font-family:'Fraunces', serif; font-size:16pt; color:${C.terracottaVif}; }
.seminaire .sem-p span { display:block; font-size:6.8pt; color:${C.sable}; margin-top:1mm; letter-spacing:.06em; }

.note-page3 { font-size:7pt; line-height:1.4; color:#6E645C; margin-top:2.5mm; font-style:italic; }

.objectifs { margin-top:4mm; }
.objectifs h3 {
  font-size:7.6pt; font-weight:700; letter-spacing:.16em; text-transform:uppercase;
  color:${C.olive}; margin-bottom:2.5mm;
}
.obj-grille { display:grid; grid-template-columns:1fr 1fr; gap:1.4mm 5mm; }
.obj {
  display:flex; align-items:baseline; gap:2mm; font-size:8pt;
  border-bottom:1px dotted rgba(94,108,85,.35); padding-bottom:1.2mm;
}
.obj .veux { flex:1; color:#4A423C; }
.obj .fl { color:${C.terracotta}; font-weight:700; }
.obj .vers { font-weight:700; color:${C.encre}; text-align:right; }

/* ── Page 4 · tarifs, financement, contact ──────────────────────────────── */
.surmesure { display:flex; gap:4.5mm; align-items:stretch; margin-bottom:4mm; }
.surmesure .sm-texte { flex:1; display:flex; flex-direction:column; gap:2.5mm; }
.surmesure .sm-texte { justify-content:space-between; }
.sm-item {
  background:${C.blanc}; border-left:2.2px solid ${C.olive}; border-radius:1.8mm;
  padding:2.8mm 3.5mm; display:flex; gap:3mm; align-items:center; flex:1;
}
.sm-item .sm-num {
  font-family:'Fraunces', serif; font-size:19pt; color:${C.sable};
  line-height:1; flex-shrink:0;
}
.sm-item b { display:block; font-size:10pt; font-weight:700; margin-bottom:1mm; }
.sm-item p { font-size:8.2pt; line-height:1.35; color:#5A5149; }

/* La carte du QR catalogue — le seul appel à l'action de cette page avec
 * l'appel découverte. Elle porte l'URL EN CLAIR sous le code : un QR seul est
 * inutilisable pour qui lit le dépliant sur un écran, ou n'a pas son téléphone. */
.sm-qr {
  width:52mm; flex-shrink:0; background:${C.terracotta}; color:${C.blanc};
  border-radius:2.5mm; padding:4mm; text-align:center;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
}
.sm-qr b { font-family:'Fraunces', serif; font-size:12.5pt; line-height:1.1; display:block; }
.sm-qr .sm-pages {
  display:block; font-size:7pt; font-weight:700; letter-spacing:.14em;
  color:rgba(255,255,255,.85); margin-top:1mm; text-transform:uppercase;
}
.sm-qr img {
  width:24mm; height:24mm; background:${C.blanc}; padding:1.4mm;
  border-radius:2mm; margin:2.2mm 0;
}
.sm-qr .sm-lib { display:block; font-size:6.8pt; line-height:1.35; color:rgba(255,255,255,.94); }
.sm-qr .sm-url {
  display:block; font-size:7.4pt; font-weight:700; color:${C.blanc};
  margin-top:2mm; padding-top:2mm; border-top:1px solid rgba(255,255,255,.3);
}


.finance {
  background:${C.terracotta}; color:${C.blanc}; border-radius:2.5mm; padding:5mm 5.5mm;
  display:flex; gap:5mm; align-items:center; margin-bottom:4mm;
}
.finance .fin-t { flex:1; }
.finance .fin-t > b { font-family:'Fraunces', serif; font-size:14pt; display:block; line-height:1.1; }
.finance p { font-size:8.3pt; line-height:1.45; margin-top:2mm; color:rgba(255,255,255,.96); }

/* Les deux chiffres qui portent la page : ils disent en un coup d'œil ce que
 * le paragraphe voisin met quatre lignes à expliquer. */
.fin-chiffres { display:flex; gap:5mm; flex-shrink:0; padding-right:5mm; border-right:1px solid rgba(255,255,255,.3); }
.fin-c { text-align:center; }
.fin-c b {
  font-family:'Fraunces', serif; font-size:30pt; line-height:.95; color:${C.blanc};
  display:block; white-space:nowrap;
}
.fin-c span {
  display:block; font-size:6.8pt; font-weight:700; letter-spacing:.08em;
  color:rgba(255,255,255,.9); margin-top:1.5mm; text-transform:uppercase; line-height:1.3;
}
.finance .fin-q { flex-shrink:0; background:${C.blanc}; border-radius:2mm; padding:2.4mm; width:41mm; }
.finance .fin-q img { width:100%; display:block; }

.deux { display:grid; grid-template-columns:1fr 1fr; gap:4mm; margin-bottom:4mm; }
.carte { background:${C.blanc}; border-radius:2mm; padding:2.8mm 3.5mm; border-left:2.2px solid ${C.olive}; }
.carte > b { display:block; font-size:9pt; font-weight:700; margin-bottom:1.5mm; }
.carte p { font-size:7.8pt; line-height:1.42; color:#5A5149; }
.carte ul { list-style:none; margin-top:1mm; }
.carte li { font-size:7.6pt; line-height:1.4; color:#5A5149; padding-left:3.2mm; position:relative; }
.carte li::before { content:'·'; position:absolute; left:.8mm; color:${C.terracotta}; font-weight:700; }

.contact {
  background:${C.encreDoux}; color:${C.creme}; border-radius:2.5mm; padding:3.8mm 4.5mm;
  display:flex; gap:6mm; align-items:center;
}
.contact .ct { flex:1; }
.contact .ct > b { font-family:'Fraunces', serif; font-size:17pt; color:${C.blanc}; display:block; line-height:1.1; }
.contact .ct > b em { font-style:italic; color:${C.terracottaVif}; }
.contact p { font-size:8.2pt; line-height:1.45; color:${C.sable}; margin-top:2mm; }
.contact .coord { font-size:8.4pt; font-weight:700; color:${C.blanc}; margin-top:2.5mm; line-height:1.6; }
.contact .cq { text-align:center; flex-shrink:0; }
.contact .cq img { width:23mm; height:23mm; background:${C.blanc}; padding:1.4mm; border-radius:2mm; }
.contact .cq span { display:block; font-size:6.6pt; font-weight:700; color:${C.sable}; margin-top:1.4mm; }

/*
 * ⚠️ Les mentions restent DANS LE FLUX. Elles étaient en « position:absolute ;
 * bottom:11mm », ce qui les faisait passer SOUS le bloc contact : les deux
 * textes se superposaient, et les mentions légales — la seule partie de ce
 * dépliant qui soit une obligation (LCEN art. 1-1) — devenaient illisibles.
 * Un bloc absolu ne réserve aucune place ; il ne peut donc pas empêcher qu'on
 * lui marche dessus. « margin-top:auto » le colle en bas SANS sortir du flux.
 */
.mentions {
  margin-top:auto; padding-top:3mm;
  font-size:5.9pt; line-height:1.42; color:#7B7169;
}
.mentions b { color:#5A5149; }

/* ── Version imprimeur : fond perdu 3 mm + repères de coupe ──────────────
 *
 * La page passe de 210 × 297 à 216 × 303 mm. Le contenu garde sa taille et
 * son calage — il est simplement décalé de 3 mm vers l'intérieur — et les
 * aplats de bord (bande de tranche, bandeau de pied, fond de couverture)
 * débordent dans la zone qui sera rognée.
 *
 * ⚠️ Les repères de coupe sont HORS du format fini, dans le fond perdu :
 * placés dedans, ils seraient imprimés sur le document livré. Ils s'arrêtent
 * donc à 1 mm du trait de coupe et pointent vers l'extérieur.
 */
.planche-fp {
  width:216mm; height:303mm; position:relative; overflow:hidden;
  background:${C.creme}; page-break-after:always; break-after:page;
}
/*
 * ⚠️ Le support prend la couleur de fond de la page qu'il porte. Sans cette
 * règle, la couverture — seule page à fond sombre — laissait apparaître une
 * bande CRÈME de 3 mm sur ses bords droit et inférieur : le fond perdu ne
 * mordait pas, et la coupe aurait montré un liseré clair sur un imprimé
 * noir. Le défaut ne se voit pas à l'écran sur le PDF au format fini ; il ne
 * serait apparu qu'après massicotage.
 */
.planche-fp:has(> .page.couv) { background:${C.encre}; }
.planche-fp:last-child { page-break-after:auto; break-after:auto; }
.planche-fp > .page {
  position:absolute; top:3mm; left:3mm;
  page-break-after:auto; break-after:auto;
}
/* Les aplats qui doivent mordre dans le fond perdu : on les prolonge de 3 mm
 * au-delà du format fini, dans les quatre directions utiles. */
.planche-fp > .page .tranche { right:-3mm; width:8mm; top:-3mm; height:calc(100% + 6mm); }
.planche-fp > .page .tranche.gauche { right:auto; left:-3mm; }
.planche-fp > .page .pied { left:-3mm; right:-3mm; bottom:-3mm; height:12mm; padding-bottom:3mm; }
.planche-fp > .page.couv { overflow:visible; }
.planche-fp > .page.couv .couv-photo { top:-3mm; left:-3mm; width:calc(100% + 6mm); height:65mm; }
.planche-fp > .page.couv .couv-voile { top:-3mm; left:-3mm; width:calc(100% + 6mm); height:65mm; }
.planche-fp > .page.couv .couv-bande { left:-3mm; right:-3mm; }
.planche-fp > .page.couv .couv-pied { left:-3mm; right:-3mm; bottom:-3mm; height:10mm; }

.repere { position:absolute; background:${C.encre}; }
.repere.h { height:.25mm; width:2mm; }
.repere.v { width:.25mm; height:2mm; }

/* ── Planche A3 ─────────────────────────────────────────────────────────── */
.planche { width:420mm; height:297mm; display:flex; page-break-after:always; break-after:page; }
.planche:last-child { page-break-after:auto; break-after:auto; }
.planche .page { page-break-after:auto; break-after:auto; }
`;
}

function pageCouverture(a: Actifs): string {
  return `
<div class="page couv">
  <img class="couv-photo" src="${a.photo}" alt="">
  <div class="couv-voile"></div>
  <div class="couv-marque"><img src="${a.logo}" alt="Axion-IA"></div>
  <div class="couv-millesime">2026 · 2027</div>

  <div class="couv-titre">
    <div class="couv-sur">Catalogue de formations IA en entreprise</div>
    <h1>L'IA,<em>de l'idée à l'impact.</em></h1>
    <div class="couv-sous">21 formations + 1 séminaire · intra-entreprise, présentiel &amp; distanciel</div>
  </div>

  <div class="couv-bande">Organisme de formation certifié Qualiopi — prise en charge OPCO jusqu'à 100 %</div>

  <div class="couv-bas">
    <div class="couv-argent">
      <div class="couv-zero">
        <div class="chiffre"><b>0 €</b><span>RESTE À CHARGE<br>POSSIBLE</span></div>
        <div class="texte">
          <h3>Vos formations peuvent ne rien vous coûter</h3>
          <p>Prises en charge par votre OPCO, <b>jusqu'à 100 %</b> — vous avez déjà cotisé pour ça.
          En subrogation, l'OPCO nous règle directement : vous n'avancez rien. Nous montons le dossier de A à Z.</p>
        </div>
      </div>
      <div class="couv-qualiopi"><img src="${a.qualiopi}" alt="Qualiopi — processus certifié"></div>
    </div>

    <div class="couv-offre">
      <div>
        <div class="couv-fondateur">
          <img src="${a.portrait}" alt="${echapper(a.portraitAlt)}">
          <div class="cf-txt">
            <b>Williams Jullin</b>
            <span>Fondateur &amp; formateur — Axion-IA</span>
          </div>
        </div>
        <h2>Par où commencer ? <em>La réponse à l'intérieur.</em></h2>
        <p>Trois portes d'entrée — le socle pour toute l'équipe, l'IA appliquée à votre métier,
        l'IA appliquée à votre secteur. Et une journée pour mettre toute l'entreprise au diapason.</p>
      </div>
      <div class="couv-qr">
        <img src="${a.qrCatalogue}" alt="">
        <span>Le catalogue<br>complet · 48 p.</span>
      </div>
    </div>

    <div class="couv-trois">
      <div>
        <b>${GENERALES.length}</b>
        <i>Offres générales</i>
        <span>Le socle pour toute l'équipe<br>${echapper(fourchette("generale"))} / groupe</span>
      </div>
      <div>
        <b>${METIERS.length}</b>
        <i>Par métier</i>
        <span>RH, marketing, vente, finance…<br>${echapper(fourchette("metier"))} / groupe</span>
      </div>
      <div>
        <b>${SECTEURS.length}</b>
        <i>Par secteur</i>
        <span>Santé, BTP, immobilier, industrie…<br>${echapper(fourchette("secteur"))} / groupe</span>
      </div>
    </div>
  </div>

  <div class="couv-note">
    Prise en charge applicable aux formations et au séminaire, sur montants HT, selon votre OPCO et votre situation.
    Le montant réellement pris en charge dépend de votre OPCO. Actions non éligibles au CPF.
  </div>
  <div class="couv-pied"></div>
</div>`;
}

/**
 * PAGE 2 — le temps rendu, en barres.
 *
 * ⚠️ REFONTE 2026-08-25 (Will : « ça fait trop bloc de texte, personne ne va
 * le lire »). La version précédente empilait huit rangées de texte, un pavé
 * de démenti, cinq étapes rédigées et quatre questions-réponses : environ
 * 480 mots sur une page de dépliant. C'était un rapport, pas un imprimé.
 *
 * Règle appliquée ici : CE QUI PEUT SE DESSINER NE S'ÉCRIT PAS. Le gain de
 * temps devient une barre, le parcours une frise, la conformité une bande
 * d'une ligne. La FAQ a disparu — sur un flyer, une question-réponse est du
 * texte que personne ne lit debout.
 */
function pagePourquoi(a: Actifs): string {
  const barres = TACHES.map((t) => {
    const part = Math.max(6, Math.round((t.apres / t.avant) * 100));
    return `
    <div class="barre">
      <div class="nom">${echapper(t.t)}</div>
      <div class="piste"><div class="plein" style="width:${part}%"></div></div>
      <div class="tps"><s>${echapper(t.a)}</s><i>→</i><b>${echapper(t.b)}</b></div>
    </div>`;
  }).join("");

  const blocsSecteurs = secteurs()
    .map(
      (s) => `
    <div class="secteur"><b>${echapper(s.nom)}</b><span>${echapper(s.apres)}</span></div>`,
    )
    .join("");

  const jalons = PARCOURS.map(
    (e) => `
    <div class="jalon">
      <div class="rond">${e.n}</div>
      <b>${echapper(e.t)}</b>
      <span>${echapper(e.d)}</span>
    </div>`,
  ).join("");

  return `
<div class="page">
  <div class="tranche gauche"></div>
  <div class="corps">
    <div class="entete">
      <img src="${a.logo}" alt="Axion-IA">
      <div class="rubrique">Le temps que l'IA vous rend</div>
    </div>

    <h1 class="titre">Le même travail, <em>en dix fois moins de temps.</em></h1>
    <p class="chapo">D'abord les tâches que <b>toutes</b> les équipes font. Ensuite, ce que ça donne
    <b>dans votre secteur.</b></p>

    <div style="height:5mm"></div>
    <div class="barres">${barres}</div>

    <h2 class="section">Et dans votre secteur <span class="compte">8 SECTEURS</span></h2>
    <div class="secteurs">${blocsSecteurs}</div>

    <div class="metiers-rappel">
      <b>Votre métier y est.</b> <i>RH · Marketing · Commerciaux · Finance · Juridique · Production ·
      Achats · Relation client · IT</i> — 9 formations par fonction, 8 par secteur, plus le socle commun
      et le séminaire. <b>Et s'il n'y est pas, on la construit</b> : 4 h à 3 jours, tout thème.
    </div>

    <div class="kpis">
      <div class="kpi"><b>1 h</b><span>gagnée par jour<br>et par personne formée</span></div>
      <div class="kpi"><b>1 temps plein</b><span>récupéré chaque mois<br>dès 8 personnes formées</span></div>
      <div class="kpi"><b>Semaine 1</b><span>les premiers gains<br>sur vos vrais dossiers</span></div>
    </div>

    <h2 class="section">De l'appel au terrain <span class="compte">5 ÉTAPES</span></h2>
    <div class="chemin">${jalons}</div>

    <div class="aiact">
      <div class="ai-badge">
        <b>Art. 4</b>
        <span>AI Act<br>depuis fév. 2025</span>
      </div>
      <div class="ai-txt">
        <b>La littératie IA de vos équipes est une obligation.</b>
        <p>Le règlement européen impose d'assurer un niveau suffisant de maîtrise de l'IA chez ceux qui
        l'utilisent. Se former, c'est y répondre <b>et</b> en garder la preuve : programmes, émargements,
        attestations — les pièces que produit un organisme certifié Qualiopi.</p>
      </div>
    </div>

  </div>
  <div class="pied">
    <span><strong>Prise en charge OPCO jusqu'à 100 %</strong> — sans avance de votre part · axion-ia.com/formations</span>
    <span class="folio">02 · 04</span>
  </div>
</div>`;
}

function pageFormations(a: Actifs): string {
  const bloc = (l: Ligne) => `
    <div class="formation">
      <b>${echapper(l.titre)}</b>
      <div class="meta"><span class="duree">${l.duree}</span><span class="prix">${echapper(l.prix)} HT</span></div>
    </div>`;

  return `
<div class="page">
  <div class="tranche"></div>
  <div class="corps">
    <div class="entete">
      <img src="${a.logo}" alt="Axion-IA">
      <div class="rubrique">Les 21 formations + le séminaire</div>
    </div>

    <h1 class="titre">Quelle formation <em>pour vous ?</em></h1>
    <p class="chapo">Trois portes d'entrée, à prix publics par groupe. Toutes en intra-entreprise, présentiel ou distanciel,
    de 2 à 15 participants — <b>et toutes finançables par votre OPCO, jusqu'à 100 %.</b></p>

    <div style="height:4mm"></div>
    <div class="colonnes">
      <div class="colonne">
        <div class="col-tete">
          <b>Offres générales</b>
          <span>${echapper(fourchette("generale"))} / groupe</span>
          <i>Le socle pour toute l'équipe.</i>
        </div>
        ${GENERALES.map(bloc).join("")}
      </div>
      <div class="colonne">
        <div class="col-tete">
          <b>Par métier</b>
          <span>${echapper(fourchette("metier"))} / groupe</span>
          <i>L'IA appliquée aux tâches réelles de chaque fonction.</i>
        </div>
        ${METIERS.map(bloc).join("")}
      </div>
      <div class="colonne">
        <div class="col-tete">
          <b>Par secteur</b>
          <span>${echapper(fourchette("secteur"))} / groupe</span>
          <i>Dans votre vocabulaire et vos contraintes.</i>
        </div>
        ${SECTEURS.map(bloc).join("")}
      </div>
    </div>

    <div class="seminaire">
      <div class="sem-t">
        <b>Séminaire IA</b>
        <i>Mettre toute l'entreprise au diapason.</i>
        <p>Tous services, tous métiers, tous niveaux réunis le même jour — en tables de 6 à 8.</p>
      </div>
      <div class="sem-p"><b>50</b><span>PARTICIPANTS<br>MAXIMUM</span></div>
      <div class="sem-p"><b>1 j</b><span>SUR DEVIS</span></div>
    </div>

    <p class="note-page3"><b>Des portes d'entrée, pas un catalogue fermé</b> — le contenu sort de vos tâches
    réelles. Sur mesure possible, 4 h à 3 jours. Prix HT par groupe, pas par personne.</p>

    <div class="objectifs">
      <h3>Par objectif — « je veux… »</h3>
      <div class="obj-grille">
        ${OBJECTIFS.map(
          (o) => `<div class="obj">
            <span class="veux">${echapper(o.veux)}</span>
            <span class="fl">→</span>
            <span class="vers">${echapper(o.vers)}</span>
          </div>`,
        ).join("")}
      </div>
    </div>
  </div>
  <div class="pied">
    <span><strong>21 formations + 1 séminaire</strong> · programmes détaillés sur axion-ia.com/formations</span>
    <span class="folio">03 · 04</span>
  </div>
</div>`;
}

/**
 * PAGE 4 — sur mesure, financement, contact.
 *
 * ⚠️ IL N'Y A PLUS DE GRILLE TARIFAIRE ICI, et ce n'est pas un oubli (décision
 * Will, 2026-08-25). Elle faisait doublon deux fois : les mêmes six cases
 * étaient déjà sur les pastilles de la page 3, et le catalogue 48 p. — vers
 * lequel pointe le QR de couverture — porte la grille complète, avec les
 * lignes que ce dépliant n'a pas (1-to-1, audit, implémentation). Un tarif
 * imprimé à deux endroits est un tarif qui finira par se contredire.
 * La place récupérée sert à dire ce que la grille ne disait pas : que chaque
 * session est bâtie sur le métier du client.
 */
function pageTarifs(a: Actifs): string {
  return `
<div class="page">
  <div class="tranche"></div>
  <div class="corps">
    <div class="entete">
      <img src="${a.logo}" alt="Axion-IA">
      <div class="rubrique">Sur mesure · financement · contact</div>
    </div>

    <h1 class="titre">Une formation qui parle <em>de votre métier.</em></h1>
    <p class="chapo">Les 22 intitulés sont des <b>portes d'entrée, pas un menu fermé.</b></p>

    <div style="height:5mm"></div>

    <div class="surmesure">
      <div class="sm-texte">
        <div class="sm-item">
          <span class="sm-num">01</span>
          <div><b>Vos dossiers</b><p>Chacun travaille en séance sur ses affaires en cours.</p></div>
        </div>
        <div class="sm-item">
          <span class="sm-num">02</span>
          <div><b>Métier × secteur</b><p>Commercial dans le BTP ≠ commercial en immobilier.</p></div>
        </div>
        <div class="sm-item">
          <span class="sm-num">03</span>
          <div><b>Hors catalogue</b><p>4 h à 3 jours, tout thème. Finançable pareil.</p></div>
        </div>
      </div>
      <div class="sm-qr">
        <b>Le catalogue complet</b>
        <span class="sm-pages">48 pages</span>
        <img src="${a.qrCatalogue}" alt="">
        <span class="sm-lib">Programmes détaillés, tarifs, audit et implémentation.</span>
        <span class="sm-url">axion-ia.com/catalogue</span>
      </div>
    </div>

    <div class="finance">
      <div class="fin-chiffres">
        <div class="fin-c"><b>0 €</b><span>reste à charge<br>possible</span></div>
        <div class="fin-c"><b>100 %</b><span>pris en charge<br>par votre OPCO</span></div>
      </div>
      <div class="fin-t">
        <b>Certifié Qualiopi</b>
        <p>Nos formations sont des <b>actions de formation</b> : votre OPCO les finance, vous avez déjà cotisé.
        En subrogation, <b>vous n'avancez rien.</b> Dossier monté par nous, de A à Z.</p>
      </div>
      <div class="fin-q"><img src="${a.qualiopi}" alt="Qualiopi — processus certifié"></div>
    </div>

    <div class="deux">
      <div class="carte">
        <b>Vos équipes filmées — offert</b>
        <p>Interviews de vos équipes formées, tournées le jour même. Page dédiée sur axion-ia.com
        et backlink dofollow.</p>
      </div>
      <div class="carte">
        <b>Vos données restent chez vous</b>
        <ul>
          <li>Liste rouge &amp; anonymisation dans chaque formation</li>
          <li>Traitements en Union européenne</li>
          <li>Rien conservé, rien réutilisé, rien pour entraîner</li>
        </ul>
      </div>
    </div>

    <div class="aussi">
      <h3>Axion-IA, c'est aussi</h3>
      <div class="aussi-grille">
        <div class="aussi-item">
          <b>Audit IA</b>
          <span>On cartographie vos usages et on priorise.</span>
        </div>
        <div class="aussi-item">
          <b>Accompagnement 1-to-1</b>
          <span>Dirigeant ou collaborateur, sur ses propres dossiers — pour des gains concrets.</span>
        </div>
        <div class="aussi-item">
          <b>Implémentation &amp; intégration</b>
          <span>Code source, site web, SaaS : on conçoit, on développe, on met en production.</span>
        </div>
      </div>
    </div>

    <div class="contact">
      <div class="ct">
        <b>Parlons de <em>vos équipes.</em></b>
        <p>30 minutes pour cibler les formations utiles et chiffrer l'OPCO. Devis sous 48 h.
        Sans engagement.</p>
        <div class="coord">axion-ia.com/appel · contact@axion-ia.com<br>Grenoble · Auvergne-Rhône-Alpes</div>
      </div>
      <div class="cq"><img src="${a.qrAppel}" alt=""><span>Réserver<br>un appel</span></div>
      <div class="cq"><img src="${a.qrAvis}" alt=""><span>Leurs retours<br>en vidéo</span></div>
    </div>

    <div class="confiance">
      <h3>Ils nous font confiance</h3>
      <div class="logos">
        ${a.logos.map((l) => `<img src="${l.src}" alt="${echapper(l.nom)}">`).join("")}
      </div>
    </div>

    <div class="mentions">
      <b>Organisme de formation certifié Qualiopi.</b> ${echapper(QUALIOPI_MENTION)}<br>
      ${echapper(MENTIONS)}
    </div>
  </div>
  <div class="pied">
    <span><strong>Le catalogue complet, 48 pages</strong> · axion-ia.com/catalogue — devis chiffré sous 48 h</span>
    <span class="folio">04 · 04</span>
  </div>
</div>`;
}

/**
 * Refuse de produire un PDF dont une page déborde.
 *
 * POURQUOI (2026-08-25, après coup). En ajoutant le bandeau « + des dizaines
 * d'autres », la page 2 a dépassé les 297 mm : `overflow:hidden` a simplement
 * COUPÉ le bas, faisant disparaître deux questions entières. Aucune erreur,
 * aucun avertissement — un PDF valide, quatre pages, du contenu en moins.
 * C'est le pire mode de défaillance possible pour un imprimé : il ne se voit
 * qu'en relisant, et pas toujours.
 *
 * On mesure donc, dans le navigateur, la hauteur réelle de chaque `.corps`
 * face à la place disponible, et on jette si ça ne rentre pas.
 */
async function verifierDebordements(page: import("playwright").Page): Promise<void> {
  const trop = await page.evaluate(() => {
    const ecarts: Array<{ page: number; deborde: number }> = [];
    document.querySelectorAll(".page").forEach((el, i) => {
      const corps = el.querySelector(".corps");
      if (!corps) return; // la couverture est en positionnement absolu, hors flux

      // ⚠️ NE PAS mesurer `scrollHeight - clientHeight` : essayé, c'est un
      // NO-OP ici. `overflow:hidden` est posé sur `.page`, pas sur `.corps` ;
      // le dépassement est donc rogné UN CRAN PLUS HAUT, et `.corps` rapporte
      // sagement scroll 1123 / client 1123 alors qu'on venait de lui injecter
      // 60 mm de contenu. On compare les rectangles réels : le bas du dernier
      // enfant contre le bas de la zone de texte (padding inférieur exclu, il
      // réserve la place du bandeau de pied).
      const boite = corps.getBoundingClientRect();
      const padBas = parseFloat(getComputedStyle(corps).paddingBottom) || 0;
      const limite = boite.bottom - padBas;

      let basReel = boite.top;
      for (const enfant of Array.from(corps.children)) {
        const r = enfant.getBoundingClientRect();
        if (r.height > 0 && r.bottom > basReel) basReel = r.bottom;
      }

      const debord = basReel - limite;
      if (debord > 1) ecarts.push({ page: i + 1, deborde: debord });
    });
    return ecarts;
  });

  if (trop.length === 0) return;

  const pxParMm = 96 / 25.4;
  const detail = trop
    .map((t) => `    page ${t.page} : ${(t.deborde / pxParMm).toFixed(1)} mm de trop`)
    .join("\n");
  throw new Error(
    `Le contenu déborde de la page — il serait COUPÉ en silence dans le PDF :\n${detail}\n` +
      `  Retirer du contenu ou resserrer les espacements ; ne PAS masquer en augmentant overflow.`,
  );
}

/**
 * Enveloppe une page dans un support 216 × 303 mm avec ses 8 repères de coupe.
 *
 * Le fond perdu vaut 3 mm — la valeur demandée par Exaprint comme par
 * Vistaprint sur ce format. Les repères sont posés aux quatre coins, à
 * l'extérieur du trait de coupe.
 */
function avecFondPerdu(page: string): string {
  // Les 4 coins × 2 traits (un horizontal, un vertical), tous hors format fini.
  const reperes = [
    // haut-gauche
    `<div class="repere h" style="top:3mm;left:0"></div>`,
    `<div class="repere v" style="left:3mm;top:0"></div>`,
    // haut-droit
    `<div class="repere h" style="top:3mm;right:0"></div>`,
    `<div class="repere v" style="right:3mm;top:0"></div>`,
    // bas-gauche
    `<div class="repere h" style="bottom:3mm;left:0"></div>`,
    `<div class="repere v" style="left:3mm;bottom:0"></div>`,
    // bas-droit
    `<div class="repere h" style="bottom:3mm;right:0"></div>`,
    `<div class="repere v" style="right:3mm;bottom:0"></div>`,
  ].join("");

  return `<div class="planche-fp">${page}${reperes}</div>`;
}

function documentHtml(corps: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Dépliant formations — Axion-IA</title><style>${styles()}</style></head>
<body>${corps}</body></html>`;
}

// ────────────────────────────────────────────────────────────────────────────
// RENDU
// ────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("→ Découpe du lockup Qualiopi / logo…");
  const { qualiopi, logo } = await decouperLockup();

  console.log("→ Recadrage de la photo de couverture…");
  const photo = await photoCouverture();

  console.log("→ Recadrage du portrait du fondateur…");
  const portrait = portraitFondateur();

  console.log("→ Génération des QR…");
  const a: Actifs = {
    qualiopi,
    logos: logosClients(),
    logo,
    photo,
    qrFormations: await qr(QR.formations),
    qrAppel: await qr(QR.appel),
    qrCatalogue: await qr(QR.catalogue),
    qrAvis: await qr(QR.avis),
    portrait: await portrait.src,
    portraitAlt: portrait.alt,
  };

  const p1 = pageCouverture(a);
  const p2 = pagePourquoi(a);
  const p3 = pageFormations(a);
  const p4 = pageTarifs(a);

  mkdirSync(SORTIE, { recursive: true });

  const htmlA4 = documentHtml(p1 + p2 + p3 + p4);
  // Imposition pliage simple : la couverture doit tomber à DROITE du recto.
  const htmlA3 = documentHtml(
    `<div class="planche">${p4}${p1}</div><div class="planche">${p2}${p3}</div>`,
  );

  // Version imprimeur : 4 pages A4 séparées, chacune à 216 × 303 mm avec ses
  // repères. Pages SÉPARÉES et non imposées : Vistaprint comme Exaprint
  // imposent eux-mêmes à partir des pages du fichier — leur livrer une planche
  // A3 déjà imposée ferait doublon et casserait leur gabarit.
  const htmlImprimeur = documentHtml([p1, p2, p3, p4].map(avecFondPerdu).join(""));

  // ⚠️ Les aperçus HTML vont dans le RÉPERTOIRE TEMPORAIRE, jamais sous
  // `public/`. Ils y étaient au premier jet : or tout ce qui vit sous `public/`
  // entre dans l'image Docker et devient servi en clair — deux fichiers d'un
  // mégaoctet, avec les fontes en base64, atteignables par n'importe qui à une
  // URL devinable. Un fichier de travail n'a rien à faire dans un dossier dont
  // le contrat est « tout ceci est public ».
  const apercus = join(tmpdir(), "axion-depliant");
  mkdirSync(apercus, { recursive: true });
  const debug = join(apercus, "depliant-apercu.html");
  writeFileSync(debug, htmlA4, "utf8");
  writeFileSync(join(apercus, "depliant-apercu-A3.html"), htmlA3, "utf8");
  writeFileSync(join(apercus, "depliant-imprimeur.html"), htmlImprimeur, "utf8");

  console.log("→ Rendu PDF (Playwright / Chromium)…");
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();

  await page.setContent(htmlA4, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await verifierDebordements(page);
  await page.pdf({
    path: join(SORTIE, "depliant-formations-axion-ia.pdf"),
    width: "210mm",
    height: "297mm",
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });

  await page.setContent(htmlA3, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.pdf({
    path: join(SORTIE, "depliant-formations-axion-ia-A3.pdf"),
    width: "420mm",
    height: "297mm",
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });

  await page.setContent(htmlImprimeur, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.pdf({
    path: join(SORTIE, "depliant-formations-axion-ia-IMPRIMEUR.pdf"),
    width: "216mm",
    height: "303mm",
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });

  await navigateur.close();

  console.log("");
  console.log("✓ public/imprimes/depliant-formations-axion-ia.pdf      (4 pages A4)");
  console.log("✓ public/imprimes/depliant-formations-axion-ia-A3.pdf   (2 planches A3)");
  console.log(
    "✓ public/imprimes/depliant-formations-axion-ia-IMPRIMEUR.pdf (4 pages 216 × 303, fond perdu 3 mm)",
  );
  console.log(`  aperçu HTML : ${debug}`);
  console.log("");
  console.log(
    `  ${GENERALES.length} générales · ${METIERS.length} métier · ${SECTEURS.length} secteur + 1 séminaire`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
