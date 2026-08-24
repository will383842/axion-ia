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
 * Le bloc encadré de ``` qui porte le texte à publier.
 *
 * 🔴 C'est LA découverte du 24/08/2026, en confrontant l'analyse au vrai
 * dossier. Une section de `10-LES-61-POSTS.md` n'est pas faite que du post :
 * elle s'ouvre sur une note de relecture (`*Note 86/100.*`) et souvent sur un
 * journal de révision en citation (« ✅ Remplacé le 19/08 — … »). Ces lignes
 * sont un jugement de rédaction, pas le texte à publier. Prises pour le
 * corps, elles atterrissaient EN TÊTE du post — visibles dans la console,
 * copiées telles quelles vers LinkedIn.
 *
 * Le bloc encadré, lui, est exactement ce qui se colle dans le champ de
 * LinkedIn. Les 61 sections en ont un et un seul.
 */
const BLOC_A_PUBLIER = /^```[^\n]*\n([\s\S]*?)\n```[ \t]*$/m;

/**
 * Les deux écritures du marqueur de premier commentaire.
 *
 * La fixture pose un intertitre (`### Premier commentaire`) ; le vrai dossier
 * écrit une amorce en gras suivie du commentaire SUR LA MÊME LIGNE
 * (`**1er commentaire** : « … »`), parfois avec une incise dans le gras
 * (`**1er commentaire — obligatoire, promis dans la vidéo**`). Le motif en
 * intertitre seul ne trouvait rien : les 61 premiers commentaires du dossier
 * partaient VIDES.
 *
 * 🔴 `[ \t]` et NON `\s` dans les deux : `\s` contient le saut de ligne, et
 * un marqueur gourmand déborde sur la ligne suivante — il avale alors le
 * commentaire qu'il devait introduire. Piège déjà payé une fois.
 */
const MARQUEUR_COMMENTAIRE: readonly RegExp[] = [
  /^#{3,}[ \t]*(?:premier[ \t]+commentaire|1er[ \t]+commentaire|commentaire)[ \t]*:?[^\n]*$/im,
  /^\*\*[ \t]*(?:premier|1er)[ \t]+commentaire[^*\n]*\*\*[ \t]*:?[ \t]*/im,
];

/**
 * Retire les guillemets français qui encadrent le commentaire dans le
 * dossier. Ils citent le texte, ils n'en font pas partie : postés tels quels,
 * ils apparaîtraient dans le commentaire publié.
 */
function nettoyerCommentaire(brut: string): string {
  const s = brut.trim();
  const cite = s.match(/^«[ \t]*([\s\S]*?)[ \t]*»$/);
  return (cite?.[1] ?? s).trim();
}

/**
 * Découpe `10-LES-61-POSTS.md` en corps et premier commentaire, par numéro.
 *
 * Une section s'ouvre sur `## #N`. Le corps est le bloc encadré de ``` quand
 * il y en a un — c'est le texte prêt à coller ; sinon, tout ce qui précède le
 * marqueur de premier commentaire. Le commentaire est ce qui suit ce marqueur.
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

    // Le bloc à publier, s'il existe. Le commentaire se cherche APRÈS lui :
    // un `**1er commentaire**` qui se trouverait dans le texte du post ne
    // doit pas couper le corps en deux.
    const bloc = contenu.match(BLOC_A_PUBLIER);
    const corpsBrut = bloc?.[1];
    const apresBloc =
      bloc && bloc.index !== undefined ? contenu.slice(bloc.index + bloc[0].length) : contenu;

    // Le premier marqueur qui répond, dans l'ordre des écritures connues.
    let marqueur: RegExpMatchArray | null = null;
    for (const motif of MARQUEUR_COMMENTAIRE) {
      const m = apresBloc.match(motif);
      if (
        m &&
        m.index !== undefined &&
        (marqueur?.index === undefined || m.index < marqueur.index)
      ) {
        marqueur = m;
      }
    }

    const commentaire =
      marqueur && marqueur.index !== undefined
        ? nettoyerCommentaire(apresBloc.slice(marqueur.index + marqueur[0].length))
        : "";

    if (corpsBrut !== undefined) {
      resultat.set(numero, { corps: corpsBrut.trim(), premierCommentaire: commentaire });
      continue;
    }

    // Pas de bloc encadré : le corps est tout ce qui précède le marqueur.
    if (marqueur && marqueur.index !== undefined) {
      resultat.set(numero, {
        corps: contenu.slice(0, marqueur.index).trim(),
        premierCommentaire: commentaire,
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

/**
 * R\u00e9sout la colonne `format` en famille d'assets.
 *
 * \u26a0\ufe0f \u00c9crit contre le VRAI dossier, pas contre la fixture. Le CSV r\u00e9el
 * n'\u00e9crit pas des \u00e9tiquettes canoniques mais des libell\u00e9s parlants :
 * \u00ab Carrousel 9 slides \u00bb, \u00ab Vid\u00e9o d\u00e9mo \u00bb, \u00ab Image punchline \u00bb, \u00ab Vid\u00e9o \u2b50 \u00bb,
 * et m\u00eame \u00ab Vid\u00e9o d\u00e9mo dans `25_POSTS_REECRITS` \u00bb \u2014 un renvoi vers un autre
 * document du dossier qui a fui dans la cellule. Une correspondance
 * strictement exacte refusait **38 lignes sur 61**, et comme l'import est
 * tout-ou-rien, elle n'en \u00e9crivait aucune.
 *
 * La r\u00e8gle, en trois temps, et l'ordre compte :
 *
 * 1. **Texte seul, \u00e0 l'exact.** En premier, sinon rien ne le distingue.
 * 2. **Alias de famille, \u00e0 l'exact.** C'est ce qui fait que \u00ab texte + cover \u00bb
 *    tombe dans `image-unique` et NON dans \u00ab texte seul \u00bb par le temps 3.
 * 3. **Alias en t\u00eate de cellule**, suivi d'une espace : le reste est un
 *    qualificatif (un d\u00e9compte de slides, une \u00e9toile, un renvoi). L'alias le
 *    plus LONG gagne, sinon \u00ab extrait vid\u00e9o \u00bb se ferait manger par \u00ab vid\u00e9o \u00bb.
 *
 * Ce n'est pas de l'\u00e0-peu-pr\u00e8s : la liste reste ferm\u00e9e, seul le qualificatif
 * qui suit est tol\u00e9r\u00e9. Une \u00e9criture inconnue part toujours en erreur.
 */
export function resoudreFamilleFormat(
  format: string,
  familles: readonly { slug: string; type: TypeAsset; aliasImport: readonly string[] }[],
  aliasTexteSeul: readonly string[],
): { slug: string | null; type: TypeAsset | null; connu: boolean } {
  const f = normaliserFormat(format);

  // 1. Texte seul.
  if (aliasTexteSeul.some((a) => normaliserFormat(a) === f)) {
    return { slug: null, type: null, connu: true };
  }

  // 2. Alias exact.
  for (const famille of familles) {
    if (famille.aliasImport.some((a) => normaliserFormat(a) === f)) {
      return { slug: famille.slug, type: famille.type, connu: true };
    }
  }

  // 3. Alias en t\u00eate, le plus long d'abord.
  const candidats: { alias: string; slug: string; type: TypeAsset }[] = [];
  for (const famille of familles) {
    for (const a of famille.aliasImport) {
      candidats.push({ alias: normaliserFormat(a), slug: famille.slug, type: famille.type });
    }
  }
  candidats.sort((x, y) => y.alias.length - x.alias.length);
  for (const c of candidats) {
    if (c.alias.length > 0 && f.startsWith(`${c.alias} `)) {
      return { slug: c.slug, type: c.type, connu: true };
    }
  }

  return { slug: null, type: null, connu: false };
}

/** Les types d'assets \u2014 le miroir de l'\u00e9num\u00e9ration `EdAssetType` de Prisma. */
export type TypeAsset = "video" | "carrousel" | "image" | "photo" | "audio" | "document";

/**
 * Lit la colonne `production`.
 *
 * \u26a0\ufe0f La fixture y \u00e9crit \u00ab oui \u00bb. Le VRAI dossier y \u00e9crit la r\u00e9f\u00e9rence de
 * production : \u00ab visuel \u00bb, \u00ab vid\u00e9o 12 \u00bb, \u00ab carrousel 7 \u00bb \u2014 des renvois vers
 * `20-PRODUCTION-VIDEOS.md` et consorts. Pass\u00e9e \u00e0 `estVrai`, aucune de ces
 * 61 cellules ne rendait `true` : l'import cr\u00e9ait **z\u00e9ro asset** au lieu de
 * soixante et un, sans que rien ne rougisse.
 *
 * La r\u00e9f\u00e9rence est conserv\u00e9e : c'est elle qui permet de retrouver la fiche de
 * production correspondante dans le dossier.
 */
export interface LectureProduction {
  aProduire: boolean;
  /** `null` quand la cellule dit seulement \u00ab oui \u00bb, sans d\u00e9signer quoi. */
  reference: string | null;
}

const NEGATIONS_PRODUCTION: readonly string[] = [
  "",
  "non",
  "aucun",
  "aucune",
  "-",
  "n/a",
  "na",
  "0",
  "false",
];

export function lireProduction(brut: string): LectureProduction {
  const v = brut.trim();
  if (NEGATIONS_PRODUCTION.includes(v.toLowerCase())) return { aProduire: false, reference: null };
  if (estVrai(v)) return { aProduire: true, reference: null };
  return { aProduire: true, reference: v };
}

/**
 * Lit la colonne `echo_page` et rend la DATE de la reprise, ou `null`.
 *
 * \u26a0\ufe0f Deuxi\u00e8me \u00e9cart entre la fixture et le vrai dossier, et le plus co\u00fbteux.
 * La fixture \u00e9crit \u00ab oui \u00bb ; le dossier r\u00e9el \u00e9crit **le jour de la reprise**,
 * sans l'ann\u00e9e : `05/09`, `10/12`, `28/12`. Lue par `estVrai`, chacune de ces
 * treize cellules rendait `false` \u2014 **aucun \u00e9cho n'\u00e9tait cr\u00e9\u00e9**. Et m\u00eame
 * corrig\u00e9e en bool\u00e9en, la date se serait perdue : l'\u00e9cho aurait \u00e9t\u00e9 dat\u00e9 du
 * m\u00eame jour que son post d'origine, alors que le dossier le programme deux
 * jours plus tard.
 *
 * L'ann\u00e9e manquante est d\u00e9duite de celle du post. Si le jour tomb\u00e9 serait
 * ANT\u00c9RIEUR au post, on passe \u00e0 l'ann\u00e9e suivante \u2014 un \u00e9cho du 04/01 pour un
 * post du 28/12 appartient \u00e0 l'ann\u00e9e d'apr\u00e8s, pas onze mois plus t\u00f4t.
 */
export function lireEchoPage(brut: string, datePost: Date): Date | null {
  const v = brut.trim();
  if (!v) return null;

  // \u00ab oui \u00bb : la fixture, et tout dossier qui ne daterait pas ses reprises.
  if (estVrai(v)) return datePost;

  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}))?$/);
  const bjour = m?.[1];
  const bmois = m?.[2];
  if (!m || bjour === undefined || bmois === undefined) {
    throw new Error(
      `\u00c9cho de page \u00ab ${brut} \u00bb illisible \u2014 attendu \u00ab oui \u00bb, \u00ab JJ/MM \u00bb ou \u00ab JJ/MM/AAAA \u00bb.`,
    );
  }

  const jour = Number(bjour);
  const mois = Number(bmois);
  if (mois < 1 || mois > 12)
    throw new Error(`\u00c9cho de page \u00ab ${brut} \u00bb : mois hors bornes.`);
  if (jour < 1 || jour > 31)
    throw new Error(`\u00c9cho de page \u00ab ${brut} \u00bb : jour hors bornes.`);

  const bannee = m[3];
  const annee = bannee === undefined ? datePost.getUTCFullYear() : Number(bannee);

  // \ud83d\udd34 `Date.UTC`, pour la m\u00eame raison que `convertirDate` : la colonne est
  // un `@db.Date` et une construction en heure locale reculerait d'un jour.
  let d = new Date(Date.UTC(annee, mois - 1, jour));
  if (d.getUTCDate() !== jour || d.getUTCMonth() !== mois - 1) {
    throw new Error(`\u00c9cho de page \u00ab ${brut} \u00bb : date inexistante au calendrier.`);
  }
  if (bannee === undefined && d.getTime() < datePost.getTime()) {
    d = new Date(Date.UTC(annee + 1, mois - 1, jour));
  }
  return d;
}
