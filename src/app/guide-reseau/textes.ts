// Textes de la page « Recevoir le guide » (lot S2). Module PUR, sans import de composant.
// Le texte de la case vient de `content/guides-reseau.ts` (versionné, empreinte sha256) :
// il n'est JAMAIS recopié ici.
import { TEXTE_CASE_PAGE_GUIDE, TEXTE_CASE_PAGE_GUIDE_INFOS } from "@/content/guides-reseau";

export const TEXTES_PAGE_GUIDE = {
  marque: "Axion-IA",
  titre: "Recevoir le guide",
  intro:
    "Dites-nous où l'envoyer : votre prénom et votre adresse e-mail suffisent. Le guide arrive dans votre boîte en quelques minutes.",
  prenom: "Prénom",
  email: "Adresse e-mail",
  case: TEXTE_CASE_PAGE_GUIDE,
  caseInfos: TEXTE_CASE_PAGE_GUIDE_INFOS,
  // ⛔ Cette ligne ne contient NI le mot « STOP » NI « autres informations » (décision de Williams).
  information: "Vos données servent à vous envoyer le guide. Comment elles sont traitées :",
  lienConfidentialite: "politique de confidentialité",
  // Mention sur l'origine des demandes (texte fourni, ne pas reformuler). Paragraphe SÉPARÉ de la ligne
  // `information` ci-dessus : celle-ci ne doit pas contenir « stop » (garde dans page-et-route.spec.tsx).
  origine:
    "Nous notons le mot, le réseau et la publication par lesquels vous nous avez contactés, pour savoir d'où viennent les demandes. Ces informations sont gardées aussi longtemps que votre fiche de contact. Vous pouvez vous y opposer à tout moment par le lien « stop » de nos messages.",
  envoyer: "Recevoir le guide",
  // Chemin sans case (avis RGPD) : texte à valider par Williams avant mise en ligne ; ne pas le reformuler sans lui.
  sansCaseDebut:
    "Vous pouvez aussi recevoir le guide sans cocher cette case : écrivez simplement votre adresse e-mail dans la conversation, ou utilisez le",
  sansCaseLien: "formulaire du guide",
  merciTitre: "Merci, c'est noté",
  merciCorps:
    "Si l'adresse saisie peut recevoir des e-mails, le guide arrive dans quelques minutes. Pensez à regarder vos courriers indésirables.",
  lienNeutre:
    "Ce lien ne peut pas être utilisé. Vous pouvez demander le guide depuis le formulaire du site :",
  lienNeutreCta: "Ouvrir le formulaire du guide",
  retour: "Revenir au formulaire",
  erreurs: {
    case: "Cochez la case pour recevoir le guide.",
    prenom: "Indiquez votre prénom (50 caractères au plus).",
    email: "Cette adresse e-mail semble invalide. Vérifiez-la, puis réessayez.",
    adresse_refusee:
      "Cette adresse ne semble pas pouvoir recevoir d'e-mails. Vérifiez-la, puis réessayez.",
    corps_trop_gros: "Votre envoi est trop volumineux. Revenez à la page, puis réessayez.",
    trop_de_requetes: "Trop de tentatives. Réessayez dans quelques minutes.",
  },
} as const;

export const URL_FORMULAIRE_GUIDE = "/fr/guide-ia";
export const URL_CONFIDENTIALITE = "/fr/politique-confidentialite";
