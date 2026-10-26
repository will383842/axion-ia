/**
 * Suivi des OUVERTURES et de l'AVANCÉE du questionnaire avant audit (2026-10-27) — module PUR.
 *
 * Besoin de Will : voir, pour chaque questionnaire envoyé, quand et combien de fois le lien a été
 * ouvert (même si la personne n'a vu que la page d'accueil), s'il a été commencé (brouillon,
 * nombre de réponses remplies) et, pour lui seul, ce qui a déjà été rempli.
 *
 * Deux interrupteurs lus côté serveur, ABSENT = ÉTEINT (seule la valeur exacte "true" allume) :
 *   · `QUESTIONNAIRE_SUIVI_ENABLED` : la page note ses ouvertures, la console les affiche avec
 *     l'avancée des brouillons, et le super-administrateur peut lire le CONTENU d'un brouillon
 *     (action serveur tracée) ;
 *   · `QUESTIONNAIRE_SUIVI_NOTICE_VISIBLE` : ne commande QUE le texte d'information de la page
 *     (décision de Will : le texte reste éteint pour Oury alors que le suivi est allumé).
 *
 * Une ouverture n'est notée que par la page elle-même, APRÈS son chargement réel (balise
 * `balise-ouverture.ts`) : un scanner de messagerie qui télécharge le lien sans exécuter le
 * JavaScript, un préchargement, un onglet resté caché ne comptent pas. Un navigateur qui se
 * déclare robot est écarté ici. Aucune IP, aucun cookie, aucun navigateur n'est gardé.
 */

import { codeDirigeantPreauditValide } from "@/server/visio/questionnaire-en-ligne/jeton";

import { libelleDe, type Libelles } from "./libelles";

type Env = Readonly<Record<string, string | undefined>>;

export const suiviActif = (env: Env = process.env): boolean =>
  env["QUESTIONNAIRE_SUIVI_ENABLED"] === "true";

export const noticeVisible = (env: Env = process.env): boolean =>
  env["QUESTIONNAIRE_SUIVI_NOTICE_VISIBLE"] === "true";

/** Plusieurs rechargements à moins de 30 minutes d'intervalle = une seule ouverture. */
export const FENETRE_DEDOUBLONNAGE_MS = 30 * 60_000;
/** La page attend 3 s, visible, avant de se signaler (ni préchargement ni aperçu éclair). */
export const DELAI_MIN_MS = 3_000;
/** 1 = page d'accueil vue ; 2 = a commencé à répondre (a touché un champ). */
export const ETAPE_MAX = 2;
export const CORPS_OUVERTURE_MAX_OCTETS = 2_000;

// ── Qui ouvre ───────────────────────────────────────────────────────────────

/**
 * `main` dirigeant (son code vérifié) · `emp` collaborateur · `it` référent informatique ·
 * `perso` lien personnel dont le parcours n'est pas dit · `lien` lien commun, sans code.
 */
export type ModeOuverture = "main" | "emp" | "it" | "perso" | "lien";

export interface PersonneOuverture {
  readonly mode: ModeOuverture;
  /** Code du lien personnel (`m`), comme le brouillon ; vide pour le dirigeant et le lien commun. */
  readonly membre: string;
}

/** Même forme de code que le brouillon (`brouillon.ts`). */
const MEMBRE = /^[A-Za-z0-9_-]{12,60}$/;

/**
 * La personne d'une ouverture, d'après le lien ouvert : `m` (code personnel) et `s` (parcours :
 * `1` collaborateur, `2` référent informatique, ou `emp` / `it`). `null` : code mal formé.
 */
export function personneDeLOuverture(
  questionnaireId: string,
  s: unknown,
  m: unknown,
): PersonneOuverture | null {
  const code = typeof m === "string" ? m.trim() : "";
  if (code === "") return { mode: "lien", membre: "" };
  if (!MEMBRE.test(code)) return null;
  if (codeDirigeantPreauditValide(questionnaireId, code)) return { mode: "main", membre: "" };
  const parcours = typeof s === "string" ? s.trim() : "";
  if (parcours === "1" || parcours === "emp") return { mode: "emp", membre: code };
  if (parcours === "2" || parcours === "it") return { mode: "it", membre: code };
  return { mode: "perso", membre: code };
}

// ── Robots ──────────────────────────────────────────────────────────────────

/**
 * Robots, aperçus de liens et scanners anti-spam connus. Ceux qui n'exécutent pas le JavaScript
 * n'arrivent jamais jusqu'ici ; ceux qui l'exécutent se déclarent souvent : on les écarte.
 */
const ROBOTS = new RegExp(
  [
    // « bot » seul, « …bot/1.0 », « …bot-… », « …bot; » (un téléphone Cubot n'est pas un robot)
    "\\bbot\\b",
    "bot/",
    "bot-",
    "bot;",
    "\\+https?:",
    "crawl",
    "spider",
    "slurp",
    "preview",
    "scanner",
    "headless",
    "phantomjs",
    "puppeteer",
    "playwright",
    "selenium",
    "lighthouse",
    "pagespeed",
    "python",
    "curl/",
    "wget",
    "java/",
    "go-http",
    "okhttp",
    "axios",
    "node-fetch",
    "undici",
    "libwww",
    "httpclient",
    "facebookexternalhit",
    "whatsapp",
    "telegrambot",
    "discord",
    "skypeuripreview",
    "microsoft office",
    "ms-office",
    "mimecast",
    "proofpoint",
    "barracuda",
    "forcepoint",
    "zscaler",
    "symantec",
    "trendmicro",
    "bitdefender",
    "safebrowsing",
    "google-read-aloud",
    "monitor",
    "uptime",
  ].join("|"),
  "i",
);

/** Un navigateur absent, trop court ou qui se déclare robot n'est pas une personne. */
export function estRobot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim();
  if (ua.length < 20) return true;
  return ROBOTS.test(ua);
}

// ── Le signal de la page ────────────────────────────────────────────────────

export interface SignalOuverture {
  readonly personne: PersonneOuverture;
  readonly etape: number;
}

export type ResultatSignal =
  | { readonly ok: true; readonly valeur: SignalOuverture }
  | { readonly ok: false; readonly motif: string };

/** Le corps `{ m, s, etape, t }` envoyé par la balise (`t` : ms depuis le chargement). */
export function validerSignal(texte: string, questionnaireId: string): ResultatSignal {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, motif: "illisible" };
  }
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) {
    return { ok: false, motif: "illisible" };
  }
  const o = brut as Record<string, unknown>;
  const t = o["t"];
  // Une page qui se signale avant 3 s n'a pas été regardée : préchargement ou robot pressé.
  if (typeof t !== "number" || !Number.isFinite(t) || t < DELAI_MIN_MS) {
    return { ok: false, motif: "trop_tot" };
  }
  const etape = o["etape"];
  if (typeof etape !== "number" || !Number.isInteger(etape) || etape < 1 || etape > ETAPE_MAX) {
    return { ok: false, motif: "etape_invalide" };
  }
  const personne = personneDeLOuverture(questionnaireId, o["s"], o["m"]);
  if (personne === null) return { ok: false, motif: "code_personnel_invalide" };
  return { ok: true, valeur: { personne, etape } };
}

// ── Dédoublonnage ───────────────────────────────────────────────────────────

export interface EtatOuverture {
  readonly nombre: number;
  readonly derniereOuverture: Date;
  readonly derniereEtapeAtteinte: number;
}

export interface ProchainEtat extends EtatOuverture {
  /** Vrai si ce signal compte une ouverture de plus (première, ou après 30 min de silence). */
  readonly nouvelle: boolean;
}

/**
 * L'état après un signal. À moins de 30 min du précédent : même ouverture (le nombre ne bouge
 * pas, l'heure avance : une page rechargée toutes les 10 min reste UNE ouverture). L'étape ne
 * redescend jamais.
 */
export function prochaineOuverture(
  existant: EtatOuverture | null,
  etape: number,
  maintenant: Date,
): ProchainEtat {
  if (existant === null) {
    return {
      nombre: 1,
      derniereOuverture: maintenant,
      derniereEtapeAtteinte: etape,
      nouvelle: true,
    };
  }
  const ecart = maintenant.getTime() - existant.derniereOuverture.getTime();
  const nouvelle = ecart >= FENETRE_DEDOUBLONNAGE_MS;
  return {
    nombre: existant.nombre + (nouvelle ? 1 : 0),
    // Une horloge qui recule (deux serveurs) ne ramène jamais la date en arrière.
    derniereOuverture: ecart > 0 ? maintenant : existant.derniereOuverture,
    derniereEtapeAtteinte: Math.max(existant.derniereEtapeAtteinte, etape),
    nouvelle,
  };
}

// ── Avancée et contenu d'un brouillon ───────────────────────────────────────

/** Les réponses d'un brouillon : `data` (forme de la page), `donnees`, sinon l'objet lui-même. */
function reponsesDuBrouillon(texte: string): Record<string, unknown> | null {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return null;
  }
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return null;
  const o = brut as Record<string, unknown>;
  for (const cle of ["data", "donnees", "reponses", "answers"]) {
    const v = o[cle];
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  }
  return o;
}

/** Une valeur remplie : texte non vide, nombre, case cochée, liste ou objet avec du contenu. */
export function estRemplie(v: unknown): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "number") return Number.isFinite(v);
  if (v === true) return true;
  if (Array.isArray(v)) return v.some(estRemplie);
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).some(estRemplie);
  return false;
}

export interface Avancee {
  readonly remplies: number;
  /** Les questions déclarées dans le fichier du questionnaire, tous parcours confondus. */
  readonly total: number | null;
  readonly pourcentage: number | null;
}

/**
 * Combien de réponses le brouillon porte, sur combien de questions. `questions` : les champs
 * déclarés dans le HTML déposé (`libellesDuHtml`), tous parcours confondus. Quand on les connaît,
 * seuls ces champs comptent (une clé technique du brouillon ne gonfle pas le compte). `null` :
 * brouillon illisible.
 */
export function avanceeDuBrouillon(texte: string, questions: ReadonlySet<string>): Avancee | null {
  const r = reponsesDuBrouillon(texte);
  if (r === null) return null;
  const cles = Object.keys(r).filter((k) => estRemplie(r[k]));
  const connues = questions.size > 0 ? cles.filter((k) => questions.has(k)) : cles;
  const remplies = questions.size > 0 && connues.length === 0 ? cles.length : connues.length;
  if (questions.size === 0) return { remplies, total: null, pourcentage: null };
  const total = questions.size;
  return {
    remplies,
    total,
    pourcentage: Math.min(100, Math.round((remplies / total) * 100)),
  };
}

export interface ChampLu {
  readonly cle: string;
  readonly libelle: string;
  readonly valeur: string;
}

function texteDe(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return v ? String(v) : "";
  if (Array.isArray(v)) {
    return v
      .filter(estRemplie)
      .map((x) => (typeof x === "object" && x !== null ? JSON.stringify(x) : texteDe(x)))
      .join(" ; ");
  }
  return JSON.stringify(v);
}

/** Les champs remplis du brouillon, avec la question en français (lecture par Will). PUR. */
export function champsDuBrouillon(
  texte: string,
  libelles: Libelles,
  mode: string,
): ReadonlyArray<ChampLu> | null {
  const r = reponsesDuBrouillon(texte);
  if (r === null) return null;
  return Object.keys(r)
    .filter((k) => estRemplie(r[k]))
    .map((cle) => ({
      cle,
      libelle: libelleDe(cle, libelles, mode === "it" ? "it" : undefined),
      valeur: texteDe(r[cle]),
    }));
}

// ── Ce que la console affiche ───────────────────────────────────────────────

export interface OuverturePersonne {
  readonly mode: string;
  readonly membre: string;
  readonly premiereOuverture: Date;
  readonly derniereOuverture: Date;
  readonly nombre: number;
  readonly derniereEtapeAtteinte: number;
}

export interface BrouillonResume {
  readonly id: string;
  readonly mode: string;
  readonly membre: string;
  readonly majLe: Date;
  /** `null` : brouillon illisible (clé absente) ; rien n'est inventé. */
  readonly avancee: Avancee | null;
}

export interface SuiviOuvertures {
  readonly ouvertures: ReadonlyArray<OuverturePersonne>;
  readonly brouillons: ReadonlyArray<BrouillonResume>;
}

export const TEXTE_SANS_BROUILLON =
  "aucun brouillon enregistré (la personne n'a peut-être rien rempli ou n'a pas accepté " +
  "l'enregistrement)";

export const TEXTE_JAMAIS_OUVERT =
  "Aucune ouverture notée pour l'instant (le suivi ne compte que depuis son activation).";

/** Fin du code personnel, pour distinguer deux collaborateurs sans écrire le code entier. */
const finDuCode = (membre: string): string => (membre.length >= 4 ? ` …${membre.slice(-4)}` : "");

export function personneLisible(mode: string, membre: string): string {
  switch (mode) {
    case "main":
      return "Dirigeant";
    case "emp":
      return `Collaborateur${finDuCode(membre)}`;
    case "it":
      return `Référent informatique${finDuCode(membre)}`;
    case "perso":
      return `Lien personnel${finDuCode(membre)}`;
    default:
      return "Lien commun (sans code personnel)";
  }
}

/** Une ouverture et un brouillon parlent de la même personne : dirigeant, ou même code. */
const clePersonne = (mode: string, membre: string): string =>
  mode === "main" ? "main" : membre === "" ? `lien:${mode}` : `m:${membre}`;

const FORMAT_JOUR_HEURE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** « 26/10 à 09:00 », heure de Paris, quelle que soit la version d'ICU du serveur. */
const jourHeure = (d: Date): string => {
  const p = Object.fromEntries(FORMAT_JOUR_HEURE.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p["day"]}/${p["month"]} à ${p["hour"]}:${p["minute"]}`;
};

const fois = (n: number): string => `${n} fois`;

function texteAvancee(a: Avancee | null): string {
  if (a === null) return "contenu illisible";
  const reponses = `${a.remplies} réponse${a.remplies > 1 ? "s" : ""} remplie${a.remplies > 1 ? "s" : ""}`;
  return a.total === null ? reponses : `${reponses} sur ${a.total} questions (${a.pourcentage} %)`;
}

export interface LigneSuivi {
  readonly cle: string;
  readonly personne: string;
  readonly texte: string;
  /** Le brouillon de cette personne, s'il existe (bouton « Lire le brouillon »). */
  readonly brouillonId: string | null;
}

/**
 * Une ligne par personne, ouvertures et brouillon réunis. Le dirigeant d'abord, puis l'ordre de la
 * dernière activité. Une personne qui a un brouillon sans ouverture notée (ouvert avant
 * l'activation du suivi) n'est jamais dite « jamais ouverte ».
 */
export function lignesSuivi(s: SuiviOuvertures): ReadonlyArray<LigneSuivi> {
  const parPersonne = new Map<
    string,
    { mode: string; membre: string; o?: OuverturePersonne; b?: BrouillonResume }
  >();
  for (const o of s.ouvertures) {
    const k = clePersonne(o.mode, o.membre);
    const p = parPersonne.get(k) ?? { mode: o.mode, membre: o.membre };
    // Un même code ouvert sous deux parcours : la ligne la plus récente l'emporte.
    if (p.o === undefined || o.derniereOuverture > p.o.derniereOuverture) p.o = o;
    if (p.mode === "perso" || p.mode === "lien") p.mode = o.mode;
    parPersonne.set(k, p);
  }
  for (const b of s.brouillons) {
    const k = clePersonne(b.mode, b.membre);
    const p = parPersonne.get(k) ?? { mode: b.mode, membre: b.membre };
    p.b = b;
    // Le brouillon dit le parcours exact quand l'ouverture ne le savait pas.
    if (p.mode === "perso") p.mode = b.mode;
    parPersonne.set(k, p);
  }
  const recent = (p: { o?: OuverturePersonne; b?: BrouillonResume }): number =>
    Math.max(p.o?.derniereOuverture.getTime() ?? 0, p.b?.majLe.getTime() ?? 0);
  return [...parPersonne.entries()]
    .sort(([ka, a], [kb, b]) => (ka === "main" ? -1 : kb === "main" ? 1 : recent(b) - recent(a)))
    .map(([cle, p]) => {
      const morceaux: string[] = [];
      if (p.o !== undefined) {
        morceaux.push(
          p.o.nombre > 1
            ? `ouvert ${fois(p.o.nombre)} (première le ${jourHeure(p.o.premiereOuverture)}, dernière le ${jourHeure(p.o.derniereOuverture)})`
            : `ouvert 1 fois, le ${jourHeure(p.o.premiereOuverture)}`,
        );
        morceaux.push(
          p.o.derniereEtapeAtteinte >= 2 ? "a commencé à répondre" : "n'a vu que la page d'accueil",
        );
      } else {
        morceaux.push("ouverture non notée (avant l'activation du suivi)");
      }
      morceaux.push(
        p.b === undefined
          ? TEXTE_SANS_BROUILLON
          : `brouillon enregistré le ${jourHeure(p.b.majLe)} : ${texteAvancee(p.b.avancee)}`,
      );
      return {
        cle,
        personne: personneLisible(p.mode, p.membre),
        texte: morceaux.join(" · "),
        brouillonId: p.b?.id ?? null,
      };
    });
}

const jourCourt = (d: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
  }).format(d);

/** Le résumé d'une ligne du bandeau « Où en est ce client » : quelques mots. PUR. */
export function resumeBandeau(s: SuiviOuvertures): string {
  const nombre = s.ouvertures.reduce((n, o) => n + o.nombre, 0);
  const derniere = s.ouvertures.reduce<Date | null>(
    (d, o) => (d === null || o.derniereOuverture > d ? o.derniereOuverture : d),
    null,
  );
  const morceaux: string[] = [];
  if (derniere === null) {
    morceaux.push(s.brouillons.length > 0 ? "ouverture non notée" : "jamais ouvert");
  } else {
    morceaux.push(`ouvert ${fois(nombre)}, dernière fois le ${jourCourt(derniere)}`);
  }
  const avancees = s.brouillons
    .map((b) => b.avancee?.pourcentage ?? null)
    .filter((p): p is number => p !== null);
  if (s.brouillons.length > 0) {
    morceaux.push(avancees.length > 0 ? `commencé (${Math.max(...avancees)} %)` : "commencé");
  } else if (s.ouvertures.some((o) => o.derniereEtapeAtteinte >= 2)) {
    morceaux.push("commencé, sans brouillon enregistré");
  }
  return morceaux.join(" · ");
}
