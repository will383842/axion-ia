/**
 * Rapprochement bancaire Finom v1 — module PUR (aucun I/O, aucune persistance).
 *
 * Deux responsabilités, testées isolément (rapprochement.spec.ts) :
 *   1. `parseFinomStatement` — parse l'export CSV Finom (format RÉEL vérifié
 *      sur un fichier de Will : séparateur virgule, en-têtes français
 *      « Date Complété UTC,Nom Contrepartie,Référence,Montant payé », dates
 *      JJ/MM/AAAA en UTC, montants décimaux français à VIRGULE possiblement
 *      entre guillemets, négatif = débit / positif = crédit, Référence « N/A »
 *      fréquente).
 *   2. `suggererRapprochements` — propose, pour chaque CRÉDIT du relevé, la
 *      facture ouverte qui lui correspond le mieux (montant exact et/ou nom de
 *      contrepartie), sans jamais suggérer deux fois la même facture.
 *
 * v1 SANS persistance : rien n'est écrit ici. L'encaissement effectif passe
 * par `enregistrerPaiementFactureAction` (transaction complète existante) —
 * ce module ne fait que LIRE un relevé et SUGGÉRER.
 *
 * Parsing manuel volontaire (aucune lib CSV) : le format est fermé (4 colonnes
 * connues), une state machine guillemets d'une quarantaine de lignes suffit et
 * n'ajoute aucun poids au bundle.
 */

export interface LigneReleve {
  /** Minuit UTC du jour du mouvement (colonne « Date Complété UTC »). */
  date: Date;
  contrepartie: string;
  /** Colonne « Référence » ; « N/A » (valeur Finom pour « aucune ») devient null. */
  reference: string | null;
  /** Montant SIGNÉ en centimes : négatif = débit (sortie), positif = crédit. */
  montantCents: number;
}

export interface FactureOuvertePourMatch {
  id: string;
  numero: string;
  destinataireNom: string | null;
  clientNom: string | null;
  /** Reste dû NET en centimes (TTC + avoirs négatifs − encaissements). */
  resteDuCents: number;
}

/**
 * - `exact`    : montant égal au reste dû ET nom de contrepartie retrouvé.
 * - `probable` : montant égal SANS correspondance de nom, OU nom retrouvé avec
 *                un écart de montant < 5 %.
 * - `aucune`   : crédit sans facture candidate (facture: null).
 */
export type NiveauSuggestion = "exact" | "probable" | "aucune";

export interface Suggestion {
  ligne: LigneReleve;
  niveau: NiveauSuggestion;
  facture: FactureOuvertePourMatch | null;
}

/** En-têtes EXACTS de l'export Finom (après trim des cellules). */
const ENTETES_FINOM = ["Date Complété UTC", "Nom Contrepartie", "Référence", "Montant payé"];

/**
 * Découpe le texte CSV complet en lignes de champs — state machine guillemets :
 * une virgule ou un saut de ligne ENTRE guillemets fait partie du champ, un
 * guillemet doublé (`""`) est un guillemet littéral.
 */
function decouperCsv(texte: string): string[][] {
  const lignes: string[][] = [];
  let champs: string[] = [];
  let cur = "";
  let entreGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const ch = texte[i];
    if (ch === '"') {
      if (entreGuillemets && texte[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        entreGuillemets = !entreGuillemets;
      }
    } else if (ch === "," && !entreGuillemets) {
      champs.push(cur);
      cur = "";
    } else if ((ch === "\n" || ch === "\r") && !entreGuillemets) {
      if (ch === "\r" && texte[i + 1] === "\n") i++; // CRLF
      champs.push(cur);
      lignes.push(champs);
      champs = [];
      cur = "";
    } else {
      cur += ch;
    }
  }
  champs.push(cur);
  lignes.push(champs);
  return lignes;
}

/** « JJ/MM/AAAA » → minuit UTC du jour, ou null si invalide (31/02, etc.). */
function parseDateFinom(brut: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(brut);
  if (m === null) return null;
  const [, jj, mm, aaaa] = m as unknown as [string, string, string, string];
  const jour = Number(jj);
  const mois = Number(mm);
  const annee = Number(aaaa);
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  // Round-trip : Date.UTC « normalise » les débordements (32/01 → 01/02) — on
  // refuse au lieu de corriger en silence.
  if (d.getUTCFullYear() !== annee || d.getUTCMonth() !== mois - 1 || d.getUTCDate() !== jour) {
    return null;
  }
  return d;
}

/**
 * Montant décimal FRANÇAIS (« -11,50 », « 1 234,56 ») → centimes entiers
 * signés, ou null si illisible. Les espaces (y compris insécables) sont des
 * groupements de milliers ; un point éventuel aussi (« 1.234,56 »).
 */
function parseMontantFinom(brut: string): number | null {
  const sansEspaces = brut.replace(/[\s\u00A0\u202F]/g, "");
  if (sansEspaces === "") return null;
  // Point = séparateur de milliers UNIQUEMENT s'il reste une virgule décimale ;
  // sinon on l'accepte comme décimale (défensif, ex. « -11.50 »).
  const normalise = sansEspaces.includes(",")
    ? sansEspaces.replace(/\./g, "").replace(",", ".")
    : sansEspaces;
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalise)) return null;
  const n = Number.parseFloat(normalise);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Parse un export CSV Finom. Robuste : BOM, CRLF, champs quotés avec virgules
 * internes, lignes vides ignorées. L'en-tête est VALIDÉ — un fichier qui n'est
 * pas un relevé Finom est refusé avec un message explicite plutôt que parsé en
 * lignes toutes invalides.
 */
export function parseFinomStatement(csvText: string): {
  lignes: LigneReleve[];
  erreurs: string[];
} {
  const erreurs: string[] = [];
  // BOM UTF-8 en tête de fichier : retiré avant découpe.
  const texte = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
  const brut = decouperCsv(texte);

  // Lignes entièrement vides (fin de fichier, lignes blanches) ignorées, mais
  // l'index d'origine est conservé pour des messages d'erreur 1-indexés exacts.
  const rangs = brut
    .map((champs, index) => ({ champs, numero: index + 1 }))
    .filter(({ champs }) => champs.some((c) => c.trim() !== ""));

  const entete = rangs[0];
  const enteteValide =
    entete !== undefined &&
    ENTETES_FINOM.every((attendu, i) => (entete.champs[i] ?? "").trim() === attendu);
  if (!enteteValide) {
    return {
      lignes: [],
      erreurs: [
        `Ce fichier ne ressemble pas à un relevé Finom : en-têtes attendus « ${ENTETES_FINOM.join(",")} ».`,
      ],
    };
  }

  const lignes: LigneReleve[] = [];
  for (const { champs, numero } of rangs.slice(1)) {
    const date = parseDateFinom((champs[0] ?? "").trim());
    const contrepartie = (champs[1] ?? "").trim();
    const referenceBrute = (champs[2] ?? "").trim();
    const montantCents = parseMontantFinom((champs[3] ?? "").trim());

    if (date === null) {
      erreurs.push(
        `Ligne ${numero} : date « ${(champs[0] ?? "").trim()} » invalide (attendu JJ/MM/AAAA).`,
      );
      continue;
    }
    if (montantCents === null) {
      erreurs.push(`Ligne ${numero} : montant « ${(champs[3] ?? "").trim()} » illisible.`);
      continue;
    }
    lignes.push({
      date,
      contrepartie,
      reference:
        referenceBrute === "" || referenceBrute.toUpperCase() === "N/A" ? null : referenceBrute,
      montantCents,
    });
  }

  return { lignes, erreurs };
}

/** Normalisation pour comparaison de noms : minuscules, sans accents ni ponctuation. */
function normaliserNom(nom: string): string {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Vrai si le nom de la contrepartie est contenu dans le nom de la facture
 * (destinataire ou client) OU l'inverse. Les chaînes de moins de 3 caractères
 * normalisés sont écartées : « sa » serait contenu dans la moitié des raisons
 * sociales.
 */
function nomCorrespond(contrepartie: string, facture: FactureOuvertePourMatch): boolean {
  const c = normaliserNom(contrepartie);
  if (c.length < 3) return false;
  for (const nom of [facture.destinataireNom, facture.clientNom]) {
    if (nom === null) continue;
    const n = normaliserNom(nom);
    if (n.length < 3) continue;
    if (n.includes(c) || c.includes(n)) return true;
  }
  return false;
}

/** Écart relatif de montant < 5 % du reste dû (les deux strictement positifs). */
function montantProche(montantCents: number, resteDuCents: number): boolean {
  if (resteDuCents <= 0 || montantCents <= 0) return false;
  return Math.abs(resteDuCents - montantCents) / resteDuCents < 0.05;
}

/**
 * Suggère un rapprochement facture pour chaque CRÉDIT du relevé.
 *
 * Attribution GLOUTONNE par score décroissant : une facture n'est suggérée
 * qu'une seule fois par relevé, au meilleur crédit d'abord (montant exact + nom
 * avant montant exact seul, avant nom seul à moins de 5 % d'écart ; à score
 * égal, le plus petit écart de montant gagne). Les débits (montant négatif ou
 * nul) sont ignorés — hors périmètre du rapprochement des encaissements.
 *
 * Retour trié : suggestions exactes, puis probables, puis crédits sans
 * correspondance (niveau « aucune », facture null).
 */
export function suggererRapprochements(
  credits: LigneReleve[],
  factures: FactureOuvertePourMatch[],
): Suggestion[] {
  const creditsPositifs = credits.filter((c) => c.montantCents > 0);

  interface Candidat {
    indexCredit: number;
    facture: FactureOuvertePourMatch;
    niveau: "exact" | "probable";
    score: number;
    ecart: number;
  }

  const candidats: Candidat[] = [];
  creditsPositifs.forEach((credit, indexCredit) => {
    for (const facture of factures) {
      const montantExact = facture.resteDuCents === credit.montantCents;
      const nomOk = nomCorrespond(credit.contrepartie, facture);
      const ecart = Math.abs(facture.resteDuCents - credit.montantCents);
      if (montantExact && nomOk) {
        candidats.push({ indexCredit, facture, niveau: "exact", score: 3, ecart });
      } else if (montantExact) {
        candidats.push({ indexCredit, facture, niveau: "probable", score: 2, ecart });
      } else if (nomOk && montantProche(credit.montantCents, facture.resteDuCents)) {
        candidats.push({ indexCredit, facture, niveau: "probable", score: 1, ecart });
      }
    }
  });

  candidats.sort((a, b) => b.score - a.score || a.ecart - b.ecart || a.indexCredit - b.indexCredit);

  const facturesPrises = new Set<string>();
  const attribution = new Map<
    number,
    { facture: FactureOuvertePourMatch; niveau: "exact" | "probable" }
  >();
  for (const cand of candidats) {
    if (attribution.has(cand.indexCredit) || facturesPrises.has(cand.facture.id)) continue;
    facturesPrises.add(cand.facture.id);
    attribution.set(cand.indexCredit, { facture: cand.facture, niveau: cand.niveau });
  }

  const suggestions: Suggestion[] = creditsPositifs.map((ligne, i) => {
    const hit = attribution.get(i);
    return hit === undefined
      ? { ligne, niveau: "aucune", facture: null }
      : { ligne, niveau: hit.niveau, facture: hit.facture };
  });

  const ordre: Record<NiveauSuggestion, number> = { exact: 0, probable: 1, aucune: 2 };
  return suggestions.slice().sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);
}
