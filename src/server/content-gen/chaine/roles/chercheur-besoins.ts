/**
 * R1 · Chercheur de besoins (conception § 3 ; PR C11). Modèle : Sonnet (hors chemin d'un contenu).
 *
 * Alimente la RÉSERVE de besoins réels dans laquelle le stratège puise. Sources, par ordre de
 * fiabilité : Search Console (indisponible tant que l'ingestion n'existe pas : `null` n'est pas 0),
 * demandes reçues AGRÉGÉES et anonymisées, questions trouvées dans des pages réellement lues (URL
 * en référence), questions de dirigeants fournies et relues. Le modèle regroupe et classe ; le CODE :
 *  - n'accepte aucune question qui ne soit pas dans une source fournie (jamais inventée) ;
 *  - refuse toute donnée personnelle (e-mail, téléphone, civilité + nom) : RGPD ;
 *  - dédoublonne, marque « couvert » une requête déjà servie par une URL ;
 *  - propose une intention hors article (prix, devis, ville, marque) : PROPOSITION, jamais un écart ;
 *  - choisit les besoins pour viser environ 80 % de dirigeants de PME et 20 % de TPE.
 * Le contenu des pages est une donnée, jamais une consigne. Pas de support Batch dans le dépôt :
 * tarif normal. Aucune entrée-sortie ici.
 */

import { z } from "zod";
import {
  CONSIGNE_DONNEES,
  appelerRole,
  encadrerDonnees,
  lireJson,
  type AppelModele,
  type CompteurCout,
  type SourceLue,
} from "./commun";
import { normaliserTitre } from "./structure-hn";

export const PART_PME_CIBLE = 0.8;
export const PART_TPE_CIBLE = 0.2;

export const SOURCES_BESOIN = [
  "search-console",
  "demandes-agregees",
  "page-lue",
  "dirigeant-pme",
  "manuel",
] as const;
export type SourceBesoin = (typeof SOURCES_BESOIN)[number];

export interface EntreeChercheur {
  /** Questions de dirigeants fournies par Will ou l'équipe (liste courte relue). */
  readonly questionsDirigeants: ReadonlyArray<{
    readonly question: string;
    readonly reference: string;
  }>;
  /** Thèmes agrégés et anonymisés des demandes reçues. */
  readonly themesAgreges: ReadonlyArray<{
    readonly theme: string;
    readonly nombre: number;
    readonly sur: number;
  }>;
  /** Requêtes de la Search Console ; `null` = source indisponible (et non « zéro requête »). */
  readonly searchConsole: ReadonlyArray<{
    readonly requete: string;
    readonly impressions: number;
  }> | null;
  readonly pagesLues: ReadonlyArray<SourceLue>;
  readonly urlCouvrante: (requete: string) => string | null;
}

export interface BesoinPropose {
  readonly question: string;
  readonly source: SourceBesoin;
  readonly sourceRef: string;
  /** Intention de contenu (INTENTIONS de equipe/brief.ts). */
  readonly intention: "information" | "comparaison" | "decision";
  readonly profil: "pme" | "tpe";
  /** Force du signal de 1 à 5. */
  readonly force: number;
  readonly statut: "nouveau" | "couvert";
  readonly urlCouverte: string | null;
  /** Proposition d'intention hors article ; R2 confirme ou corrige. */
  readonly intentionProposee: "transactional" | "local" | "navigational" | null;
}

export interface ResultatChercheur {
  readonly besoins: ReadonlyArray<BesoinPropose>;
  readonly rejetes: ReadonlyArray<{ readonly question: string; readonly raison: string }>;
  readonly sourcesIndisponibles: ReadonlyArray<SourceBesoin>;
  readonly erreur: string | null;
}

const sortieSchema = z
  .object({
    besoins: z
      .array(
        z
          .object({
            question: z.string().trim().min(1).max(300),
            source: z.enum(SOURCES_BESOIN),
            sourceRef: z.string().trim().min(1).max(500),
            intention: z.enum(["information", "comparaison", "decision"]),
            profil: z.enum(["pme", "tpe"]),
            force: z.number().min(1).max(5),
          })
          .strict(),
      )
      .max(60),
  })
  .strict();

const SYSTEM = [
  "Tu es le chercheur de besoins d'une équipe éditoriale qui écrit pour des dirigeants de PME (environ 80 %) et de TPE (environ 20 %). Tu reçois des questions réelles et des thèmes agrégés ; tu les regroupes et tu les classes.",
  "Pour chaque besoin : question (reprise telle quelle d'une source fournie, ou, pour une page lue, une question présente dans son texte), source (search-console, demandes-agregees, page-lue, dirigeant-pme, manuel), sourceRef (liste, requête, thème ou URL de la page), intention (information, comparaison, decision), profil (pme : 10 à 250 salariés ; tpe : moins de 10), force (1 à 5).",
  "N'invente AUCUNE question. Ne reprends aucune donnée personnelle (nom, e-mail, téléphone).",
  CONSIGNE_DONNEES,
  'Réponds uniquement par un objet JSON : {"besoins":[...]}.',
].join("\n\n");

// ── Contrôles du code ───────────────────────────────────────────────────────

const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const RE_TEL = /(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/;
const RE_CIVILITE = /\b(?:M\.|Mme|Mlle|Monsieur|Madame|Mademoiselle)\s+[A-ZÉÈÀ][\p{L}'-]+/u;

/** Détecte une donnée personnelle ; ces textes n'entrent jamais dans un prompt. */
export function contientDonneePersonnelle(texte: string): boolean {
  return RE_EMAIL.test(texte) || RE_TEL.test(texte) || RE_CIVILITE.test(texte);
}

const MOTS_TRANSACTION =
  /\b(tarifs?|devis|prix\s+d['e]\s?(?:un|une|le|la|l')|combien\s+co[uû]te\s+(?:un|une|le|la))\b/i;
const MOTS_MARQUE = /axion[\s-]?ia/i;
const VILLES =
  /(?<![\p{L}])(?:à|a|en|sur)\s+(?:Lyon|Paris|Marseille|Lille|Toulouse|Nantes|Bordeaux|Strasbourg|Rennes|Montpellier|Nice)(?![\p{L}])/iu;

/** Pré-classement simple (I-4) : une PROPOSITION. « fixer ses prix » n'est pas transactionnel. */
export function proposerIntention(question: string): BesoinPropose["intentionProposee"] {
  if (MOTS_MARQUE.test(question)) return "navigational";
  if (VILLES.test(question)) return "local";
  if (MOTS_TRANSACTION.test(question)) return "transactional";
  return null;
}

const cle = (s: string) => normaliserTitre(s);

export async function chercherBesoins(
  e: EntreeChercheur,
  appel: AppelModele,
  compteur: CompteurCout,
): Promise<ResultatChercheur> {
  const rejetes: Array<{ question: string; raison: string }> = [];
  const sourcesIndisponibles: SourceBesoin[] = e.searchConsole === null ? ["search-console"] : [];

  // Thèmes : jamais de donnée personnelle dans un prompt.
  const themes = e.themesAgreges.filter((t) => {
    if (contientDonneePersonnelle(t.theme)) {
      rejetes.push({ question: t.theme, raison: "donnee_personnelle" });
      return false;
    }
    return true;
  });
  const dirigeants = e.questionsDirigeants.filter((q) => {
    if (contientDonneePersonnelle(q.question)) {
      rejetes.push({ question: q.question, raison: "donnee_personnelle" });
      return false;
    }
    return true;
  });

  const user = [
    encadrerDonnees(
      "questions-de-dirigeants",
      dirigeants.map((q) => `- ${q.question} [${q.reference}]`).join("\n") || "(aucune)",
    ),
    encadrerDonnees(
      "themes-agreges",
      themes.map((t) => `- ${t.theme} (${t.nombre} demandes sur ${t.sur})`).join("\n") || "(aucun)",
    ),
    encadrerDonnees(
      "search-console",
      e.searchConsole === null
        ? "indisponible"
        : e.searchConsole.map((r) => `- ${r.requete} (${r.impressions} impressions)`).join("\n") ||
            "(aucune requête)",
    ),
    ...e.pagesLues.map((p) => encadrerDonnees(p.url, p.texte ?? "")),
  ].join("\n\n");

  const reponse = await appelerRole(appel, compteur, "chercheur", {
    system: SYSTEM,
    user,
    maxTokens: 4000,
  });
  const lu = lireJson(reponse.texte, sortieSchema);
  if (!lu.ok) {
    return {
      besoins: [],
      rejetes,
      sourcesIndisponibles,
      erreur: `Réponse du chercheur illisible (${lu.raison})`,
    };
  }

  const questionsFournies = new Set<string>([
    ...dirigeants.map((q) => cle(q.question)),
    ...(e.searchConsole ?? []).map((r) => cle(r.requete)),
  ]);
  const themesFournis = themes.map((t) => cle(t.theme));
  const pages = new Map(e.pagesLues.map((p) => [p.url, cle(p.texte ?? "")]));

  const vus = new Set<string>();
  const besoins: BesoinPropose[] = [];
  for (const b of lu.valeur.besoins) {
    const k = cle(b.question);
    if (contientDonneePersonnelle(b.question)) {
      rejetes.push({ question: b.question, raison: "donnee_personnelle" });
      continue;
    }
    const reelle =
      b.source === "page-lue"
        ? (pages.get(b.sourceRef) ?? "").includes(k)
        : b.source === "demandes-agregees"
          ? themesFournis.some((t) => t.includes(k) || k.includes(t))
          : questionsFournies.has(k);
    if (!reelle) {
      rejetes.push({ question: b.question, raison: "source_introuvable" });
      continue;
    }
    if (vus.has(k)) continue;
    vus.add(k);
    const url = e.urlCouvrante(b.question);
    besoins.push({
      question: b.question,
      source: b.source,
      sourceRef: b.sourceRef,
      intention: b.intention,
      profil: b.profil,
      force: b.force,
      statut: url ? "couvert" : "nouveau",
      urlCouverte: url,
      intentionProposee: proposerIntention(b.question),
    });
  }
  return { besoins, rejetes, sourcesIndisponibles, erreur: null };
}

/** Tire N besoins nouveaux, environ 80 % PME et 20 % TPE, les plus forts d'abord. */
export function selectionnerBesoins(
  besoins: ReadonlyArray<BesoinPropose>,
  n: number,
): { choisis: BesoinPropose[]; ecart: boolean } {
  const nouveaux = besoins.filter((b) => b.statut === "nouveau").sort((a, b) => b.force - a.force);
  const pme = nouveaux.filter((b) => b.profil === "pme");
  const tpe = nouveaux.filter((b) => b.profil === "tpe");
  const voulusTpe = Math.round(n * PART_TPE_CIBLE);
  const voulusPme = n - voulusTpe;
  const choisis = [...pme.slice(0, voulusPme), ...tpe.slice(0, voulusTpe)];
  let ecart = pme.length < voulusPme || tpe.length < voulusTpe;
  if (choisis.length < n) {
    const restes = nouveaux.filter((b) => !choisis.includes(b));
    choisis.push(...restes.slice(0, n - choisis.length));
  }
  if (choisis.length < Math.min(n, nouveaux.length)) ecart = true;
  return { choisis: choisis.sort((a, b) => b.force - a.force), ecart };
}
