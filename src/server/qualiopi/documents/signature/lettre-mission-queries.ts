/**
 * Lecture de l'état de signature de la LETTRE DE MISSION FORMATEUR.
 *
 * Jumelle de `releve-queries.ts`, et pour la même raison : alimenter DEUX écrans
 * — l'accueil du formateur et la console — par la MÊME lecture. Deux lectures
 * parallèles divergeraient sur ce qui est affiché comme signé, et l'un finirait
 * par contredire l'autre sur la même pièce.
 *
 * LECTURE SEULE, aucune écriture.
 *
 * ## 🔴 Le mandat, et pourquoi cette lecture doit employer LE MÊME résolveur
 *
 * `signerLettreMissionFormateurAction` n'autorise QUE le formateur que la lettre
 * NOMME, résolu par `resolvePrincipalTrainerId(session)` — le résolveur qui a
 * imprimé `data.formateur.nomPrenom` sur la pièce. Un co-formateur ou un
 * assistant est membre de la session sans être ce mandataire.
 *
 * Si cette lecture employait une autre règle (l'appartenance de l'émargement,
 * par exemple, comme le fait le relevé), l'écran proposerait un bouton à
 * quelqu'un que l'action refuse à coup sûr. Le refus se lirait comme une panne,
 * et l'intéressé réessaierait au lieu de demander une régénération de la pièce.
 * D'où l'import de `resolvePrincipalTrainerId` ici : un seul résolveur, pas deux.
 *
 * ## Ce que cette lecture doit garantir
 *
 * 🔴 Le texte présenté au signataire et la version scellée dans l'empreinte
 * viennent du MÊME endroit — `mentionCompleteDocument`. Prouver « ce qu'il a
 * signé » suppose que l'écran et l'empreinte concordent ; une mention réécrite
 * dans le composant casserait ce lien en silence.
 *
 * ⚠️ Aucune donnée personnelle de signataire n'en sort au-delà du NOM et de la
 * QUALITÉ. `signataireEmail` reste scellé en base : il sert au recalcul de
 * l'empreinte, pas à l'affichage.
 */

import { prisma } from "@/lib/prisma";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { resolvePrincipalTrainerId } from "@/server/qualiopi/trainers/session-formateurs";
import { partiesRequisesPour, circuitPour } from "./parties-requises";
import { mentionCompleteDocument } from "./mentions-document";
import type { PartieSignataire } from "./document-signature-hash";

/** Une partie du circuit, et où elle en est. */
export interface EtatPartieLettreMission {
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

export interface EtatSignatureLettreMission {
  documentGenereId: string;
  numero: string;
  /** Statut DÉRIVÉ porté par la pièce. Cache de lecture, jamais la vérité. */
  statutSignature: string;
  /**
   * Session mandatée. L'accueil du formateur affiche plusieurs lettres à la
   * suite : sans le rattachement, il signerait un mandat sans savoir lequel.
   * ⚠️ Chaîne VIDE pour une lettre-cadre : `periodeLisible` prend le relais.
   */
  sessionId: string;
  sessionNumero: string;
  sessionTitre: string;
  /** Lettre-CADRE (plusieurs sessions couvertes, une seule signature) ? */
  estCadre: boolean;
  /** « du 01/09/2026 au 31/12/2026 » — le rattachement affiché d'une lettre-cadre. */
  periodeLisible: string | null;
  parties: EtatPartieLettreMission[];
  /** Le lecteur courant peut-il apposer SA signature maintenant ? */
  peutAgir: boolean;
  /** À quel titre il signerait — détermine aussi la mention affichée. */
  pourPartie: PartieSignataire;
  /**
   * 🔴 Pourquoi il ne peut pas, quand il ne peut pas. `null` sinon.
   *
   * Spécimen, signature déjà posée, mandat qui nomme quelqu'un d'autre, rôle
   * insuffisant : ces quatre refus sont certains AVANT le clic. Les taire
   * ferait passer un refus légitime pour une panne de l'écran.
   */
  motifBlocage: string | null;
  /** Texte EXACT présenté au signataire, dans l'ordre d'affichage. */
  mentions: string[];
  /**
   * 🔴 Le plafond probant, affiché à l'écran et non seulement documenté.
   *
   * Il ne dit PAS la même chose que celui du relevé. Sur le relevé, les deux
   * signataires sont souvent le même humain ; ici ce sont deux personnes
   * distinctes, mais le registre qui porte la preuve est tenu par l'une d'elles.
   */
  plafondProbant: string;
}

/**
 * 🔴 Les deux parties sont des personnes DIFFÉRENTES, contrairement au relevé.
 * Le plafond n'est donc pas la confusion des qualités mais la détention du
 * registre : c'est le cocontractant du formateur qui conserve la preuve de ce
 * que le formateur a signé. Le taire laisserait croire à une tierce partie
 * neutre qui n'existe pas sur le canal maison.
 */
const PLAFOND_PROBANT =
  "Les deux signatures sont recueillies et conservées par l'organisme de formation, qui est lui-même l'une des deux parties à cette lettre. La preuve repose donc sur le registre scellé de l'organisme, et non sur l'intervention d'un tiers de confiance : le formateur peut en demander une copie à tout moment.";

const LIBELLES: Readonly<Record<string, string>> = {
  formateur: "Signature du formateur",
  axionia: "Contreseing de l'organisme de formation",
};

const horodatageParis = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** Jour seul, pour la période d'une lettre-cadre (« 1 septembre 2026 »). */
const jourLisible = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Europe/Paris",
});

/**
 * Métadonnées d'une lettre-CADRE — forme testée, jamais castée.
 *
 * ⚠️ `metadata` est un `Json` : rien ne garantit sa forme côté application.
 * Une pièce dont la métadonnée est absente ou malformée n'est PAS une erreur :
 * elle est traitée comme une lettre de session ordinaire (rendu dégradé, pièce
 * intacte).
 */
function lireLettreCadreMeta(metadata: unknown): { du: Date; au: Date } | null {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return null;
  const cadre = (metadata as Record<string, unknown>)["lettreCadre"];
  if (typeof cadre !== "object" || cadre === null || Array.isArray(cadre)) return null;
  const { du, au } = cadre as Record<string, unknown>;
  if (typeof du !== "string" || typeof au !== "string") return null;
  const dDu = new Date(`${du}T00:00:00.000Z`);
  const dAu = new Date(`${au}T00:00:00.000Z`);
  if (Number.isNaN(dDu.getTime()) || Number.isNaN(dAu.getTime())) return null;
  return { du: dDu, au: dAu };
}

/** Clé de déduplication d'une lettre-cadre : sa période, `null` si illisible. */
function cleLettreCadre(metadata: unknown): string | null {
  const meta = lireLettreCadreMeta(metadata);
  if (meta === null) return null;
  return `${meta.du.toISOString()}:${meta.au.toISOString()}`;
}

/** Rôles habilités à engager l'organisme. Miroir de `habiliter()` du service. */
const ROLES_HABILITES = new Set(["super_admin", "admin"]);

/** Motif renvoyé au formateur que la lettre ne nomme pas. */
const MOTIF_NON_MANDATAIRE =
  "Cette lettre de mission ne vous est pas adressée : elle nomme un formateur précis, et lui seul peut la signer.";

/**
 * UUID nul, employé quand l'identifiant de formateur reçu n'en est pas un.
 *
 * ⚠️ Pas une chaîne vide : `@db.Uuid` la refuse et la requête échoue en 500 côté
 * PostgreSQL — pas un refus propre, une erreur serveur. Un UUID valide qui
 * n'existe pas rend simplement zéro ligne, ce qui est exactement le sens voulu
 * (« ce formateur-là n'a aucune lettre »).
 */
const NEANT_UUID = "00000000-0000-0000-0000-000000000000";

const FORME_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rend l'identifiant tel quel s'il est exploitable, sinon le néant. */
function filtreUuid(valeur: string): string {
  return FORME_UUID.test(valeur) ? valeur : NEANT_UUID;
}

/**
 * Sélection COMMUNE aux deux entrées.
 *
 * Partagée volontairement : deux `select` distincts finiraient par diverger, et
 * l'un des deux écrans afficherait une partie de moins que l'autre sur la même
 * pièce.
 *
 * ⚠️ `signataireEmail` n'y figure PAS, et c'est délibéré : il reste scellé en
 * base pour le recalcul de l'empreinte. Le sélectionner ici le ferait fuiter
 * vers le navigateur via les props du composant client.
 */
const SELECTION_PIECE = {
  id: true,
  numero: true,
  statutSignature: true,
  metadata: true,
  // 🔴 L'ancre directe du mandat (2026-08-01). Quand elle est posée, elle PRIME
  // sur la résolution par session : c'est elle que le générateur a imprimée.
  // Les lettres-CADRE n'ont qu'elle (session nulle).
  trainerId: true,
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
      id: true,
      numero: true,
      titreSession: true,
      // 🔴 Les DEUX champs du résolveur de mandat, et rien d'autre : c'est
      // exactement ce que lit `estMandataireDeLaLettre` dans la Server Action.
      formateurPrincipalId: true,
      coFormateurs: true,
    },
  },
} as const;

/** Forme minimale d'une pièce lue, pour typer la fonction de construction. */
type PieceLue = {
  id: string;
  numero: string;
  statutSignature: string;
  metadata: unknown;
  trainerId: string | null;
  signatures: Array<{
    partie: string;
    signataireNom: string | null;
    signataireQualite: string | null;
    signeAt: Date;
    selfHash: string;
  }>;
  session: {
    id: string;
    numero: string;
    titreSession: string;
    formateurPrincipalId: string | null;
    coFormateurs: unknown;
  } | null;
};

type Lecteur =
  { pourPartie: "formateur"; trainerId: string } | { pourPartie: "axionia"; role: string };

/**
 * Le formateur voit les lettres de mission qui LE nomment.
 *
 * Le plan situe cet écran sur l'accueil de l'espace formateur, pas sur une page
 * de session : une lettre de mission se signe avant que la session n'existe
 * vraiment dans le quotidien du formateur, et lui demander de la chercher
 * session par session est le meilleur moyen qu'elle ne soit jamais signée.
 *
 * ⚠️ Rend une liste, éventuellement vide — cas NORMAL d'un formateur dont
 * aucune lettre n'a encore été générée, pas une erreur.
 *
 * 🔴 Les lettres DÉJÀ signées restent dans la liste. Elles portent la preuve
 * (signataire, horodatage, empreinte) : les masquer une fois signées priverait
 * le formateur du seul endroit où il peut constater ce qu'il a signé.
 */
export async function lireLettresMissionDuFormateur(
  trainerId: string,
): Promise<EtatSignatureLettreMission[]> {
  const filtre = filtreUuid(trainerId);

  // ⚠️ PRÉ-FILTRE, pas la règle d'autorisation.
  //
  // La règle est `resolvePrincipalTrainerId`, appliquée plus bas en mémoire :
  // elle seule sait retomber sur le Json `coFormateurs` quand la FK est nulle,
  // ce qu'aucun `where` Prisma ne fait de façon fiable sur un tableau d'objets.
  // Ce `where`-ci ne sert qu'à ne pas rapatrier toutes les lettres du dépôt ; il
  // est volontairement PLUS LARGE que la règle (il laisse passer des
  // co-formateurs), et le recoupement mémoire les écarte ensuite.
  //
  // ⚠️ LIMITE CONNUE : une session dont le mandat n'existe QUE dans le Json
  // `coFormateurs`, sans FK ET sans ligne `SessionFormateur`, échapperait à ce
  // pré-filtre — sa lettre n'apparaîtrait pas du tout. Le backfill du
  // 2026-07-09 a dérivé ces lignes pour l'existant et
  // `assignTrainerToSessionAction` les écrit en dual-write depuis, donc le cas
  // ne devrait plus se produire. Si un formateur signale une lettre absente,
  // c'est ICI qu'il faut regarder — pas dans la règle de mandat, qui est juste.
  const pieces = await prisma.documentGenere.findMany({
    where: {
      type: "lettre_mission",
      // 🔴 Une lettre ANNULÉE ne s'affiche plus au formateur ni au registre.
      // Sans ce filtre, `AXI-DOC-2026-007` — qui qualifie le dirigeant de
      // « mandataire sous-traitant » de sa propre société et qu'on annule
      // précisément pour ça — continuerait de s'afficher dans l'espace
      // formateur comme la lettre en vigueur, signatures à l'appui.
      annuleeAt: null,
      OR: [
        // Lettres-CADRE : ancrées directement sur le formateur, sans session.
        { trainerId: filtre, sessionId: null },
        {
          session: {
            is: {
              OR: [
                { formateurPrincipalId: filtre },
                { sessionFormateurs: { some: { trainerId: filtre } } },
              ],
            },
          },
        },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: SELECTION_PIECE,
  });

  const identite = await getOrganismeIdentite();
  const lecteur: Lecteur = { pourPartie: "formateur", trainerId };

  // 🔴 Une seule lettre par session : la PLUS RÉCENTE fait foi en cas de
  // réémission. Les précédentes restent en base avec leurs signatures — une
  // preuve ne disparaît pas parce qu'une pièce a été réémise — mais les
  // afficher côte à côte ferait signer la périmée aussi souvent que la bonne.
  const retenues = new Set<string>();
  const etats: EtatSignatureLettreMission[] = [];
  for (const piece of pieces as unknown as PieceLue[]) {
    if (piece.session === null) {
      // Lettre-CADRE. Le mandat est l'ancre directe — déjà filtrée en SQL,
      // revérifiée ici (le pré-filtre n'est jamais la règle).
      if (piece.trainerId === null || piece.trainerId !== trainerId) continue;
      // Une réémission de la MÊME période remplace la précédente à l'écran
      // (même règle « la plus récente fait foi » que par session) ; deux
      // périodes différentes coexistent — ce sont deux mandats distincts.
      // Métadonnée illisible → la pièce reste visible, seule (clé = son id).
      const cle = `cadre:${cleLettreCadre(piece.metadata) ?? piece.id}`;
      if (retenues.has(cle)) continue;
      retenues.add(cle);
      etats.push(construireEtat(piece, lecteur, identite.raisonSociale));
      continue;
    }
    if (retenues.has(piece.session.id)) continue;
    retenues.add(piece.session.id);

    // ⚠️ Le pré-filtre SQL laisse passer les co-formateurs et les assistants :
    // ils sont membres de la session sans être le mandataire que la lettre
    // nomme. On ne leur montre pas la pièce du tout — afficher un mandat qui
    // désigne quelqu'un d'autre n'a aucune utilité pour eux et expose le nom du
    // formateur principal à qui n'a pas à le connaître par ce canal.
    const mandataire =
      piece.trainerId ??
      resolvePrincipalTrainerId({
        formateurPrincipalId: piece.session.formateurPrincipalId,
        coFormateurs: piece.session.coFormateurs,
      });
    if (mandataire === null || mandataire !== trainerId) continue;

    etats.push(construireEtat(piece, lecteur, identite.raisonSociale));
  }
  return etats;
}

/**
 * Toutes les lettres de mission d'UN formateur, côté CONSOLE (fiche formateur).
 *
 * Cette entrée existe pour un cas que la page de session ne couvre pas : une
 * lettre-CADRE ne couvrant QUE des coachings ou des audits n'apparaît sur
 * aucune page de session — sans surface ici, l'organisme ne pourrait jamais la
 * contresigner et elle resterait à demi signée pour toujours.
 *
 * Même règle d'appartenance et même déduplication que l'écran du formateur :
 * l'organisme contresigne ce que le formateur a sous les yeux, rien d'autre.
 */
export async function lireLettresMissionConsoleDuFormateur(
  trainerId: string,
  role: string,
): Promise<EtatSignatureLettreMission[]> {
  const filtre = filtreUuid(trainerId);

  const pieces = await prisma.documentGenere.findMany({
    where: {
      type: "lettre_mission",
      // 🔴 Une lettre ANNULÉE ne s'affiche plus au formateur ni au registre.
      // Sans ce filtre, `AXI-DOC-2026-007` — qui qualifie le dirigeant de
      // « mandataire sous-traitant » de sa propre société et qu'on annule
      // précisément pour ça — continuerait de s'afficher dans l'espace
      // formateur comme la lettre en vigueur, signatures à l'appui.
      annuleeAt: null,
      OR: [
        { trainerId: filtre },
        {
          session: {
            is: {
              OR: [
                { formateurPrincipalId: filtre },
                { sessionFormateurs: { some: { trainerId: filtre } } },
              ],
            },
          },
        },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: SELECTION_PIECE,
  });

  const identite = await getOrganismeIdentite();
  const lecteur: Lecteur = { pourPartie: "axionia", role };

  const retenues = new Set<string>();
  const etats: EtatSignatureLettreMission[] = [];
  for (const piece of pieces as unknown as PieceLue[]) {
    // Appartenance : l'ancre PRIME, le résolveur de session couvre le legacy.
    const mandataire =
      piece.trainerId ??
      (piece.session === null
        ? null
        : resolvePrincipalTrainerId({
            formateurPrincipalId: piece.session.formateurPrincipalId,
            coFormateurs: piece.session.coFormateurs,
          }));
    if (mandataire !== trainerId) continue;

    const cle =
      piece.session === null
        ? `cadre:${cleLettreCadre(piece.metadata) ?? piece.id}`
        : piece.session.id;
    if (retenues.has(cle)) continue;
    retenues.add(cle);

    etats.push(construireEtat(piece, lecteur, identite.raisonSociale));
  }
  return etats;
}

/**
 * Même lecture, côté CONSOLE, pour le contreseing de l'organisme.
 *
 * Rend `null` quand aucune lettre de mission n'a été générée pour la session —
 * cas NORMAL, pas une erreur : la lettre se génère à la demande depuis la
 * section Documents de la même page.
 *
 * ⚠️ Le rôle est vérifié ICI aussi, en plus de la Server Action et du service.
 * Trois contrôles, et aucun n'est de trop : celui-ci évite de proposer un bouton
 * à un `editor`, qui n'a pas le pouvoir d'engager l'organisme — et contresigner
 * une lettre de mission confie une mission, un tarif journalier et une clause de
 * confidentialité de cinq ans.
 */
export async function lireEtatSignatureLettreMissionConsole(
  sessionId: string,
  role: string,
): Promise<EtatSignatureLettreMission | null> {
  const piece = await prisma.documentGenere.findFirst({
    where: {
      type: "lettre_mission",
      // 🔴 Une lettre ANNULÉE ne s'affiche plus au formateur ni au registre.
      // Sans ce filtre, `AXI-DOC-2026-007` — qui qualifie le dirigeant de
      // « mandataire sous-traitant » de sa propre société et qu'on annule
      // précisément pour ça — continuerait de s'afficher dans l'espace
      // formateur comme la lettre en vigueur, signatures à l'appui.
      annuleeAt: null,
      OR: [
        { sessionId },
        // Une lettre-CADRE couvrant cette session doit apparaître ICI aussi :
        // c'est sur la page de session que l'organisme contresigne, et une
        // lettre-cadre sans surface de contreseing resterait à demi signée pour
        // toujours. Le rapprochement se fait par `metadata.lettreCadre` —
        // affichage et navigation, jamais l'autorisation (qui lit `trainerId`).
        {
          sessionId: null,
          metadata: { path: ["lettreCadre", "sessionIds"], array_contains: sessionId },
        },
      ],
    },
    // ⚠️ La plus RÉCENTE fait foi, exactement comme côté formateur. Deux tris
    // différents feraient viser à l'organisme une pièce que le formateur n'a pas
    // sous les yeux.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: SELECTION_PIECE,
  });
  if (piece === null) return null;

  const identite = await getOrganismeIdentite();
  return construireEtat(
    piece as unknown as PieceLue,
    { pourPartie: "axionia", role },
    identite.raisonSociale,
  );
}

/**
 * L'UNIQUE fonction de construction — partagée par les deux entrées.
 *
 * Pure : aucune requête, aucune horloge autre que le formatage. Tout ce qui
 * varie entre les deux écrans tient dans `lecteur`.
 */
function construireEtat(
  piece: PieceLue,
  lecteur: Lecteur,
  raisonSociale: string,
): EtatSignatureLettreMission {
  // 🔴 Les parties viennent du SSOT, jamais d'un littéral. Une liste écrite ici
  // divergerait un jour de celle que `signerDocument` reçoit, et la pièce
  // afficherait « signée » sur un mandat que l'organisme n'a jamais contresigné.
  const requises = partiesRequisesPour("lettre_mission") ?? [];
  const posees = new Map(piece.signatures.map((s) => [s.partie, s]));

  const parties: EtatPartieLettreMission[] = requises.map((partie) => {
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

  // 🔴 Un SPÉCIMEN ne part jamais en signature — `signerDocument` le refuse.
  // ⚠️ `metadata` est une colonne `Json` : son type n'est PAS garanti côté
  // application. On teste la forme au lieu de caster.
  const estSpecimen =
    typeof piece.metadata === "object" &&
    piece.metadata !== null &&
    !Array.isArray(piece.metadata) &&
    (piece.metadata as Record<string, unknown>)["specimen"] === true;

  const dejaSignee = parties.some((p) => p.partie === lecteur.pourPartie && p.signee);

  // 🔴 LA règle de mandat — la même que la Server Action, dans le même ordre.
  //
  // L'ancre directe `trainerId` PRIME quand elle existe (pièces émises depuis
  // le 2026-08-01, lettres-cadre comprises) : c'est elle que le générateur a
  // imprimée. À défaut, le résolveur de session couvre les pièces legacy.
  // `null` au bout du compte = personne d'identifiable — la pièce doit être
  // régénérée, pas signée, d'où le refus de TOUT LE MONDE dans ce cas.
  const mandataire =
    piece.trainerId ??
    (piece.session === null
      ? null
      : resolvePrincipalTrainerId({
          formateurPrincipalId: piece.session.formateurPrincipalId,
          coFormateurs: piece.session.coFormateurs,
        }));
  const estMandataire =
    lecteur.pourPartie === "formateur" && mandataire !== null && mandataire === lecteur.trainerId;

  const habilite = lecteur.pourPartie === "axionia" && ROLES_HABILITES.has(lecteur.role);

  const peutAgir =
    !estSpecimen && !dejaSignee && (lecteur.pourPartie === "formateur" ? estMandataire : habilite);

  const circuit = circuitPour("lettre_mission");
  const cadre = lireLettreCadreMeta(piece.metadata);

  return {
    documentGenereId: piece.id,
    numero: piece.numero,
    statutSignature: piece.statutSignature,
    sessionId: piece.session?.id ?? "",
    sessionNumero: piece.session?.numero ?? "",
    sessionTitre: piece.session?.titreSession ?? "",
    estCadre: piece.session === null && cadre !== null,
    periodeLisible:
      cadre === null
        ? null
        : `du ${jourLisible.format(cadre.du)} au ${jourLisible.format(cadre.au)}`,
    parties,
    peutAgir,
    pourPartie: lecteur.pourPartie,
    motifBlocage: peutAgir
      ? null
      : raisonDuRefus({ estSpecimen, estMandataire, habilite, lecteur }),
    mentions: mentionCompleteDocument(
      lecteur.pourPartie,
      {
        pieceLibelle: circuit?.libelle ?? "lettre de mission",
        pieceNumero: piece.numero,
        organisme: raisonSociale,
      },
      // Canal MAISON : la mention doit porter le plafond probant. En canal
      // fournisseur elle serait fausse — un certificat est bien remis.
      true,
    ),
    plafondProbant: PLAFOND_PROBANT,
  };
}

/**
 * La raison du refus, dans l'ordre où elle doit être dite.
 *
 * ⚠️ L'ORDRE compte. Un spécimen signé par personne et un spécimen à demi signé
 * relèvent du même geste correctif — régénérer la pièce une fois l'identité de
 * l'organisme complète. Annoncer d'abord « vous avez déjà signé » ferait croire
 * que tout va bien sur une pièce qui n'a aucune valeur.
 */
function raisonDuRefus(ctx: {
  estSpecimen: boolean;
  estMandataire: boolean;
  habilite: boolean;
  lecteur: Lecteur;
}): string {
  if (ctx.estSpecimen) {
    return "Cette lettre de mission porte la mention SPÉCIMEN : l'identité de l'organisme était incomplète au moment de sa génération, et la pièce n'est pas opposable. Complétez l'identité de l'organisme, régénérez la lettre, puis signez-la.";
  }
  if (ctx.lecteur.pourPartie === "formateur") {
    if (!ctx.estMandataire) return MOTIF_NON_MANDATAIRE;
    return "Vous avez déjà signé cette lettre de mission. Elle reste affichée avec son horodatage et son empreinte : c'est votre preuve.";
  }
  if (!ctx.habilite) {
    return "Contresigner une lettre de mission engage l'organisme : seuls un administrateur ou le dirigeant peuvent le faire.";
  }
  return "L'organisme a déjà contresigné cette lettre de mission. Elle reste affichée avec son horodatage et son empreinte.";
}
