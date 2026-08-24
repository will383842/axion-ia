/**
 * Console éditoriale — analyse de la COUCHE PRODUCTION du dossier LinkedIn.
 *
 * Module PUR : aucun import `next`/prisma, aucun accès disque.
 *
 * ── Ce que ce module répare ───────────────────────────────────────────────
 *
 * L'import du 21/08 ne lisait que deux fichiers : le calendrier et les
 * 61 posts. Il savait donc dire « il faut produire un carrousel de 9 slides »
 * — et rien de plus. Ni le script de la vidéo, ni le prompt de l'image, ni le
 * plan slide par slide. Quatre fichiers du dossier portaient tout cela et
 * restaient dehors :
 *
 * | Fichier                              | Ce qu'il porte                   |
 * | ------------------------------------ | -------------------------------- |
 * | `20-PRODUCTION-VIDEOS.md`            | 22 scripts, hook, registre       |
 * | `21-PRODUCTION-CARROUSELS.md`        | 13 carrousels, slide par slide   |
 * | `22-PRODUCTION-IMAGES-ET-PROMPTS.md` | les prompts de génération        |
 * | `23-PRODUCTION-PHOTOS-DE-WILL.md`    | les 23 briefs photo, par registre|
 *
 * ── Le contrat de sortie ──────────────────────────────────────────────────
 *
 * Les quatre lecteurs rendent la MÊME forme : une liste de briefs, chacun
 * rattaché à un **numéro de post** et à une **cible** (l'asset de production,
 * ou la photo de Williams). Le script d'import n'a alors qu'une chose à
 * faire : retrouver l'asset et y accrocher les segments. Toute la
 * connaissance des quatre formats de fichier vit ici, et se teste sans base.
 */

/** Le rôle d'un segment — miroir de l'énumération `EdSegmentRole` de Prisma. */
export type RoleSegment = "script" | "prompt" | "slide" | "legende" | "consigne";

export interface SegmentBrut {
  /** Rang d'affichage. Pour un carrousel, c'est le numéro de la slide. */
  ordre: number;
  role: RoleSegment;
  titre: string | null;
  contenu: string | null;
  prompt: string | null;
}

export interface BriefPost {
  /** Le numéro du post au calendrier — la clé de rattachement. */
  numeroPost: number;
  /**
   * Quel asset vise ce brief.
   *
   * Un post porte jusqu'à DEUX assets : celui de production (la vidéo, le
   * carrousel, le visuel) et, séparément, la photo de Williams. Coller le
   * brief photo sur l'asset de production mélangerait deux tournages.
   */
  cible: "production" | "photo";
  /** D'où vient ce brief — sert de préfixe d'idempotence. */
  source: string;
  segments: SegmentBrut[];
}

/** Normalise les fins de ligne. Le dépôt tourne sous Windows (piège connu). */
function normaliser(texte: string): string {
  return texte.replace(/\r\n/g, "\n");
}

/** Retire le gras, les emojis d'ornement et les espaces d'un intitulé. */
function nettoyerTitre(brut: string): string {
  return brut
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Rend le contenu du PREMIER bloc encadré de ```, ou `null`. */
export function premierBlocEncadre(texte: string): string | null {
  const m = texte.match(/^```[^\n]*\n([\s\S]*?)\n```[ \t]*$/m);
  return m?.[1]?.trim() ?? null;
}

/**
 * Découpe un texte en sections, sur un motif d'en-tête donné.
 *
 * Rend, pour chaque section, ses groupes capturés et son corps. Écrit une
 * fois plutôt que quatre : les quatre fichiers ont la même mécanique de
 * découpe, seul le motif change.
 */
function decouperSections(
  texte: string,
  motif: RegExp,
): { entete: string; groupes: string[]; corps: string }[] {
  const sections: { entete: string; groupes: string[]; corps: string }[] = [];
  const global = new RegExp(motif.source, "gm");
  const trouvees: { index: number; longueur: number; entete: string; groupes: string[] }[] = [];

  let m: RegExpExecArray | null = global.exec(texte);
  while (m !== null) {
    trouvees.push({
      index: m.index,
      longueur: m[0].length,
      entete: m[0],
      groupes: m.slice(1).map((g) => g ?? ""),
    });
    m = global.exec(texte);
  }

  for (let i = 0; i < trouvees.length; i += 1) {
    const courante = trouvees[i];
    if (!courante) continue;
    const suivante = trouvees[i + 1];
    const debut = courante.index + courante.longueur;
    const fin = suivante ? suivante.index : texte.length;
    sections.push({
      entete: courante.entete,
      groupes: courante.groupes,
      corps: texte.slice(debut, fin),
    });
  }

  return sections;
}

// ── 20-PRODUCTION-VIDEOS.md ────────────────────────────────────────────────

/**
 * `# 🎬 VIDÉO 1 — POST #1 — **Mardi 1er septembre**`
 *
 * L'en-tête porte les DEUX numéros. C'est le numéro de POST qui sert de clé :
 * la numérotation des vidéos est interne au dossier de tournage et ne dit
 * rien au calendrier.
 */
const ENTETE_VIDEO = /^#[ \t]+[^\n]*?VIDÉO[ \t]+(\d+)[^\n]*?POST[ \t]*#(\d+)[^\n]*$/;

/** Les sous-sections d'une vidéo : `### 🎯 HOOK`, `### Script`, `### Montage`. */
const SOUS_SECTION = /^###[ \t]+([^\n]+)$/;

export function lireVideos(texte: string): BriefPost[] {
  const briefs: BriefPost[] = [];

  for (const section of decouperSections(normaliser(texte), ENTETE_VIDEO)) {
    const brutPost = section.groupes[1];
    if (brutPost === undefined) continue;
    const numeroPost = Number.parseInt(brutPost, 10);
    if (!Number.isFinite(numeroPost)) continue;

    const segments: SegmentBrut[] = [];
    const sous = decouperSections(section.corps, SOUS_SECTION);

    for (const s of sous) {
      const titre = nettoyerTitre(s.groupes[0] ?? "");
      const contenu = s.corps.trim();
      if (!contenu) continue;

      // 🔴 Seul le script part en `script`. Le hook, la production et le
      // montage sont des CONSIGNES : les confondre ferait lire à voix haute
      // des indications de cadrage.
      const role: RoleSegment = /^script\b/i.test(titre) ? "script" : "consigne";

      segments.push({
        ordre: segments.length + 1,
        role,
        titre,
        contenu,
        prompt: null,
      });
    }

    if (segments.length > 0) {
      briefs.push({ numeroPost, cible: "production", source: "videos", segments });
    }
  }

  return briefs;
}

// ── 21-PRODUCTION-CARROUSELS.md ───────────────────────────────────────────

const ENTETE_CARROUSEL = /^#[ \t]+[^\n]*?CARROUSEL[ \t]+(\d+)[^\n]*?POST[ \t]*#(\d+)[^\n]*$/;

/**
 * Une ligne de la table des slides : `| **3** | texte exact | graphisme |`.
 *
 * ⚠️ La colonne « Graphisme » N'EST PAS de la décoration : c'est la consigne
 * de fabrication de CETTE slide. Elle part donc dans `prompt`, séparée du
 * texte — on colle l'un dans le générateur et l'autre dans la mise en page,
 * et les mélanger fait coller le mauvais dans le mauvais champ.
 */
const LIGNE_SLIDE = /^\|[ \t]*\*\*(\d+)\*\*[ \t]*\|([^|\n]*)\|([^|\n]*)\|[ \t]*$/gm;

export function lireCarrousels(texte: string): BriefPost[] {
  const briefs: BriefPost[] = [];

  for (const section of decouperSections(normaliser(texte), ENTETE_CARROUSEL)) {
    const brutPost = section.groupes[1];
    if (brutPost === undefined) continue;
    const numeroPost = Number.parseInt(brutPost, 10);
    if (!Number.isFinite(numeroPost)) continue;

    const segments: SegmentBrut[] = [];
    const sous = decouperSections(section.corps, SOUS_SECTION);
    let rangConsigne = 0;

    for (const s of sous) {
      const titre = nettoyerTitre(s.groupes[0] ?? "");

      if (/^l[ée]gende/i.test(titre)) {
        // La légende est encadrée de ``` — c'est le texte prêt à coller.
        const bloc = premierBlocEncadre(s.corps) ?? s.corps.trim();
        if (bloc) {
          segments.push({
            // 🔴 Rang ZÉRO, et non « le suivant ».
            //
            // Défaut trouvé au premier import réel : la légende prenait le
            // rang 1, la slide 1 aussi, et comme le rang entre dans la
            // référence d'idempotence, les deux portaient la MÊME clé. Sept
            // slides « 1 » ont été silencieusement refusées comme doublons —
            // sept carrousels privés de leur slide d'accroche, celle qui
            // déclenche le swipe. Un rang réservé les sépare pour de bon, et
            // place la légende avant les slides, ce qui est aussi son ordre
            // de lecture.
            ordre: 0,
            role: "legende",
            titre: "Légende du post",
            contenu: bloc,
            prompt: null,
          });
        }
        continue;
      }

      if (/^slides?$/i.test(titre)) {
        const lignes = [...s.corps.matchAll(LIGNE_SLIDE)];
        for (const l of lignes) {
          const brutNumero = l[1];
          if (brutNumero === undefined) continue;
          const numeroSlide = Number.parseInt(brutNumero, 10);
          if (!Number.isFinite(numeroSlide)) continue;
          segments.push({
            ordre: numeroSlide,
            role: "slide",
            titre: `Slide ${numeroSlide}`,
            contenu: (l[2] ?? "").trim() || null,
            prompt: (l[3] ?? "").trim() || null,
          });
        }
        continue;
      }

      const contenu = s.corps.trim();
      if (contenu) {
        rangConsigne += 1;
        segments.push({
          // Même raison que la légende : les consignes vivent au-dessus de
          // 100, hors de portée de toute numérotation de slide. Un carrousel
          // de 10 slides et une 3ᵉ consigne ne se disputent plus un rang.
          ordre: 100 + rangConsigne,
          role: "consigne",
          titre,
          contenu,
          prompt: null,
        });
      }
    }

    if (segments.length > 0) {
      briefs.push({ numeroPost, cible: "production", source: "carrousels", segments });
    }
  }

  return briefs;
}

// ── 22-PRODUCTION-IMAGES-ET-PROMPTS.md ────────────────────────────────────

const ENTETE_IMAGE = /^##[ \t]+[^\n]*?#(\d+)[ \t]*·[^\n]*$/;

/**
 * 🔴 Le marqueur du prompt PÉRIMÉ.
 *
 * Le dossier conserve les anciens prompts « pour mémoire » sous un intertitre
 * qui dit explicitement **NE PAS UTILISER**. Trois posts en portent un. Les
 * importer donnerait deux prompts contradictoires sur le même visuel, et
 * rien à l'écran ne dirait lequel est le bon. On coupe la section AVANT.
 */
const MARQUEUR_PERIME = /^###[ \t]+[^\n]*?[Aa]ncien prompt[^\n]*$/m;

/** `**Incrustation** : « Le 27 juillet » …` — la typo posée après génération. */
const LIGNE_INCRUSTATION = /^\*\*Incrustation\*\*[ \t]*:?[ \t]*([^\n]+)$/m;

export function lireImages(texte: string): BriefPost[] {
  const briefs: BriefPost[] = [];

  for (const section of decouperSections(normaliser(texte), ENTETE_IMAGE)) {
    const brutPost = section.groupes[0];
    if (brutPost === undefined) continue;
    const numeroPost = Number.parseInt(brutPost, 10);
    if (!Number.isFinite(numeroPost)) continue;

    // Tout ce qui suit le marqueur « ancien prompt » est écarté.
    const perime = section.corps.match(MARQUEUR_PERIME);
    const utile =
      perime && perime.index !== undefined ? section.corps.slice(0, perime.index) : section.corps;

    const prompt = premierBlocEncadre(utile);
    if (!prompt) continue;

    const incrustation = utile.match(LIGNE_INCRUSTATION)?.[1]?.trim() ?? null;

    briefs.push({
      numeroPost,
      cible: "production",
      source: "images",
      segments: [
        {
          ordre: 1,
          role: "prompt",
          titre: nettoyerTitre(section.entete),
          contenu: incrustation ? `Incrustation : ${incrustation}` : null,
          prompt,
        },
      ],
    });
  }

  return briefs;
}

// ── 23-PRODUCTION-PHOTOS-DE-WILL.md ───────────────────────────────────────

/** `| **#4** | 07/09 | **C** | Trois-quarts devant l'écran… |` */
const LIGNE_PHOTO = /^\|[ \t]*\*\*#(\d+)\*\*[ \t]*\|([^|\n]*)\|([^|\n]*)\|([^|\n]*)\|[ \t]*$/gm;

export function lirePhotos(texte: string): BriefPost[] {
  const briefs: BriefPost[] = [];

  for (const l of normaliser(texte).matchAll(LIGNE_PHOTO)) {
    const brutPost = l[1];
    if (brutPost === undefined) continue;
    const numeroPost = Number.parseInt(brutPost, 10);
    if (!Number.isFinite(numeroPost)) continue;

    const registre = nettoyerTitre(l[3] ?? "");
    const description = (l[4] ?? "").trim();
    if (!description) continue;

    briefs.push({
      numeroPost,
      // 🔴 La photo de Williams est un asset DISTINCT de la production : la
      // colonne `photo_will` du calendrier lui est propre et lui crée le sien.
      cible: "photo",
      source: "photos",
      segments: [
        {
          ordre: 1,
          role: "consigne",
          titre: registre ? `Registre ${registre}` : "Brief photo",
          contenu: description,
          prompt: null,
        },
      ],
    });
  }

  return briefs;
}

/** La référence d'idempotence d'un segment — unique, stable, relisible. */
export function refSegment(source: string, numeroPost: number, ordre: number): string {
  return `linkedin-2026-q4-${source}-${String(numeroPost).padStart(2, "0")}-${String(ordre).padStart(2, "0")}`;
}

// ── Les séries, lues dans les titres des 61 posts ─────────────────────────

/**
 * Une série éditoriale et ses épisodes.
 *
 * 🔴 Les séries sont dans le dossier depuis l'origine, et la base en comptait
 * ZÉRO : les 74 publications avaient toutes `serieId` à null. Elles ne sont
 * pourtant pas décoratives — le plan directeur écrit que « Sous le capot » est
 * profil-exclusif et que « Maison témoin » peut avoir un écho de page. Une
 * règle qu'on ne peut pas appliquer parce que la donnée manque est une règle
 * qui ne garde rien.
 */
export interface SerieLue {
  nom: string;
  /** Les numéros de post, du premier au dernier épisode. */
  posts: { numeroPost: number; rang: number | null }[];
}

/** `**Sous le capot #3**` — la forme NUMÉROTÉE, celle qui déclare la série. */
const MARQUEUR_SERIE = /\*\*([^*\n]+?)[ \t]*#(\d+)\*\*/;

/**
 * Lit les séries dans les en-têtes `## #N — … — **Nom #k**`.
 *
 * ⚠️ DEUX passes, et la seconde n'est pas un raffinement cosmétique.
 *
 * Le dossier note « Recrutement » de deux façons : trois fois en clair
 * (`— Recrutement —`) et une fois numérotée (`**Recrutement #4**`). Une seule
 * passe sur la forme numérotée ne trouverait qu'UN épisode sur quatre — et le
 * rang 4 isolé donnerait l'impression d'une série amputée.
 *
 * La règle : la forme numérotée DÉCLARE qu'une série existe ; la seconde passe
 * ne fait que retrouver ses mentions nues. On n'invente donc aucune série à
 * partir d'un mot isolé — « Image » ou « Écho » ne deviendront jamais des
 * séries parce qu'ils apparaissent entre deux tirets.
 */
export function lireSeries(texte: string): SerieLue[] {
  const entetes = [...normaliser(texte).matchAll(/^##[ \t]+#(\d+)([^\n]*)$/gm)];

  // Passe 1 — les séries déclarées, par leur forme numérotée.
  const series = new Map<string, SerieLue>();
  const vus = new Set<number>();
  for (const e of entetes) {
    const brutNumero = e[1];
    const reste = e[2];
    if (brutNumero === undefined || reste === undefined) continue;
    const m = reste.match(MARQUEUR_SERIE);
    const nom = m?.[1]?.trim();
    const rang = m?.[2];
    if (!nom || rang === undefined) continue;
    const numeroPost = Number.parseInt(brutNumero, 10);
    if (!Number.isFinite(numeroPost)) continue;
    const serie = series.get(nom) ?? { nom, posts: [] };
    serie.posts.push({ numeroPost, rang: Number.parseInt(rang, 10) });
    series.set(nom, serie);
    vus.add(numeroPost);
  }

  // Passe 2 — les mentions NUES des séries déjà déclarées.
  for (const e of entetes) {
    const brutNumero = e[1];
    const reste = e[2];
    if (brutNumero === undefined || reste === undefined) continue;
    const numeroPost = Number.parseInt(brutNumero, 10);
    if (!Number.isFinite(numeroPost) || vus.has(numeroPost)) continue;

    // Les segments d'un titre, séparés par des tirets cadratins.
    const segments = reste.split(/[—–-]/).map((s) => s.replace(/\*\*/g, "").trim());
    for (const [nom, serie] of series) {
      if (segments.some((s) => s.toLowerCase() === nom.toLowerCase())) {
        serie.posts.push({ numeroPost, rang: null });
        vus.add(numeroPost);
        break;
      }
    }
  }

  for (const s of series.values()) {
    // Ordre de diffusion : le numéro de post, pas le rang — un épisode non
    // numéroté n'a pas de rang, et le calendrier tranche de toute façon.
    s.posts.sort((a, b) => a.numeroPost - b.numeroPost);
  }
  return [...series.values()];
}

/** `Sous le capot` → `sous-le-capot`. Clé naturelle, stable, relisible. */
export function slugSerie(nom: string): string {
  return nom
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
