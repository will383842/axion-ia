// Le DESSIN des pièces de communication, dans le navigateur de l'apporteur (canvas 2D) : aucune
// image n'est fabriquée au serveur, et les pièces à son nom (bannière LinkedIn, couverture
// Facebook) portent son nom sans qu'il ne parte nulle part.
//
// Style = celui de la couverture de la charte de marque : fond noir chaud, lueur et anneaux
// terracotta, titres Fraunces (avec un mot en italique terracotta), texte Manrope — les polices
// du site. Les zones sûres viennent des guides de dimensions des réseaux (vérifiées le 09/10) :
//   · LinkedIn 1584 × 396 : sur téléphone, ~117 px rognés par côté et ~83 px en haut et en bas,
//     la photo de profil couvre le bas à gauche → tout tient dans la bande centrale 1350 × 220 ;
//   · Facebook 1640 × 624 : sur téléphone, ~265 px rognés par côté, la photo de profil couvre le
//     bas à gauche → tout tient au centre, entre x = 300 et x = 1340.

import type { LigneTitre, Visuel } from "@/features/apporteurs-reseau/outils-communication";

export const COULEURS = {
  noir: "#16120f", // hex-ok: dessin canvas, charte figée dans les images exportées
  surface: "#2a2420", // hex-ok: dessin canvas, charte figée dans les images exportées
  creme: "#f3ede4", // hex-ok: dessin canvas, charte figée dans les images exportées
  doux: "#b8ada0", // hex-ok: dessin canvas, charte figée dans les images exportées
  faible: "#9a8f83", // hex-ok: dessin canvas, charte figée dans les images exportées
  vif: "#e07040", // hex-ok: dessin canvas, charte figée dans les images exportées
} as const;

const SERIF = "Fraunces";
const SANS = "Manrope";

export const FORMATS = {
  carre: { l: 1080, h: 1080 },
  story: { l: 1080, h: 1920 },
  linkedin: { l: 1584, h: 396 },
  facebook: { l: 1640, h: 624 },
} as const;

export interface Ressources {
  logo: HTMLImageElement;
}

const POLICES = "/documents/apporteurs/outils/polices";

/** Charge les polices du site et le logo ; à appeler une fois avant de dessiner. */
export async function chargerRessources(): Promise<Ressources> {
  const polices = [
    new FontFace(SERIF, `url(${POLICES}/fraunces-latin-var.woff2)`, { weight: "300 900" }),
    new FontFace(SERIF, `url(${POLICES}/fraunces-latin-var-italic.woff2)`, {
      weight: "300 900",
      style: "italic",
    }),
    new FontFace(SANS, `url(${POLICES}/manrope-latin-var.woff2)`, { weight: "200 800" }),
  ];
  await Promise.all(
    polices.map(async (f) => {
      await f.load();
      document.fonts.add(f);
    }),
  );
  const logo = new Image();
  logo.src = "/images/axion-ia-logo-vectoriel-couleur.svg";
  await logo.decode();
  return { logo };
}

const RATIO_LOGO = 1229 / 521;

function fond(
  ctx: CanvasRenderingContext2D,
  l: number,
  h: number,
  lueur: { x: number; y: number; r: number },
) {
  ctx.fillStyle = COULEURS.noir;
  ctx.fillRect(0, 0, l, h);
  const g = ctx.createRadialGradient(lueur.x, lueur.y, 0, lueur.x, lueur.y, lueur.r);
  g.addColorStop(0, "rgba(224,112,64,0.62)");
  g.addColorStop(0.5, "rgba(198,90,46,0.18)");
  g.addColorStop(1, "rgba(198,90,46,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, l, h);
}

function anneaux(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rayons: number[],
  epaisseur: number,
) {
  rayons.forEach((r, i) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(224,112,64,${0.34 - i * 0.1})`;
    ctx.lineWidth = epaisseur;
    ctx.stroke();
  });
}

/** Le logo dans sa pastille blanche ; (x, y) = coin haut-gauche, ou haut-droit si `aDroite`. */
function pastilleLogo(
  ctx: CanvasRenderingContext2D,
  r: Ressources,
  x: number,
  y: number,
  hLogo: number,
  aDroite = false,
) {
  const px = hLogo * 0.62;
  const py = hLogo * 0.3;
  const lLogo = hLogo * RATIO_LOGO;
  const l = lLogo + 2 * px;
  const h = hLogo + 2 * py;
  const x0 = aDroite ? x - l : x;
  ctx.fillStyle = "#ffffff"; // hex-ok: pastille blanche du logo, dessin canvas
  ctx.beginPath();
  ctx.roundRect(x0, y, l, h, h / 2);
  ctx.fill();
  ctx.drawImage(r.logo, x0 + px, y + py, lLogo, hLogo);
  return h;
}

const police = (taille: number, poids: number, italique = false, famille = SERIF) =>
  `${italique ? "italic " : ""}${poids} ${taille}px ${famille}`;

function largeurLigne(ctx: CanvasRenderingContext2D, ligne: LigneTitre, taille: number) {
  return ligne.reduce((s, seg) => {
    ctx.font = police(taille, seg.i ? 300 : 500, seg.i);
    return s + ctx.measureText(seg.t).width;
  }, 0);
}

/** Titre à segments ; réduit la taille si une ligne dépasse `lMax`. Renvoie la hauteur dessinée. */
function titre(
  ctx: CanvasRenderingContext2D,
  lignes: LigneTitre[],
  o: { x: number; y: number; taille: number; lMax: number; align: "left" | "right" | "center" },
) {
  const plusLarge = Math.max(...lignes.map((l) => largeurLigne(ctx, l, o.taille)));
  const taille = plusLarge > o.lMax ? (o.taille * o.lMax) / plusLarge : o.taille;
  const interligne = taille * 1.0;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  lignes.forEach((ligne, i) => {
    const lTot = largeurLigne(ctx, ligne, taille);
    let x = o.align === "left" ? o.x : o.align === "right" ? o.x - lTot : o.x - lTot / 2;
    const y = o.y + taille * 0.82 + i * interligne;
    for (const seg of ligne) {
      ctx.font = police(taille, seg.i ? 300 : 500, seg.i);
      ctx.fillStyle = seg.i ? COULEURS.vif : COULEURS.creme;
      ctx.fillText(seg.t, x, y);
      x += ctx.measureText(seg.t).width;
    }
  });
  return lignes.length * interligne;
}

/** Texte courant, coupé en lignes de `lMax` au plus. Renvoie la hauteur dessinée. */
function paragraphe(
  ctx: CanvasRenderingContext2D,
  texte: string,
  o: {
    x: number;
    y: number;
    taille: number;
    lMax: number;
    couleur: string;
    align?: CanvasTextAlign;
  },
) {
  ctx.font = police(o.taille, 400, false, SANS);
  ctx.fillStyle = o.couleur;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = "top";
  const lignes: string[] = [];
  let courante = "";
  for (const mot of texte.split(" ")) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (ctx.measureText(essai).width > o.lMax && courante) {
      lignes.push(courante);
      courante = mot;
    } else courante = essai;
  }
  if (courante) lignes.push(courante);
  lignes.forEach((l, i) => ctx.fillText(l, o.x, o.y + i * o.taille * 1.35));
  ctx.textAlign = "left";
  return lignes.length * o.taille * 1.35;
}

function surtitre(
  ctx: CanvasRenderingContext2D,
  texte: string,
  x: number,
  y: number,
  taille: number,
  align: CanvasTextAlign = "left",
) {
  ctx.font = police(taille, 600, false, SANS);
  ctx.fillStyle = COULEURS.vif;
  ctx.textBaseline = "top";
  ctx.textAlign = align;
  ctx.letterSpacing = `${Math.round(taille * 0.26)}px`;
  ctx.fillText(texte.toUpperCase(), x, y);
  ctx.letterSpacing = "0px";
  ctx.textAlign = "left";
}

function trait(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number) {
  ctx.save();
  ctx.shadowColor = "rgba(224,112,64,0.7)";
  ctx.shadowBlur = h * 4;
  ctx.fillStyle = COULEURS.vif;
  ctx.beginPath();
  ctx.roundRect(x, y, l, h, h / 2);
  ctx.fill();
  ctx.restore();
}

/** Visuel de publication : carré (1080 × 1080) ou story (1080 × 1920). */
export function dessinerVisuel(
  canvas: HTMLCanvasElement,
  r: Ressources,
  v: Visuel,
  format: "carre" | "story",
  mentionBas: string,
) {
  const { l, h } = FORMATS[format];
  canvas.width = l;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const story = format === "story";
  const m = 90;
  fond(ctx, l, h, { x: l * 0.5, y: h * (story ? 0.3 : 0.32), r: l * 0.75 });
  anneaux(ctx, l + 30, story ? 520 : 250, [450, 280], 2);

  pastilleLogo(ctx, r, m, story ? 160 : m, 46);
  const yTitre = story ? 640 : 330;
  surtitre(ctx, v.surtitre, m, yTitre, 26);
  const hTitre = titre(ctx, v.titre, {
    x: m,
    y: yTitre + 55,
    taille: 104,
    lMax: l - 2 * m,
    align: "left",
  });
  const yTrait = yTitre + 55 + hTitre + 40;
  trait(ctx, m, yTrait, 110, 8);
  paragraphe(ctx, v.sousTitre, {
    x: m,
    y: yTrait + 40,
    taille: 34,
    lMax: l - 2 * m - 70,
    couleur: COULEURS.doux,
  });

  const yMention = h - (story ? 230 : 120);
  ctx.fillStyle = COULEURS.surface;
  ctx.fillRect(m, yMention, l - 2 * m, 2);
  paragraphe(ctx, mentionBas, {
    x: m,
    y: yMention + 26,
    taille: 24,
    lMax: l - 2 * m,
    couleur: COULEURS.faible,
  });
}

/** Bannière LinkedIn à son nom : tout le contenu dans la bande sûre 1350 × 220, à droite. */
export function dessinerLinkedin(
  canvas: HTMLCanvasElement,
  r: Ressources,
  nom: string,
  lignes: LigneTitre[],
  mentionTexte: string,
) {
  const { l, h } = FORMATS.linkedin;
  canvas.width = l;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  fond(ctx, l, h, { x: l * 0.78, y: h * 0.4, r: l * 0.45 });
  anneaux(ctx, l - 30, h * 0.35, [310, 200], 1.5);

  const xDroite = l - 200;
  let y = 98;
  y += pastilleLogo(ctx, r, xDroite, y, 20, true) + 12;
  surtitre(ctx, nom, xDroite, y, 18, "right");
  y += 30;
  titre(ctx, lignes, { x: xDroite, y, taille: 46, lMax: 760, align: "right" });
  y += 2 * 46 + 8;
  paragraphe(ctx, mentionTexte, {
    x: xDroite,
    y,
    taille: 18,
    lMax: 760,
    couleur: COULEURS.doux,
    align: "right",
  });
}

/** Couverture Facebook à son nom : contenu centré, entre x = 300 et x = 1340. */
export function dessinerFacebook(
  canvas: HTMLCanvasElement,
  r: Ressources,
  nom: string,
  lignes: LigneTitre[],
  mentionTexte: string,
) {
  const { l, h } = FORMATS.facebook;
  canvas.width = l;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  fond(ctx, l, h, { x: l * 0.5, y: h * 0.35, r: l * 0.5 });
  anneaux(ctx, l * 0.5, h * 0.45, [430, 300], 1.5);

  const cx = l / 2;
  let y = 120;
  const hLogo = 30;
  const lPastille = hLogo * RATIO_LOGO + 2 * hLogo * 0.62;
  y += pastilleLogo(ctx, r, cx - lPastille / 2, y, hLogo) + 22;
  surtitre(ctx, nom, cx, y, 24, "center");
  y += 44;
  titre(ctx, lignes, { x: cx, y, taille: 70, lMax: 1000, align: "center" });
  y += 2 * 70 + 18;
  paragraphe(ctx, mentionTexte, {
    x: cx,
    y,
    taille: 26,
    lMax: 1000,
    couleur: COULEURS.doux,
    align: "center",
  });
}

/** Le logo seul, en PNG (fond transparent), à la largeur demandée. */
export function dessinerLogo(canvas: HTMLCanvasElement, r: Ressources, largeur: number) {
  canvas.width = largeur;
  canvas.height = Math.round(largeur / RATIO_LOGO);
  canvas.getContext("2d")!.drawImage(r.logo, 0, 0, canvas.width, canvas.height);
}

export const enPng = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((ok, ko) =>
    canvas.toBlob((b) => (b ? ok(b) : ko(new Error("png"))), "image/png"),
  );
