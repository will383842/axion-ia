/**
 * Catalogue des mesures d'adaptation par type de besoin, et circuit de demande —
 * texte public de `/accessibilite` (indicateurs 10 et 26 du Référentiel national
 * qualité, NC12).
 *
 * Langage simple, AUCUNE donnée médicale : on parle de besoins et de mesures,
 * jamais de diagnostics. Le stagiaire n'a aucun justificatif médical à fournir
 * pour obtenir une adaptation.
 *
 * Module pur, sans dépendance : lu par la page et par son test.
 */

import { DELAI_ACCES_PHRASE } from "@/content/formations/delai-acces";

export interface BesoinMesures {
  /** Type de besoin, formulé simplement. */
  readonly besoin: string;
  /** Mesures que nous proposons. */
  readonly mesures: ReadonlyArray<string>;
}

export interface EtapeCircuit {
  readonly titre: string;
  readonly detail: string;
}

export interface MesuresHandicapTextes {
  readonly titreCatalogue: string;
  readonly introCatalogue: string;
  readonly besoins: ReadonlyArray<BesoinMesures>;
  readonly noteCatalogue: string;
  readonly titreCircuit: string;
  readonly introCircuit: string;
  readonly etapes: ReadonlyArray<EtapeCircuit>;
  readonly delai: string;
  readonly titreRecours: string;
  readonly introRecours: string;
}

const FR: MesuresHandicapTextes = {
  titreCatalogue: "Les mesures que nous proposons",
  introCatalogue:
    "Chaque personne est différente : ces mesures sont des exemples, que nous adaptons avec vous. Vous n'avez pas à nous donner de document médical.",
  besoins: [
    {
      besoin: "Si vous entendez mal",
      mesures: [
        "supports écrits complets, remis à l'avance",
        "sous-titres pendant les formations en visioconférence",
        "place face au formateur",
        "interprète en langue des signes française (LSF) si besoin, avec une aide de l'Agefiph",
      ],
    },
    {
      besoin: "Si vous voyez mal",
      mesures: [
        "documents en gros caractères ou lisibles par un lecteur d'écran",
        "contrastes soignés",
        "supports envoyés avant la formation",
      ],
    },
    {
      besoin: "Si vous avez des troubles « dys » (dyslexie, dyspraxie…)",
      mesures: ["police de caractères adaptée", "consignes courtes", "temps supplémentaire"],
    },
    {
      besoin: "Si vous avez des troubles psychiques ou cognitifs",
      mesures: [
        "pauses",
        "rythme adapté",
        "contact avec le référent handicap pendant la formation",
        "groupe réduit si possible",
      ],
    },
    {
      besoin: "Si vous avez une maladie chronique ou une grande fatigabilité",
      mesures: [
        "horaires aménagés",
        "pauses",
        "formation fractionnée en plusieurs demi-journées",
        "formation à distance possible",
      ],
    },
    {
      besoin: "Si vous avez des difficultés pour vous déplacer",
      mesures: ["salle accessible, vérifiée avant la formation", "poste de travail adapté"],
    },
  ],
  noteCatalogue: "Votre besoin n'est pas dans la liste ? Écrivez-nous : nous cherchons avec vous.",
  titreCircuit: "Comment se passe votre demande",
  introCircuit:
    "Le circuit est le même pour tout le monde et se déroule sans démarche compliquée :",
  etapes: [
    {
      titre: "Vous nous signalez votre besoin",
      detail:
        "dans le questionnaire que vous recevez avant la formation. Vous pouvez aussi écrire directement au référent handicap.",
    },
    {
      titre: "Nous vous proposons des mesures",
      detail: "adaptées à votre besoin et à la formation suivie.",
    },
    {
      titre: "Vous confirmez",
      detail: "ce qui vous convient, ou vous demandez une autre solution.",
    },
    { titre: "Nous appliquons les mesures", detail: "pendant la formation." },
    {
      titre: "Nous recueillons votre retour",
      detail: "après la formation, pour améliorer ce qui doit l'être.",
    },
  ],
  delai: DELAI_ACCES_PHRASE,
  titreRecours: "Si vous avez besoin d'un appui extérieur",
  introRecours:
    "Selon votre situation, ces organismes peuvent vous aider à financer ou à organiser une adaptation. Nous vous orientons vers eux si besoin :",
};

const EN: MesuresHandicapTextes = {
  titreCatalogue: "The measures we offer",
  introCatalogue:
    "Everyone is different: these measures are examples that we adapt with you. You do not have to give us any medical document.",
  besoins: [
    {
      besoin: "If you are hard of hearing",
      mesures: [
        "complete written materials, sent in advance",
        "captions during online training",
        "a seat facing the trainer",
        "a French Sign Language (LSF) interpreter if needed, with Agefiph funding",
      ],
    },
    {
      besoin: "If you have low vision",
      mesures: [
        "large-print documents, or documents readable by a screen reader",
        "careful contrast",
        "materials sent before the training",
      ],
    },
    {
      besoin: "If you have “dys” learning difficulties (dyslexia, dyspraxia…)",
      mesures: ["an adapted typeface", "short instructions", "extra time"],
    },
    {
      besoin: "If you have psychological or cognitive difficulties",
      mesures: [
        "breaks",
        "an adapted pace",
        "contact with the disability officer during the training",
        "a smaller group where possible",
      ],
    },
    {
      besoin: "If you have a chronic illness or tire easily",
      mesures: [
        "adjusted hours",
        "breaks",
        "training split into several half-days",
        "remote training where possible",
      ],
    },
    {
      besoin: "If you have difficulty getting around",
      mesures: ["an accessible room, checked beforehand", "an adapted workstation"],
    },
  ],
  noteCatalogue: "Your need is not listed? Write to us: we will look for a solution with you.",
  titreCircuit: "How your request works",
  introCircuit: "The process is the same for everyone and needs no complicated steps:",
  etapes: [
    {
      titre: "You tell us your need",
      detail:
        "in the questionnaire sent before the training. You can also write directly to the disability officer.",
    },
    {
      titre: "We suggest measures",
      detail: "suited to your need and to the course.",
    },
    { titre: "You confirm", detail: "what suits you, or ask for another solution." },
    { titre: "We apply the measures", detail: "during the training." },
    {
      titre: "We collect your feedback",
      detail: "after the training, to improve what needs improving.",
    },
  ],
  delai: "Access time: about 2 weeks between your request and the training.",
  titreRecours: "If you need outside support",
  introRecours:
    "Depending on your situation, these bodies can help you fund or organise an adaptation. We can refer you to them if needed:",
};

export function mesuresHandicapTextes(locale: "fr" | "en"): MesuresHandicapTextes {
  return locale === "fr" ? FR : EN;
}
