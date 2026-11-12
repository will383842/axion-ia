/**
 * Bloc de positionnement « déploiement de l'IA en entreprise » (audit blog/RAG 24/10/2026).
 *
 * Ce bloc est commun aux générateurs de blog. Il donne la cible et la démarche
 * d'Axion-IA, et liste le fond interdit. Il n'est PAS dans VOCAB_BASE ni dans
 * BV_MANON_DIRECTE : ces deux textes servent aussi au chatbot.
 *
 * L'« angle d'entrée » varie d'un article à l'autre (graine = identifiant du job)
 * pour éviter que tous les articles commencent de la même façon.
 */

/** Marqueur présent dans le bloc : sert à ne l'ajouter qu'une seule fois. */
export const MARQUEUR_POSITIONNEMENT = "POSITIONNEMENT AXION-IA";

/** Lignes communes : forme interdite et fond interdit (bloqué automatiquement). */
const LIGNES_INTERDITS = `Cible : les PME ; écrire « PME » dans un titre et « TPE et PME » dans le texte (permis). Ne présentez jamais les offres comme destinées aux entreprises de taille intermédiaire ni aux grands groupes.
Forme interdite : l'étiquette abrégée qui colle « TPE » et « PME » par une barre oblique ou un tiret, tout slogan, la phrase « vous entendez parler d'IA partout… nous si » ou sa paraphrase proche, la même accroche que d'autres articles. Suis l'ANGLE D'ENTRÉE donné dans la consigne.
Fond interdit (bloqué automatiquement, l'article part en relecture), y compris dans le titre, la méta, la réponse directe, la FAQ, le point clé et l'avis : Qualiopi ; CPF, Mon Compte Formation, RNCP ; financement « à 100 % », « intégral » ou « gratuit » ; OPCO ou France Travail ; partenariat, label ou client nommé ; cas client, témoignage ou résultat chiffré attribué à Axion-IA ; statistique attribuée à Axion-IA ; « garanti », « sans risque » ; une ville comme base d'Axion-IA (Axion-IA intervient partout en France) ; Grenoble ; réservation ou paiement en ligne ; TVA non facturée.`;

export const BLOC_POSITIONNEMENT = `## ${MARQUEUR_POSITIONNEMENT} — À FAIRE SENTIR, JAMAIS À RÉCITER
Message principal d'Axion-IA, à faire sentir sans le réciter : « Le partenaire IA de bout en bout des PME : on chiffre, on forme, on met en place. »
Lecteur : dirigeant d'une petite ou moyenne entreprise française. Il entend parler d'IA partout et ne sait pas par où commencer. Il cherche du temps gagné, de la marge ou du chiffre d'affaires, pas de la théorie.
Sujet de fond : le DÉPLOIEMENT concret de l'IA dans l'entreprise (quels usages, dans quel ordre, avec quel effort), jamais l'IA en général.
La démarche d'Axion-IA, à faire comprendre par le fond de l'article et non par un encart publicitaire : un Diagnostic IA gratuit de 45 minutes, sans engagement, en visio ou par téléphone ; l'offre phare, « La Journée IA » : un audit de l'entreprise le matin (en général de deux à quatre heures), la formation des équipes l'après-midi, le rapport complet remis à la fin de la journée (jamais de prix en chiffres, ni d'acompte, ni de frais de déplacement) ; seules durées chiffrées autorisées : l'audit et le Diagnostic IA de 45 minutes ; une liste priorisée, d'abord ce qui apporte le plus de valeur pour l'effort et ce qui se met en place le plus vite ; puis un déploiement étendu étape par étape. Axion-IA s'occupe de la mise en place : ne suggère jamais au lecteur de le faire seul.
Montre, n'annonce pas : un métier précis, une tâche réelle, un outil nommé, un ordre de grandeur honnête d'effort, un premier pas possible cette semaine.
${LIGNES_INTERDITS}
Un seul appel à l'action, en fin d'article : proposer le Diagnostic IA gratuit de 45 minutes, sans engagement, avec un conseiller (page contact). Aucun lien de réservation ni de paiement.`;

export const BLOC_POSITIONNEMENT_ACTUALITE = `## ${MARQUEUR_POSITIONNEMENT} — ACTUALITÉ
${LIGNES_INTERDITS}
Termine par un court paragraphe sur ce que l'actualité change concrètement pour une entreprise de quelques dizaines de personnes, et le premier usage raisonnable à envisager, sans promotion.`;

/** Les 8 angles d'entrée possibles pour ouvrir un article. */
export const ANGLES_ENTREE: readonly string[] = [
  "Une scène de travail précise : la tâche répétitive d'un métier et le temps qu'elle prend.",
  "La question qu'un dirigeant se pose vraiment, avec ses mots à lui (jamais la phrase-slogan).",
  "Une erreur fréquente : acheter un outil avant d'avoir choisi l'usage, et ce qu'elle coûte.",
  "Un ordre de priorité : ce qu'on ferait en premier, en deuxième, et ce qu'on laisserait pour plus tard.",
  "Un chiffre public fourni dans les sources, et ce qu'il veut dire pour une petite structure (sans chiffre : prendre l'angle 1).",
  "Un avant/après d'une journée de travail, sans chiffre inventé.",
  "Le coût de ne rien faire (temps, clients, concurrents), sur un ton calme.",
  "Une idée reçue (« l'IA, c'est pour les grands groupes ») corrigée par un exemple.",
];

/** Hachage FNV-1a 32 bits (déterministe, sans dépendance). */
function fnv1a(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Repli des bits hauts sur les bits bas : FNV-1a seul rend les bas bits
  // trop dépendants des derniers caractères (modulo 8 mal réparti).
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return h >>> 0;
}

/** Choisit l'indice (0 à 7) de l'angle d'entrée pour une graine donnée. */
export function choisirAngleEntree(graine: string): number {
  return fnv1a(graine) % ANGLES_ENTREE.length;
}

/** Consigne à ajouter au prompt : l'angle d'entrée choisi pour cet article. */
export function consigneAngle(graine: string): string {
  const i = choisirAngleEntree(graine);
  return `ANGLE D'ENTRÉE POUR CET ARTICLE : ${ANGLES_ENTREE[i]}`;
}

/**
 * Taille d'audience envoyée aux prompts : les offres publiques visent les PME
 * (et les TPE), jamais les ETI ni les grandes entreprises (audit d'harmonie du
 * 08/11/2026). ETI et grande entreprise sont ramenées à « PME ».
 */
export function taillePourPrompt(taille: string | undefined, defaut = "PME"): string {
  if (taille === "ETI" || taille === "GRANDE_ENTREPRISE") return "PME";
  return taille ?? defaut;
}
