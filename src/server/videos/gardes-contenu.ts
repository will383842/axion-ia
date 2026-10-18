/**
 * GARDES DE CONTENU (plan PLAN-W1-W4 §3.6) — appliquées à tous les textes reçus
 * du studio, ET relues au rendu (une page ne rend jamais « certifié Qualiopi » si
 * le réglage est retombé à `false` entre-temps : leçon P3-01).
 *
 * Pure : les réglages entrent en paramètre. `reglagesRuntime()` les lit dans
 * l'environnement, comme le reste du site.
 *
 * La liste noire de noms de clients n'est JAMAIS écrite dans le dépôt (public) :
 * variable d'environnement runtime `VIDEOS_NOMS_CLIENTS_INTERDITS`, séparée par
 * « ; » (décision D9, valeur par défaut du plan).
 */
import {
  isQualiopiCertificationObtenue,
  isQualiopiPublicDisclosureEnabled,
} from "@/server/qualiopi/config/flag";
import { checkTranslationBannedWords } from "@/lib/knowledge/banned-words";
import type { PublicationVideo } from "./contrat";

export type RegleContenu =
  "grenoble" | "aucun_gain_garanti" | "qualiopi" | "financement" | "nom_de_client" | "mot_banni";

export interface ViolationContenu {
  readonly regle: RegleContenu;
  readonly champ: string;
}

export interface ReglagesContenu {
  readonly qualiopiCertificationObtenue: boolean;
  readonly ofPublicDisclosure: boolean;
  readonly nomsClientsInterdits: ReadonlyArray<string>;
}

const RE_GRENOBLE = /grenoble/i;
const RE_GAIN_GARANTI = /aucun\s+gain\s+garanti/i;
// « certifié(e)(s) … Qualiopi » ou « Qualiopi … certifié(e)(s) », dans une même phrase.
const RE_QUALIOPI_CERTIFIE = /certifi\w*[^.!?\n]{0,80}qualiopi|qualiopi[^.!?\n]{0,80}certifi\w*/i;
// Financements réservés à un organisme dont la divulgation est ouverte.
const RE_FINANCEMENT = /\b(?:CPF|OPCO|EDOF)\b|mon\s+compte\s+formation/i;

export function contientAffirmationQualiopi(texte: string): boolean {
  return RE_QUALIOPI_CERTIFIE.test(texte);
}

export function listeNoireDepuisEnv(brut: string | undefined): string[] {
  return (brut ?? "")
    .split(";")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 3);
}

/** Réglages lus au runtime (jamais figés au build). */
export function reglagesRuntime(): ReglagesContenu {
  return {
    qualiopiCertificationObtenue: isQualiopiCertificationObtenue(),
    ofPublicDisclosure: isQualiopiPublicDisclosureEnabled(),
    nomsClientsInterdits: listeNoireDepuisEnv(process.env.VIDEOS_NOMS_CLIENTS_INTERDITS),
  };
}

/** Tous les textes de la publication, avec le nom de champ à rapporter. */
export function textesDe(p: PublicationVideo): Array<[string, string]> {
  const t: Array<[string, string]> = [
    ["titre", p.titre],
    ["description", p.description],
    ["resume", p.resume],
  ];
  p.aRetenir.forEach((s, i) => t.push([`aRetenir.${i}`, s]));
  p.questions.forEach((q, i) => {
    t.push([`questions.${i}.question`, q.question], [`questions.${i}.reponse`, q.reponse]);
  });
  p.chapitres.forEach((c, i) => t.push([`chapitres.${i}.titre`, c.titre]));
  if (p.serie) t.push(["serie.titre", p.serie.titre]);
  if (p.transcription) t.push(["transcription", p.transcription]);
  return t;
}

export function controlerContenu(p: PublicationVideo, r: ReglagesContenu): ViolationContenu[] {
  const violations: ViolationContenu[] = [];
  for (const [champ, texte] of textesDe(p)) {
    if (RE_GRENOBLE.test(texte)) violations.push({ regle: "grenoble", champ });
    if (RE_GAIN_GARANTI.test(texte)) violations.push({ regle: "aucun_gain_garanti", champ });
    if (!r.qualiopiCertificationObtenue && contientAffirmationQualiopi(texte)) {
      violations.push({ regle: "qualiopi", champ });
    }
    if (!r.ofPublicDisclosure && RE_FINANCEMENT.test(texte)) {
      violations.push({ regle: "financement", champ });
    }
    const minuscule = texte.toLowerCase();
    if (r.nomsClientsInterdits.some((nom) => minuscule.includes(nom))) {
      violations.push({ regle: "nom_de_client", champ });
    }
    // Filet partagé avec la base de connaissance (liste vide aujourd'hui, mais c'est
    // le point d'entrée si un mot devait être proscrit un jour).
    if (!checkTranslationBannedWords({ body: texte }).valid) {
      violations.push({ regle: "mot_banni", champ });
    }
  }
  return violations;
}
