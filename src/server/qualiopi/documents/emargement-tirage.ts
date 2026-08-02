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
import { EmargementPdf } from "@/server/qualiopi/documents/templates/emargement";
import { construireFeuillePdf, LIBELLE_DEMI } from "@/server/qualiopi/emargement/feuille-pdf";
import {
  LIEU_DOCUMENT_SELECT,
  resolveLieuDocument,
} from "@/server/qualiopi/lieu/resolve-lieu-document";

export type TirageEmargement =
  | {
      ok: true;
      element: (numero: string) => React.ReactElement;
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
    select: { id: true, ...LIEU_DOCUMENT_SELECT },
  });
  if (!session) return { ok: false, message: "Session introuvable" };

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
    totalSignatures: feuille.totalSignatures,
    // Compté sur la feuille elle-même plutôt que par une requête de plus : c'est
    // le nombre RÉELLEMENT imprimé, donc celui qu'il est utile de journaliser.
    nbParticipants: journees[0]?.lignes.length ?? 0,
    element: (numero: string) =>
      React.createElement(EmargementPdf, {
        data: {
          numero,
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
