/**
 * Lecture de l'état de signature du relevé de connexion d'une session.
 *
 * Alimente DEUX écrans — celui du formateur et celui de la console — par la
 * MÊME lecture. Deux lectures parallèles divergeraient sur ce qui est affiché
 * comme signé, et l'un finirait par contredire l'autre sur la même pièce.
 *
 * LECTURE SEULE, aucune écriture.
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
  /** Le lecteur courant peut-il apposer SA signature maintenant ? */
  peutAgir: boolean;
  /** À quel titre il signerait — détermine aussi la mention affichée. */
  pourPartie: PartieSignataire;
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
  return lireEtat(sessionId, { pourPartie: "formateur", trainerId });
}

/**
 * Même lecture, côté CONSOLE, pour le visa du responsable pédagogique.
 *
 * 🔴 Factorisée avec la lecture formateur, et ce n'est pas de la coquetterie :
 * deux lectures parallèles divergeraient sur ce qui est affiché comme signé, et
 * l'écran de l'un finirait par contredire l'écran de l'autre sur la même pièce.
 *
 * ⚠️ Le rôle est vérifié ICI aussi, en plus de la Server Action et du service.
 * Trois contrôles, et aucun n'est de trop : celui-ci évite de proposer un bouton
 * à quelqu'un qui n'a pas le pouvoir d'engager l'organisme — un refus après clic
 * se lit comme une panne.
 */
export async function lireEtatSignatureReleveConsole(
  sessionId: string,
  role: string,
): Promise<EtatSignatureReleve | null> {
  return lireEtat(sessionId, { pourPartie: "responsable_pedagogique", role });
}

type Lecteur =
  | { pourPartie: "formateur"; trainerId: string }
  | { pourPartie: "responsable_pedagogique"; role: string };

/** Rôles habilités à engager l'organisme. Miroir de `habiliter()` du service. */
const ROLES_HABILITES = new Set(["super_admin", "admin"]);

/**
 * UUID nul, employé quand il n'y a PAS de formateur à recouper.
 *
 * ⚠️ Pas une chaîne vide : `@db.Uuid` la refuse et la requête échoue en 500.
 * Un UUID valide qui n'existe pas rend simplement zéro ligne, ce qui est
 * exactement le sens voulu.
 */
const NEANT_UUID = "00000000-0000-0000-0000-000000000000";

async function lireEtat(sessionId: string, lecteur: Lecteur): Promise<EtatSignatureReleve | null> {
  // 🔴 Le filtre `sessionFormateurs` n'est posé QUE côté formateur.
  //
  // Une chaîne vide passée à une colonne `@db.Uuid` fait échouer la requête
  // côté PostgreSQL — pas un refus propre, une erreur 500. Le rattachement ne
  // concerne de toute façon que le formateur : côté console, l'habilitation
  // vient du rôle, pas d'un lien à la session.
  const filtreFormateur =
    lecteur.pourPartie === "formateur"
      ? { where: { trainerId: lecteur.trainerId }, select: { trainerId: true } }
      : { where: { trainerId: NEANT_UUID }, select: { trainerId: true } };

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
          sessionFormateurs: filtreFormateur,
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
    lecteur.pourPartie === "formateur" &&
    (piece.session?.formateurPrincipalId === lecteur.trainerId ||
      (piece.session?.sessionFormateurs.length ?? 0) > 0);

  // 🔴 UN FORMATEUR NON RATTACHÉ NE VOIT RIEN, il ne se contente pas de ne
  // pas pouvoir agir.
  //
  // Le rattachement ne conditionnait que `peutAgir`. Le numéro de la pièce et
  // les NOMS des signataires étaient rendus à tout formateur connecté, pour
  // n'importe quelle session — sûrs aujourd'hui seulement parce que l'unique
  // appelant garde avant d'appeler.
  //
  // ⚠️ Même raisonnement que `lireFeuilleGroupe` : une sécurité qui repose sur
  // l'ordre d'appel tient tant qu'il n'y a qu'un appelant. On rend `null`, ce
  // que l'appelant traite déjà comme « pas de relévé » — indiscernable de
  // l'absence de pièce, ce qui est exactement le bon niveau d'information pour
  // quelqu'un qui n'anime pas cette session.
  if (lecteur.pourPartie === "formateur" && !rattache) return null;

  const identite = await getOrganismeIdentite();
  const circuit = circuitPour("releve_connexion");

  return {
    documentGenereId: piece.id,
    numero: piece.numero,
    statutSignature: piece.statutSignature,
    parties,
    // Un SPÉCIMEN bloque les deux parties : la pièce n'a aucune valeur juridique
    // tant que l'identité de l'organisme est incomplète.
    peutAgir:
      !estSpecimen &&
      !parties.some((p) => p.partie === lecteur.pourPartie && p.signee) &&
      (lecteur.pourPartie === "formateur" ? rattache : ROLES_HABILITES.has(lecteur.role)),
    pourPartie: lecteur.pourPartie,
    mentions: mentionCompleteDocument(
      lecteur.pourPartie,
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
