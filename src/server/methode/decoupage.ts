/**
 * Couche « Méthode » — DÉCOUPAGE des fiches Markdown en entrées (ADR 0076).
 *
 * Module PUR : aucune base, aucun réseau, aucun `fs` (la seule dépendance,
 * `interdits-publication`, est elle-même pure). Il reçoit le chemin relatif
 * et le texte d'un fichier et rend la liste des sections, avec leur slug stable,
 * leurs étiquettes et leur collection. L'importeur (`scripts/methode/`) et les
 * tests l'appellent tels quels.
 *
 * Deux formats d'entrée coexistent dans le dépôt de marque :
 *   - les fiches EXTRAITES DES PDF du Drive (`livres/**`) : pas de titres Markdown,
 *     des sections numérotées « 1. Titre », puis des blocs fixes (« Si… alors… »,
 *     « Mises en situation », « Teste-toi », « Cartes mémo »…) ;
 *   - le dossier santé, écrit en Markdown (`#`, `##`).
 *
 * Règle de séparation des chiffres (décision du 11/11) : toute section qui porte
 * un montant en euros reçoit l'étiquette `chiffres-exercice` et un avertissement
 * en tête. Ces montants sont des montants d'ENTRAÎNEMENT ; le seul prix public est
 * celui de `src/content/offre.ts`.
 */

import { detecterInterditsSurface } from "@/lib/contenu/interdits-publication";

export const PREFIXE_SLUG = "methode";

export const COLLECTION_VENTE = "methode-vente";
export const COLLECTION_SANTE = "methode-secteur-sante";

/** Slug de l'entrée « noyau », toujours injectée quand la couche est allumée. */
export const SLUG_NOYAU = `${PREFIXE_SLUG}/00-axion-ia-methode-de-vente/essentiel`;

export const ETIQUETTE_CHIFFRES = "chiffres-exercice";
export const ETIQUETTE_SANTE = "secteur:sante";
/**
 * Fiche qui heurte la doctrine de publication (ville du siège nommée, promesse de gain,
 * étiquette TPE/PME…). Elle est importée — Williams la relit en console — mais
 * `obtenirContexteMethode` ne la sert JAMAIS à une automatisation.
 */
export const ETIQUETTE_DOCTRINE = "doctrine:a-revoir";

export const AVERTISSEMENT_CHIFFRES =
  "> ⚠️ Montants d'entraînement, pas de prix public. Le seul prix public est celui de " +
  "la Journée IA, tiré de `src/content/offre.ts`. Ne jamais recopier ces montants " +
  "dans un texte destiné à un client.";

export type TypeMethode = "regle" | "script" | "objection" | "calcul" | "posture";

export interface SectionMethode {
  /** `methode/<fichier>/<section>` — stable tant que le fichier et le titre le sont. */
  readonly slug: string;
  readonly titre: string;
  /** Corps prêt à stocker (avertissement compris s'il y a des montants). */
  readonly texte: string;
  readonly type: TypeMethode;
  readonly etiquettes: readonly string[];
  readonly collection: typeof COLLECTION_VENTE | typeof COLLECTION_SANTE;
  readonly fichier: string;
  readonly contientMontants: boolean;
  /** Codes de la doctrine heurtés (vide = fiche servable). */
  readonly signalements: readonly string[];
}

/** Fichiers jamais importés : notices, et l'extraction PDF santé gardée pour comparaison. */
export function fichierIgnore(cheminRelatif: string): boolean {
  const nom = cheminRelatif.split("/").pop() ?? cheminRelatif;
  if (!nom.toLowerCase().endsWith(".md")) return true;
  if (/^lisez-moi\.md$/i.test(nom)) return true;
  if (/extrait-pdf\.md$/i.test(nom)) return true;
  return false;
}

/** Minuscules, sans accents, tirets ; borné à `max` caractères sur une fin de mot. */
export function slugifier(texte: string, max = 60): string {
  const s = texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= max) return s;
  const coupe = s.slice(0, max);
  const dernier = coupe.lastIndexOf("-");
  return (dernier > 20 ? coupe.slice(0, dernier) : coupe).replace(/-+$/g, "");
}

/** Montant en euros : « 1 490 € », « 290 €/mois », « 35 € », « 1 900 EUR ». */
const MOTIF_MONTANT = /\d[\d\s  .,]*\s?(?:€|EUR\b|euros?\b)/i;

export function contientMontant(texte: string): boolean {
  return MOTIF_MONTANT.test(texte);
}

/** `livre:<auteur>` déduit du nom de fichier. */
export function etiquetteLivre(nomFichier: string): string {
  const n = nomFichier.toLowerCase();
  const auteurs = [
    "dunford",
    "osterwalder",
    "hormozi",
    "miller",
    "dib",
    "rackham",
    "cialdini",
    "voss",
    "oury",
  ];
  const trouve = auteurs.find((a) => n.includes(a));
  return `livre:${trouve ?? "axion-ia"}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Nettoyage des artefacts d'extraction PDF
// ─────────────────────────────────────────────────────────────────────────────

function lignesNettoyees(texte: string): string[] {
  return texte
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => !/^<!--\s*page\s+\d+\s*-->$/.test(l.trim()))
    .filter((l) => !/^\d+\s*\/\s*\d+$/.test(l.trim()))
    .filter((l) => !/^AXION IA · Plus de performance, moins de charges$/.test(l.trim()))
    .filter((l) => !/^Source : Google Drive/.test(l.trim()));
}

function compacter(lignes: readonly string[]): string {
  return lignes
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Fiches extraites des PDF
// ─────────────────────────────────────────────────────────────────────────────

/** Blocs fixes des fiches « livre appliqué » → slug de section. */
const BLOCS_FIXES: ReadonlyArray<{ readonly ligne: string; readonly slug: string | null }> = [
  { ligne: "L'ESSENTIEL EN 30 SECONDES", slug: "essentiel" },
  // « LE CHEMIN » appartient au noyau : on ne coupe pas, on garde la ligne.
  { ligne: "Les idées clés", slug: null },
  { ligne: "Appliqué à AXION IA", slug: null },
  { ligne: "Si… alors…", slug: "si-alors" },
  { ligne: "Mises en situation", slug: "mises-en-situation" },
  { ligne: "Teste-toi", slug: "teste-toi" },
  { ligne: "Cartes mémo", slug: "cartes-memo" },
  { ligne: "À relire juste avant d'agir", slug: "a-relire-avant-d-agir" },
];

interface Morceau {
  slug: string;
  titre: string;
  lignes: string[];
}

const MOTIF_NUMERO = /^(\d{1,2})\.\s+(\S.{1,88})$/;

/**
 * Lecture d'une ligne « N. Titre » : candidate à un titre de section, ou rien.
 * Un titre en forme de question (« 3. Pourquoi toi, et pas un autre ? ») n'est
 * retenu que s'il est suivi d'un paragraphe : les questions de quiz ne le sont pas.
 */
function candidatNumerote(ligne: string): { n: number; titre: string; question: boolean } | null {
  const m = MOTIF_NUMERO.exec(ligne.trim());
  if (!m) return null;
  const titre = m[2]!.trim();
  return { n: Number(m[1]), titre, question: titre.endsWith("?") };
}

/** La ligne non vide suivante est-elle un vrai paragraphe (≥ 70 car.) ? */
function suiviDUnParagraphe(lignes: readonly string[], i: number): boolean {
  let j = i + 1;
  while (j < lignes.length && lignes[j]!.trim() === "") j++;
  return (lignes[j]?.trim().length ?? 0) >= 70;
}

function decouperFichePdf(lignes: readonly string[], titreFichier: string): Morceau[] {
  const morceaux: Morceau[] = [];
  let courant: Morceau = { slug: "introduction", titre: titreFichier, lignes: [] };
  let dernierNumero = 0;
  // Liste numérotée IMBRIQUÉE (cellules de tableau « 1. Se positionner »…) :
  // elle repart de 1 et peut croiser le numéro attendu de la section suivante.
  let numeroImbrique = 0;
  let dansBlocFixe = false;
  let numeroCas = 0;

  const pousser = () => {
    if (compacter(courant.lignes).length > 0) morceaux.push(courant);
  };

  for (let i = 0; i < lignes.length; i++) {
    const brute = lignes[i]!;
    const ligne = brute.trim();

    if (/^# /.test(ligne)) continue; // titre H1 = nom du fichier

    const bloc = BLOCS_FIXES.find((b) => b.ligne === ligne);
    if (bloc) {
      if (bloc.slug === null) continue; // simple étiquette de mise en page
      pousser();
      if (bloc.slug === "essentiel") {
        // Le noyau s'arrête à « Les idées clés » ; la section numérotée en cours
        // reprend ensuite (le PDF pose l'encadré au milieu de la page 1).
        const reprise = courant;
        const essentiel: Morceau = {
          slug: "essentiel",
          titre: "L'essentiel en 30 secondes",
          lignes: [],
        };
        let j = i + 1;
        while (j < lignes.length && lignes[j]!.trim() !== "Les idées clés") {
          essentiel.lignes.push(lignes[j]!);
          j++;
        }
        morceaux.push(essentiel);
        courant = { ...reprise, lignes: [] };
        // `reprise` a déjà été poussé s'il avait du contenu : sa suite reçoit un suffixe.
        courant.slug = `${reprise.slug}-suite`;
        i = j; // saute « Les idées clés »
        continue;
      }
      dansBlocFixe = true;
      courant = { slug: bloc.slug, titre: ligne, lignes: [] };
      continue;
    }

    // Dans « Mises en situation », un cas = une fiche.
    if (courant.slug.startsWith("mises-en-situation") || courant.slug.startsWith("cas-")) {
      const cas = /^Cas\s+(\d+)\s+[—–-]\s+(.+)$/.exec(ligne);
      if (cas) {
        pousser();
        numeroCas = Number(cas[1]);
        courant = { slug: `cas-${numeroCas}-${slugifier(cas[2]!, 50)}`, titre: ligne, lignes: [] };
        continue;
      }
      if (ligne === "MISE EN SITUATION") continue;
    }

    if (!dansBlocFixe) {
      const c = candidatNumerote(ligne);
      let estSection = false;
      if (c) {
        const attendu = c.n === dernierNumero + 1;
        if (numeroImbrique > 0 && c.n === numeroImbrique + 1) {
          // Conflit possible : on tranche par la forme (un titre de section est
          // suivi d'un paragraphe, une cellule de tableau d'un fragment court).
          if (attendu && suiviDUnParagraphe(lignes, i)) {
            estSection = true;
            numeroImbrique = 0;
          } else {
            numeroImbrique = c.n;
          }
        } else if (attendu && (!c.question || suiviDUnParagraphe(lignes, i))) {
          estSection = true;
          numeroImbrique = 0;
        } else if (c.n === 1) {
          numeroImbrique = 1;
        }
      }
      if (c && estSection) {
        pousser();
        dernierNumero += 1;
        courant = {
          slug: `${String(dernierNumero).padStart(2, "0")}-${slugifier(c.titre, 50)}`,
          titre: `${dernierNumero}. ${c.titre}`,
          lignes: [],
        };
        continue;
      }
    }

    courant.lignes.push(brute);
  }
  pousser();

  // Une « suite » vide a déjà été écartée ; une suite non vide est recollée à
  // sa section d'origine pour garder une fiche = une idée.
  const fusion: Morceau[] = [];
  for (const m of morceaux) {
    if (m.slug.endsWith("-suite")) {
      const origine = fusion.find((x) => x.slug === m.slug.replace(/-suite$/, ""));
      if (origine) {
        origine.lignes.push("", ...m.lignes);
        continue;
      }
      m.slug = m.slug.replace(/-suite$/, "");
    }
    fusion.push(m);
  }
  return fusion;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Fiches « affiche » (important-a-savoir/) : une page du PDF = une fiche
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les cinq fiches `important-a-savoir/` sont des affiches en colonnes : leur
 * texte extrait n'a ni numérotation fiable ni titres. L'unité stable y est la
 * PAGE du PDF d'origine (`<!-- page N -->`), qui ne bouge pas tant que le Drive
 * ne bouge pas.
 */
function decouperParPage(contenu: string): Morceau[] {
  const morceaux: Morceau[] = [];
  const blocs = contenu.replace(/\r\n?/g, "\n").split(/^<!--\s*page\s+(\d+)\s*-->\s*$/m);
  // split avec groupe capturant : [avant, n1, texte1, n2, texte2, …]
  for (let k = 1; k < blocs.length; k += 2) {
    const n = Number(blocs[k]);
    const lignes = lignesNettoyees(blocs[k + 1] ?? "");
    const titre =
      lignes
        .map((l) => l.trim())
        .find((l) => l.length >= 8 && !/^A X I O N/.test(l) && !/^#/.test(l)) ?? `Page ${n}`;
    morceaux.push({ slug: `page-${String(n).padStart(2, "0")}`, titre, lignes });
  }
  return morceaux;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Fichiers Markdown (dossier santé)
// ─────────────────────────────────────────────────────────────────────────────

function decouperMarkdown(lignes: readonly string[]): Morceau[] {
  const morceaux: Morceau[] = [];
  let courant: Morceau | null = null;
  let parent = "";
  const vus = new Map<string, number>();

  const unique = (slug: string) => {
    const n = (vus.get(slug) ?? 0) + 1;
    vus.set(slug, n);
    return n === 1 ? slug : `${slug}-${n}`;
  };

  for (const brute of lignes) {
    const h = /^(#{1,2})\s+(.+?)\s*$/.exec(brute);
    if (h) {
      if (courant && compacter(courant.lignes).length > 0) morceaux.push(courant);
      const titre = h[2]!.replace(/\*\*/g, "").trim();
      if (h[1] === "#") parent = slugifier(titre, 40);
      const base = h[1] === "#" ? parent : `${parent}--${slugifier(titre, 40)}`;
      courant = { slug: unique(base || "introduction"), titre, lignes: [] };
      continue;
    }
    if (!courant) courant = { slug: unique("introduction"), titre: "Introduction", lignes: [] };
    courant.lignes.push(brute);
  }
  if (courant && compacter(courant.lignes).length > 0) morceaux.push(courant);
  return morceaux;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Typage d'une section
// ─────────────────────────────────────────────────────────────────────────────

export function typerSection(slugSection: string, titre: string, nomFichier: string): TypeMethode {
  const t = `${slugSection} ${titre}`.toLowerCase();
  if (/posture|voix|tenue/i.test(nomFichier)) return "posture";
  if (/objection/.test(t)) return "objection";
  if (/calcul|chiffr|formule|paiement|prix/.test(t)) return "calcul";
  if (/^cas-|script|expressions|ce que je dis/.test(t) || /expressions/i.test(nomFichier))
    return "script";
  if (/si-alors|a-relire|posture/.test(t)) return "posture";
  return "regle";
}

// ─────────────────────────────────────────────────────────────────────────────
//  Point d'entrée du module
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Découpe un fichier. `cheminRelatif` est relatif au dossier `methode/`
 * (ex. `livres/03-Hormozi-100M-Offers.md`, `secteurs/sante/Dossier….md`).
 */
export function decouperFichier(cheminRelatif: string, contenu: string): SectionMethode[] {
  if (fichierIgnore(cheminRelatif)) return [];

  const nomFichier = (cheminRelatif.split("/").pop() ?? cheminRelatif).replace(/\.md$/i, "");
  const fichier = slugifier(nomFichier, 70);
  const estSante = /(^|\/)secteurs\/sante\//.test(cheminRelatif.replace(/\\/g, "/"));
  const lignes = lignesNettoyees(contenu);

  // Markdown structuré = au moins un titre de niveau 2 ; sinon, fiche PDF.
  const estMarkdown = lignes.some((l) => /^##\s+/.test(l));
  const estAffiche = /(^|\/)important-a-savoir\//.test(cheminRelatif.replace(/\\/g, "/"));
  const morceaux = estMarkdown
    ? decouperMarkdown(lignes)
    : estAffiche
      ? decouperParPage(contenu)
      : decouperFichePdf(lignes, nomFichier);

  return morceaux.map((m) => {
    const corps = compacter(m.lignes);
    const montants = contientMontant(corps) || contientMontant(m.titre);
    const type = typerSection(m.slug, m.titre, nomFichier);
    const signalements = Array.from(
      new Set(
        detecterInterditsSurface(
          { titre: m.titre, texte: corps },
          { actualite: false, financementPublicAutorise: false },
        ).map((v) => v.code),
      ),
    ).sort();
    const etiquettes = [
      etiquetteLivre(nomFichier),
      `type:${type}`,
      ...(montants ? [ETIQUETTE_CHIFFRES] : []),
      ...(estSante ? [ETIQUETTE_SANTE] : []),
      ...(signalements.length > 0 ? [ETIQUETTE_DOCTRINE] : []),
    ];
    return {
      slug: `${PREFIXE_SLUG}/${fichier}/${m.slug}`.slice(0, 180),
      titre: `${nomFichier} · ${m.titre}`.slice(0, 255),
      texte: montants ? `${AVERTISSEMENT_CHIFFRES}\n\n${corps}` : corps,
      type,
      etiquettes,
      collection: estSante ? COLLECTION_SANTE : COLLECTION_VENTE,
      fichier,
      contientMontants: montants,
      signalements,
    };
  });
}
