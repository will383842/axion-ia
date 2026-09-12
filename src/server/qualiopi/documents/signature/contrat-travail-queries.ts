/**
 * Lecture de l'état de signature du CONTRAT DE TRAVAIL d'un formateur salarié.
 *
 * Jumelle de `lettre-mission-queries.ts`, et pour la même raison : alimenter
 * DEUX écrans — l'espace du salarié et la console — par la MÊME lecture. Deux
 * lectures parallèles divergeraient sur ce qui est affiché comme signé, et l'une
 * finirait par contredire l'autre sur la même pièce.
 *
 * LECTURE SEULE, aucune écriture.
 *
 * ## 🔑 Ce qui rend cette lecture PLUS SIMPLE que celle de la lettre de mission
 *
 * La lettre de mission a un mandat à résoudre : elle peut être rattachée à une
 * session, et le mandataire s'y déduit du formateur principal ou du Json des
 * co-formateurs. Rien de tel ici — un contrat de travail est TOUJOURS émis avec
 * `refs: { trainerId }` par l'unique action qui le produit, et son titulaire est
 * cette ancre, sans détour possible.
 *
 * ⚠️ D'où une conséquence qu'il faut énoncer plutôt que de la découvrir : une
 * pièce `contrat_travail` sans `trainerId` n'appartient à PERSONNE. Elle n'est
 * pas « à rattacher » — elle est à régénérer. On refuse donc tout le monde
 * dessus, plutôt que d'inventer un titulaire.
 *
 * ## Ce que cette lecture doit garantir
 *
 * 🔴 Le texte présenté au signataire et la version scellée dans l'empreinte
 * viennent du MÊME endroit — `mentionCompleteDocument`. Prouver « ce qu'il a
 * signé » suppose que l'écran et l'empreinte concordent.
 *
 * ⚠️ Aucune donnée personnelle de signataire n'en sort au-delà du NOM et de la
 * QUALITÉ. `signataireEmail` reste scellé en base.
 */

import { prisma } from "@/lib/prisma";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { partiesRequisesPour, circuitPour } from "./parties-requises";
import { mentionCompleteDocument } from "./mentions-document";
import type { PartieSignataire } from "./document-signature-hash";

/** Une partie du circuit, et où elle en est. */
export interface EtatPartieContratTravail {
  partie: PartieSignataire;
  libelle: string;
  signee: boolean;
  signataireNom: string | null;
  signataireQualite: string | null;
  signeAtLisible: string | null;
  empreinte: string | null;
}

export interface EtatSignatureContratTravail {
  documentGenereId: string;
  numero: string;
  /** Statut DÉRIVÉ porté par la pièce. Cache de lecture, jamais la vérité. */
  statutSignature: string;
  /** « CDI » / « CDD », lu de la fiche. Chaîne vide si la nature a été effacée. */
  natureLisible: string;
  /** Date d'émission lisible — repère quand plusieurs tirages coexistent. */
  emisLeLisible: string;
  /** La pièce porte-t-elle le filigrane SPÉCIMEN ? */
  estSpecimen: boolean;
  parties: EtatPartieContratTravail[];
  peutAgir: boolean;
  pourPartie: PartieSignataire;
  motifBlocage: string | null;
  mentions: string[];
  plafondProbant: string;
}

/**
 * 🔴 Les deux parties sont des personnes DIFFÉRENTES, et l'une des deux tient le
 * registre. Le dire est d'autant plus nécessaire ici que le signataire est un
 * SALARIÉ : il signe une pièce dont la preuve est conservée par son employeur.
 * Taire ce point laisserait croire à un tiers de confiance qui n'existe pas.
 */
const PLAFOND_PROBANT =
  "Les deux signatures sont recueillies et conservées par l'employeur, qui est lui-même l'une des deux parties à ce contrat. La preuve repose donc sur son registre scellé, et non sur l'intervention d'un tiers de confiance. Le salarié peut en demander une copie à tout moment, et un exemplaire papier signé des deux parties lui est remis dans tous les cas.";

const LIBELLES: Readonly<Record<string, string>> = {
  formateur: "Signature du salarié",
  axionia: "Signature de l'employeur",
};

const horodatageParis = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

const jourLisible = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Europe/Paris",
});

/** Rôles habilités à engager l'organisme. Miroir de `habiliter()` du service. */
const ROLES_HABILITES = new Set(["super_admin", "admin"]);

const MOTIF_NON_TITULAIRE =
  "Ce contrat de travail ne vous concerne pas : il nomme une personne précise, et elle seule peut le signer.";

const SELECTION_PIECE = {
  id: true,
  numero: true,
  statutSignature: true,
  metadata: true,
  createdAt: true,
  trainerId: true,
  trainer: { select: { contratType: true } },
  signatures: {
    where: { revokedAt: null },
    select: {
      partie: true,
      signataireNom: true,
      signataireQualite: true,
      signeAt: true,
      selfHash: true,
    },
  },
} as const;

type PieceLue = {
  id: string;
  numero: string;
  statutSignature: string;
  metadata: unknown;
  createdAt: Date;
  trainerId: string | null;
  trainer: { contratType: string | null } | null;
  signatures: Array<{
    partie: string;
    signataireNom: string | null;
    signataireQualite: string | null;
    signeAt: Date;
    selfHash: string;
  }>;
};

type Lecteur =
  { pourPartie: "formateur"; trainerId: string } | { pourPartie: "axionia"; role: string };

/**
 * Le salarié voit SON contrat de travail.
 *
 * 🔴 Les contrats DÉJÀ signés restent dans la liste. Ils portent la preuve
 * (signataire, horodatage, empreinte) : les masquer priverait le salarié du seul
 * endroit où il peut constater ce qu'il a signé — et sur un contrat de travail
 * c'est précisément la pièce qu'il aura besoin de produire ailleurs.
 *
 * ⚠️ Rend une liste, éventuellement vide — cas NORMAL d'un formateur dont aucun
 * contrat n'a été établi, et de tout sous-traitant.
 */
export async function lireContratsTravailDuFormateur(
  trainerId: string,
): Promise<EtatSignatureContratTravail[]> {
  const pieces = await prisma.documentGenere.findMany({
    where: { type: "contrat_travail", annuleeAt: null, trainerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: SELECTION_PIECE,
  });

  const identite = await getOrganismeIdentite();
  const lecteur: Lecteur = { pourPartie: "formateur", trainerId };

  // 🔴 Le tirage le PLUS RÉCENT fait foi. Les précédents restent en base avec
  // leurs signatures — une preuve ne disparaît pas parce qu'une pièce a été
  // réémise — mais les afficher côte à côte ferait signer le périmé aussi
  // souvent que le bon. Et sur un contrat de travail, signer le mauvais tirage
  // n'est pas une maladresse : c'est un salaire ou un terme différent.
  const retenue = pieces[0];
  if (retenue === undefined) return [];
  const piece = retenue as unknown as PieceLue;
  if (piece.trainerId === null || piece.trainerId !== trainerId) return [];
  return [construireEtat(piece, lecteur, identite.raisonSociale)];
}

/**
 * Le même contrat, côté CONSOLE, pour la signature de l'employeur.
 *
 * ⚠️ Le rôle est vérifié ICI aussi, en plus de la Server Action et du service.
 * Trois contrôles, et aucun n'est de trop : celui-ci évite de proposer un bouton
 * à un `editor`, qui n'a pas le pouvoir d'engager l'organisme — et signer un
 * contrat de travail est l'engagement le plus lourd de la console.
 */
export async function lireContratsTravailConsole(
  trainerId: string,
  role: string,
): Promise<EtatSignatureContratTravail[]> {
  const pieces = await prisma.documentGenere.findMany({
    where: { type: "contrat_travail", annuleeAt: null, trainerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: SELECTION_PIECE,
  });

  const identite = await getOrganismeIdentite();
  const retenue = pieces[0];
  if (retenue === undefined) return [];
  return [
    construireEtat(
      retenue as unknown as PieceLue,
      { pourPartie: "axionia", role },
      identite.raisonSociale,
    ),
  ];
}

/** L'UNIQUE fonction de construction — partagée par les deux entrées. */
function construireEtat(
  piece: PieceLue,
  lecteur: Lecteur,
  raisonSociale: string,
): EtatSignatureContratTravail {
  // 🔴 Les parties viennent du SSOT, jamais d'un littéral. Une liste écrite ici
  // divergerait un jour de celle que `signerDocument` reçoit, et la pièce
  // afficherait « signée » sur un contrat que l'employeur n'a jamais signé.
  const requises = partiesRequisesPour("contrat_travail") ?? [];
  const posees = new Map(piece.signatures.map((s) => [s.partie, s]));

  const parties: EtatPartieContratTravail[] = requises.map((partie) => {
    const s = posees.get(partie);
    return {
      partie,
      libelle: LIBELLES[partie] ?? partie,
      signee: s !== undefined,
      signataireNom: s?.signataireNom ?? null,
      signataireQualite: s?.signataireQualite ?? null,
      // Heure de PARIS : un horodatage en UTC ferait constater au signataire une
      // heure qui n'est pas la sienne, sur la seule pièce censée le prouver.
      signeAtLisible: s === undefined ? null : horodatageParis.format(s.signeAt),
      empreinte: s?.selfHash ?? null,
    };
  });

  // ⚠️ `metadata` est une colonne `Json` : son type n'est PAS garanti côté
  // application. On teste la forme au lieu de caster.
  const estSpecimen =
    typeof piece.metadata === "object" &&
    piece.metadata !== null &&
    !Array.isArray(piece.metadata) &&
    (piece.metadata as Record<string, unknown>)["specimen"] === true;

  const dejaSignee = parties.some((p) => p.partie === lecteur.pourPartie && p.signee);
  const estTitulaire =
    lecteur.pourPartie === "formateur" &&
    piece.trainerId !== null &&
    piece.trainerId === lecteur.trainerId;
  const habilite = lecteur.pourPartie === "axionia" && ROLES_HABILITES.has(lecteur.role);

  const peutAgir =
    !estSpecimen && !dejaSignee && (lecteur.pourPartie === "formateur" ? estTitulaire : habilite);

  const circuit = circuitPour("contrat_travail");

  return {
    documentGenereId: piece.id,
    numero: piece.numero,
    statutSignature: piece.statutSignature,
    natureLisible:
      piece.trainer?.contratType === null ? "" : (piece.trainer?.contratType ?? "").toUpperCase(),
    emisLeLisible: jourLisible.format(piece.createdAt),
    estSpecimen,
    parties,
    peutAgir,
    pourPartie: lecteur.pourPartie,
    motifBlocage: peutAgir ? null : raisonDuRefus({ estSpecimen, estTitulaire, habilite, lecteur }),
    mentions: mentionCompleteDocument(
      lecteur.pourPartie,
      {
        pieceLibelle: circuit?.libelle ?? "contrat de travail",
        pieceNumero: piece.numero,
        organisme: raisonSociale,
      },
      // Canal MAISON : la mention doit porter le plafond probant.
      true,
    ),
    plafondProbant: PLAFOND_PROBANT,
  };
}

/**
 * La raison du refus, dans l'ordre où elle doit être dite.
 *
 * ⚠️ L'ORDRE compte. Un spécimen relève d'un geste correctif — renseigner la
 * convention collective, régénérer la pièce. Annoncer d'abord « vous avez déjà
 * signé » ferait croire que tout va bien sur un contrat qui n'est pas opposable.
 */
function raisonDuRefus(ctx: {
  estSpecimen: boolean;
  estTitulaire: boolean;
  habilite: boolean;
  lecteur: Lecteur;
}): string {
  if (ctx.estSpecimen) {
    return "Ce contrat porte la mention SPÉCIMEN : la convention collective de l'organisme, ou son identité, était incomplète au moment de sa génération. Il n'est pas opposable. Complétez le paramètre manquant, établissez à nouveau le contrat, puis signez-le.";
  }
  if (ctx.lecteur.pourPartie === "formateur") {
    if (!ctx.estTitulaire) return MOTIF_NON_TITULAIRE;
    return "Vous avez déjà signé ce contrat. Il reste affiché avec son horodatage et son empreinte : c'est votre preuve.";
  }
  if (!ctx.habilite) {
    return "Signer un contrat de travail engage l'organisme comme employeur : seuls un administrateur ou le dirigeant peuvent le faire.";
  }
  return "L'employeur a déjà signé ce contrat. Il reste affiché avec son horodatage et son empreinte.";
}
