/**
 * Console éditoriale — analyse et transformation du dossier LinkedIn (§6).
 *
 * Module PUR : aucun import `next`/prisma, aucun accès disque. Il reçoit du
 * texte et rend des objets. C'est ce qui le rend testable sans base — et c'est
 * là que vivent tous les cas tordus, donc tous les tests qui comptent.
 *
 * ⚠️ §0 du plan : **les 61 publications sont de la DONNÉE, pas la
 * spécification.** Une fois importées, la BASE fait foi et les `.md`
 * deviennent une archive gelée. Ce module ne sert donc qu'une fois — mais il
 * doit être exact une fois, parce que personne ne relira 61 lignes à la main.
 */

/** Une ligne du CSV, colonnes du §6, telles quelles. */
export interface LigneCalendrier {
  numero: string;
  date: string;
  heure: string;
  format: string;
  accroche: string;
  production: string;
  photoWill: string;
  lien: string;
  echoPage: string;
  tags: string;
  /** Lu, puis IGNORÉ : « la note est un jugement daté, pas une donnée d'outil ». */
  note: string;
}

export interface ErreurLigne {
  /** Numéro de ligne dans le fichier, en-tête comprise — celui qu'affiche un tableur. */
  ligne: number;
  numero: string;
  motif: string;
}

/**
 * Découpe un texte CSV en cellules, séparateur `;`.
 *
 * Écrit à la main plutôt que tiré d'une dépendance, pour trois raisons qui
 * sont toutes des pièges rencontrés :
 *
 * 1. **Le BOM UTF-8.** Non retiré, il colle à la PREMIÈRE en-tête : la colonne
 *    devient `﻿numero` et toute lecture par nom échoue — silencieusement,
 *    en rendant `undefined`.
 * 2. **CRLF.** Le dépôt tourne sous Windows et le protocole le signale déjà
 *    comme piège. Un `\r` résiduel en fin de cellule casse toute comparaison.
 * 3. **Les guillemets.** Une accroche contient des `;` et des retours à la
 *    ligne. Un `split(";")` naïf produirait des lignes décalées, et le
 *    décalage ne se voit qu'à la 40ᵉ ligne.
 */
export function decouperCsv(texte: string): string[][] {
  const sansBom = texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte;

  const lignes: string[][] = [];
  let cellules: string[] = [];
  let courante = "";
  let dansGuillemets = false;

  for (let i = 0; i < sansBom.length; i += 1) {
    const c = sansBom[i];

    if (dansGuillemets) {
      if (c === '"') {
        // `""` à l'intérieur d'un champ cité = un guillemet littéral.
        if (sansBom[i + 1] === '"') {
          courante += '"';
          i += 1;
        } else {
          dansGuillemets = false;
        }
      } else {
        courante += c;
      }
      continue;
    }

    if (c === '"') {
      dansGuillemets = true;
    } else if (c === ";") {
      cellules.push(courante);
      courante = "";
    } else if (c === "\n") {
      cellules.push(courante);
      lignes.push(cellules);
      cellules = [];
      courante = "";
    } else if (c === "\r") {
      // Avalé : le saut de ligne est porté par le \n qui suit.
    } else {
      courante += c;
    }
  }

  // Dernière cellule, quand le fichier ne finit pas par un saut de ligne.
  if (courante.length > 0 || cellules.length > 0) {
    cellules.push(courante);
    lignes.push(cellules);
  }

  return lignes.filter((l) => l.some((cell) => cell.trim() !== ""));
}

/** Normalise une en-tête : minuscules, sans accent, `_` pour tout le reste. */
function normaliserEntete(brut: string): string {
  return brut
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const ENTETES_ATTENDUES: Record<string, keyof LigneCalendrier> = {
  numero: "numero",
  date: "date",
  heure: "heure",
  format: "format",
  accroche: "accroche",
  production: "production",
  photo_will: "photoWill",
  lien: "lien",
  echo_page: "echoPage",
  tags: "tags",
  note: "note",
};

export interface LectureCalendrier {
  lignes: LigneCalendrier[];
  erreurs: ErreurLigne[];
}

/**
 * Lit le CSV de calendrier et rend ses lignes typées.
 *
 * Une colonne absente n'est PAS une erreur de ligne mais une erreur de
 * fichier : elle est levée, parce qu'importer 61 lignes dont un champ est
 * partout vide serait pire qu'échouer.
 */
export function lireCalendrier(texte: string): LectureCalendrier {
  const brutes = decouperCsv(texte);
  const premiereLigne = brutes[0];
  if (!premiereLigne) {
    throw new Error("Le CSV de calendrier est vide.");
  }

  const entetes = premiereLigne.map(normaliserEntete);
  const manquantes = Object.keys(ENTETES_ATTENDUES).filter((e) => !entetes.includes(e));
  if (manquantes.length > 0) {
    throw new Error(
      `Colonnes absentes du CSV : ${manquantes.join(", ")}. ` +
        `Colonnes lues : ${entetes.join(", ")}.`,
    );
  }

  const lignes: LigneCalendrier[] = [];
  const erreurs: ErreurLigne[] = [];

  for (let i = 1; i < brutes.length; i += 1) {
    const cellules = brutes[i] ?? [];
    const numeroLigne = i + 1;

    const ligne: Partial<LigneCalendrier> = {};
    for (let c = 0; c < entetes.length; c += 1) {
      const entete = entetes[c];
      if (!entete) continue;
      const champ = ENTETES_ATTENDUES[entete];
      // Une cellule absente vaut cellule vide : un CSV dont la dernière
      // colonne est vide se termine souvent sans le « ; » final.
      if (champ) ligne[champ] = (cellules[c] ?? "").trim();
    }

    if (!ligne.numero) {
      erreurs.push({ ligne: numeroLigne, numero: "", motif: "Colonne `numero` vide." });
      continue;
    }
    lignes.push(ligne as LigneCalendrier);
  }

  return { lignes, erreurs };
}

/**
 * Découpe `10-LES-61-POSTS.md` en corps et premier commentaire, par numéro.
 *
 * Une section s'ouvre sur `## #N`. À l'intérieur, un intertitre annonce le
 * premier commentaire ; tout ce qui le précède est le corps.
 */
export function lirePosts(
  texte: string,
): Map<number, { corps: string; premierCommentaire: string }> {
  const resultat = new Map<number, { corps: string; premierCommentaire: string }>();
  if (!texte.trim()) return resultat;

  const normalise = texte.replace(/\r\n/g, "\n");
  // `## #12` ou `## #12 — Titre` : seul le numéro est retenu.
  const sections = normalise.split(/^##\s+#(\d+)[^\n]*$/gm);

  // split rend [avant, num, contenu, num, contenu, …].
  for (let i = 1; i < sections.length; i += 2) {
    const brutNumero = sections[i];
    if (brutNumero === undefined) continue;
    const numero = Number.parseInt(brutNumero, 10);
    if (!Number.isFinite(numero)) continue;

    const contenu = sections[i + 1] ?? "";
    const marqueur = contenu.match(
      // 🔴 `[ \t]` et NON `\s` : `\s` contient le saut de ligne.
      // Gourmand, il faisait déborder le marqueur sur la ligne suivante — il
      // avalait le commentaire qu’il devait introduire, qui repartait VIDE pour
      // les 61 posts. Le motif reste désormais sur sa propre ligne.
      /^#{3,}[ \t]*(?:premier[ \t]+commentaire|1er[ \t]+commentaire|commentaire)[ \t]*:?[^\n]*$/im,
    );

    if (marqueur && marqueur.index !== undefined) {
      resultat.set(numero, {
        corps: contenu.slice(0, marqueur.index).trim(),
        premierCommentaire: contenu.slice(marqueur.index + marqueur[0].length).trim(),
      });
    } else {
      resultat.set(numero, { corps: contenu.trim(), premierCommentaire: "" });
    }
  }

  return resultat;
}

/** `JJ/MM/AAAA` → `Date` à minuit UTC. */
export function convertirDate(brut: string): Date {
  const m = brut.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) {
    throw new Error(`Date « ${brut} » illisible — attendu JJ/MM/AAAA.`);
  }
  const [, j, mo, a] = m;
  const jour = Number(j);
  const mois = Number(mo);
  const annee = Number(a);

  if (mois < 1 || mois > 12) throw new Error(`Date « ${brut} » : mois hors bornes.`);
  if (jour < 1 || jour > 31) throw new Error(`Date « ${brut} » : jour hors bornes.`);

  // 🔴 `Date.UTC` et non `new Date(a, m, j)` : la seconde forme construit en
  // heure LOCALE. Stockée dans une colonne `@db.Date`, une date du 12 à minuit
  // en UTC+2 redescend au 11. Le calendrier afficherait alors la veille — et
  // le critère « septembre aux bonnes dates » échouerait d'un jour.
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  if (d.getUTCDate() !== jour || d.getUTCMonth() !== mois - 1) {
    throw new Error(`Date « ${brut} » inexistante au calendrier.`);
  }
  return d;
}

/** `7h45`, `7:45`, `07h45`, `7h` → `07:45` / `07:00`. */
export function convertirHeure(brut: string): string {
  const m = brut.trim().match(/^(\d{1,2})\s*[h:]\s*(\d{0,2})$/i);
  if (!m) {
    throw new Error(`Heure « ${brut} » illisible — attendu 7h45.`);
  }
  const heures = Number(m[1]);
  const minutes = m[2] === "" ? 0 : Number(m[2]);
  if (heures > 23) throw new Error(`Heure « ${brut} » : heures hors bornes.`);
  if (minutes > 59) throw new Error(`Heure « ${brut} » : minutes hors bornes.`);
  return `${String(heures).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** `#IAPourPME #RGPD` → `["IAPourPME", "RGPD"]`. Croisillon retiré, ordre gardé. */
export function convertirTags(brut: string): string[] {
  return brut
    .split(/[\s,;]+/)
    .map((t) => t.trim().replace(/^#+/, ""))
    .filter((t) => t.length > 0);
}

/**
 * Clé du marqueur de non-répétabilité de l’import.
 *
 * Déclarée ICI, dans le module pur, parce que DEUX appelants la lisent :
 * la commande d’import qui l’écrit, et le tableau de bord qui affiche
 * « import effectué ». Dupliquée, elle aurait dérivé au premier renommage —
 * et le tableau de bord aurait affiché « pas encore importé » pour toujours,
 * sans que rien ne rougisse.
 */
export const CLE_MARQUEUR_IMPORT = "editorial.import.linkedin-2026-q4";

/** Préfixe du §6 : `linkedin-2026-q4-04`. */
export const PREFIXE_REF_IMPORT = "linkedin-2026-q4";

export function refImport(numero: string | number): string {
  const n =
    typeof numero === "number" ? numero : Number.parseInt(String(numero).replace(/\D/g, ""), 10);
  if (!Number.isFinite(n)) {
    throw new Error(`Numéro « ${numero} » illisible.`);
  }
  return `${PREFIXE_REF_IMPORT}-${String(n).padStart(2, "0")}`;
}

/** L'écho de page dérive du numéro d'origine — il reste rattachable à vue d'œil. */
export function refImportEcho(numero: string | number): string {
  return `${refImport(numero)}-echo`;
}

/**
 * Destinations des liens (colonne `lien` du §6).
 *
 * ⚠️ `newsletter` est délibérément ABSENT. Le compte n°9 est « à créer, jalon
 * du 11 octobre » et aucune route ne lui correspond dans `routing.ts`. Plutôt
 * qu'inventer une URL qui rendrait la règle `utm` verte sur une page qui
 * n'existe pas, l'import laisse `lienUrl` à `null` et le SIGNALE. La règle
 * `utm` fera alors son travail : la publication ne sera pas validable tant que
 * la destination n'existe pas. C'est le comportement voulu, pas un manque.
 */
export const DESTINATIONS: Record<string, string> = {
  reservation: "https://axion-ia.com/fr/appel",
  candidature: "https://axion-ia.com/fr/carrieres",
};

/** Construit un lien porteur des quatre UTM exigés par la règle `utm`. */
export function construireLien(
  type: string,
  campagne: string,
  contenu: string,
): { url: string | null; avertissement: string | null } {
  const cle = type.trim().toLowerCase();
  if (!cle) return { url: null, avertissement: null };

  const base = DESTINATIONS[cle];
  if (!base) {
    return {
      url: null,
      avertissement:
        `Destination « ${cle} » inconnue : aucune route ne lui correspond. ` +
        `Lien laissé vide — la règle « utm » bloquera la validation tant qu'il manque.`,
    };
  }

  const u = new URL(base);
  u.searchParams.set("utm_source", "linkedin");
  u.searchParams.set("utm_medium", "social");
  u.searchParams.set("utm_campaign", campagne);
  u.searchParams.set("utm_content", contenu);
  return { url: u.toString(), avertissement: null };
}

/**
 * Vrai quand la cellule vaut « oui ».
 *
 * Le CSV mêle `oui`, `x`, `1`, `OUI` et la cellule vide. Une lecture
 * `Boolean(cellule)` rendrait `true` sur la chaîne « non » — le genre de bug
 * qui crée 61 assets dont personne n'a besoin.
 */
export function estVrai(brut: string): boolean {
  const v = brut.trim().toLowerCase();
  return v === "oui" || v === "x" || v === "1" || v === "true" || v === "yes";
}

/** Normalise un `format` pour la comparaison aux alias de famille. */
export function normaliserFormat(brut: string): string {
  return brut
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
