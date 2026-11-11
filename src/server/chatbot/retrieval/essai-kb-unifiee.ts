// ESSAI À BLANC — base unique du chatbot (chantier V3-3, 2026-11-11).
//
// Compare, sur 30 questions types, ce que le chatbot récupérerait depuis sa copie
// `chat_kb_chunks` (hybridSearch, comportement actuel) et depuis les fiches
// `knowledge_entries` (chercherDansKnowledgeEntry, interrupteur allumé). On compare
// les PASSAGES récupérés (ce qui nourrit la réponse) et la confiance T-11 qui
// décide entre réponse et escalade : aucun appel LLM, aucun cache, aucune écriture.
//
// Le rapport signale tout montant en euros autre que 1 490 (seul prix affiché) ; le
// lecteur écarte déjà ces fiches du prompt. Le flux passe par `hybridSearch`, qui
// embarque la question (appel OpenAI) sauf en mode `--fts-seul` du script.

import { assessConfidence } from "@/server/chatbot/retrieval/confidence";
import {
  reciprocalRankFusion,
  type hybridSearch,
  type RetrievedChunk,
} from "@/server/chatbot/retrieval/hybrid-search";
import {
  montantsHorsJourneeIa,
  type chercherDansKnowledgeEntry,
} from "@/server/chatbot/retrieval/knowledge-entry-search";
import { DEFAULT_TENANT_SETTINGS, RERANK_TOP_N } from "@/server/chatbot/constants";

export { montantsHorsJourneeIa };

/** 30 questions types (Journée IA, prix, RDV 45 min, garantie, AI Act…). */
export const QUESTIONS_ESSAI: ReadonlyArray<string> = [
  "Qu'est-ce que la Journée IA ?",
  "Combien coûte la Journée IA ?",
  "Quel est le prix de la Journée IA ?",
  "Que se passe-t-il pendant la Journée IA dans mon entreprise ?",
  "Qu'est-ce que je reçois à la fin de la Journée IA ?",
  "La Journée IA se déroule-t-elle dans nos locaux ?",
  "Combien de personnes peuvent participer à la Journée IA ?",
  "Comment réserver la Journée IA ?",
  "Proposez-vous un rendez-vous gratuit ?",
  "Combien de temps dure le rendez-vous gratuit ?",
  "Comment prendre rendez-vous pour un échange de 45 minutes ?",
  "Le premier échange est-il payant ?",
  "Quelles garanties offrez-vous ?",
  "Que se passe-t-il si la Journée IA ne me convient pas ?",
  "Avez-vous la certification Qualiopi ?",
  "La formation peut-elle être financée par mon OPCO ?",
  "Qu'est-ce que l'AI Act ?",
  "L'AI Act s'applique-t-il à ma PME ?",
  "Quelles obligations l'AI Act impose-t-il aux entreprises ?",
  "Quand l'AI Act entre-t-il en application ?",
  "Comment former mes salariés à l'IA conformément à l'AI Act ?",
  "Mes données restent-elles confidentielles avec l'IA ?",
  "L'IA est-elle compatible avec le RGPD ?",
  "Quels outils d'IA recommandez-vous pour une PME ?",
  "Comment l'IA peut-elle aider un cabinet comptable ?",
  "Comment l'IA peut-elle aider une entreprise du BTP ?",
  "Intervenez-vous partout en France ?",
  "Faut-il des compétences techniques pour suivre la Journée IA ?",
  "Quelle différence entre un audit IA et la Journée IA ?",
  "Comment mesurer le retour sur investissement de l'IA ?",
];

export interface ResultatSource {
  readonly nb: number;
  readonly confiance: number;
  readonly escalade: boolean;
  readonly refs: ReadonlyArray<string>;
  readonly montantsHorsGrille: ReadonlyArray<string>;
  readonly erreur?: string;
}

export interface ResultatQuestion {
  readonly question: string;
  readonly chunks: ResultatSource;
  readonly fiches: ResultatSource;
  /** Fiches présentes dans les RERANK_TOP_N premiers passages après fusion RRF. */
  readonly fichesRetenues: number;
}

function resumer(chunks: ReadonlyArray<RetrievedChunk>, seuil: number): ResultatSource {
  const conf = assessConfidence(chunks, seuil);
  return {
    nb: chunks.length,
    confiance: Math.round(conf.score * 100) / 100,
    escalade: !conf.confident,
    refs: chunks.map((c) => `${c.sourceType}:${c.sourceRef}`),
    montantsHorsGrille: [...new Set(chunks.flatMap((c) => montantsHorsJourneeIa(c.contenu)))],
  };
}

const enErreur = (err: unknown): ResultatSource => ({
  nb: 0,
  confiance: 0,
  escalade: true,
  refs: [],
  montantsHorsGrille: [],
  erreur: err instanceof Error ? err.message : String(err),
});

export interface EssaiDeps {
  readonly tenantId: string;
  readonly hybrid: typeof hybridSearch;
  readonly knowledgeEntry: typeof chercherDansKnowledgeEntry;
  readonly questions?: ReadonlyArray<string>;
  readonly seuil?: number;
}

/** Exécute l'essai (lecture seule : seules les deux fonctions de recherche sont appelées). */
export async function executerEssaiKbUnifiee(deps: EssaiDeps): Promise<ResultatQuestion[]> {
  const seuil = deps.seuil ?? DEFAULT_TENANT_SETTINGS.confidenceThreshold;
  const out: ResultatQuestion[] = [];
  for (const question of deps.questions ?? QUESTIONS_ESSAI) {
    let brutsChunks: RetrievedChunk[] = [];
    let brutsFiches: RetrievedChunk[] = [];
    const chunks = await deps.hybrid(deps.tenantId, question).then((r) => {
      brutsChunks = r;
      return resumer(r, seuil);
    }, enErreur);
    const fiches = await deps.knowledgeEntry(question).then((r) => {
      brutsFiches = r;
      return resumer(r, seuil);
    }, enErreur);
    const fusion = reciprocalRankFusion<RetrievedChunk>([brutsFiches, brutsChunks], {
      topK: RERANK_TOP_N,
    });
    out.push({
      question,
      chunks,
      fiches,
      fichesRetenues: fusion.filter((f) => f.item.sourceType === "knowledge_entry").length,
    });
  }
  return out;
}

const cellule = (s: ResultatSource): string =>
  s.erreur
    ? `erreur : ${s.erreur.replace(/\|/g, "/").slice(0, 80)}`
    : `${s.nb} · ${s.confiance}${s.escalade ? " · escalade" : ""}`;

/** Rapport Markdown, en français. */
export function rapportMarkdown(resultats: ReadonlyArray<ResultatQuestion>, date: string): string {
  const total = resultats.length;
  const escChunks = resultats.filter((r) => r.chunks.escalade).length;
  const escFiches = resultats.filter((r) => r.fiches.escalade).length;
  const replis = resultats.filter((r) => r.fiches.nb === 0).length;
  const montants = resultats.filter((r) => r.fiches.montantsHorsGrille.length > 0);
  const lignes = [
    `# Essai à blanc — base unique du chatbot (${date})`,
    "",
    "Lecture seule : aucune écriture en base, aucun appel au modèle de langage.",
    "",
    "À lire avant les chiffres :",
    "- Le premier passage d'une seule liste a une confiance normalisée de 0,5 (> 0,35) : « escalade » veut dire « aucun résultat », pas « résultat peu fiable ».",
    "- Sans `--fts-seul`, l'essai fait jusqu'à 30 appels d'embedding OpenAI.",
    "- Le compte « Fiches retenues » est fait sans le filtre des doublons de la PR #1908.",
    "- Le compte « Fiches retenues » vient d'un classement interne (fusion RRF). En production, un service externe de reclassement choisit les 5 passages : le compte réel peut différer.",
    "",
    `Interrupteur \`CHATBOT_KB_UNIFIED\` : non modifié par l'essai.`,
    "",
    `- Questions : ${total}`,
    `- Escalades, source actuelle (chat_kb_chunks) : ${escChunks}`,
    `- Escalades, fiches KnowledgeEntry : ${escFiches}`,
    `- Questions sans fiche (repli automatique sur chat_kb_chunks) : ${replis}`,
    `- Questions dont les fiches citent un montant autre que 1 490 € : ${montants.length}`,
    "",
    `| # | Question | chat_kb_chunks (nb · confiance) | Fiches (nb · confiance) | Fiches retenues (top ${RERANK_TOP_N} fusionné) |`,
    "|---|---|---|---|---|",
    ...resultats.map(
      (r, i) =>
        `| ${i + 1} | ${r.question} | ${cellule(r.chunks)} | ${cellule(r.fiches)} | ${r.fichesRetenues} |`,
    ),
    "",
    "## Sources par question",
    "",
    ...resultats.flatMap((r, i) => [
      `### ${i + 1}. ${r.question}`,
      `- chat_kb_chunks : ${r.chunks.refs.join(", ") || "—"}`,
      `- Fiches : ${r.fiches.refs.join(", ") || "— (repli)"}`,
      ...(r.fiches.montantsHorsGrille.length > 0
        ? [
            `- ⚠️ Montants hors Journée IA dans les fiches : ${r.fiches.montantsHorsGrille.join(", ")}`,
          ]
        : []),
      "",
    ]),
  ];
  return lignes.join("\n");
}
