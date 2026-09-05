/**
 * Qualiopi — la boucle contractuelle se referme : transmettre l'exemplaire signé.
 *
 * ## Le défaut, vécu EN PRODUCTION le 2026-09-04
 *
 * Convention `AXI-DOC-2026-039`. Envoyée à la cliente à 20:47 UTC. Signée par
 * elle. Contresignée par l'organisme à 21:33 UTC. **Rien n'est parti.** La
 * cliente n'a jamais reçu l'exemplaire intégralement signé.
 *
 * Ce n'est pas un oubli d'ergonomie : un contrat de formation professionnelle
 * (art. L.6353-1 s.) n'existe qu'une fois remis aux deux parties. Tant que
 * l'exemplaire ne part pas, l'organisme détient seul la preuve d'un engagement
 * réciproque — et le portail, lui, PROMET le contraire, mot pour mot :
 *
 *     « Votre signature est enregistrée. … vous adressera l'exemplaire
 *       contresigné. »   (`portail/signer/[token]/page.tsx`)
 *
 * ## Pourquoi personne ne l'avait vu
 *
 * Parce qu'une pièce complète DISPARAÎT de toutes les surfaces de rattrapage :
 *
 *   · `listerPiecesEnAttente()` filtre `statutSignature IN (en_attente,
 *     partielle)` — `signee` en sort ;
 *   · `partieARelancer()` retourne `null` dès que le statut n'est plus l'un des
 *     deux, avec ce commentaire : « `signee` n'a personne à relancer » ;
 *   · l'écran « À traiter », le compteur de navigation et l'évaluateur
 *     d'alertes lisent tous les trois la même liste.
 *
 * Le succès de la signature effaçait donc la seule trace qui aurait pu dire
 * qu'il restait quelque chose à faire. Un défaut qui se cache dans son propre
 * succès ne se trouve pas en relisant du code : il se trouve en signant une
 * vraie convention et en regardant la boîte aux lettres d'en face.
 *
 * ## Ce que ce module garantit
 *
 *  1. **Un seul chemin.** Les deux canaux de complétion — la cliente qui signe
 *     en dernier par jeton, l'organisme qui contresigne en dernier — appellent
 *     la MÊME fonction. Deux implémentations auraient divergé, et l'une des
 *     deux serait restée muette : c'est littéralement l'histoire du défaut
 *     d'origine, où le canal jeton notifiait (par Telegram, en interne) et le
 *     canal contresignature ne notifiait rien du tout.
 *  2. **L'idempotence par revendication.** On pose `exemplaireSigneEnvoyeAt`
 *     AVANT d'enfiler l'e-mail, par un `updateMany` conditionnel qui ne peut
 *     réussir qu'une fois. Deux clics simultanés n'envoient qu'un exemplaire.
 *  3. **La revendication se relâche en cas d'échec.** Si le rendu ou la mise en
 *     file échoue, on remet la colonne à `null`. Sans ce relâchement, un Redis
 *     momentanément absent marquerait la pièce « transmise » pour toujours —
 *     on aurait remplacé un défaut silencieux par un défaut silencieux qui, en
 *     plus, se croit réparé.
 *  4. **Jamais de levée.** La fonction retourne un motif, elle ne lève pas :
 *     une signature VALIDE ne doit pas être perdue parce que l'envoi a raté.
 *     La preuve est déjà en base ; ce qui reste est un envoi, et l'alerte
 *     `exemplaire_signe_non_transmis` le rattrape.
 */

import { prisma } from "@/lib/prisma";
import { documentPdfKey } from "@/lib/r2-storage";
import { storeAndSignPdf } from "@/server/qualiopi/documents/render";
import { rendreExemplaireSigne } from "@/server/qualiopi/documents/signature/exemplaire-signe";
import { circuitPour } from "@/server/qualiopi/documents/signature/parties-requises";
import { enqueueEmail } from "@/server/queue/queues";

/**
 * La partie ORGANISME ne se transmet rien à elle-même.
 *
 * Miroir de `DocumentPartieSignataire.axionia`. Écrit en dur ici parce que
 * l'exclusion est une règle métier — « on n'envoie pas l'exemplaire à soi-même »
 * — et non une propriété de l'énumération.
 */
const PARTIE_ORGANISME = "axionia";

export type MotifNonTransmission =
  /** Déjà transmis. Le cas nominal d'un second appel — pas une anomalie. */
  | "deja_transmis"
  /** La pièce n'est pas intégralement signée : il reste une partie. */
  | "pas_complete"
  /** Pièce annulée au registre : elle ne fait plus foi, on ne la diffuse pas. */
  | "annulee"
  /** Aucune partie signataire ne porte d'adresse. Rien à faire ici. */
  | "aucun_destinataire"
  /** Le rendu du PDF signé a échoué (instantané absent, gabarit modifié…). */
  | "rendu_impossible"
  /** R2 n'est pas configuré : pas de clé, donc pas de pièce jointe possible. */
  | "archivage_impossible"
  /** La file d'e-mails n'a rien accepté (Redis absent, adresse supprimée…). */
  | "file_indisponible";

export type ResultatTransmission =
  | { readonly ok: true; readonly destinataires: readonly string[]; readonly r2Key: string }
  | { readonly ok: false; readonly motif: MotifNonTransmission; readonly detail?: string };

/** Clé d'archive de l'exemplaire signé — voisine du PDF vierge, jamais la même. */
export function exemplaireSignePdfKey(doc: {
  type: string;
  numero: string;
  createdAt: Date;
}): string {
  // `documentPdfKey` rend `documents/<année>/<type>/<numéro>.pdf`. On suffixe
  // plutôt que de composer une clé à la main : les deux fichiers doivent vivre
  // dans le même dossier, et la règle de partitionnement par année locale (et
  // non UTC) est déjà tranchée là-bas — la redériver ici la ferait diverger un
  // 31 décembre au soir.
  return documentPdfKey(doc).replace(/\.pdf$/, "-signe.pdf");
}

/**
 * Les adresses à qui l'exemplaire doit parvenir.
 *
 * On lit les SIGNATURES réellement posées, pas les parties requises : c'est
 * l'adresse qui a signé qui reçoit son exemplaire, pas celle qu'on aurait
 * espérée. Une signature révoquée ne compte pas.
 *
 * Exporté pour être éprouvé seul : c'est la seule partie de ce module qui
 * décide de QUI reçoit un contrat, et elle mérite ses propres témoins.
 */
export function destinatairesExemplaire(
  signatures: ReadonlyArray<{ partie: string; signataireEmail: string | null }>,
): string[] {
  const vues = new Set<string>();
  const out: string[] = [];
  for (const s of signatures) {
    if (s.partie === PARTIE_ORGANISME) continue;
    const email = (s.signataireEmail ?? "").trim();
    if (email.length === 0) continue;
    // Dédoublonnage insensible à la casse : la même personne peut signer deux
    // qualités sur une tripartite, et recevoir deux fois le même PDF ferait
    // douter de la pièce.
    const cle = email.toLowerCase();
    if (vues.has(cle)) continue;
    vues.add(cle);
    out.push(email);
  }
  return out;
}

/**
 * Transmet l'exemplaire intégralement signé à toutes les parties signataires
 * autres que l'organisme.
 *
 * Ne lève jamais. Sûre à appeler plusieurs fois.
 */
export async function transmettreExemplaireSigne(
  documentGenereId: string,
): Promise<ResultatTransmission> {
  const piece = await prisma.documentGenere.findUnique({
    where: { id: documentGenereId },
    select: {
      id: true,
      type: true,
      numero: true,
      createdAt: true,
      statutSignature: true,
      annuleeAt: true,
      exemplaireSigneEnvoyeAt: true,
      clientId: true,
      signatures: {
        where: { revokedAt: null },
        select: { partie: true, signataireEmail: true, signataireNom: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (piece === null) return { ok: false, motif: "rendu_impossible", detail: "piece_introuvable" };
  if (piece.statutSignature !== "signee") return { ok: false, motif: "pas_complete" };
  if (piece.annuleeAt !== null) return { ok: false, motif: "annulee" };
  if (piece.exemplaireSigneEnvoyeAt !== null) return { ok: false, motif: "deja_transmis" };

  const destinataires = destinatairesExemplaire(piece.signatures);
  if (destinataires.length === 0) return { ok: false, motif: "aucun_destinataire" };

  // ── Revendication ────────────────────────────────────────────────────────
  // Poser la date AVANT d'envoyer, et seulement si elle est encore nulle. Le
  // `updateMany` conditionnel est atomique : de deux appels concurrents, un
  // seul voit `count === 1`. Le second repart en « déjà transmis » sans avoir
  // rien envoyé.
  const revendication = await prisma.documentGenere.updateMany({
    where: { id: piece.id, exemplaireSigneEnvoyeAt: null },
    data: { exemplaireSigneEnvoyeAt: new Date() },
  });
  if (revendication.count === 0) return { ok: false, motif: "deja_transmis" };

  /** Rend la pièce de nouveau transmissible — l'échec ne doit pas la sceller. */
  const relacher = async (): Promise<void> => {
    await prisma.documentGenere
      .update({ where: { id: piece.id }, data: { exemplaireSigneEnvoyeAt: null } })
      .catch(() => undefined);
  };

  const rendu = await rendreExemplaireSigne(piece.id).catch(() => null);
  if (rendu === null || !rendu.ok) {
    await relacher();
    return {
      ok: false,
      motif: "rendu_impossible",
      ...(rendu !== null ? { detail: rendu.raison } : {}),
    };
  }

  const r2Key = exemplaireSignePdfKey(piece);
  const archive = await storeAndSignPdf(rendu.buffer, r2Key).catch(() => null);
  if (archive === null) {
    // `storeAndSignPdf` rend `null` quand R2 n'est pas configuré. Sans clé R2,
    // `enqueueEmail` ne peut PAS joindre le PDF — et un e-mail qui annonce un
    // exemplaire sans le porter est pire que pas d'e-mail du tout.
    await relacher();
    return { ok: false, motif: "archivage_impossible" };
  }

  const circuit = circuitPour(piece.type);
  const libellePiece = circuit?.libelle ?? "la pièce";

  let aumoinsUnEnfile = false;
  for (const to of destinataires) {
    const res = await enqueueEmail(
      "piece-exemplaire-signe",
      to,
      "fr",
      {
        numero: piece.numero,
        libellePiece,
        signataires: piece.signatures
          .filter((s) => s.signataireNom.trim().length > 0)
          .map((s) => s.signataireNom),
      },
      {
        attachments: [
          { filename: rendu.nomFichier, r2Key, contentType: "application/pdf" },
        ],
        entityType: "DocumentGenere",
        entityId: piece.id,
        clientId: piece.clientId,
        sujet: `Votre exemplaire signé — ${libellePiece} ${piece.numero}`,
      },
    ).catch(() => ({ enqueued: false }) as const);
    if (res.enqueued) aumoinsUnEnfile = true;
  }

  if (!aumoinsUnEnfile) {
    await relacher();
    return { ok: false, motif: "file_indisponible" };
  }

  // La clé d'archive n'est écrite qu'ICI, une fois l'envoi effectif : elle
  // atteste que le PDF transmis est celui qui dort sous cette clé.
  await prisma.documentGenere
    .update({ where: { id: piece.id }, data: { exemplaireSigneKey: r2Key } })
    .catch(() => undefined);

  return { ok: true, destinataires, r2Key };
}
