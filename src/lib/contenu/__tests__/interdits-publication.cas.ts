/**
 * Cas de test des interdits de publication (données seulement, pas de test).
 * Le fichier de test les rejoue dans plusieurs variantes typographiques.
 */
import type { CodeInterdit } from "../interdits-publication";

/** Phrases qui DOIVENT être bloquées, avec le code attendu. */
export const CAS_BLOQUANTS: ReadonlyArray<readonly [CodeInterdit, string]> = [
  ["qualiopi", "Notre organisme est certifié Qualiopi."],
  ["qualiopi", "Le référentiel national qualité impose un audit."],
  ["qualiopi", "Le RNQ s'applique aux organismes de formation."],
  ["cpf", "Cette formation est éligible au CPF."],
  ["cpf", "Réservez via Mon Compte Formation dès aujourd'hui."],
  ["cpf", "Le compte personnel de formation finance votre cursus."],
  ["cpf", "Inscrite au répertoire spécifique de France Compétences."],
  ["cpf", "La certification est enregistrée au RNCP."],
  ["financement-100", "Formation financée à 100 % par votre branche."],
  ["financement-100", "Une prise en charge intégrale est possible."],
  ["financement-100", "Bénéficiez d'un financement automatique."],
  ["financement-100", "Une formation gratuite grâce à votre branche."],
  ["financement-100", "Votre projet est 100% pris en charge."],
  ["financement-100", "Un accompagnement sans reste à charge."],
  ["financement-100", "Le coût est jusqu'à 100 % couvert."],
  ["financement-public", "Une prise en charge par votre OPCO est possible."],
  ["financement-public", "Un financement France Travail est envisageable."],
  ["financement-public", "L'AIF peut compléter le dispositif."],
  ["numero-legal", "Organisme certifié, certificat n° 12345."],
  ["numero-legal", "Numéro de déclaration d'activité : 11 75 12345 75."],
  ["partenariat", "Nous sommes partenaire officiel de plusieurs éditeurs."],
  ["partenariat", "Axion-IA est labellisée par un réseau national."],
  ["partenariat", "Programme développé en partenariat avec la CCI de Lyon."],
  ["partenariat", "Parmi nos clients, des industriels de la région."],
  ["partenariat", "Ils nous font confiance depuis des années."],
  ["partenariat", "Nos partenaires financent l'étude."],
  ["temoignage-axion", "Voici un cas client dans le commerce de proximité."],
  ["temoignage-axion", "Un de nos clients a doublé ses devis."],
  ["temoignage-axion", "Grâce à Axion-IA, une entreprise a gagné 12 heures par semaine."],
  ["temoignage-axion", "Témoignage client : une transformation réussie."],
  ["citation-temoin", "« Cet outil a changé notre quotidien de gestion », confie le directeur d'une PME."],
  ["stat-axion", "Selon les données internes d'Axion-IA, 8 dirigeants sur 10 hésitent."],
  ["stat-axion", "Notre étude interne montre un gain net."],
  ["stat-axion", "Les évaluations 2025 le confirment."],
  ["stat-axion", "Sur un échantillon (n=87 dirigeants), la tendance est nette."],
  ["grenoble", "Nous intervenons à Grenoble et alentours."],
  ["ancrage-local", "Axion-IA, basée à Lyon, accompagne les dirigeants."],
  ["promesse-garantie", "Un résultat garanti dès le premier mois."],
  ["promesse-garantie", "Nous vous garantissons un retour sur investissement."],
  ["promesse-garantie", "Une démarche sans risque pour votre trésorerie."],
  ["promesse-garantie", "Des gains garantis chaque trimestre."],
  ["promesse-garantie", "Satisfait ou remboursé, sans discussion."],
  ["faites-le-vous-meme", "Faites-le vous-même en trois étapes."],
  ["faites-le-vous-meme", "Une approche do it yourself pour tous."],
  ["etiquette-tpe-pme", "Un guide pour les TPE/PME qui débutent."],
  ["etiquette-tpe-pme", "Conçu pour les TPE et PME de tous secteurs."],
  ["slogan-recopie", "Vous entendez parler de l'IA partout."],
  ["slogan-recopie", "Par où commencer ? Nous, si."],
  ["reservation-paiement", "Payez en ligne votre audit en deux minutes."],
  ["reservation-paiement", "Réservez votre créneau sur Calendly."],
  ["tva-non-facturee", "Tarif net de TVA pour tous."],
  ["tva-non-facturee", "TVA non applicable, article 293 B du CGI."],
  ["texte-admin", "Section indisponible pour le moment."],
  ["texte-admin", "Lorem ipsum dolor sit amet."],
];

/** Phrases saines qui doivent passer (liste minimale du plan, section 4.3 et plus). */
export const CAS_SAINS: ReadonlyArray<string> = [
  "garantir la conformité RGPD de vos données",
  "Microsoft Copilot et Google Gemini",
  "OpenAI a annoncé un partenariat avec Microsoft",
  "vos partenaires commerciaux",
  "une PME de 20 salariés",
  "la région Bretagne compte 3,3 millions d'habitants",
  "les données de l'INSEE",
  "le chiffre d'affaires",
  "un audit de deux à quatre heures",
  "l'étude de cas publiée par Bpifrance",
  "l'IA n'apporte aucun gain de temps si les équipes n'adoptent pas l'outil",
  "[SIREN à compléter]",
  "Nous, si vous le souhaitez, pouvons détailler chaque étape.",
  "Un dirigeant qui ne sait pas par où commencer avec l'IA.",
  "Commencez par un cas d'usage simple et mesurable.",
  "Vos données restent hébergées en Europe.",
  "Le règlement européen sur l'IA impose des obligations de transparence.",
  "Un audit de votre activité pour repérer les tâches répétitives.",
  "Rédiger un compte rendu de réunion en quelques minutes.",
  "Le prix dépend du périmètre et de la durée de l'intervention.",
  "Prenez rendez-vous pour un échange de trente minutes.",
  "Axion-IA intervient partout en France.",
  "Un assistant de rédaction pour répondre aux e-mails clients.",
  "La CNIL publie des recommandations sur l'IA.",
  "Les résultats dépendent de la qualité de vos données.",
  "Un risque d'erreur subsiste, il faut relire les réponses.",
  "Sans méthode, un projet d'IA s'enlise vite.",
  "Les évaluations de vos équipes aident à choisir l'outil.",
  "Une facture avec TVA à 20 % est établie pour chaque prestation.",
  "Le budget formation de votre entreprise peut être utilisé.",
  "Gagner du temps sur les devis grâce à un modèle de réponse.",
  "Un client mécontent apprécie une réponse rapide.",
  "Les chiffres de l'Eurostat 2025 montrent une adoption croissante.",
];

/** Retire les accents (comme le ferait un texte saisi sans accents). */
function sansAccents(t: string): string {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Variantes typographiques d'une phrase : le contrôle doit les voir toutes.
 * Accentuée, sans accent, majuscules, espaces insécables (\u00A0, \u202F),
 * apostrophe courbe, trait d'union insécable (\u2011), trait d'union
 * conditionnel (\u00AD) au milieu de chaque mot.
 */
export function variantes(t: string): string[] {
  return [
    t,
    sansAccents(t),
    t.toUpperCase(),
    t.replace(/ /g, "\u00A0"),
    t.replace(/ /g, "\u202F"),
    t.replace(/'/g, "\u2019"),
    t.replace(/-/g, "\u2011"),
    t.replace(/([A-Za-zÀ-ÿ]{3})([A-Za-zÀ-ÿ]{2,})/g, "$1\u00AD$2"),
  ];
}
