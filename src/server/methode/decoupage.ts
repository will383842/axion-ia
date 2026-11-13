/**
 * Couche « Méthode » — découpage des fiches Markdown en entrées de connaissance.
 *
 * Module PUR (aucune entrée/sortie) : il reçoit le chemin RELATIF d'un fichier et son
 * contenu, et rend la liste des fiches à créer ou mettre à jour. Le script
 * `scripts/methode/importer-methode.ts` s'en sert pour l'essai à blanc comme pour
 * l'écriture. Cf. ADR 0076.
 *
 * Règles (ADR 0076 § 2.3 à 2.6) :
 *   - slug stable `methode/<fichier>/<section>` ;
 *   - une section numérotée (1., 2., 3.… dans l'ordre) = une fiche ; les blocs
 *     « MISE EN SITUATION », « CARTES MÉMO » et « ? TESTE-TOI » = une fiche chacun ;
 *   - le bloc « L'ESSENTIEL EN 30 SECONDES » + « LE CHEMIN » = la fiche `essentiel`
 *     (pour la fiche 00, c'est le NOYAU toujours injecté) ;
 *   - toute section qui cite un montant en euros, un acompte, un abonnement ou un
 *     suivi à 30 jours reçoit l'étiquette `chiffres-exercice` et l'avertissement en
 *     tête : ce sont des EXEMPLES d'entraînement, jamais des règles ni des prix.
 */

/** Préfixe commun de tous les slugs de la couche. */
export const PREFIXE_SLUG = "methode";

/** Slug du noyau toujours injecté (fiche 00, « L'essentiel » + « Le chemin »). */
export const SLUG_NOYAU = "methode/00-axion-ia-methode-de-vente/essentiel";

export const COLLECTION_VENTE = "methode-vente";
export const COLLECTION_SANTE = "methode-secteur-sante";

export const ETIQUETTE_METHODE = "methode";
export const ETIQUETTE_CHIFFRES = "chiffres-exercice";
export const ETIQUETTE_SANTE = "secteur:sante";

/** Avertissement posé en tête de toute fiche qui cite des montants (ADR 0076 § 2.5). */
export const AVERTISSEMENT_CHIFFRES =
  "⚠️ Montants d'entraînement, pas de prix public. Les montants, l'acompte, l'abonnement " +
  "et le suivi cités ici sont des EXEMPLES, jamais des règles ni des prix. Seul prix " +
  "affiché : Journée IA 1 490 € HT (source : src/content/offre.ts).";

export type TypeFiche = "regle" | "script" | "objection" | "calcul" | "posture";

export interface FicheMethode {
  /** `methode/<fichier>/<section>`, ≤ 180 caractères. */
  readonly slug: string;
  /** `<fichier>` normalisé. */
  readonly fichier: string;
  /** `<section>` normalisée. */
  readonly section: string;
  readonly titre: string;
  /** Corps (avertissement compris si `chiffresExercice`). */
  readonly corps: string;
  /** `doctrine` pour la fiche 00, `methodology` sinon. */
  readonly kbType: "doctrine" | "methodology";
  readonly typeFiche: TypeFiche;
  readonly collection: typeof COLLECTION_VENTE | typeof COLLECTION_SANTE;
  readonly chiffresExercice: boolean;
  /** Toutes les étiquettes, triées, sans doublon. */
  readonly etiquettes: readonly string[];
}

/** Fichiers jamais importés (ADR 0076 § 2.6). */
export function estFichierImportable(cheminRelatif: string): boolean {
  const c = cheminRelatif.replace(/\\/g, "/");
  const nom = c.split("/").pop() ?? "";
  if (!nom.toLowerCase().endsWith(".md")) return false;
  if (/^LISEZ-MOI\.md$/i.test(nom)) return false;
  if (/^EVALUATION-FICHES/i.test(nom)) return false;
  // Fiches propres (axion-brand `methode/propre/`) : l'index et les rapports de
  // contrôle (`_controles/`) décrivent les fiches, ils n'en sont pas.
  if (/^INDEX\.md$/i.test(nom)) return false;
  const segments = c.split("/");
  if (segments.slice(0, -1).some((d) => d.startsWith("_"))) return false;
  if (segments.includes("livres-purs")) return false;
  // Secteur santé : seul l'original Markdown ; l'extrait PDF est un doublon de comparaison.
  if (/extrait-pdf\.md$/i.test(nom)) return false;
  return true;
}

/** Minuscules ASCII, tirets, sans accents. */
export function normaliserSlug(texte: string, max = 60): string {
  const base = texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length <= max) return base;
  const coupe = base.slice(0, max);
  const dernier = coupe.lastIndexOf("-");
  return (dernier > max / 2 ? coupe.slice(0, dernier) : coupe).replace(/-+$/g, "");
}

const MONTANT_EUROS = /\d[\d\s  .,]*\s*(?:k\s*)?(?:€|EUR\b|euros?\b)/i;
const MARQUEURS_EXERCICE = /\bacomptes?\b|\babonnements?\b|\bsuivi (?:à|a) 30 jours\b/i;

/** Vrai si le texte cite un montant en euros, un acompte, un abonnement ou un suivi à 30 jours. */
export function contientChiffresExercice(texte: string): boolean {
  return MONTANT_EUROS.test(texte) || MARQUEURS_EXERCICE.test(texte);
}

/** Pose l'avertissement en tête, une seule fois. */
export function avecAvertissement(texte: string): string {
  const t = texte.trimStart();
  if (t.startsWith(AVERTISSEMENT_CHIFFRES)) return t;
  return `${AVERTISSEMENT_CHIFFRES}\n\n${t}`;
}

/** `livre:<auteur>` déduit du nom de fichier. */
export function livreDepuisFichier(nomFichier: string): string {
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
  for (const a of auteurs) if (n.includes(a)) return `livre:${a}`;
  return "livre:axion-ia";
}

/** Exactement un `type:*`, déduit du titre (puis du fichier). Ordre = priorité. */
export function classerTypeFiche(titre: string, nomFichier: string): TypeFiche {
  const t = titre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const f = nomFichier.toLowerCase();
  if (/objection|trop cher|je vais reflechir|pas maintenant/.test(t)) return "objection";
  if (/calcul|formule|chiffr|combien|remboursement|perte annuelle/.test(t)) return "calcul";
  if (/posture|voix|tenue|attitude/.test(t) || f.includes("posture")) return "posture";
  if (/script|phrase|dire|expressions?|mise en situation|ce que je dis|cartes memo/.test(t)) {
    return "script";
  }
  if (f.includes("expressions")) return "script";
  return "regle";
}

const MARQUEURS_BLOC: ReadonlyArray<{ re: RegExp; cle: string; libelle: string }> = [
  { re: /^MISE EN SITUATION$/, cle: "mise-en-situation", libelle: "Mise en situation" },
  { re: /^CARTES MÉMO$/, cle: "cartes-memo", libelle: "Cartes mémo" },
  { re: /^\?\s*TESTE-TOI$/, cle: "teste-toi", libelle: "Teste-toi" },
];

const ESSENTIEL_DEBUT = /^L['’]ESSENTIEL EN 30 SECONDES$/;
const ESSENTIEL_FIN = /^Les idées clés$/;

/** Retire les marqueurs de page, compteurs « N / M » et l'en-tête répété des extraits PDF. */
export function nettoyerExtraitPdf(contenu: string): string[] {
  const lignes = contenu.replace(/\r\n?/g, "\n").split("\n");
  const entetes = new Map<string, number>();
  for (let i = 0; i < lignes.length - 1; i += 1) {
    if (/^\d+ \/ \d+$/.test((lignes[i] ?? "").trim())) {
      const suivante = (lignes[i + 1] ?? "").trim();
      if (suivante) entetes.set(suivante, (entetes.get(suivante) ?? 0) + 1);
    }
  }
  const aRetirer = new Set([...entetes].filter(([, n]) => n >= 2).map(([l]) => l));
  return lignes.filter((l) => {
    const t = l.trim();
    if (/^<!--\s*page \d+\s*-->$/.test(t)) return false;
    if (/^\d+ \/ \d+$/.test(t)) return false;
    if (aRetirer.has(t)) return false;
    return true;
  });
}

interface SectionBrute {
  section: string;
  titre: string;
  lignes: string[];
}

function corpsDe(lignes: readonly string[]): string {
  return lignes
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Découpe un fichier en fiches. `cheminRelatif` est relatif au dossier importé
 * (ex. `livres/00-AXION-IA-Methode-de-vente.md`, `secteurs/sante/…`).
 */
export function decouperFichier(cheminRelatif: string, contenu: string): FicheMethode[] {
  const fm = lireEnTete(contenu);
  if (fm) return decouperFichePropre(cheminRelatif, fm.entete, fm.reste);
  const chemin = cheminRelatif.replace(/\\/g, "/");
  const nomFichier = (chemin.split("/").pop() ?? chemin).replace(/\.md$/i, "");
  const fichier = normaliserSlug(nomFichier, 80);
  const estSante = /(^|\/)secteurs\/sante\//.test(chemin);
  const estFiche00 = fichier.startsWith("00-");
  const lignes = nettoyerExtraitPdf(contenu);

  // Titre du document : la première ligne « # ».
  const titreDoc = (lignes.find((l) => /^#\s+/.test(l)) ?? `# ${nomFichier}`)
    .replace(/^#\s+/, "")
    .trim();

  // Fichier Markdown structuré (titres « # 1. ») : seules les lignes de titre comptent.
  const titresNumerotes = lignes.some((l) => /^#{1,3}\s+\d{1,2}\.\s+\S/.test(l));
  const reSection = titresNumerotes ? /^#{1,3}\s+(\d{1,2})\.\s+(\S.*)$/ : /^(\d{1,2})\.\s+(\S.*)$/;

  const sections: SectionBrute[] = [];
  const essentiel: string[] = [];
  let courante: SectionBrute = { section: "introduction", titre: "Introduction", lignes: [] };
  let attendu = 1;
  // Liste numérotée IMBRIQUÉE (ex. un tableau « 1. Se positionner … 10. Après » à
  // l'intérieur de la section 3) : elle repart à 1 et l'emporte sur la section
  // suivante tant qu'elle se poursuit (n = imbrique + 1).
  let imbrique = 0;
  let blocsCommences = false;
  let dansEssentiel = false;
  const compteBlocs = new Map<string, number>();

  for (const brute of lignes) {
    const ligne = brute.replace(/\s+$/, "");
    const t = ligne.trim();

    if (ESSENTIEL_DEBUT.test(t)) {
      dansEssentiel = true;
      essentiel.push(t);
      continue;
    }
    if (dansEssentiel) {
      if (ESSENTIEL_FIN.test(t)) {
        dansEssentiel = false;
        courante.lignes.push(t);
        continue;
      }
      const debutSection = !blocsCommences && reSection.exec(t);
      if (!(debutSection && Number(debutSection[1]) === attendu)) {
        essentiel.push(ligne);
        continue;
      }
      dansEssentiel = false;
    }

    const bloc = MARQUEURS_BLOC.find((m) => m.re.test(t));
    if (bloc) {
      sections.push(courante);
      blocsCommences = true;
      const n = (compteBlocs.get(bloc.cle) ?? 0) + 1;
      compteBlocs.set(bloc.cle, n);
      courante = { section: `${bloc.cle}-${String(n)}`, titre: bloc.libelle, lignes: [] };
      continue;
    }

    const m = !blocsCommences ? reSection.exec(t) : null;
    const numero = m ? Number(m[1]) : 0;
    if (
      m &&
      !titresNumerotes &&
      attendu > 1 &&
      (numero === 1 || (imbrique > 0 && numero === imbrique + 1))
    ) {
      imbrique = numero;
      courante.lignes.push(ligne);
      continue;
    }
    if (m && numero === attendu) {
      imbrique = 0;
      sections.push(courante);
      const titre = (m[2] ?? "").replace(/^#+\s*/, "").trim();
      courante = {
        section: `${String(attendu)}-${normaliserSlug(titre)}`,
        titre: `${String(attendu)}. ${titre}`,
        lignes: [],
      };
      attendu += 1;
      continue;
    }

    // La ligne de titre du document et la ligne « Source : … » ne sont pas du contenu.
    if (courante.section === "introduction" && (/^#\s+/.test(t) || /^Source\s*:/.test(t))) continue;

    // Le titre d'une mise en situation est sa première ligne non vide.
    if (
      courante.titre.endsWith("Mise en situation") &&
      courante.lignes.every((l) => !l.trim()) &&
      t
    ) {
      courante.titre = `Mise en situation : ${t.length > 120 ? `${t.slice(0, 117)}…` : t}`;
    }
    courante.lignes.push(ligne);
  }
  sections.push(courante);

  const livre = livreDepuisFichier(nomFichier);
  const collection = estSante ? COLLECTION_SANTE : COLLECTION_VENTE;
  const vus = new Map<string, number>();
  const fiches: FicheMethode[] = [];

  const ajouter = (section: string, titre: string, corpsBrut: string) => {
    if (corpsBrut.length < 40) return;
    let cle = section || "section";
    const deja = vus.get(cle) ?? 0;
    vus.set(cle, deja + 1);
    if (deja > 0) cle = `${cle}-${String(deja + 1)}`;
    const slug = `${PREFIXE_SLUG}/${fichier}/${cle}`.slice(0, 180);
    const chiffres = contientChiffresExercice(corpsBrut);
    const typeFiche = section === "essentiel" ? "regle" : classerTypeFiche(titre, nomFichier);
    const etiquettes = new Set<string>([ETIQUETTE_METHODE, livre, `type:${typeFiche}`]);
    if (chiffres) etiquettes.add(ETIQUETTE_CHIFFRES);
    if (estSante) etiquettes.add(ETIQUETTE_SANTE);
    fiches.push({
      slug,
      fichier,
      section: cle,
      titre: `${titreDoc} — ${titre}`.slice(0, 255),
      corps: chiffres ? avecAvertissement(corpsBrut) : corpsBrut,
      kbType: estFiche00 ? "doctrine" : "methodology",
      typeFiche,
      collection,
      chiffresExercice: chiffres,
      etiquettes: [...etiquettes].sort(),
    });
  };

  if (essentiel.length > 0) {
    ajouter("essentiel", "L'essentiel en 30 secondes et le chemin", corpsDe(essentiel));
  }
  for (const s of sections) {
    const corps = corpsDe(s.lignes);
    if (s.section === "introduction") {
      if (corps.length >= 200) ajouter(s.section, s.titre, corps);
      continue;
    }
    // Le titre de la section fait partie de la fiche (une règle tient parfois en une ligne).
    ajouter(s.section, s.titre, corpsDe([s.titre, ...s.lignes]));
  }
  return fiches;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Fiches PROPRES (axion-brand `methode/propre/**`, R13) : en-tête YAML + un
//  marqueur `<!-- id: … ; type: … ; chiffres-exercice: oui|non -->` sous chaque
//  titre de section. L'id écrit par l'auteur EST la section du slug : il est
//  stable, contrôlé (aucun doublon) et indépendant de la mise en forme.
// ─────────────────────────────────────────────────────────────────────────────

const TYPES_FICHE: readonly TypeFiche[] = ["regle", "script", "objection", "calcul", "posture"];
const RE_MARQUEUR_ID = /^<!--\s*id:\s*([^;>]+?)\s*(?:;(.*?))?-->$/;
const RE_TITRE = /^(#{1,6})\s+(\S.*)$/;

/** En-tête YAML minimal (`clé: valeur` sur une ligne). `null` si absent. */
export function lireEnTete(
  contenu: string,
): { entete: Readonly<Record<string, string>>; reste: string } | null {
  const texte = contenu.replace(/\r\n?/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(texte);
  if (!m) return null;
  const entete: Record<string, string> = {};
  for (const ligne of (m[1] ?? "").split("\n")) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(ligne);
    if (kv?.[1]) entete[kv[1]] = (kv[2] ?? "").trim().replace(/^["']|["']$/g, "");
  }
  return { entete, reste: texte.slice(m[0].length) };
}

function attributsMarqueur(suite: string | undefined): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const part of (suite ?? "").split(";")) {
    const kv = /^\s*([\w-]+)\s*:\s*(.*?)\s*$/.exec(part);
    if (kv?.[1]) attrs[kv[1]] = kv[2] ?? "";
  }
  return attrs;
}

const RE_ESSENTIEL_PROPRE = /^>?\s*\*{0,2}L['’]ESSENTIEL EN 30 SECONDES\*{0,2}\s*$/;
const RE_FIN_CHEMIN = /^\(?Les idées clés\)?$/;

/**
 * Sort le bloc « L'ESSENTIEL EN 30 SECONDES » + « LE CHEMIN » d'une section de la
 * fiche 00 (citation Markdown) : il devient la fiche `essentiel` (le NOYAU).
 */
function extraireEssentiel(lignes: readonly string[]): {
  essentiel: string[];
  reste: string[];
} {
  const debut = lignes.findIndex((l) => RE_ESSENTIEL_PROPRE.test(l.trim()));
  if (debut < 0) return { essentiel: [], reste: [...lignes] };
  let fin = lignes.length;
  let vuChemin = false;
  for (let i = debut + 1; i < lignes.length; i += 1) {
    const t = (lignes[i] ?? "").trim();
    if (/^\*{0,2}LE CHEMIN\*{0,2}$/.test(t)) vuChemin = true;
    if (RE_FIN_CHEMIN.test(t) || RE_TITRE.test(t)) {
      fin = RE_FIN_CHEMIN.test(t) ? i + 1 : i;
      break;
    }
    // Sans « LE CHEMIN », la citation s'arrête à la première ligne hors citation.
    if (!vuChemin && t && !t.startsWith(">")) {
      fin = i;
      break;
    }
  }
  const essentiel = lignes
    .slice(debut, fin)
    .filter((l) => !RE_FIN_CHEMIN.test(l.trim()))
    .map((l) => l.replace(/^>\s?/, ""));
  return { essentiel, reste: [...lignes.slice(0, debut), ...lignes.slice(fin)] };
}

export function decouperFichePropre(
  cheminRelatif: string,
  entete: Readonly<Record<string, string>>,
  corps: string,
): FicheMethode[] {
  const chemin = cheminRelatif.replace(/\\/g, "/");
  const nomFichier = (chemin.split("/").pop() ?? chemin).replace(/\.md$/i, "");
  const slugEntete = entete.slug ?? "";
  const fichier = normaliserSlug(slugEntete.split("/").pop() || nomFichier, 80);
  const estSante = /(^|\/)secteurs\/sante\//.test(chemin) || entete.secteur === "sante";
  const estFiche00 = fichier.startsWith("00-");
  const titreDoc = (entete.titre ?? nomFichier).trim();
  const lignes = corps.split("\n").filter((l) => !/^<!--\s*page \d+\s*-->$/.test(l.trim()));

  interface Bloc {
    id: string;
    titre: string;
    attrs: Record<string, string>;
    lignes: string[];
  }
  const blocs: Bloc[] = [];
  let courant: Bloc = { id: "introduction", titre: "Introduction", attrs: {}, lignes: [] };
  for (let i = 0; i < lignes.length; i += 1) {
    const ligne = (lignes[i] ?? "").replace(/\s+$/, "");
    const titre = RE_TITRE.exec(ligne.trim());
    const marqueur = titre ? RE_MARQUEUR_ID.exec((lignes[i + 1] ?? "").trim()) : null;
    if (titre && marqueur?.[1]) {
      blocs.push(courant);
      courant = {
        id: marqueur[1],
        titre: (titre[2] ?? "").trim(),
        attrs: attributsMarqueur(marqueur[2]),
        lignes: [ligne],
      };
      i += 1; // le marqueur n'est pas du contenu
      continue;
    }
    // Un marqueur orphelin (sans titre au-dessus) n'est pas du contenu non plus.
    if (RE_MARQUEUR_ID.test(ligne.trim())) continue;
    courant.lignes.push(ligne);
  }
  blocs.push(courant);

  // Introduction : sans la ligne de titre du document.
  const intro = blocs[0];
  if (intro) intro.lignes = intro.lignes.filter((l) => !/^#\s+/.test(l.trim()));

  const livre = livreDepuisFichier(nomFichier);
  const collection = estSante ? COLLECTION_SANTE : COLLECTION_VENTE;
  const vus = new Map<string, number>();
  const fiches: FicheMethode[] = [];

  const ajouter = (
    section: string,
    titre: string,
    corpsBrut: string,
    attrs: Record<string, string>,
  ) => {
    if (corpsBrut.length < 40) return;
    // L'id de l'auteur est gardé TEL QUEL s'il est déjà sûr (il peut porter « -- ») :
    // c'est lui que l'index et les contrôles citent.
    let cle =
      /^[a-z0-9]+(?:-+[a-z0-9]+)*$/.test(section) && section.length <= 100
        ? section
        : normaliserSlug(section, 100) || "section";
    const deja = vus.get(cle) ?? 0;
    vus.set(cle, deja + 1);
    if (deja > 0) cle = `${cle}-${String(deja + 1)}`;
    const slug = `${PREFIXE_SLUG}/${fichier}/${cle}`.slice(0, 180);
    // Union : le marqueur de l'auteur OU la détection — un montant ne passe jamais nu.
    const chiffres =
      /^oui$/i.test(attrs["chiffres-exercice"] ?? "") || contientChiffresExercice(corpsBrut);
    const typeMarque = (attrs.type ?? "").toLowerCase() as TypeFiche;
    const typeFiche =
      section === "essentiel"
        ? "regle"
        : TYPES_FICHE.includes(typeMarque)
          ? typeMarque
          : classerTypeFiche(titre, nomFichier);
    const etiquettes = new Set<string>([ETIQUETTE_METHODE, livre, `type:${typeFiche}`]);
    if (chiffres) etiquettes.add(ETIQUETTE_CHIFFRES);
    if (estSante) etiquettes.add(ETIQUETTE_SANTE);
    fiches.push({
      slug,
      fichier,
      section: cle,
      titre: `${titreDoc} — ${titre}`.slice(0, 255),
      corps: chiffres ? avecAvertissement(corpsBrut) : corpsBrut,
      kbType: estFiche00 ? "doctrine" : "methodology",
      typeFiche,
      collection,
      chiffresExercice: chiffres,
      etiquettes: [...etiquettes].sort(),
    });
  };

  // Fiche 00 : le bloc « L'essentiel » + « Le chemin » devient le noyau.
  if (estFiche00) {
    for (const b of blocs) {
      const { essentiel, reste } = extraireEssentiel(b.lignes);
      if (essentiel.length === 0) continue;
      b.lignes = reste;
      ajouter("essentiel", "L'essentiel en 30 secondes et le chemin", corpsDe(essentiel), {});
      break;
    }
  }

  const avecId = blocs.length > 1;
  for (const b of blocs) {
    const texte = corpsDe(b.lignes);
    if (b.id === "introduction") {
      // Sans aucun marqueur, le fichier entier est UNE fiche.
      if (!avecId) ajouter("fiche", titreDoc, texte, {});
      else if (texte.length >= 200) ajouter("introduction", b.titre, texte, {});
      continue;
    }
    ajouter(b.id, b.titre, texte, b.attrs);
  }
  return fiches;
}
