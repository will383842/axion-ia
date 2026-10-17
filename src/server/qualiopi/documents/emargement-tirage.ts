/**
 * Qualiopi — Données de la feuille d'émargement, à l'instant où on la demande.
 *
 * ## Le défaut que ce module ferme
 *
 * 🔴 Une feuille d'émargement est un INSTANTANÉ. `genererEmargementAction` lit
 * bien des données vives — mais le PDF qu'elle produit est figé dans R2 au
 * moment du clic. Émise AVANT la session (ce qui est l'usage : on imprime la
 * feuille pour la faire signer), elle porte pour toujours
 * « Signatures enregistrées au tirage : 0 », des cases vides et la mention
 * « feuille incomplète » — même une fois toutes les signatures recueillies.
 *
 * Constaté sur la première session réelle (`AXI-SESS-2026-003`) : la base
 * portait 100 % de présence signée le 01/08, et `AXI-DOC-2026-004`, tiré le
 * 31/07, montrait une feuille vierge. La pièce du registre CONTREDISAIT la
 * preuve, sur exactement le document qu'un auditeur Qualiopi ouvre en premier.
 *
 * ## Pourquoi un tirage dérivé, et pas une régénération
 *
 * Régénérer produit une pièce NEUVE : nouveau numéro au registre, et filigrane
 * « COPIE » dès la deuxième du même type. On se retrouve avec deux feuilles
 * concurrentes pour une seule session, dont la plus juste est estampillée copie.
 *
 * ➡️ Même doctrine que l'exemplaire signé d'une pièce contractuelle : un rendu
 * DÉRIVÉ, produit à la volée, jamais persisté et jamais numéroté. L'original
 * scellé reste au registre ; le tirage à jour sert à prouver.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { EmargementPdf } from "@/server/qualiopi/documents/templates/emargement";
import { construireFeuillePdf, LIBELLE_DEMI } from "@/server/qualiopi/emargement/feuille-pdf";
import {
  LIEU_DOCUMENT_SELECT,
  refusEmissionLieu,
  resolveLieuDocument,
} from "@/server/qualiopi/lieu/resolve-lieu-document";

export type TirageEmargement =
  | {
      ok: true;
      /**
       * `reimpression` : mention imprimée en tête d'un TIRAGE À JOUR. Absente
       * pour la pièce officielle produite par `generateDocument`.
       */
      element: (numero: string, reimpression?: string) => React.ReactElement;
      numeroSession: string;
      totalSignatures: number;
      /** Stagiaires effectivement portés sur la feuille (une ligne chacun). */
      nbParticipants: number;
    }
  | { ok: false; message: string };

/**
 * Construit l'élément de rendu de la feuille d'émargement d'une session.
 *
 * Le numéro est passé en paramètre du constructeur plutôt qu'inclus dans les
 * données : la génération officielle reçoit celui que lui alloue
 * `generateDocument`, le tirage à la demande réutilise celui de la pièce déjà
 * au registre. Aucune des deux voies n'invente de numérotation.
 */
export async function construireTirageEmargement(sessionId: string): Promise<TirageEmargement> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, modalite: true, ...LIEU_DOCUMENT_SELECT },
  });
  if (!session) return { ok: false, message: "Session introuvable" };

  // 🔴 I17-01 — une feuille qui imprimerait l'adresse de l'organisme faute de
  // lieu n'est ni émise au registre (`produireEmargement`) ni tirée à la demande
  // (route GET, qui rend ce motif en 409) : les deux voies passent ici.
  const refusLieu = refusEmissionLieu(session);
  if (refusLieu !== null) return { ok: false, message: refusLieu };

  const identite = await getOrganismeIdentite();

  // Horaires RÉELS, multi-jours, modules, formateur par journée, écart de
  // signature et ancrage de chaîne — tout vient de `session_jours`.
  const feuille = await construireFeuillePdf(sessionId);
  if (feuille === null || feuille.journees.length === 0) {
    return {
      ok: false,
      message:
        "Les journées de cette session ne sont pas déclarées. Renseignez-les avec leurs horaires réels : une feuille d'émargement sans horaires exacts est insuffisamment probante.",
    };
  }

  const journees = feuille.journees.map((j) => ({
    dateLisible: j.dateLisible,
    horaires: j.horaires,
    formateurNom: j.formateurNom,
    modules: j.modules,
    entetes: j.demiJournees.map((dj) => LIBELLE_DEMI[dj]),
    lignes: j.lignes.map((l) => ({
      nom: l.stagiaireNom,
      entreprise: l.entreprise ?? "",
      cases: l.cases.map((c) =>
        c.signeAHeure === null
          ? ""
          : [
              `Signé ${c.signeAHeure}`,
              // Mitigation obligatoire de D13 : un écart de 40 h visible et
              // assumé se défend, le même écart muet ne se défend pas.
              c.ecart === null ? "" : `(${c.ecart})`,
              c.surPosteFormateur ? "— poste formateur" : "",
            ]
              .filter(Boolean)
              .join(" "),
      ),
      // Empreinte tronquée : de quoi recouper le registre sans rendre la
      // feuille illisible.
      ancrage:
        l.empreinteTete === null ? "—" : `${l.nbSignatures} · ${l.empreinteTete.slice(0, 10)}`,
    })),
    // Une ligne par demi-journée contresignée. Le nom figuré est celui qui a
    // CONTRESIGNÉ, pas celui annoncé au planning.
    contresignatures: j.contresignatures.map(
      (c) => `${LIBELLE_DEMI[c.demiJournee]} — ${c.formateurNom}, signé ${c.signeAHeure}`,
    ),
    // 🔴 H2 — demi-journées de CE jour SANS contresignature formateur. Le grain
    // « journee » (créneau hérité d'un import) n'est jamais contresigné : le
    // compter comme manquant produirait un faux « feuille incomplète ».
    contresignaturesManquantes: j.demiJournees
      .filter((dj) => dj !== "journee" && !j.contresignatures.some((c) => c.demiJournee === dj))
      .map((dj) => LIBELLE_DEMI[dj]),
  }));

  return {
    ok: true,
    numeroSession: feuille.numeroSession,
    totalSignatures: feuille.totalSignatures,
    // Compté sur la feuille elle-même plutôt que par une requête de plus : c'est
    // le nombre RÉELLEMENT imprimé, donc celui qu'il est utile de journaliser.
    nbParticipants: journees[0]?.lignes.length ?? 0,
    element: (numero: string, reimpression?: string) =>
      React.createElement(EmargementPdf, {
        data: {
          numero,
          ...(reimpression !== undefined ? { reimpression } : {}),
          intituleFormation: feuille.intituleFormation,
          numeroSession: feuille.numeroSession,
          lieu: resolveLieuDocument(session, identite),
          nda: identite.nda,
          journees,
          totalSignatures: feuille.totalSignatures,
        },
        identite,
      }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Le TIRAGE À JOUR — un seul chemin de rendu
// ─────────────────────────────────────────────────────────────────────────────

const FUSEAU_PARIS = "Europe/Paris";
const NUMERO_SANS_ORIGINE = "— non émise au registre —";

function dateParis(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU_PARIS,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function heureParis(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU_PARIS,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

/**
 * Mention imprimée en tête d'un tirage à jour. Heure de PARIS : une date écrite
 * en UTC recule d'un jour toute pièce émise entre minuit et 2 h — exactement la
 * lecture « antidatée » que cette mention existe pour empêcher.
 */
export function mentionTirageAJour(
  tireLe: Date,
  origine: { numero: string; emiseLe: Date } | null,
): string {
  const quand = `${dateParis(tireLe)} à ${heureParis(tireLe)} (heure de Paris)`;
  return origine === null
    ? `Tirage à jour du ${quand} — aucune feuille d'émargement émise au registre pour cette session`
    : `Réimpression à jour du ${quand} — pièce d'origine : ${origine.numero}, émise le ${dateParis(origine.emiseLe)}`;
}

export type TirageEmargementAJour =
  | {
      ok: true;
      buffer: Buffer;
      /** Numéro de la feuille du registre réimprimée, `null` si aucune n'est émise. */
      numeroOrigine: string | null;
      numeroSession: string;
      totalSignatures: number;
      /** Mention imprimée sur le PDF, reprise telle quelle dans les index. */
      mention: string;
    }
  | { ok: false; message: string };

/**
 * Rend le TIRAGE À JOUR de la feuille d'émargement d'une session.
 *
 * 🔴 X-documents-pdf-01 (audit initial 2026-09-14, relecture de la PR 1089).
 * C'est le SEUL chemin de rendu du tirage à jour : l'écran « Télécharger la
 * feuille à jour », le dossier d'audit d'une session et le ZIP du mode auditeur
 * passent tous par ici. Avant, l'écran et le dossier de session construisaient
 * chacun le leur, avec deux populations d'inscriptions différentes, sous le
 * même numéro — et aucun des deux ne disait, sur le PDF, qu'il était une
 * réimpression.
 *
 * - **Population : celle de l'écran.** Les inscriptions sous droit à
 *   l'effacement n'y figurent pas (minimisation, défaut de
 *   `construireFeuillePdf`). Leurs signatures, conservées (art. 17 §3 b),
 *   restent justifiées dans `feuille-emargement.json` et
 *   `verification-integrite.json` du dossier de session.
 * - **Numéro : celui de la dernière feuille qui fait ENCORE foi.** Jamais celui
 *   d'une feuille annulée : le tirage se réclamerait d'une pièce sans valeur, et
 *   il n'existe aucun filigrane « ANNULÉ » dans le dépôt. Même filtre que
 *   `documents-service.ts` pour la chaîne de remplacement.
 * - **Rien n'est créé.** Aucun document, aucun numéro, aucune écriture.
 */
export async function rendreTirageEmargementAJour(
  sessionId: string,
  maintenant: Date = new Date(),
): Promise<TirageEmargementAJour> {
  const tirage = await construireTirageEmargement(sessionId);
  if (!tirage.ok) return tirage;

  const officielle = await prisma.documentGenere.findFirst({
    where: { type: "emargement", sessionId, annuleeAt: null },
    orderBy: { createdAt: "desc" },
    select: { numero: true, createdAt: true },
  });

  const mention = mentionTirageAJour(
    maintenant,
    officielle === null ? null : { numero: officielle.numero, emiseLe: officielle.createdAt },
  );
  const rendu = await renderPdfToBuffer(
    tirage.element(officielle?.numero ?? NUMERO_SANS_ORIGINE, mention),
  );

  return {
    ok: true,
    buffer: rendu.buffer,
    numeroOrigine: officielle?.numero ?? null,
    numeroSession: tirage.numeroSession,
    totalSignatures: tirage.totalSignatures,
    mention,
  };
}
