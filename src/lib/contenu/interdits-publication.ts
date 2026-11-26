/**
 * Contenu — interdits de publication (doctrine Axion-IA), module PUR.
 *
 * Audit blog/RAG du 24/10/2026 : seule la faute « SIREN » bloquait vraiment la
 * publication ; Qualiopi, CPF, « 100 % financé », faux partenariats, Grenoble,
 * « garanti »… ne faisaient que baisser la note, et le titre, la méta, la FAQ,
 * le point clé et l'avis d'expert n'étaient jamais contrôlés.
 *
 * Ce module est la source unique des motifs interdits. Il n'importe ni Prisma
 * ni Next : il tourne dans le conteneur worker comme dans le site, et se teste
 * sans base.
 *
 * Principe : on normalise d'abord le texte (minuscules, accents retirés,
 * espaces insécables, apostrophes et tirets typographiques, balises HTML), puis
 * on applique des motifs écrits en ASCII avec des bornes de mot EXPLICITES.
 * Piège évité : sans le drapeau `u`, `\b` ne voit pas « é » comme une lettre de
 * mot, donc `/\bétude/` ne trouve jamais le mot après une espace.
 */

/** Début de mot : pas de lettre ni de chiffre juste avant (texte normalisé). */
const B = "(?<![a-z0-9])";
/** Fin de mot : pas de lettre ni de chiffre juste après (texte normalisé). */
const E = "(?![a-z0-9])";

export type CodeInterdit =
  | "qualiopi"
  | "cpf"
  | "financement-100"
  | "financement-public"
  | "numero-legal"
  | "partenariat"
  | "temoignage-axion"
  | "citation-temoin"
  | "stat-axion"
  | "grenoble"
  | "ancrage-local"
  | "promesse-garantie"
  | "faites-le-vous-meme"
  | "etiquette-tpe-pme"
  | "slogan-recopie"
  | "reservation-paiement"
  | "tva-non-facturee"
  | "texte-admin"
  | "frais-deplacement"
  | "prix-barre"
  | "frais-venue"
  | "multiple-garantie"
  | "seuil-garantie-euros"
  | "preuve-sociale-vague";

export interface OptionsInterdits {
  /** Contenu d'actualité (RSS) : une citation d'un tiers est permise. */
  readonly actualite: boolean;
  /**
   * `true` seulement quand `OF_PUBLIC_DISCLOSURE_ENABLED === "true"` : OPCO et
   * France Travail peuvent alors être cités. Sinon le contrat légal de
   * `server/qualiopi/config/financing.ts` (points 1 et 2) l'interdit.
   */
  readonly financementPublicAutorise: boolean;
}

export interface InterditDetecte {
  readonly code: CodeInterdit;
  /** Court extrait du texte normalisé autour de la première occurrence. */
  readonly extrait: string;
  readonly occurrences: number;
}

export interface InterditSurface {
  readonly code: CodeInterdit;
  /** Nom du champ de la sortie (titre, metaTitre, faq[3].reponse, corps…). */
  readonly champ: string;
  readonly extrait: string;
}

export interface MotifInterdit {
  readonly code: CodeInterdit;
  readonly re: RegExp;
  /** Condition qui désactive le motif. */
  readonly sauf?: "actualite" | "financement-public-autorise";
  readonly raison: string;
}

/**
 * Normalise un texte avant contrôle. L'ordre des étapes compte.
 *  1. retire les balises HTML ; 2. décode quelques entités ; 3. minuscules ;
 *  4. œ/æ/％ ; 5. retire les accents ; 6. retire les caractères invisibles ;
 *  7. apostrophes typographiques → ' ; 8. tirets typographiques → - ;
 *  9. toutes les espaces (insécables comprises) → une espace.
 */
export function normaliserPourControle(t: string): string {
  // Les balises de texte barré deviennent « ~~ » AVANT le retrait du HTML : sinon
  // « <del>1 990 €</del> » se réduit à « 1 990 € » et le prix barré passe inaperçu.
  let s = (t ?? "").replace(
    /<(del|s|strike)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/gi,
    (_m, _tag: string, dedans: string) => ` ~~${dedans}~~ `,
  );
  s = s.replace(/<[^>]*>/g, " ");
  s = s
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&rsquo;|&#8217;|&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/&agrave;/gi, "à")
    .replace(/&ccedil;/gi, "ç");
  s = s.toLowerCase();
  s = s.replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/％/g, "%");
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.replace(/[­​-‍⁠﻿]/g, "");
  s = s.replace(/[‘’‚‛′´`ʼ＇]/g, "'");
  s = s.replace(/[‐-―−﹘﹣－]/g, "-");
  s = s.replace(/[  -   　\s]+/g, " ");
  return s;
}

/** Montant en euros (texte normalisé) : « 4 470 € », « 4470 euros », « 4.470 eur ». */
const MONTANT_EUROS = String.raw`${B}[0-9][0-9 .,]{0,12}(?:€|euros?|eur${E})`;

/**
 * Multiple AUTRE que 3 (texte normalisé) : « 2 fois le prix », « cinq fois le tarif », « x10 », « 10x ».
 * « 3 fois », « trois fois », « x3 », « 3x » sont écartés par la tête négative. Le « N fois » exige
 * un complément de prix pour ne pas prendre « payable en 2 fois » ni « 2 fois par an ».
 */
const MULTIPLE_AUTRE = String.raw`(?!(?:3|trois)(?![0-9.,]*[0-9]) ?(?:fois|x|×)|[x×]3(?![.,]?[0-9]))(?:(?:[0-9]+(?:[.,][0-9]+)?|un|deux|quatre|cinq|six|sept|huit|neuf|dix|douze|quinze|vingt|cent) fois (?:le |la |l'|son |sa |votre |vos |notre |leur |du |ce |cet |cette )?(?:prix|tarif|montant|investissement|mise|somme investie|somme|cout|budget)|(?:double|quadruple|quintuple|decuple) (?:du |de |des |de l')?(?:prix|tarif|montant|investissement|mise|somme investie|somme|cout|budget)|(?!300 ?%)[0-9]{3,4} ?% (?:du |de |des |de l')?(?:prix|tarif|montant|investissement|mise|somme investie|somme|cout|budget)|[x×][0-9]+(?:[.,][0-9]+)?(?![0-9x×])|[0-9]+ ?[x×] (?:le |la |l'|son |sa |votre |vos |notre |leur |du |ce |cet |cette )?(?:prix|tarif|montant|investissement|mise|somme investie|somme|cout|budget))`;

// Motif NDA / certificat suivi d'un numéro (repris de doctrine-check.ts, porté
// sur le texte normalisé).
const NUMERO_LEGAL = String.raw`(?:declaration d['e]? ?activite|certificat|certification qualiopi|qualiopi|${B}nda${E}) ?(?:qualiopi ?)?(?:n[°ºo]|numero|:) ?\d|${B}nda${E} ?\d{3}`;

/**
 * Motifs interdits, appliqués au texte passé par `normaliserPourControle`.
 * Toutes les regex ont le drapeau `g` et n'ont pas `u`.
 */
export const MOTIFS_INTERDITS: ReadonlyArray<MotifInterdit> = [
  {
    code: "qualiopi",
    re: new RegExp(String.raw`qualiopi|referentiel national (?:de la )?qualite|${B}rnq${E}`, "g"),
    raison:
      "« Qualiopi » cité dans un contenu généré. Axion-IA n'est pas certifiée : aucune mention publique. Retirer le mot.",
  },
  {
    code: "cpf",
    re: new RegExp(
      String.raw`${B}(?:cpf|edof|rncp)${E}|compte personnel (?:de )?formation|mon ?compte ?formation|moncompteformation|repertoire specifique`,
      "g",
    ),
    raison:
      "CPF / Mon Compte Formation / RNCP cité : Axion-IA n'a pas cette habilitation. Retirer toute référence.",
  },
  {
    code: "financement-100",
    re: new RegExp(
      String.raw`100 ?% ?(?:finance|pris|prise|rembourse|gratuit)|(?:finance|pris en charge|prise en charge|rembourse)e?s? (?:a |jusqu'a )?100 ?%|jusqu'a 100 ?%|prise?s? en charge (?:integrale|totale|complete|integralement|entierement|totalement)|(?:integralement|entierement|totalement) (?:finance|pris en charge|rembourse|gratuit)|financement (?:automatique|integral|total|garanti)|automatiquement financ|sans (?:avance de frais|reste a charge|rien debourser)|zero reste a charge|reste a charge (?:nul|zero|de 0)|formations? gratuites?|gratuite?s? grace a|ne vous coute(?:ra)? rien`,
      "g",
    ),
    raison:
      "Sur-promesse de financement (100 %, intégral, automatique, gratuit). Formuler « prise en charge possible, selon votre situation » ou ne rien promettre.",
  },
  {
    code: "financement-public",
    re: new RegExp(String.raw`${B}(?:opco|aif|fne)${E}|france travail|pole emploi`, "g"),
    sauf: "financement-public-autorise",
    raison:
      "OPCO / France Travail cités alors que la divulgation publique du financement n'est pas autorisée (OF_PUBLIC_DISCLOSURE_ENABLED).",
  },
  {
    code: "numero-legal",
    re: new RegExp(NUMERO_LEGAL, "g"),
    raison:
      "Numéro légal (NDA / certificat Qualiopi) dans un contenu généré. Ces numéros ne figurent jamais dans le public.",
  },
  {
    code: "partenariat",
    re: new RegExp(
      String.raw`${B}(?:axion-?ia|nous|notre cabinet|notre equipe) (?:sommes|est|avons ete|a ete|etes)(?: [a-z']+){0,3} (?:partenaire|labellise|certifie|agree|accredite|homologue|reference par)|${B}(?:axion-?ia|nous) (?:travaillons|collaborons) en partenariat|${B}(?:nos|notre) (?:partenaires?|partenariats?|labels?|accreditations?)${E}|(?:partenaire|revendeur|integrateur) (?:officiel|certifie|agree|gold|premier|strategique)|en (?:partenariat|collaboration) avec (?:la |le |l'|les )?(?:cci|chambre|pole|universite|metropole|agglomeration|region|prefecture|mairie|ville de|bpifrance|france num)|parmi nos clients|nos clients (?:tels? que|comme|incluent)|ils nous font confiance|activateur france num`,
      "g",
    ),
    raison:
      "Partenariat, label ou client fabriqué. Axion-IA n'a aucun partenariat institutionnel ni client nommé public. Retirer la mention.",
  },
  {
    code: "temoignage-axion",
    re: new RegExp(
      String.raw`${B}cas clients?${E}|${B}retours? (?:de nos|d'un de nos) clients|${B}temoignages? (?:client|de nos clients|d'un client)|${B}etude de cas[^.!?]{0,40}${B}(?:axion|notre|nous)|${B}notre cliente?${E}|${B}un de nos clients|${B}une de nos clientes|${B}nos clients ont|${B}accompagnee?s? par (?:axion|nos soins|notre equipe)|${B}(?:grace a|avec) (?:axion-?ia|notre accompagnement|notre audit|notre intervention)[^.!?]{0,80}[0-9]+ ?(?:%|heures?|jours?|euros?|€)`,
      "g",
    ),
    raison:
      "Cas client, témoignage ou résultat chiffré attribué à Axion-IA : fausse preuve sociale. Retirer ou passer à un exemple clairement hypothétique.",
  },
  {
    code: "citation-temoin",
    re: new RegExp(
      String.raw`« ?[^»\s]+(?: [^»\s]+){2,}[^»]{0,300}» ?[,-]? ?(?:a |ont )?(?:confie|explique|temoigne|raconte|souligne|precise|indique|declare|ajoute|reconnait|affirme|assure|estime|note|observe)[^.]{0,30}${B}(?:directeur|directrice|dirigeante?|gerante?|responsable|fondat(?:eur|rice)|presidente?|(?:ceo|daf|drh)${E})`,
      "g",
    ),
    sauf: "actualite",
    raison:
      "Citation entre guillemets attribuée à une fonction : risque de faux témoignage. Autorisée seulement dans une actualité sourcée.",
  },
  {
    code: "stat-axion",
    re: new RegExp(
      String.raw`${B}(?:donnees|mesures|chiffres|statistiques?|etude|enquete|barometre|observatoire|analyse)s? (?:internes? )?(?:d'|de |du )?axion-?ia|${B}axion-?ia,? \(?20[0-9]{2}|source ?: ?axion|${B}etude interne|${B}evaluations? 20[0-9]{2}|${B}n ?= ?[0-9]`,
      "g",
    ),
    raison:
      "Statistique attribuée à Axion-IA (données internes, étude, évaluations, taille d'échantillon) : invérifiable. Citer une source publique ou formuler sans chiffre.",
  },
  {
    code: "grenoble",
    re: new RegExp(String.raw`${B}grenobl`, "g"),
    raison: "« Grenoble » est interdit en communication : écrire « partout en France ».",
  },
  {
    code: "ancrage-local",
    re: new RegExp(
      String.raw`${B}axion-?ia[^.!?]{0,40}(?:base|situe|implante|installe)e?s? (?:a|en|au|dans)(?![a-z])`,
      "g",
    ),
    raison:
      "Ancrage local d'Axion-IA (« basée à… ») interdit : Axion-IA intervient partout en France.",
  },
  {
    code: "promesse-garantie",
    re: new RegExp(
      String.raw`${B}gains? garanti(?:e|s|es)?${E}|aucun gain (?:n'est )?garanti|aucun (?:resultat|gain|succes) (?:n'est )?garanti|${B}(?:resultats?|roi|retour sur investissement|economies?|rentabilite|succes|reussite|chiffre d'affaires|satisfaction) (?:est |sont |reste )?garanti(?:e|s|es)?${E}|${B}garantie?s? (?:de |des |du )?(?:gain|resultat|roi|economie|succes|reussite)|${B}nous (?:vous )?garantissons|${B}axion-?ia (?:vous )?garantit|garantie de (?:resultat|reussite|satisfaction)|${B}sans (?:aucun )?risque|zero risque|satisfait ou rembourse`,
      "g",
    ),
    raison:
      "Promesse de résultat (« garanti », « sans risque »). Aucune promesse de gain ou de résultat. « Garantir la conformité » reste permis.",
  },
  {
    code: "faites-le-vous-meme",
    re: new RegExp(
      String.raw`${B}faites-? ?le-? ?(?:vous-? ?meme|seule?s?)|${B}faire (?:vous|soi)-? ?meme|do it yourself|${B}diy${E}`,
      "g",
    ),
    raison: "« Faites-le vous-même » est interdit : Axion-IA s'occupe de tout.",
  },
  {
    code: "etiquette-tpe-pme",
    // Décision du 08/11/2026 : « TPE et PME » est AUTORISÉ dans le texte ; seule l'étiquette
    // collée « TPE/PME » (barre oblique ou tiret, espaces compris) est interdite.
    re: new RegExp(String.raw`${B}tpe ?[/-] ?pme${E}`, "g"),
    raison:
      "L'étiquette « TPE/PME » est interdite : écrire « PME » dans un titre, « TPE et PME » dans le texte.",
  },
  {
    code: "slogan-recopie",
    re: new RegExp(
      String.raw`entendez parler (?:de l'ia|d'ia|d'intelligence artificielle) (?:de )?partout|par ou commencer[^.!?]{0,30}nous,? si(?![a-z])|(?<![a-z])nous,? si ?[.!]`,
      "g",
    ),
    raison: "Slogan de positionnement recopié tel quel : le faire sentir sans le réciter.",
  },
  {
    code: "reservation-paiement",
    re: new RegExp(
      String.raw`paiement en ligne|payez en ligne|ajoutez au panier|commandez en ligne|reservez (?:directement )?(?:en ligne|votre creneau)|calendly`,
      "g",
    ),
    raison: "Réservation ou paiement en ligne : fonction qui n'existe pas sur le site.",
  },
  {
    code: "tva-non-facturee",
    re: new RegExp(
      String.raw`sans tva|tva non applicable|exoneree?s? de (?:la )?tva|franchise en base|293 ?b(?![a-z])|net de tva`,
      "g",
    ),
    raison: "Axion-IA facture la TVA : aucune mention de franchise ou d'exonération.",
  },
  {
    code: "texte-admin",
    re: new RegExp(String.raw`section indisponible|re-?generation recommandee|lorem ipsum`, "g"),
    raison: "Texte d'administration ou de remplissage resté dans le contenu.",
  },
  {
    code: "frais-deplacement",
    // Règle du dirigeant : jamais de frais de déplacement, d'hébergement ni de repas dans un
    // contenu (ni inclus, ni offerts, ni sur devis). Seule formule permise : « dans vos locaux,
    // partout en France ». « hébergement » seul n'est PAS interdit (hébergement des données,
    // d'un site) : on vise un frais, un statut (inclus, offert, gratuit, pris en charge…) ou
    // l'association à un repas / déplacement. Faux positif assumé : « l'hébergement est inclus
    // dans l'abonnement » et les contenus hôtellerie-restauration (« repas offerts aux clients »)
    // : règle absolue du dirigeant, envoi en relecture. Bornes de mot : « déplacer », « repasser »,
    // « repartir » ne déclenchent rien.
    re: new RegExp(
      String.raw`${B}frais (?:de |d'|des |pour (?:le |les )?)?(?:deplacements?|hebergements?|repas|restauration|transports?|voyages?|bouche|sejours?)${E}|${B}frais kilometriques (?:sont |est )?(?:inclus|offerts?|compris|gratuits?|pris en charge|factures?)${E}|${B}(?:deplacements?|hebergements?|repas(?: du midi| du soir)?|dejeuners?|diners?|nuitees?)(?: du formateur| de notre formateur| des formateurs?| de l'intervenant)?(?: et| ou|,)? (?:les |le |l')?(?:(?:deplacements?|hebergements?|repas|dejeuners?|diners?|nuitees?)${E}|(?:sont |est )?(?:inclus|incluse|incluses|offert|offerte|offertes|offerts|gratuits?|gratuite?s?|compris|comprise|comprises|pris en charge|prises? en charge|factures?|facturee?s?|a (?:votre|notre) charge|sur devis|en sus|en supplement)${E})|${B}(?:deplacements?|hebergements?|repas) (?:du|des|de notre|de l') ?(?:formateurs?|intervenants?|consultants?)${E}|${B}(?:prenons|prend|prenez|assumons|offrons|incluons) (?:en charge )?(?:le |les |l')?(?:deplacements?|hebergements?|repas)${E}|${B}(?:nous )?nous deplacons? (?:gratuitement|sans frais|sans supplement)|${B}(?:nous |axion-?ia )?(?:nous )?deplacons?(?: et|,) ?[^.!?]{0,40}(?:frais|supplement)`,
      "g",
    ),
    raison:
      "Frais de déplacement, d'hébergement ou de repas évoqués (inclus, offerts, sur devis…) : interdit. Seule formule permise : « dans vos locaux, partout en France ».",
  },
  {
    code: "prix-barre",
    re: new RegExp(
      String.raw`${B}(?:prix|tarif)s? barre(?:e|s|es)?${E}|${B}ancien (?:prix|tarif)${E}|${B}anciennement [0-9][0-9 ]*(?:€|euros?)|${B}au lieu de (?:payer )?[0-9][0-9 ]*(?:€|euros?|eur${E})|~~[^~]{0,40}[0-9][^~]{0,25}(?:€|euros?|eur${E})[^~]{0,15}~~|${B}(?:prix|tarif) (?:normal|habituel|habituellement constate)${E} ?:? ?[0-9][0-9 ]*(?:€|euros?|eur${E})`,
      "g",
    ),
    raison:
      "Prix barré ou ancien prix : le tarif s'affiche seul (1 490 € HT), sans prix barré ni ancien prix.",
  },
  {
    code: "frais-venue",
    // Barrière de code (lot « équipe éditoriale », PR 1) : aucun texte publié ne parle de
    // déplacement, d'hébergement ni de repas FACTURÉS, pris en charge, inclus ou offerts.
    // Le motif exige un contexte de facturation / prise en charge : « le déplacement d'une
    // tâche », « un repas d'équipe », « déplacer un rendez-vous » ne bloquent pas. « hébergement »
    // seul n'est pas visé (hébergement de données) : il faut qu'il soit relié au formateur, à un
    // repas, à un déplacement ou à un « frais ».
    re: new RegExp(
      String.raw`${B}frais (?:de |d'|des )?(?:deplacements?|hebergements?|repas|restauration|transports?|voyages?|sejours?|bouche|trajets?)${E}|${B}(?:deplacements?|repas|dejeuners?|diners?|nuitees?|hebergements? (?:du|des|de notre|de l') ?(?:formateurs?|intervenants?|consultants?|equipes?))(?: [a-z']+){0,4} (?:inclus|incluse|incluses|inclut|offert|offerte|offertes|offerts|gratuits?|gratuite?s?|compris(?! dans le temps| entre)|comprise|comprises|pris en charge|prise en charge|prises en charge|(?:est|sont|sera|seront|restent?) (?:re)?facturee?s?|(?:re)?facturee?|en sus|en supplement|sur devis|a (?:votre|notre|la) charge|avec supplement)${E}|${B}(?:deplacements|hebergements|nuitees) (?:re)?factures${E}|${B}prises? en charge (?:du|des|de) ?(?:frais de )?(?:deplacements?|trajets?|nuitees?)${E}|${B}(?:nous|axion-?ia) (?:nous )?(?:prenons|prend|assumons|assurons|offrons|incluons|facturons|refacturons|remboursons)(?: [a-z']+){0,2} (?:en charge )?(?:les |le |la |l'|vos |votre |nos |notre )?(?:frais )?(?:de |des |d')?(?:deplacements?|trajets?|repas|nuitees?|dejeuners?|diners?|hebergements? (?:du|des) (?:formateurs?|intervenants?))${E}|${B}se deplacent? (?:gratuitement|sans frais)${E}`,
      "g",
    ),
    raison:
      "Déplacement, hébergement ou repas évoqués comme facturés, inclus, offerts ou pris en charge : interdit. Seule formule permise : « dans vos locaux, partout en France ».",
  },
  {
    code: "multiple-garantie",
    // La garantie ne se formule que « 3 fois le prix » en « gains identifiés ». Tout autre
    // multiple (2 fois, 5 fois, x10, 10x, double, 300 %…) à portée d'un mot de garantie
    // bloque. Le « 3 » est écrit ici ; un test le compare à MULTIPLE_GARANTIE.
    re: new RegExp(
      String.raw`${B}(?:garantie?s?|garantit|garantissons|garantissez)${E}[^.!?;]{0,90}${B}${MULTIPLE_AUTRE}|${B}rembours\w*(?=[^.!?;]{0,90}(?:gains?|identifie))[^.!?;]{0,90}${B}${MULTIPLE_AUTRE}|${B}${MULTIPLE_AUTRE}[^.!?;]{0,90}${B}(?:garantie?s?|garantit|garantissons|garantissez)${E}`,
      "g",
    ),
    raison:
      "Multiple de garantie autre que « 3 fois le prix » (en gains identifiés) : interdit. Reprendre la formule exacte du site.",
  },
  {
    code: "seuil-garantie-euros",
    // Un montant en euros présenté comme seuil de la garantie (multiple × prix) : jamais cité,
    // seulement « 3 fois le prix ». Hors contexte de gains identifiés (garantie décennale,
    // seuil de rentabilité, prêt…), rien ne bloque.
    re: new RegExp(
      String.raw`${B}seuils? (?:de |d')?(?:la )?garantie(?: [a-z']+){0,3}(?: ?:)? (?:(?:de|a|d') ?)?${MONTANT_EUROS}|${B}garantie(?: [a-z']+){0,5}(?: ?: ?| (?:de|a|d'|jusqu'a|des|au-dela de|superieurs? a|inferieurs? a|atteignent|depassent) )${MONTANT_EUROS}(?=[^.!?;]{0,40}(?:gains?|identifie))|${B}garantie(?=[^.!?;]{0,60}(?:gains?|identifie|fois le))[^.!?;]{0,60}${B}(?:soit|ce qui fait|correspond a|equivaut a|equivalent a)(?: environ)? ${MONTANT_EUROS}|${B}garantie(?=[^.!?;]{0,80}gains?)[^.!?;]{0,80}(?:inferieurs?|moins|sous|atteign\w*|depass\w*)(?: [a-z']+){0,3} ${MONTANT_EUROS}|${B}rembours\w*(?=[^.!?;]{0,60}(?:gains?|identifie))[^.!?;]{0,80}(?:inferieurs?|moins|sous|atteign\w*|depass\w*)(?: [a-z']+){0,3} ${MONTANT_EUROS}|${MONTANT_EUROS} (?:de|en) (?:gains?|economies) identifies?[^.!?;]{0,40}garanti\w*`,
      "g",
    ),
    raison:
      "Montant en euros présenté comme seuil de garantie : interdit. Écrire « 3 fois le prix HT en gains identifiés », sans montant.",
  },
  {
    code: "preuve-sociale-vague",
    re: new RegExp(
      String.raw`${B}nos retours? (?:de )?terrain${E}|${B}retours? (?:de )?terrain (?:d'|de )?(?:axion|nos|notre)|${B}retours? (?:de )?terrain d'une? (?:pme|tpe|entreprise|societe|cabinet|agence|commerce)${E}|${B}d'apres nos (?:clients?|retours?|observations?|experiences?)${E}|${B}selon nos (?:clients?|retours?)${E}|${B}nos clients (?:nous )?(?:disent|confient|rapportent|racontent|expliquent|temoignent|constatent|apprecient|remercient|sont unanimes|ont constate|ont observe)${E}|${B}nos clients nous ont (?:dit|confie|rapporte|raconte|explique)${E}`,
      "g",
    ),
    raison:
      "Preuve sociale invérifiable (« nos retours terrain », « d'après nos clients ») : aucun client ni retour public. Retirer, ou citer une source publique.",
  },
];

/**
 * Motif d'un code, SANS état (sans drapeau `g`), à appliquer à un texte DÉJÀ normalisé par
 * `normaliserPourControle`. Pour les lecteurs qui ont leur propre structure (ex. la fiche
 * Journée IA) et ne doivent pas dupliquer les motifs. Lève si le code n'a pas de motif.
 */
export function motifInterdit(code: CodeInterdit): RegExp {
  const m = MOTIFS_INTERDITS.find((x) => x.code === code);
  if (!m) throw new Error(`aucun motif pour le code d'interdit « ${code} »`);
  return new RegExp(m.re.source, m.re.flags.replace("g", ""));
}

/** Raison lisible d'un code (journaux, rapports). */
export function raisonInterdit(code: CodeInterdit): string {
  return MOTIFS_INTERDITS.find((m) => m.code === code)?.raison ?? code;
}

function motifActif(m: MotifInterdit, opts: OptionsInterdits): boolean {
  if (m.sauf === "actualite") return !opts.actualite;
  if (m.sauf === "financement-public-autorise") return !opts.financementPublicAutorise;
  return true;
}

function extraitAutour(texte: string, debut: number, longueur: number): string {
  const de = Math.max(0, debut - 25);
  const a = Math.min(texte.length, debut + longueur + 25);
  return texte.slice(de, a).trim();
}

/**
 * Cherche les interdits dans un texte (brut : il est normalisé ici).
 * Renvoie un élément par code trouvé, avec le nombre d'occurrences.
 */
export function detecterInterdits(texte: string, opts: OptionsInterdits): InterditDetecte[] {
  const normalise = normaliserPourControle(texte);
  if (!normalise) return [];
  const trouves: InterditDetecte[] = [];
  for (const m of MOTIFS_INTERDITS) {
    if (!motifActif(m, opts)) continue;
    const occ = [...normalise.matchAll(m.re)];
    if (occ.length === 0) continue;
    const premiere = occ[0]!;
    trouves.push({
      code: m.code,
      extrait: extraitAutour(normalise, premiere.index ?? 0, premiere[0].length),
      occurrences: occ.length,
    });
  }
  return trouves;
}

/**
 * Même contrôle sur chaque champ d'une sortie (titre, méta, FAQ, point clé,
 * avis d'expert, corps…). Un champ vide ou absent est ignoré.
 */
export function detecterInterditsSurface(
  champs: Record<string, string | undefined>,
  opts: OptionsInterdits,
): InterditSurface[] {
  const out: InterditSurface[] = [];
  for (const [champ, valeur] of Object.entries(champs)) {
    if (!valeur) continue;
    for (const d of detecterInterdits(valeur, opts)) {
      out.push({ code: d.code, champ, extrait: d.extrait });
    }
  }
  return out;
}
