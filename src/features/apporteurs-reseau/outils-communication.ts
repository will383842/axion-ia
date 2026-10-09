// OUTILS DE COMMUNICATION de l'apporteur (décision de Will, 2026-10-09) : des pièces PRÊTES À
// L'EMPLOI, téléchargées ou copiées depuis son espace, pour parler d'Axion-IA sans rien retoucher.
//
// Le contrat (art. 22 bis) autorise l'apporteur à communiquer s'il respecte la charte de marque :
// chaque pièce la respecte donc d'office.
//   · la mention « apporteur d'affaires indépendant — réseau Axion-IA » figure partout ;
//   · aucun prix, aucune promesse de résultat, aucun financement, rien sur le CPF ni sur une
//     certification (art. 8.3 et 22 bis.3) ;
//   · jamais « agent commercial », « représentant » ni « salarié » : l'apporteur parle EN SON NOM ;
//   · aucun avatar au logo d'Axion-IA (ce serait se présenter comme Axion-IA, art. 22 bis.4).
// La garde `outils-communication.spec.ts` relit chaque texte de ce fichier.
//
// La bannière LinkedIn, la couverture Facebook et la signature d'e-mail portent le NOM de
// l'apporteur ; les visuels de publication sont les mêmes pour tous.

/** Ce que voit qui ouvre les outils sans contrat signé (ou sans lien valide) : aucun chiffre. */
export const OUTILS_RESERVES = {
  titre: "Vos outils de communication arrivent avec votre contrat",
  texte:
    "Bannière, visuels, textes et logo sont disponibles depuis votre lien personnel, une fois votre contrat d'apporteur signé.",
} as const;

/** Accord de la mention : l'apporteur choisit sur la page (aucun genre n'est enregistré). */
export type Accord = "m" | "f";

/** Un morceau de ligne de titre ; `i` = en italique terracotta. */
export interface Segment {
  t: string;
  i?: boolean;
}
export type LigneTitre = Segment[];

export const mention = (a: Accord) =>
  a === "f"
    ? "Apporteuse d'affaires indépendante — réseau Axion-IA"
    : "Apporteur d'affaires indépendant — réseau Axion-IA";

/** Bas des visuels communs : neutre, puisqu'ils sont les mêmes pour tous. */
export const MENTION_VISUEL = "Publié par un apporteur d'affaires indépendant — réseau Axion-IA";

/** Un visuel de publication (carré 1080 × 1080, ou story 1080 × 1920). */
export interface Visuel {
  cle: string;
  libelle: string;
  surtitre: string;
  titre: LigneTitre[];
  sousTitre: string;
}

export const VISUELS: readonly Visuel[] = [
  {
    cle: "general",
    libelle: "Général",
    surtitre: "L'IA appliquée en entreprise",
    titre: [
      [{ t: "L'IA : vous ne" }],
      [{ t: "savez pas " }, { t: "par où", i: true }],
      [{ t: "commencer ?", i: true }],
    ],
    sousTitre:
      "Formation, audit, mise en place, conférence : on part de votre réalité. Parlons-en.",
  },
  {
    cle: "formations",
    libelle: "Formations",
    surtitre: "Formations IA en entreprise",
    titre: [
      [{ t: "Vos équipes et l'IA :" }],
      [{ t: "on s'y met", i: true }],
      [{ t: "ensemble ?", i: true }],
    ],
    sousTitre: "Des formations sur site, construites sur vos vrais dossiers. Parlons-en.",
  },
  {
    cle: "audit",
    libelle: "Audit",
    surtitre: "Audit IA",
    titre: [
      [{ t: "L'IA chez vous :" }],
      [{ t: "où en êtes-vous", i: true }],
      [{ t: "vraiment ?", i: true }],
    ],
    sousTitre: "Un regard extérieur sur vos usages, vos outils et vos priorités. Parlons-en.",
  },
  {
    cle: "mise-en-place",
    libelle: "Mise en place",
    surtitre: "Mise en place d'outils IA",
    titre: [
      [{ t: "L'IA, " }, { t: "concrètement,", i: true }],
      [{ t: "dans vos outils" }],
      [{ t: "de tous les jours" }],
    ],
    sousTitre: "Des outils IA réglés pour votre façon de travailler. Parlons-en.",
  },
  {
    cle: "accompagnement",
    libelle: "Accompagnement individuel",
    surtitre: "Accompagnement individuel",
    titre: [
      [{ t: "Dirigeant :" }],
      [{ t: "l'IA à votre rythme,", i: true }],
      [{ t: "en tête-à-tête" }],
    ],
    sousTitre: "Un accompagnement individuel, sur vos propres sujets. Parlons-en.",
  },
  {
    cle: "conferences",
    libelle: "Conférences",
    surtitre: "Conférences IA",
    titre: [
      [{ t: "Faire découvrir" }],
      [{ t: "l'IA à toute", i: true }],
      [{ t: "votre équipe", i: true }],
    ],
    sousTitre: "Une intervention pour lancer le sujet dans votre entreprise. Parlons-en.",
  },
];

/** Titre des bannières à son nom (LinkedIn, Facebook). */
export const TITRE_BANNIERE: LigneTitre[] = [
  [{ t: "L'IA : vous ne savez pas" }],
  [{ t: "par où commencer ?", i: true }],
];

/** Où mettre chaque pièce : une phrase, sous l'aperçu. */
export const MODE_EMPLOI = {
  linkedin:
    "Sur LinkedIn : votre profil → le crayon en haut de la bannière → importez l'image. Regardez ensuite votre profil sur votre téléphone.",
  facebook:
    "Sur Facebook : votre profil → « Modifier la photo de couverture » → importez l'image. Regardez ensuite votre profil sur votre téléphone.",
  visuels:
    "À publier sur Facebook, Instagram ou LinkedIn, avec l'un des textes de publication ci-dessous.",
  story: "Sur Instagram ou Facebook : « Ajouter à votre story » → choisissez l'image.",
  bio: "Sur Instagram : « Modifier le profil » → Bio → collez le texte.",
  titreLinkedin: "Sur LinkedIn : votre profil → le crayon → « Titre » → collez le texte.",
  signature:
    "Gmail : Paramètres → « Voir tous les paramètres » → Signature → collez. Outlook : Paramètres → Courrier → Composer et répondre → collez.",
  textes: "Copiez le texte, puis collez-le sous l'un des visuels.",
  logos:
    "Pour vos supports : gardez de l'espace autour du logo, ne le déformez pas, ne le recolorez pas.",
} as const;

const apporteur = (a: Accord) => (a === "f" ? "apporteuse" : "apporteur");
const Apporteur = (a: Accord) => (a === "f" ? "Apporteuse" : "Apporteur");
const independant = (a: Accord) => (a === "f" ? "indépendante" : "indépendant");

/** Bio Instagram : 150 caractères au plus (limite d'Instagram). */
export const bioInstagram = (a: Accord) =>
  `${mention(a)}. L'IA appliquée en entreprise : formation, audit, mise en place. Écrivez-moi.`;

/** Titre du profil LinkedIn : 220 caractères au plus. */
export const titreLinkedin = (a: Accord) =>
  `${mention(a)} | L'IA appliquée en entreprise : formation, audit, mise en place, conférences`;

/** Les textes de publication, à coller sous un visuel. */
export const textesPublication = (a: Accord): { cle: string; libelle: string; texte: string }[] => [
  {
    cle: "par-ou-commencer",
    libelle: "Par où commencer",
    texte:
      "« L'IA, il faut s'y mettre… mais par où commencer ? » C'est une question que se posent beaucoup d'entreprises.\n\n" +
      `Je suis ${apporteur(a)} d'affaires ${independant(a)} pour Axion-IA, qui forme et accompagne les entreprises sur l'IA, à partir de leurs vrais dossiers.\n\n` +
      "Si le sujet vous parle, écrivez-moi : je vous mets en relation.",
  },
  {
    cle: "formations",
    libelle: "Formations",
    texte:
      "Former ses équipes à l'IA, ce n'est pas regarder des démonstrations : c'est travailler sur ses propres dossiers.\n\n" +
      "Axion-IA intervient sur site, avec des formations construites pour chaque métier.\n\n" +
      `${Apporteur(a)} d'affaires ${independant(a)} pour Axion-IA, je peux vous mettre en relation : écrivez-moi.`,
  },
  {
    cle: "audit-mise-en-place",
    libelle: "Audit et mise en place",
    texte:
      "Avant d'acheter un outil d'IA, mieux vaut savoir où il servira vraiment.\n\n" +
      "Axion-IA réalise des audits et met en place des outils IA adaptés à chaque entreprise.\n\n" +
      `${Apporteur(a)} d'affaires ${independant(a)} pour Axion-IA, je peux vous mettre en relation : écrivez-moi.`,
  },
];

/** Signature d'e-mail : texte brut (repli) et HTML (collé dans Gmail ou Outlook). */
export const LOGO_SIGNATURE = "https://axion-ia.com/email/axion-ia-logo-pill.png";

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const signatureTexte = (nomComplet: string, a: Accord) => `${nomComplet}\n${mention(a)}`;

export const signatureHtml = (nomComplet: string, a: Accord) =>
  `<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;color:#241d15">` +
  `<tr><td style="font-size:15px;font-weight:bold;padding-bottom:2px">${echapper(nomComplet)}</td></tr>` +
  `<tr><td style="font-size:13px;color:#6b6153;padding-bottom:8px">${echapper(mention(a))}</td></tr>` +
  `<tr><td><img src="${LOGO_SIGNATURE}" alt="Axion-IA" height="28" style="height:28px;display:block"></td></tr>` +
  `</table>`;

/** Tous les textes qu'une pièce peut montrer, pour la garde de vocabulaire. */
export function tousLesTextes(nomComplet = "Marie Dupont"): string[] {
  const parAccord = (a: Accord) => [
    mention(a),
    bioInstagram(a),
    titreLinkedin(a),
    signatureTexte(nomComplet, a),
    ...textesPublication(a).map((x) => x.texte),
  ];
  return [
    MENTION_VISUEL,
    ...VISUELS.flatMap((v) => [
      v.surtitre,
      v.sousTitre,
      v.titre
        .flat()
        .map((s) => s.t)
        .join(""),
    ]),
    TITRE_BANNIERE.flat()
      .map((s) => s.t)
      .join(""),
    ...Object.values(MODE_EMPLOI),
    OUTILS_RESERVES.titre,
    OUTILS_RESERVES.texte,
    ...parAccord("m"),
    ...parAccord("f"),
  ];
}
