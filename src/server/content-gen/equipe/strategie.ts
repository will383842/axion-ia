/**
 * Rôle « stratège mots-clés » (équipe éditoriale, PR 3), derrière `CONTENT_EQUIPE_EDITORIALE`.
 *
 * Produit la fiche de brief d'un article à partir d'un sujet, via claude-sonnet-5-5 (rôle
 * « court » de la porte `blog-claude`, qui réserve puis solde le coût). AVANT tout appel : si la
 * carte des requêtes dit que le mot-clé appartient déjà à une autre URL, on refuse (ou on
 * propose une « mise-a-jour » de l'URL propriétaire) SANS appeler le modèle.
 * Interrupteur éteint : rien n'est lu, rien n'est appelé.
 */

import { equipeEditorialeActive } from "../fact-check/equipe-editoriale-drapeau";
import { genererTexteBlogClaude } from "../providers/blog-claude";
import type { GenerationRequest, GenerationResponse } from "../providers/IProvider";
import { normaliserUrl, type CarteRequetes } from "../strategie/carte-requetes";
import { briefSchema, type Brief, type Question } from "./brief";

export type ResultatStrategie =
  | { readonly statut: "desactive" }
  | { readonly statut: "refus"; readonly motCle: string; readonly proprietaire: string }
  | { readonly statut: "mise-a-jour"; readonly motCle: string; readonly proprietaire: string }
  | { readonly statut: "brief"; readonly brief: Brief; readonly coutUsd: number };

export type GenererTexte = (req: GenerationRequest, role: "court") => Promise<GenerationResponse>;

export interface ArgsStrategie {
  readonly jobId: string;
  readonly sujet: string;
  /** Mot-clé visé, si déjà choisi (sinon le sujet sert de requête pour la carte). */
  readonly motCleVise?: string;
  /** Questions déjà connues (Search Console, plan) que le brief peut reprendre telles quelles. */
  readonly questionsConnues?: readonly Question[];
  /** Que faire si le mot-clé est déjà possédé : refuser (défaut) ou proposer la mise à jour. */
  readonly siPossede?: "refuser" | "mise-a-jour";
}

export interface DependancesStrategie {
  readonly carte: CarteRequetes;
  readonly generer?: GenererTexte;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export class StrategieError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StrategieError";
  }
}

const SYSTEME = `Tu es le stratège mots-clés d'une équipe éditoriale. À partir d'un sujet, tu produis la fiche de brief SEO d'un article.
Réponds UNIQUEMENT par un objet JSON :
{"motCle": "...", "intention": "information"|"comparaison"|"decision", "requetesSecondaires": [..], "champSemantique": [..], "entites": [..], "questions": [{"question": "...", "origine": "search-console"|"plan-editorial"|"autre-source", "reference": "..."}], "urlCible": "https://...", "cluster": "...", "type": "neuf"}
Règles :
- Chaque question porte une origine ET une référence réelle. Reprends telles quelles les questions connues fournies ; n'invente jamais une origine « search-console » ou « plan-editorial » : une question de ton cru est "autre-source" avec la source en référence.
- Aucun chiffre, aucune donnée de client. Aucune prose hors du JSON.`;

function extraireJson(sortie: string): unknown {
  const debut = sortie.indexOf("{");
  const fin = sortie.lastIndexOf("}");
  if (debut === -1 || fin <= debut) throw new StrategieError("Réponse du modèle sans JSON");
  try {
    return JSON.parse(sortie.slice(debut, fin + 1));
  } catch {
    throw new StrategieError("Réponse du modèle : JSON illisible");
  }
}

export async function produireBrief(
  args: ArgsStrategie,
  deps: DependancesStrategie,
): Promise<ResultatStrategie> {
  if (!equipeEditorialeActive(deps.env ?? process.env)) return { statut: "desactive" };

  const visee = (args.motCleVise ?? args.sujet).trim();
  const possede = deps.carte.proprietaire(visee);
  if (possede !== null) {
    return args.siPossede === "mise-a-jour"
      ? { statut: "mise-a-jour", motCle: visee, proprietaire: possede }
      : { statut: "refus", motCle: visee, proprietaire: possede };
  }

  const generer = deps.generer ?? genererTexteBlogClaude;
  const connues = (args.questionsConnues ?? []).slice(0, 20);
  const reponse = await generer(
    {
      jobId: args.jobId,
      contentType: "equipe_brief",
      role: "text",
      systemPrompt: SYSTEME,
      userPrompt: `Sujet : « ${args.sujet.slice(0, 500)} »\nMot-clé visé : ${
        args.motCleVise ? `« ${args.motCleVise.slice(0, 200)} »` : "à choisir"
      }\nQuestions connues : ${JSON.stringify(connues)}`,
      maxTokens: 2000,
    },
    "court",
  );

  const lu = briefSchema.safeParse(extraireJson(reponse.output));
  if (!lu.success) throw new StrategieError("Brief du modèle invalide (schéma)");
  const brief = lu.data;

  // Le modèle peut avoir choisi un autre mot-clé : même garde, après coup.
  const proprietaire = deps.carte.proprietaire(brief.motCle);
  if (proprietaire !== null && proprietaire !== normaliserUrl(brief.urlCible)) {
    return args.siPossede === "mise-a-jour"
      ? { statut: "mise-a-jour", motCle: brief.motCle, proprietaire }
      : { statut: "refus", motCle: brief.motCle, proprietaire };
  }
  return { statut: "brief", brief, coutUsd: reponse.costUsd };
}
