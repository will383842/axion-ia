/**
 * Les CONSIGNES des passes P1 à P5 (ADR 0055 ; `compte-rendu-et-extraction.md` §5).
 *
 * Les textes vivent dans `consignes/*.md`, versionnés, relus comme du code.
 * Deux parties y sont GÉNÉRÉES, jamais recopiées :
 *   · la table des types de faits, depuis `TYPES_DE_FAITS` (une ligne par type,
 *     avec sa définition ci-dessous — un type ajouté sans définition ne compile
 *     pas) ;
 *   · le catalogue (sans aucun prix), construit à chaque appel.
 *
 * `instructions` = bloc commun + consigne de la passe : identique d'une passe
 * à l'autre pour un même rendez-vous (cache automatique d'OpenAI). Les
 * données variables vont dans `input`, jamais ici.
 *
 * `empreinteDesConsignes()` = SHA-256 des fichiers de consignes, des
 * définitions et des versions de schémas : écrite dans `CompteRendu.promptHash`,
 * elle dit avec quelles consignes un compte rendu a été produit.
 *
 * Lecture sur disque, à l'exécution, dans le WORKER seulement (les `.md` sont
 * copiés avec `src/` dans son image).
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { FaitType } from "../../../prisma/generated/client";
import { SCHEMAS_VISIO } from "./schemas";
import { rubriqueDuType } from "./schemas/communs";
import { TYPES_DE_FAITS } from "./types-de-faits";

export const FICHIERS_CONSIGNES = {
  commun: "commun.md",
  extraire: "p1-extraction.md",
  rattacher: "p2-rattachement.md",
  consolider: "p3-consolidation.md",
  ebaucher: "p4-ebauche.md",
  rediger: "p5-redaction.md",
} as const;

export type PasseAvecConsigne = Exclude<keyof typeof FICHIERS_CONSIGNES, "commun">;

/** Une définition d'une ligne et un exemple, par type. */
export const DEFINITIONS_TYPES: Readonly<Record<FaitType, string>> = {
  info_societe:
    "Ce que fait l'entreprise, son histoire. Ex. : « on fait de la menuiserie depuis 1998 ».",
  activite: "Le secteur d'activité. Ex. : « on est un cabinet d'expertise comptable ».",
  effectif: "Le nombre de salariés de l'entreprise. Ex. : « on est trente-cinq ».",
  outil_utilise: "Un outil déjà utilisé (clé = l'outil). Ex. : « tout est sur Excel ».",
  niveau_ia: "Le niveau de pratique de l'IA. Ex. : « quelques-uns testent ChatGPT chez eux ».",
  decideur: "Qui décide pour ce projet. Ex. : « c'est mon associé qui signe ».",
  processus_decision:
    "Comment la décision se prend. Ex. : « on valide en comité le mois prochain ».",
  mise_en_relation: "Qui a recommandé Axion-IA. Ex. : « c'est Paul qui m'a parlé de vous ».",
  probleme: "Un problème rencontré, avec ses mots. Ex. : « on perd des heures sur les relances ».",
  besoin:
    "Un besoin exprimé par le client. Ex. : « il faudrait que l'équipe sache rédiger avec l'IA ».",
  objectif: "Un objectif visé. Ex. : « on veut répondre aux devis en une journée ».",
  public_cible: "Les personnes à former (clé = le métier). Ex. : « les commerciaux ».",
  nb_participants: "Le nombre de participants. Ex. : « on serait douze ».",
  modalite_souhaitee: "La modalité souhaitée. Ex. : « plutôt en présentiel chez nous ».",
  lieu_intervention: "Le lieu de l'intervention. Ex. : « dans nos locaux de Lyon ».",
  contrainte: "Une contrainte. Ex. : « pas en décembre, c'est la clôture ».",
  budget:
    "Le montant que le client dit pouvoir consacrer. Ex. : « on avait prévu autour de deux mille euros ». HT/TTC seulement si c'est dit.",
  financement: "Le financement envisagé. Ex. : « on passerait par l'OPCO ».",
  echeance: "Une échéance. Ex. : « il faudrait que ce soit fait avant le 15 décembre ».",
  objection: "Un frein DIT par le client. Ex. : « deux jours, c'est long pour nous ».",
  concurrent: "Un autre prestataire ou outil envisagé. Ex. : « on a aussi vu un autre organisme ».",
  engagement_axion: "Un engagement de Williams. Ex. : « je vous envoie le programme vendredi ».",
  engagement_client: "Un engagement du client. Ex. : « je vous confirme d'ici le 20 ».",
  prix_annonce_axion:
    "Un prix annoncé par Williams. Ex. : « la journée est à mille neuf cents euros ».",
  offre_envisagee:
    "Une offre du catalogue envisagée (clé = la référence). Ex. : « la formation d'une journée ».",
  question_ouverte: "Une question restée sans réponse. Ex. : « je dois voir avec la direction ».",
  question_client_repondue: "Une question du client à laquelle Williams a répondu.",
  prochaine_etape: "La prochaine étape convenue. Ex. : « on se rappelle jeudi ».",
  autre: "Une information utile qui n'entre dans aucun autre type.",
};

function libelleLocuteurs(type: FaitType): string {
  const l = TYPES_DE_FAITS[type].locuteurs;
  if (l.client && l.axion === "oui") return "dit par le client ou par Williams";
  if (l.client && l.axion === "avec_confirmation")
    return "dit par le client, ou par Williams avec confirmation du client";
  if (l.client) return "dit par le client uniquement";
  return "dit par Williams uniquement";
}

/** La table des types, générée depuis `TYPES_DE_FAITS`. */
export function tableDesTypes(): string {
  return (Object.keys(TYPES_DE_FAITS) as FaitType[])
    .map((t) => {
      const m = TYPES_DE_FAITS[t];
      const rubrique = rubriqueDuType(t) ?? "divers";
      const deduction = (m.certitudesAdmises as readonly string[]).includes("deduit")
        ? "déduction permise (marquée « deduit »)"
        : "pas de déduction";
      return [
        t,
        `rubrique ${rubrique}`,
        m.cardinalite === "unique" ? "valeur unique" : "liste",
        `portée : ${m.porteesAdmises.join(" ou ")}`,
        libelleLocuteurs(t),
        deduction,
        DEFINITIONS_TYPES[t],
      ].join(" — ");
    })
    .join("\n");
}

const DOSSIER = (): string => path.resolve(process.cwd(), "src/server/visio/consignes");

const cache = new Map<string, string>();
function lireFichier(nom: string): string {
  const deja = cache.get(nom);
  if (deja !== undefined) return deja;
  const texte = readFileSync(path.join(DOSSIER(), nom), "utf8");
  cache.set(nom, texte);
  return texte;
}

/** Les instructions d'une passe : bloc commun (types + catalogue) puis la consigne. */
export function instructionsDe(passe: PasseAvecConsigne, catalogue: string): string {
  const commun = lireFichier(FICHIERS_CONSIGNES.commun)
    .replace("{{TABLE_DES_TYPES}}", tableDesTypes())
    .replace(
      "{{CATALOGUE}}",
      catalogue.trim() === "" ? "(aucune référence disponible)" : catalogue,
    );
  return `${commun.trim()}\n\n${lireFichier(FICHIERS_CONSIGNES[passe]).trim()}\n`;
}

/** L'empreinte écrite dans `CompteRendu.promptHash`. */
export function empreinteDesConsignes(): string {
  const h = createHash("sha256");
  for (const nom of Object.values(FICHIERS_CONSIGNES)) h.update(lireFichier(nom));
  h.update(tableDesTypes());
  for (const s of Object.values(SCHEMAS_VISIO)) h.update(`${s.nom}:${s.version}`);
  return h.digest("hex");
}
