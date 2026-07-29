/**
 * Lecture de l'état de signature du relevé de connexion d'une session.
 *
 * Alimente l'écran du formateur. LECTURE SEULE, aucune écriture.
 *
 * ## Ce que cette lecture doit garantir
 *
 * 🔴 Le texte présenté au signataire et la version scellée dans l'empreinte
 * doivent venir du MÊME endroit. Si l'écran affiche une mention et que le tuple
 * scelle `MENTION_VERSION_DOCUMENT`, prouver « ce qu'elle a signé » suppose que
 * les deux correspondent. C'est pour cela que les mentions sont construites ici,
 * par `mentionCompleteDocument`, et non réécrites dans le composant.
 *
 * ⚠️ Aucune donnée personnelle de signataire n'en sort au-delà du NOM et de la
 * QUALITÉ. `signataireEmail` reste scellé en base : il sert au recalcul de
 * l'empreinte, pas à l'affichage.
 */

import { prisma } from "@/lib/prisma";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { partiesRequisesPour, circuitPour } from "./parties-requises";
import { mentionCompleteDocument } from "./mentions-document";
import type { PartieSignataire } from "./document-signature-hash";

/** Une partie du circuit, et où elle en est. */
export interface EtatPartieReleve {
  partie: PartieSignataire;
  libelle: string;
  /** Signée et non révoquée ? */
  signee: boolean;
  /** Identité figée du signataire, quand elle existe. Jamais l'e-mail. */
  signataireNom: string | null;
  signataireQualite: string | null;
  /** Horodatage lisible, heure de Paris. */
  signeAtLisible: string | null;
  /** Empreinte vérifiable. C'est elle qui rend la signature opposable. */
  empreinte: string | null;
}

export interface EtatSignatureReleve {
  documentGenereId: string;
  numero: string;
  /** Statut DÉRIVÉ porté par la pièce. Cache de lecture, jamais la vérité. */
  statutSignature: string;
  parties: EtatPartieReleve[];
  /** Le formateur connecté peut-il signer maintenant ? */
  formateurPeutSigner: boolean;
  /** Texte EXACT présenté au formateur, dans l'ordre d'affichage. */
  mentions: string[];
  /**
   * 🔴 Le plafond probant, affiché à l'écran et non seulement documenté.
   *
   * Dans un organisme d'une personne, le formateur et le responsable
   * pédagogique sont le même humain : les deux signatures attestent deux
   * QUALITÉS, pas deux personnes indépendantes. Le taire laisserait croire à un
   * double contrôle qui n'existe pas.
   */
  plafondProbant: string;
}

const LIBELLES: Readonly<Record<string, string>> = {
  formateur: "Signature du formateur",
  responsable_pedagogique: "Visa du responsable pédagogique",
};

const horodatageParis = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/**
 * État de signature du relevé de connexion d'une session.
 *
 * Retourne `null` quand aucun relevé n'a encore été généré — cas NORMAL d'une
 * session dont l'import FOAD n'a pas été fait, pas une erreur.
 *
 * ⚠️ Le relevé le plus RÉCENT fait foi quand plusieurs existent (réémissions).
 * Les précédents restent en base avec leurs signatures : une preuve ne
 * disparaît pas parce qu'une pièce a été réémise.
 */
export async function lireEtatSignatureReleve(
  sessionId: string,
  trainerId: string,
): Promise<EtatSignatureReleve | null> {
  const piece = await prisma.documentGenere.findFirst({
    where: { sessionId, type: "releve_connexion" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      numero: true,
      statutSignature: true,
      metadata: true,
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
      session: {
        select: {
          formateurPrincipalId: true,
          sessionFormateurs: { where: { trainerId }, select: { trainerId: true } },
        },
      },
    },
  });
  if (piece === null) return null;

  const requises = partiesRequisesPour("releve_connexion") ?? [];
  const posees = new Map(piece.signatures.map((s) => [s.partie as string, s]));

  const parties: EtatPartieReleve[] = requises.map((partie) => {
    const s = posees.get(partie);
    return {
      partie,
      libelle: LIBELLES[partie] ?? partie,
      signee: s !== undefined,
      signataireNom: s?.signataireNom ?? null,
      signataireQualite: s?.signataireQualite ?? null,
      signeAtLisible: s === undefined ? null : horodatageParis.format(s.signeAt),
      empreinte: s?.selfHash ?? null,
    };
  });

  // 🔴 Un SPÉCIMEN ne part jamais en signature — `signerDocument` le refuse.
  // L'écran doit donc le dire AVANT le clic, pas après : proposer un bouton qui
  // refusera à coup sûr est une invitation à croire à une panne.
  const estSpecimen =
    typeof piece.metadata === "object" &&
    piece.metadata !== null &&
    !Array.isArray(piece.metadata) &&
    (piece.metadata as Record<string, unknown>)["specimen"] === true;

  const rattache =
    piece.session?.formateurPrincipalId === trainerId ||
    (piece.session?.sessionFormateurs.length ?? 0) > 0;

  const identite = await getOrganismeIdentite();
  const circuit = circuitPour("releve_connexion");

  return {
    documentGenereId: piece.id,
    numero: piece.numero,
    statutSignature: piece.statutSignature,
    parties,
    formateurPeutSigner:
      rattache && !estSpecimen && !parties.some((p) => p.partie === "formateur" && p.signee),
    mentions: mentionCompleteDocument(
      "formateur",
      {
        pieceLibelle: circuit?.libelle ?? "relevé de connexion",
        pieceNumero: piece.numero,
        organisme: identite.raisonSociale,
      },
      // Canal MAISON : la mention doit porter le plafond probant. En canal
      // fournisseur elle serait fausse — un certificat est bien remis.
      true,
    ),
    plafondProbant:
      "Le relevé porte deux signatures internes à l'organisme. Lorsque le formateur et le responsable pédagogique sont la même personne, elles attestent deux qualités distinctes et non un double contrôle indépendant.",
  };
}
