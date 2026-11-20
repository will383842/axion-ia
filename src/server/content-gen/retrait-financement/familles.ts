/**
 * Retrait des mentions de financement — PR B : générateur d'overrides PAR FAMILLE.
 *
 * Entrée : le rapport Markdown de l'essai à blanc (`--report`, section « Cas ambigus »). Sortie : trois
 * fichiers relisibles (cf. `scripts/content-gen/retrait-financement-generer-overrides.ts`). Ce module est
 * PUR : texte entrant, texte sortant. Il n'ouvre ni la base, ni le réseau, ni un fichier.
 *
 * Familles (analyse du 20/11/2026, `geo/relectures/ANALYSE-DRY-RUN-RETRAIT-2026-11-20.md`) :
 *   F1  FAQ dont la question parle de financement et dont TOUTES les phrases sont visées → AUTO
 *   F2  FAQ dont la question parle de financement, réponse mêlée                         → lot agent
 *   F3  FAQ à question étrangère, réponse avec phrase « forme non prouvée »              → lot agent
 *   F4  section HTML titrée sur le financement : 100 % financement → AUTO ; mêlée → lot agent
 *   F5  phrase DANS une section F4 : disparaît avec la section (aucune ligne propre)
 *   F6  phrase hors section (intro, conclusion, puce)                                    → lot agent
 *   F7  cas durs (verrou, tableau, champs courts, cas non reconnu)                       → À LA MAIN
 *
 * Règles de sûreté :
 *  - les remplacements n'utilisent QUE les phrases de `phrases-standard.ts` (phrase FR validée par Williams le 20/11) ;
 *  - une famille non automatisable ne reçoit AUCUNE proposition, jamais une proposition devinée ;
 *  - tout remplacement repasse la « porte des interdits » (`refusReplacement`) avant d'être émis ;
 *  - sortie déterministe : tri stable, aucune date, aucun aléa.
 */
import { PHRASE_EN, PHRASE_FR, QUESTION_EN, QUESTION_FR } from "./phrases-standard";
import { INTERDITS_PUBLICS, empreinte } from "./plan";
import { estVisee, motsNonRetirables } from "./regles";

export type Famille = "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7";

/** Un cas ambigu tel que le rapport l'imprime. */
export interface CasAmbigu {
  /** `<table>:<id>`. */
  cle: string;
  table: string;
  id: string;
  champ: string;
  message: string;
  /** Texte complet du passage, lignes jointes par « \n ». */
  passage: string;
  lignes: string[];
}

export interface CasClasse {
  cas: CasAmbigu;
  famille: Famille;
}

/** Un override PROPOSÉ (un par champ). Jamais écrit en base : c'est un fichier à relire. */
export interface EntreeOverride {
  contenu: string;
  champ: string;
  famille: "F1" | "F4";
  /**
   * `champ-entier` : `origine` est la valeur COMPLÈTE du champ (FAQ fille) ;
   * `element-faqJson` : un élément de `faqJson` (question + réponse), à recomposer dans le tableau ;
   * `zone` : un passage du `body` HTML, à recomposer dans le champ (jamais le champ entier).
   */
  portee: "champ-entier" | "zone" | "element-faqJson";
  /** Passage d'origine (zone : titre puis lignes de la section, séparés par « \n »). */
  origine: string;
  remplacement: string;
  raison: string;
  /** Mots non financiers que le remplacement fait disparaître (porte « mots perdus », A8). */
  pertesAcceptees: string[];
  /** Empreinte de `origine`, seulement quand `origine` est la valeur complète du champ. */
  empreinteOrigine: string | null;
  /** La borne de la zone est estimée (le rapport n'imprime pas les niveaux de titre) : à confirmer sur le HTML. */
  zoneEstimee: boolean;
  reponseOrigine?: string;
  reponseRemplacement?: string;
  consignes: string[];
}

export interface Sortie {
  auto: EntreeOverride[];
  agent: CasClasse[];
  aLaMain: CasClasse[];
}

// ───────────────────────────── lecture du rapport ─────────────────────────────

const ENTETE_CAS = /^- identifiant `([^`]+)` · champ `([^`]+)` : (.*)$/;
const LIGNE_PASSAGE = /^ {4}>(?: ?)(.*)$/;

/** Lit la section « Cas ambigus » d'un rapport de retrait (texte Markdown). */
export function lireRapport(md: string): CasAmbigu[] {
  const lignes = md.split("\n");
  const debut = lignes.findIndex((l) => l.startsWith("## Cas ambigus"));
  if (debut < 0) return [];
  let fin = lignes.findIndex((l, i) => i > debut && l.startsWith("## "));
  if (fin < 0) fin = lignes.length;
  const cas: CasAmbigu[] = [];
  let courant: CasAmbigu | null = null;
  for (const l of lignes.slice(debut + 1, fin)) {
    const e = ENTETE_CAS.exec(l);
    if (e) {
      const cle = e[1]!;
      const i = cle.indexOf(":");
      courant = {
        cle,
        table: i < 0 ? cle : cle.slice(0, i),
        id: i < 0 ? "" : cle.slice(i + 1),
        champ: e[2]!,
        message: e[3]!.trim(),
        passage: "",
        lignes: [],
      };
      cas.push(courant);
      continue;
    }
    const p = LIGNE_PASSAGE.exec(l);
    if (p && courant) courant.lignes.push(p[1]!.trim());
  }
  for (const c of cas) c.passage = c.lignes.join("\n");
  return cas;
}

// ───────────────────────────── outils de texte ─────────────────────────────

/** Dernier « … » du message : la question (FAQ) ou la phrase visée. */
function citation(message: string): string | null {
  // R1 : « forme non prouvée (hors « A, B et X. », … ) : « phrase » » contient déjà des « » dans son
  // préfixe fixe : on le retire avant de chercher la citation, sinon la « phrase » commence trop tôt.
  const m = /« (.*) »\s*$/.exec(message.replace(/^forme non prouvée \([^)]*\) : /, ""));
  return m ? m[1]!.trim() : null;
}

function phrasesDe(texte: string): string[] {
  return texte
    .split(/(?<=[.!?…])\s+/)
    .map((x) => x.trim())
    .filter((x) => x !== "");
}

const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Libellés de bloc d'encadré : courts et sans ponctuation, mais ce ne sont pas des titres. */
const ENCADRES = new Set([
  "attention",
  "à noter",
  "note",
  "important",
  "à retenir",
  "bon à savoir",
  "conseil",
]);
/** Une ligne du rapport ressemble-t-elle à un TITRE ? (le rapport n'imprime pas les niveaux) */
function ressembleAUnTitre(ligne: string): boolean {
  const l = ligne.trim();
  return l.length <= 110 && !/[.;,:…!]$/.test(l) && !ENCADRES.has(l.toLowerCase());
}

/** Section estimée d'un titre dans les lignes d'un passage : indice du titre et lignes de contenu. */
function sectionDe(
  lignes: readonly string[],
  titre: string,
): { debut: number; corps: string[] } | null {
  const t = norm(titre);
  const debut = lignes.findIndex((l) => norm(l) === t);
  if (debut < 0) return null;
  const corps: string[] = [];
  for (const l of lignes.slice(debut + 1)) {
    if (ressembleAUnTitre(l)) break;
    corps.push(l);
  }
  return { debut, corps };
}

/** Titre numéroté (« Étape 4 — … », « 3. … ») : l'article le place dans une liste ordonnée. */
const TITRE_NUMEROTE = /^(?:[ÉE]tape|Step|Phase|Partie|Part)\s*\d|^\d+\s*[.)]/i;

const titreDeSection = (message: string): string | null => {
  const m = /^section « (.*?) » :/.exec(message);
  return m ? m[1]! : null;
};

/** Le texte est-il, sans doute possible, du français ? Sinon on ne propose rien (phrases standard FR). */
function estFrancais(lignes: readonly string[]): boolean {
  const t = ` ${lignes.join(" ").toLowerCase()} `;
  const fr = (t.match(/ (?:les|des|une|est|vous|nous|pour|dans|avec) /g) ?? []).length;
  const en = (t.match(/ (?:the|and|your|you|with|for|is|are) /g) ?? []).length;
  return fr > 0 && fr > en;
}

// ───────────────────────────── classement ─────────────────────────────

const MSG_FAQ_FINANCEMENT = "FAQ à relire (question de financement";
const MSG_FAQ_ETRANGERE = "FAQ à relire (question étrangère";
const CHAMPS_COURTS = new Set(["directAnswer", "keyTakeaway", "expertQuoteText"]);

/** Toutes les phrases de la réponse sont-elles visées ? (réponse vide : non) */
function reponseToutEntiereVisee(reponse: string): boolean {
  const p = phrasesDe(reponse);
  return p.length > 0 && p.every(estVisee);
}

/** Question → réponses des FAQ filles de financement (answerFr) lues dans le rapport. */
function reponsesParQuestion(cas: readonly CasAmbigu[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const c of cas) {
    if (c.table !== "faq" || c.champ !== "answerFr" || !c.message.startsWith(MSG_FAQ_FINANCEMENT))
      continue;
    const q = citation(c.message);
    if (q === null) continue;
    const l = m.get(q) ?? [];
    l.push(c.passage);
    m.set(q, l);
  }
  return m;
}

function familleDe(
  c: CasAmbigu,
  parQuestion: Map<string, string[]>,
  sections: Map<string, string[]>,
  contextes: Map<string, string[]>,
): Famille {
  if (CHAMPS_COURTS.has(c.champ)) return "F7";
  if (c.message.startsWith("verrou") || c.message.startsWith("tableau")) return "F7";
  if (c.message.startsWith(MSG_FAQ_FINANCEMENT)) {
    if (c.table === "faq") return reponseToutEntiereVisee(c.passage) ? "F1" : "F2";
    const q = citation(c.message);
    const reponses = q === null ? [] : (parQuestion.get(q) ?? []);
    // Le rapport n'imprime que la QUESTION de l'élément faqJson : on ne conclut « F1 » que si TOUTES
    // les FAQ filles de même question sont F1. Sans fille connue, on ne devine pas.
    // R3 : le rapport ne relie pas l'élément `faqJson` d'un article à SA FAQ fille (identifiants
    // différents) : si plusieurs réponses DIFFÉRENTES existent pour la même question, on ne choisit pas
    // (le résultat dépendrait de l'ordre du rapport et les pertes seraient celles d'un autre article).
    const distinctes = new Set(reponses.map(norm));
    return distinctes.size === 1 && reponses.every(reponseToutEntiereVisee) ? "F1" : "F2";
  }
  if (c.message.startsWith(MSG_FAQ_ETRANGERE)) return "F3";
  const titreF4 = titreDeSection(c.message);
  // R2 : une section numérotée est au milieu d'une liste ordonnée (« Étape 3 », puis le remplacement,
  // puis « Étape 5 ») : jamais de remplacement automatique, un relecteur renumérote.
  if (titreF4 !== null) return TITRE_NUMEROTE.test(titreF4.trim()) ? "F7" : "F4";
  if (c.message.startsWith("forme non prouvée") || c.message.startsWith("phrase mixte")) {
    if (c.table === "faq" || c.champ === "faqJson") return "F3";
    const phrase = citation(c.message);
    const titres = sections.get(`${c.cle}|${c.champ}`) ?? [];
    // R1 : un cas « phrase » n'imprime parfois que le paragraphe, sans titre. Le contexte est le passage
    // le plus long du même (contenu, champ) : celui d'un cas « section » ou « forme non prouvée ».
    const contexte = contextes.get(`${c.cle}|${c.champ}`) ?? c.lignes;
    if (phrase !== null)
      for (const t of titres) {
        const s = sectionDe(contexte, t);
        if (s && [...s.corps].some((l) => norm(l).includes(norm(phrase).slice(0, 80)))) return "F5";
      }
    return "F6";
  }
  // Message non reconnu : on ne devine pas, un humain tranche.
  return "F7";
}

/** Classe chaque cas ambigu (même ordre que l'entrée). */
export function classerAmbigus(cas: readonly CasAmbigu[]): CasClasse[] {
  const parQuestion = reponsesParQuestion(cas);
  const sections = new Map<string, string[]>();
  const contextes = new Map<string, string[]>();
  for (const c of cas) {
    const kc = `${c.cle}|${c.champ}`;
    if (c.lignes.length > (contextes.get(kc)?.length ?? 0)) contextes.set(kc, c.lignes);
  }
  for (const c of cas) {
    const t = titreDeSection(c.message);
    if (t === null) continue;
    const k = `${c.cle}|${c.champ}`;
    sections.set(k, [...(sections.get(k) ?? []), t]);
  }
  return cas.map((c) => ({ cas: c, famille: familleDe(c, parQuestion, sections, contextes) }));
}

// ───────────────────────────── porte des interdits ─────────────────────────────

/**
 * Interdits supplémentaires d'un REMPLACEMENT (en plus de `INTERDITS_PUBLICS`, la porte de `plan.ts`) :
 * même « prise en charge » nue, noms de ville et formules de la charte des remplacements.
 */
const INTERDITS_REMPLACEMENT = new RegExp(
  [
    "qualiopi",
    "\\bOPCOs?\\b",
    "op[ée]rateurs? de comp[ée]tences",
    "\\bCPF\\b",
    "france travail",
    "financ",
    "pris(?:e|es)? en charge",
    "grenoble",
    "appel de cadrage",
    "aucun gain garanti",
  ].join("|"),
  "i",
);

/** Raison du refus d'un texte de remplacement, ou `null` s'il passe la porte des interdits. */
export function refusReplacement(texte: string): string | null {
  const a = INTERDITS_PUBLICS.exec(texte);
  if (a) return `interdit public « ${a[0]} »`;
  const b = INTERDITS_REMPLACEMENT.exec(texte);
  return b ? `interdit du remplacement « ${b[0]} »` : null;
}

/** Mots non financiers perdus entre `origine` et `remplacement`, triés, sans doublon. */
function pertes(origine: string, remplacement: string): string[] {
  return [...new Set(motsNonRetirables(origine, remplacement))].sort();
}

// ───────────────────────────── génération ─────────────────────────────

function entree(
  e: Omit<EntreeOverride, "pertesAcceptees" | "empreinteOrigine" | "zoneEstimee" | "consignes"> &
    Partial<Pick<EntreeOverride, "zoneEstimee" | "consignes">>,
): EntreeOverride {
  const complet = e.portee === "champ-entier";
  const textes = [e.remplacement, e.reponseRemplacement ?? ""].join(" ");
  const refus = refusReplacement(textes);
  if (refus) throw new Error(`Remplacement refusé par la porte des interdits : ${refus}`);
  return {
    ...e,
    pertesAcceptees: pertes(
      [e.origine, e.reponseOrigine ?? ""].join(" "),
      [e.remplacement, e.reponseRemplacement ?? ""].join(" "),
    ),
    empreinteOrigine: complet ? empreinte(e.origine) : null,
    zoneEstimee: e.zoneEstimee ?? false,
    consignes: e.consignes ?? [],
  };
}

function overridesF1(classes: readonly CasClasse[]): EntreeOverride[] {
  const out: EntreeOverride[] = [];
  // R3 : réponse d'origine d'une question, seulement quand elle est UNIQUE dans tout le rapport.
  const reponses = new Map<string, string>();
  const ambigues = new Set<string>();
  for (const { cas, famille } of classes)
    if (famille === "F1" && cas.table === "faq" && cas.champ === "answerFr") {
      const q = citation(cas.message) ?? "";
      const vue = reponses.get(q);
      if (vue !== undefined && norm(vue) !== norm(cas.passage)) ambigues.add(q);
      else reponses.set(q, cas.passage);
    }

  const questionsFaq = new Set<string>();
  for (const { cas, famille } of classes) {
    if (famille !== "F1") continue;
    const q = citation(cas.message);
    if (q === null) continue;
    if (cas.table === "faq") {
      const en = cas.champ === "answerEn";
      out.push(
        entree({
          contenu: cas.cle,
          champ: cas.champ,
          famille: "F1",
          portee: "champ-entier",
          origine: cas.passage,
          remplacement: en ? PHRASE_EN : PHRASE_FR,
          raison: `FAQ de financement dont toutes les phrases sont visées : réponse remplacée par la phrase standard ${en ? "EN" : "FR"}`,
        }),
      );
      // A7 : la question de financement est surchargée AVEC la réponse (sinon elle resterait publiée).
      // Dans les FAQ filles, `questionEn` contient le texte français (constat du rapport) : l'empreinte
      // de l'original sera refusée par la porte 1 si ce n'est plus le cas.
      for (const [champ, remplacement] of [
        ["questionFr", QUESTION_FR],
        ["questionEn", QUESTION_EN],
      ] as const) {
        const k = `${cas.cle}|${champ}`;
        if (questionsFaq.has(k)) continue;
        questionsFaq.add(k);
        out.push(
          entree({
            contenu: cas.cle,
            champ,
            famille: "F1",
            portee: "champ-entier",
            origine: q,
            remplacement,
            raison:
              "question de financement : remplacée par la question standard, avec la réponse (A7)",
          }),
        );
      }
    } else if (cas.champ === "faqJson") {
      // Garde (la classification l'empêche déjà) : deux réponses différentes → jamais d'automatique.
      if (ambigues.has(q) || !reponses.has(q)) continue;
      out.push(
        entree({
          contenu: cas.cle,
          champ: "faqJson",
          famille: "F1",
          portee: "element-faqJson",
          origine: q,
          remplacement: QUESTION_FR,
          reponseOrigine: reponses.get(q) ?? "",
          reponseRemplacement: PHRASE_FR,
          raison:
            "élément faqJson du parent : même Q/R standard que la FAQ fille (trois stockages cohérents)",
          consignes: [
            "recomposer le tableau faqJson : remplacer l'élément dont la question est `origine`, sans retirer d'élément",
          ],
        }),
      );
    }
  }
  return out;
}

function overridesF4(classes: readonly CasClasse[]): EntreeOverride[] {
  const out: EntreeOverride[] = [];
  for (const { cas, famille } of classes) {
    if (famille !== "F4") continue;
    const z = zoneAuto(cas);
    if (!z) continue;
    out.push(
      entree({
        contenu: cas.cle,
        champ: cas.champ,
        famille: "F4",
        portee: "zone",
        origine: [z.titre, ...z.corps].join("\n"),
        remplacement: PHRASE_FR,
        raison: `section « ${z.titre} » entièrement consacrée au financement (${z.corps.length} bloc(s), toutes les phrases visées) : titre et contenu remplacés par la phrase standard`,
        zoneEstimee: true,
        consignes: [
          "le titre ET les blocs listés dans `origine` deviennent un seul <p> avec la phrase standard",
          "la zone est EXACTEMENT `origine`, reconnue sur le HTML (titre puis blocs, dans l'ordre) : si la section HTML court plus loin que le dernier bloc listé, jusqu'au titre de même niveau (sous-titres, puces, tableaux), REFUSER et envoyer à la main, jamais de remplacement partiel",
          "retirer l'entrée de sommaire ou l'ancre (#…) qui pointait vers ce titre",
          "si l'article a déjà une section « Tarifs », supprimer la zone au lieu de la remplacer (pas de doublon)",
          "bornes estimées depuis le rapport (il n'imprime pas les niveaux de titre) : refus si la zone est introuvable, présente deux fois, ou plus courte que la section HTML (« jusqu'au titre de même niveau »)",
        ],
      }),
    );
  }
  return out;
}

/** Section 100 % financement, en français, de taille raisonnable ? Sinon `null` (lot de l'agent). */
function zoneAuto(cas: CasAmbigu): { titre: string; corps: string[] } | null {
  const titre = titreDeSection(cas.message);
  if (titre === null) return null;
  const s = sectionDe(cas.lignes, titre);
  if (!s || s.corps.length === 0 || s.corps.length > 6) return null;
  if (!estFrancais([titre, ...s.corps])) return null;
  const toutesVisees = s.corps.every((l) => phrasesDe(l).every(estVisee));
  if (!toutesVisees) return null;
  // R2 : une zone qui perd un chiffre ou un nom propre (ville, organisme, personne) ne part pas en
  // automatique : un relecteur ou l'agent décide si cette information doit survivre ailleurs.
  const perdus = pertes([titre, ...s.corps].join("\n"), PHRASE_FR);
  if (perdus.some((m) => /\d/.test(m))) return null;
  if (nomsPropresPerdus(s.corps, new Set(perdus))) return null;
  return { titre, corps: s.corps };
}

const sansAccent = (m: string): string =>
  m
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Mots capitalisés qui font partie du VOCABULAIRE du financement (noms d'organismes, de dispositifs). */
const VOCABULAIRE_FINANCEMENT = new Set(
  [
    "operateurs",
    "competences",
    "france",
    "travail",
    "compte",
    "personnel",
    "formation",
    "individuelle",
    "aide",
    "pole",
    "emploi",
    "qualiopi",
    "regionale",
    "region",
    "etat",
  ].map((m) => m),
);

/** Un mot capitalisé hors début de phrase figure-t-il parmi les mots perdus ? */
function nomsPropresPerdus(lignes: readonly string[], perdus: ReadonlySet<string>): boolean {
  for (const l of lignes) {
    const mots = l.split(/\s+/);
    for (let i = 1; i < mots.length; i++) {
      if (/[.!?:…]$/.test(mots[i - 1]!)) continue;
      const m = mots[i]!.replace(/^[(«"'’]+/, "");
      if (
        /^\p{Lu}[\p{Ll}'’-]+/u.test(m) &&
        perdus.has(sansAccent(m)) &&
        !VOCABULAIRE_FINANCEMENT.has(sansAccent(m))
      )
        return true;
    }
  }
  return false;
}

const comparer = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Répartit les cas ambigus entre overrides automatiques, lot de l'agent et liste « à la main ». */
export function genererOverrides(cas: readonly CasAmbigu[]): Sortie {
  const classes = classerAmbigus(cas);
  const brut = [...overridesF1(classes), ...overridesF4(classes)];
  const vus = new Set<string>();
  const auto = brut
    .filter((e) => {
      const k = `${e.contenu}|${e.champ}|${e.origine}`;
      if (vus.has(k)) return false;
      vus.add(k);
      return true;
    })
    .sort(
      (a, b) =>
        comparer(a.contenu, b.contenu) ||
        comparer(a.champ, b.champ) ||
        comparer(a.origine, b.origine),
    );

  // Un cas F4 pris en charge par un override automatique n'est pas à refaire par l'agent.
  const prisEnCharge = new Set(
    auto
      .filter((e) => e.famille === "F4")
      .map((e) => `${e.contenu}|${e.champ}|${e.origine.split("\n")[0]}`),
  );
  const reste = classes.filter(
    (c) =>
      c.famille !== "F1" &&
      c.famille !== "F5" &&
      !(
        c.famille === "F4" &&
        prisEnCharge.has(`${c.cas.cle}|${c.cas.champ}|${titreDeSection(c.cas.message)}`)
      ),
  );
  const tri = (l: CasClasse[]): CasClasse[] =>
    [...l].sort(
      (a, b) =>
        comparer(a.cas.cle, b.cas.cle) ||
        comparer(a.cas.champ, b.cas.champ) ||
        comparer(a.famille, b.famille) ||
        comparer(a.cas.message, b.cas.message),
    );
  return {
    auto,
    agent: tri(reste.filter((c) => c.famille !== "F7")),
    aLaMain: tri(reste.filter((c) => c.famille === "F7")),
  };
}

// ───────────────────────────── sorties ─────────────────────────────

/** `overrides-auto.json` : un objet par champ à surcharger. Rien n'y est écrit en base. */
export function rendreOverridesAuto(s: Sortie): string {
  return `${JSON.stringify(
    {
      avertissement:
        "Propositions à RELIRE. Les phrases standard sont celles de phrases-standard.ts, validées par Williams (20/11). Aucune écriture en base : ce fichier est lu par le vérificateur d'overrides (quatre portes).",
      familles: ["F1", "F4"],
      total: s.auto.length,
      overrides: s.auto,
    },
    null,
    2,
  )}\n`;
}

/** Passage utile à l'agent : la réponse (FAQ), la section estimée (F4) ou le contexte de la phrase. */
function zoneAgent(c: CasClasse): { passage: string; phrase: string | null } {
  const { cas } = c;
  const phrase = citation(cas.message);
  if (c.famille === "F4") {
    const t = titreDeSection(cas.message);
    const s = t === null ? null : sectionDe(cas.lignes, t);
    if (t !== null && s) return { passage: [t, ...s.corps].join("\n"), phrase };
  }
  if (c.famille === "F6" && phrase !== null) {
    const cle = norm(phrase).slice(0, 80);
    const i = cas.lignes.findIndex((l) => norm(l).includes(cle));
    if (i >= 0) return { passage: cas.lignes.slice(Math.max(0, i - 2), i + 3).join("\n"), phrase };
  }
  return { passage: cas.passage, phrase };
}

/** `lot-agent.jsonl` : une ligne par cas, avec le passage d'origine. AUCUNE proposition de texte. */
export function rendreLotAgent(s: Sortie): string {
  return s.agent
    .map((c) => {
      const z = zoneAgent(c);
      return JSON.stringify({
        cle: c.cas.cle,
        champ: c.cas.champ,
        famille: c.famille,
        message: c.cas.message,
        phrase: z.phrase,
        passage: z.passage,
      });
    })
    .join("\n")
    .concat(s.agent.length > 0 ? "\n" : "");
}

/** `a-la-main.md` : les cas durs (F7), à écrire par un relecteur. Aucune proposition. */
export function rendreALaMain(s: Sortie): string {
  const l: string[] = [
    "# À la main — cas durs du retrait des mentions de financement (F7)",
    "",
    "Aucune proposition n'est faite : chaque cas demande la lecture de la phrase complète (verrou « mots non financiers perdus »), la réécriture d'un champ court repris par les moteurs de réponse (`directAnswer`, `keyTakeaway`), ou le recalage d'un tableau et de ses décomptes (A6).",
    "",
    `${s.aLaMain.length} cas.`,
    "",
  ];
  for (const c of s.aLaMain) {
    l.push(
      `## \`${c.cas.cle}\` · \`${c.cas.champ}\``,
      "",
      `- famille : ${c.famille}`,
      `- motif : ${c.cas.message}`,
    );
    l.push("- passage d'origine :");
    for (const x of c.cas.lignes) l.push(`  > ${x}`);
    l.push("- remplacement : _à écrire par un relecteur_", "");
  }
  return `${l.join("\n")}\n`;
}
