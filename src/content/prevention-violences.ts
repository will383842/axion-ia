/**
 * Prévention et traitement des violences, du harcèlement et des
 * discriminations — UN SEUL texte pour toutes les pièces qui en parlent.
 *
 * ## Pourquoi ce module existe (2026-10-02)
 *
 * Le décret n° 2026-728 (en vigueur le 1er novembre 2026) ajoute à
 * l'indicateur 12 du Référentiel national qualité : « Il s'assure de la
 * prévention et du traitement de toute situation de violence, dont les
 * violences sexistes et sexuelles, de harcèlement ou de discrimination dans le
 * cadre de leur formation. » Cet indicateur n'est pas dans la liste « nouvel
 * entrant » : sa MISE EN ŒUVRE est jugée dès l'audit initial.
 *
 * Analyse d'écarts du 02/10 (`_AUDIT/QUALIOPI-AUDIT-INITIAL-2026-10-01/
 * ECARTS-REFERENTIEL-01-11-2026.md`, B1 et C) :
 *  - le même article était numéroté « 3 quater » sur le site et « 3 ter » dans
 *    le PDF remis au stagiaire ;
 *  - il citait « le signalement prévu à l'article 40 du code de procédure
 *    pénale », alinéa qui vise les autorités constituées et les fonctionnaires,
 *    pas une SAS privée ;
 *  - il renvoyait à « l'adresse de contact publiée dans les mentions légales »
 *    sans la donner, ne disait ni le délai de réponse ni les recours
 *    extérieurs (Défenseur des droits) ;
 *  - le livret d'accueil et la convocation n'en disaient rien.
 *
 * ## D'où vient chaque engagement — rien n'est inventé ici
 *
 * Canal, objet « SIGNALEMENT », consignation le jour même par le formateur,
 * accusé de réception sous 48 heures ouvrées, réponse motivée sous 15 jours
 * ouvrés, point d'étape si l'instruction est plus longue, mise en sécurité
 * immédiate, recours extérieurs jamais subordonnés à l'instruction interne :
 * tout est repris du registre confidentiel des signalements
 * (`AXI-QUA-REGISTRE-SIGNALEMENTS` v1.0, approuvé le 18/09/2026, §3, §4, §5,
 * §7). L'adresse `contact@axion-ia.com` est celle que ce registre désigne ;
 * aucune adresse dédiée n'existe, et on n'en crée pas une dans un texte.
 *
 * ⚠️ Aucun numéro de téléphone de l'organisme : ordre permanent du dirigeant
 * (aucun numéro public). Les numéros cités sont ceux des services publics.
 *
 * Module sans dépendance : lu par la page publique (`src/content/legal.ts`) et
 * par les gabarits PDF (règlement intérieur, livret d'accueil, convocation) —
 * l'isolation Qualiopi autorise ce sens-là. Gardé par
 * `src/server/qualiopi/documents/templates/__tests__/prevention-violences-une-seule-regle.spec.tsx`.
 */

/** Numéro de l'article, identique sur la page publique et dans le PDF remis. */
export const ARTICLE_VIOLENCES = "Article 3 quater";

export const TITRE_ARTICLE_VIOLENCES = `${ARTICLE_VIOLENCES} — Prévention des violences, du harcèlement et des discriminations`;

/** À qui, et comment. */
export const VIOLENCES_SIGNALER =
  "Signaler — toute personne qui s'estime victime ou témoin de tels faits peut les signaler, pendant ou après la formation, au représentant légal de l'organisme, Williams Jullin, Président : par écrit à contact@axion-ia.com, en indiquant « SIGNALEMENT » en objet, ou de vive voix au formateur pendant la session, qui le consigne le jour même. Aucun formalisme n'est exigé : le récit des faits suffit.";

/** Ce que fait l'organisme : confidentialité, délais, protection. */
export const VIOLENCES_TRAITEMENT =
  "Ce que fait l'organisme — le signalement est reçu hors du circuit ordinaire des réclamations, inscrit le jour même au registre confidentiel des signalements et traité de manière confidentielle : son contenu n'est communiqué qu'aux personnes dont l'intervention est nécessaire. Toute situation en cours est interrompue sans délai. L'organisme accuse réception par écrit sous 48 heures ouvrées, prend les mesures conservatoires utiles — dont la suspension de la participation de la personne mise en cause aux séquences concernées —, puis recueille la version de chacun. Il adresse à l'auteur du signalement une réponse écrite et motivée sous 15 jours ouvrés, qui indique les mesures prises et la suite donnée ; si l'instruction demande plus de temps, un point d'étape écrit lui est adressé dans ce même délai. Aucune mesure défavorable ne peut être prise contre l'auteur d'un signalement ou un témoin de bonne foi.";

/**
 * Suites. ⚠️ « Article 40 du code de procédure pénale » retiré : son alinéa 2
 * oblige les autorités constituées et les fonctionnaires, pas un organisme
 * privé. Toute personne peut en revanche porter des faits à la connaissance du
 * procureur de la République.
 */
export const VIOLENCES_SUITES =
  "Suites — si les faits sont établis, ils constituent un agissement fautif et appellent une sanction choisie dans l'échelle de l'article 3 bis, prononcée selon la procédure de l'article 3 ter (art. R6352-3 et R6352-4 du code du travail). Lorsque les faits sont susceptibles de recevoir une qualification pénale, l'organisme informe la victime de son droit de porter plainte et, le cas échéant, porte les faits à la connaissance du procureur de la République. Le signalement, les mesures prises et la suite donnée sont consignés au registre.";

/**
 * Recours extérieurs. Le 119 (enfance en danger) n'est pas cité : les
 * formations de l'organisme s'adressent à des salariés, majeurs.
 */
export const VIOLENCES_RECOURS =
  "Recours extérieurs — passer par l'organisme n'est jamais un préalable. Chacun peut à tout moment s'adresser directement aux services de police ou de gendarmerie et y porter plainte (17 ou 112 en cas d'urgence), saisir le Défenseur des droits pour toute discrimination (09 69 39 00 00, defenseurdesdroits.fr) ou appeler le 3919, Violences Femmes Info, numéro d'écoute gratuit et anonyme. Un signalement qui viserait le représentant légal lui-même peut être adressé directement à ces interlocuteurs.";

/** Les quatre paragraphes de procédure, dans l'ordre où le règlement les imprime. */
export const VIOLENCES_PROCEDURE: readonly string[] = [
  VIOLENCES_SIGNALER,
  VIOLENCES_TRAITEMENT,
  VIOLENCES_SUITES,
  VIOLENCES_RECOURS,
];

/** Titre de l'encart des pièces remises (livret d'accueil, convocation). */
export const TITRE_ENCART_VIOLENCES =
  "Prévention des violences, du harcèlement et des discriminations";

/**
 * Encart court des pièces remises au stagiaire avant et à l'entrée en
 * formation (livret d'accueil, convocation) : il renvoie au règlement
 * intérieur et donne le contact de signalement. Information DIRECTE du
 * stagiaire, et non plus seulement par renvoi au règlement.
 */
export const ENCART_VIOLENCES: readonly string[] = [
  `Aucune violence, dont les violences sexistes et sexuelles, aucun harcèlement et aucune discrimination ne sont tolérés, en présentiel comme à distance. Les règles et la procédure figurent à l'${ARTICLE_VIOLENCES.toLowerCase()} du règlement intérieur des stagiaires.`,
  "Victime ou témoin, vous pouvez le signaler à tout moment, pendant ou après la formation, à Williams Jullin, Président : par écrit à contact@axion-ia.com, avec « SIGNALEMENT » en objet, ou de vive voix au formateur. Votre signalement est traité de manière confidentielle ; vous recevez un accusé de réception sous 48 heures ouvrées et une réponse motivée sous 15 jours ouvrés. Aucune mesure défavorable ne peut être prise contre vous pour un signalement de bonne foi.",
  "Vous pouvez aussi vous adresser directement à la police ou à la gendarmerie (17 ou 112 en cas d'urgence), au Défenseur des droits (09 69 39 00 00, defenseurdesdroits.fr) ou au 3919, Violences Femmes Info.",
];
