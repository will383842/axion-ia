/**
 * 🔴 CHANTIER QNC, LOT L11 — LE DOSSIER DE SESSION, CHARGÉ UNE FOIS.
 *
 * Tout ce qui concerne une session, lu en base et rangé par `classement.ts` :
 *   · ses PIÈCES — en vigueur, REMPLACÉES (gardées, étiquetées, hors voyants)
 *     et ANNULÉES (nommées, hors voyants) ; badge « non probante » lu dans
 *     l'instantané de rendu ;
 *   · ses E-MAILS, avec la copie de ce qui est parti (rattachés par l'ENTITÉ,
 *     `idsLiesALaSession`, jamais par l'adresse) ;
 *   · ses REMISES et RETOURS (`remises_retours`) et ses RELANCES
 *     (`relances_journal`), avec leur canal réel ;
 *   · les blocs Moyens, Réclamations et Adaptation (`blocs.ts`).
 *
 * L'écran (onglets « Dossier » et « E-mails ») et le ZIP appellent CETTE
 * fonction puis `rendreDossier` : il n'y a pas d'autre chemin.
 *
 * 🔒 Aucune fuite entre sessions : chaque requête est bornée par l'identifiant
 * de la session, ou par des identifiants dérivés d'elle (inscriptions, pièces,
 * questionnaires). Une session inconnue rend `null`, jamais un dossier vide
 * qui ressemblerait à un autre.
 *
 * Fail-soft, jamais muet : une lecture qui échoue ajoute un avertissement qui
 * dit que ce n'est PAS un constat d'absence. Stub-safe.
 */

import { prisma } from "@/lib/prisma";
import { documentPdfKey } from "@/lib/r2-storage";
import { idsLiesALaSession } from "@/features/admin-emails/query";
import { libelleStatutLigne } from "@/features/admin-emails/statut-libelles";
import { documentJointAuDossierAudit } from "@/server/qualiopi/conformite/hors-dossier-audit";
import { colonneDeclarationDisponible } from "@/server/qualiopi/adaptation/colonne-declaration";
import { dateHeureParis } from "@/server/qualiopi/sessions/verrou-dossier-pur";

import {
  destinataireEmail,
  destinatairePiece,
  emailHorsDossier,
  motifNonProbante,
  remplaceePar,
  type Canal,
  type Destinataire,
} from "./classement";
import type { ElementDossier, ModeleDossierSession } from "./rendu";
import {
  blocAdaptation,
  blocMoyens,
  blocReclamations,
  lecteurEstReferentHandicap,
  type MoyenPourDossier,
  type ReclamationPourDossier,
} from "./blocs";
import { sectionIndicateur10Session } from "./adaptation-session";

export interface LecteurDossier {
  /** Rôle de la console : décide du bloc Adaptation (référent handicap seul). */
  readonly role: string | null;
}

const NON_CONSTAT = "ce n'est PAS un constat d'absence.";

/** Chemin d'un PDF dans le ZIP. Les originaux remplacés ont leur propre dossier. */
export function cheminPdfPiece(p: { type: string; numero: string }, remplacee: boolean): string {
  return remplacee
    ? `documents/remplacees/${p.type}/${p.numero}.pdf`
    : `documents/${p.type}/${p.numero}.pdf`;
}

/** Clé de stockage R2 d'une pièce (pour le ZIP), exportée pour l'écrivain. */
export function cleStockagePiece(p: { type: string; numero: string; createdAt: Date }): string {
  return documentPdfKey(p);
}

const CANAUX: ReadonlySet<string> = new Set(["espace", "email", "papier", "autre"]);
const DESTINATAIRES: ReadonlySet<string> = new Set([
  "stagiaire",
  "entreprise",
  "formateur",
  "financeur",
]);

/**
 * Charge le modèle du dossier d'une session. `null` si la session n'existe pas
 * (ou au build).
 */
export async function chargerDossierSession(
  sessionId: string,
  lecteur: LecteurDossier,
): Promise<ModeleDossierSession | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;

  const colonneDeclaration = await colonneDeclarationDisponible();
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      numero: true,
      titreSession: true,
      dateDebut: true,
      dateFin: true,
      estTestInterne: true,
      enrollments: {
        orderBy: { trainee: { nom: "asc" } },
        select: {
          id: true,
          traineeId: true,
          estTestInterne: true,
          adaptationsRealisees: true,
          besoinAdaptationDeclareAt: colonneDeclaration,
          // Identifiants seulement : les RÉPONSES (le positionnement peut
          // porter un besoin de santé) ne sont lues que pour le référent.
          questionnaires: { select: { id: true } },
          trainee: {
            select: { nom: true, prenom: true, deletedAt: true, situationHandicap: true },
          },
        },
      },
    },
  });
  if (session === null) return null;

  const avertissements: string[] = [];
  const elements: ElementDossier[] = [];
  const horsDossier = { pieces: 0, emails: 0 };
  const sessionEssai = session.estTestInterne === true;

  const inscriptionParId = new Map(session.enrollments.map((e) => [e.id, e]));
  const inscriptionParStagiaire = new Map(session.enrollments.map((e) => [e.traineeId, e]));
  const inscriptionParQuestionnaire = new Map(
    session.enrollments.flatMap((e) => e.questionnaires.map((q) => [q.id, e] as const)),
  );
  const nomStagiaire = (e: { trainee: { prenom: string; nom: string; deletedAt: Date | null } }) =>
    e.trainee.deletedAt !== null
      ? "[stagiaire sous droit à l'effacement]"
      : `${e.trainee.prenom} ${e.trainee.nom}`.trim();
  const essaiInscription = (id: string | null | undefined): boolean =>
    sessionEssai || (id != null && inscriptionParId.get(id)?.estTestInterne === true);

  // ── Pièces ────────────────────────────────────────────────────────────────
  const typePieceParId = new Map<string, Parameters<typeof destinatairePiece>[0]>();
  const numeroPieceParId = new Map<string, string>();
  const libelleEmailParId = new Map<string, string>();
  try {
    const pieces = await prisma.documentGenere.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        numero: true,
        createdAt: true,
        envoyeAt: true,
        annuleeAt: true,
        annuleeMotif: true,
        remplaceeParNumero: true,
        metadata: true,
        traineeId: true,
      },
    });
    for (const p of pieces) {
      typePieceParId.set(p.id, p.type);
      numeroPieceParId.set(p.id, p.numero);
      if (!documentJointAuDossierAudit(p.type)) {
        horsDossier.pieces += 1;
        continue;
      }
      const par = remplaceePar(p.remplaceeParNumero);
      const inscription =
        p.traineeId === null ? undefined : inscriptionParStagiaire.get(p.traineeId);
      const etiquettes: string[] = [];
      if (par !== null) etiquettes.push(`Remplacée par ${par}`);
      if (p.annuleeAt !== null) {
        etiquettes.push(
          `Annulée le ${dateHeureParis(p.annuleeAt)} — ${p.annuleeMotif ?? "motif non renseigné"}`,
        );
      }
      const nonProbante = motifNonProbante(p.metadata);
      if (nonProbante !== null) etiquettes.push(`Non probante — ${nonProbante}`);
      const canal: Canal = p.envoyeAt !== null ? "email" : "autre";
      elements.push({
        cle: `piece:${p.id}`,
        nature: "piece",
        destinataire: destinatairePiece(p.type),
        canal,
        date: p.createdAt,
        titre: `${p.numero} (${p.type})`,
        details: [
          ...(inscription !== undefined ? [`Stagiaire : ${nomStagiaire(inscription)}`] : []),
          ...(p.envoyeAt !== null ? [`Envoyée le ${dateHeureParis(p.envoyeAt)}`] : []),
        ],
        etiquettes,
        essai: essaiInscription(inscription?.id),
        // Une pièce remplacée OU annulée ne compte dans aucun voyant.
        horsVoyants: par !== null || p.annuleeAt !== null,
        // Annulée sans remplaçant : nommée, jamais jointe (doctrine du ZIP).
        cheminPdf: p.annuleeAt !== null && par === null ? null : cheminPdfPiece(p, par !== null),
        cleStockage: cleStockagePiece(p),
      });
    }
  } catch {
    avertissements.push(`⚠️ Les pièces de la session n'ont pas pu être lues : ${NON_CONSTAT}`);
  }

  // ── E-mails ───────────────────────────────────────────────────────────────
  try {
    const ids = await idsLiesALaSession(sessionId);
    const envois =
      ids.length === 0
        ? []
        : await prisma.emailLog.findMany({
            where: { entityId: { in: ids } },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              template: true,
              recipient: true,
              status: true,
              bounceType: true,
              entityType: true,
              entityId: true,
              sentAt: true,
              createdAt: true,
              contenu: {
                select: { subject: true, html: true, text: true, attachmentNames: true },
              },
            },
          });
    for (const e of envois) {
      const typePiece =
        e.entityType === "DocumentGenere" && e.entityId !== null
          ? (typePieceParId.get(e.entityId) ?? null)
          : null;
      if (
        emailHorsDossier(e.template, typePiece !== null && !documentJointAuDossierAudit(typePiece))
      ) {
        horsDossier.emails += 1;
        continue;
      }
      const inscription =
        e.entityId === null
          ? undefined
          : e.entityType === "Enrollment"
            ? inscriptionParId.get(e.entityId)
            : e.entityType === "Questionnaire"
              ? inscriptionParQuestionnaire.get(e.entityId)
              : undefined;
      libelleEmailParId.set(e.id, `${e.template} du ${dateHeureParis(e.sentAt ?? e.createdAt)}`);
      const efface = e.recipient.startsWith("erased:");
      const etiquettes: string[] = [];
      if (efface) etiquettes.push("Adresse masquée (effacement RGPD) — copie conservée 5 ans");
      if (e.contenu === null) etiquettes.push("Copie du contenu non conservée");
      elements.push({
        cle: `email:${e.id}`,
        nature: "email",
        destinataire: destinataireEmail({
          template: e.template,
          entityType: e.entityType,
          typePiece,
        }),
        canal: "email",
        date: e.sentAt ?? e.createdAt,
        titre: e.contenu?.subject ?? e.template,
        details: [
          `Gabarit : ${e.template}`,
          `Adressé à : ${efface ? "[adresse masquée]" : e.recipient}`,
          ...(inscription !== undefined ? [`Stagiaire : ${nomStagiaire(inscription)}`] : []),
          `Statut : ${libelleStatutLigne(e)}`,
          ...(e.contenu !== null && e.contenu.attachmentNames.length > 0
            ? [`Pièces jointes annoncées : ${e.contenu.attachmentNames.join(", ")}`]
            : []),
        ],
        etiquettes,
        essai: essaiInscription(inscription?.id),
        horsVoyants: false,
        copie:
          e.contenu === null
            ? null
            : { sujet: e.contenu.subject, html: e.contenu.html, texte: e.contenu.text },
      });
    }
  } catch {
    avertissements.push(`⚠️ Les e-mails de la session n'ont pas pu être lus : ${NON_CONSTAT}`);
  }

  // ── Remises, retours et relances (journaux en ajout seul du socle) ─────────
  try {
    const [remises, relances] = await Promise.all([
      prisma.remiseRetour.findMany({
        where: { sessionId },
        orderBy: { survenuLe: "asc" },
        select: {
          id: true,
          enrollmentId: true,
          nature: true,
          remiseId: true,
          destinataire: true,
          canal: true,
          objet: true,
          libelle: true,
          documentGenereId: true,
          emailLogId: true,
          survenuLe: true,
        },
      }),
      prisma.relanceJournal.findMany({
        where: { sessionId },
        orderBy: { creeLe: "asc" },
        select: {
          id: true,
          enrollmentId: true,
          objet: true,
          destinataire: true,
          canal: true,
          rang: true,
          automatique: true,
          creeLe: true,
        },
      }),
    ]);
    const remiseParId = new Map(remises.map((r) => [r.id, r]));
    for (const r of remises) {
      const inscription =
        r.enrollmentId === null ? undefined : inscriptionParId.get(r.enrollmentId);
      const remise = r.remiseId === null ? undefined : remiseParId.get(r.remiseId);
      const quoi = r.libelle.trim() !== "" ? r.libelle : r.objet;
      elements.push({
        cle: `${r.nature === "remise" ? "remise" : "retour"}:${r.id}`,
        nature: r.nature === "remise" ? "remise" : "retour",
        destinataire: (DESTINATAIRES.has(r.destinataire)
          ? r.destinataire
          : "organisme") as Destinataire,
        canal: (CANAUX.has(r.canal) ? r.canal : "autre") as Canal,
        date: r.survenuLe,
        titre:
          r.nature === "remise"
            ? quoi
            : `${r.nature} — ${remise !== undefined ? (remise.libelle.trim() !== "" ? remise.libelle : remise.objet) : quoi}`,
        details: [
          ...(inscription !== undefined ? [`Stagiaire : ${nomStagiaire(inscription)}`] : []),
          ...(r.documentGenereId !== null
            ? [`Pièce : ${numeroPieceParId.get(r.documentGenereId) ?? "hors de cette session"}`]
            : []),
          ...(r.emailLogId !== null
            ? [
                `E-mail : ${libelleEmailParId.get(r.emailLogId) ?? "hors du journal de cette session"}`,
              ]
            : []),
        ],
        etiquettes: [],
        essai: essaiInscription(r.enrollmentId),
        horsVoyants: false,
      });
    }
    for (const r of relances) {
      const inscription =
        r.enrollmentId === null ? undefined : inscriptionParId.get(r.enrollmentId);
      elements.push({
        cle: `relance:${r.id}`,
        nature: "relance",
        destinataire: (DESTINATAIRES.has(r.destinataire)
          ? r.destinataire
          : "organisme") as Destinataire,
        canal: (CANAUX.has(r.canal) ? r.canal : "autre") as Canal,
        date: r.creeLe,
        titre: `${r.objet} — relance n° ${r.rang}`,
        details: [
          ...(inscription !== undefined ? [`Stagiaire : ${nomStagiaire(inscription)}`] : []),
          r.automatique ? "Relance automatique" : "Relance manuelle",
        ],
        etiquettes: [],
        essai: essaiInscription(r.enrollmentId),
        horsVoyants: false,
      });
    }
  } catch {
    avertissements.push(
      `⚠️ Les remises, retours et relances n'ont pas pu être lus : ${NON_CONSTAT}`,
    );
  }

  // ── Blocs ─────────────────────────────────────────────────────────────────
  const fin = session.dateFin ?? new Date();
  let moyens: MoyenPourDossier[] = [];
  try {
    moyens = (
      await prisma.moyenPedagogique.findMany({
        where: { createdAt: { lte: fin } },
        orderBy: [{ categorie: "asc" }, { libelle: "asc" }],
        select: {
          libelle: true,
          categorie: true,
          actif: true,
          dateVerification: true,
          historique: {
            where: { creeLe: { lte: fin } },
            select: { creeLe: true, motif: true, auteurNom: true, avant: true, apres: true },
          },
        },
      })
    ).map((m) => ({ ...m, categorie: String(m.categorie) }));
  } catch {
    avertissements.push(`⚠️ Les moyens pédagogiques n'ont pas pu être lus : ${NON_CONSTAT}`);
  }

  let reclamations: ReclamationPourDossier[] = [];
  try {
    const idsInscriptions = session.enrollments.map((e) => e.id);
    reclamations =
      idsInscriptions.length === 0
        ? []
        : (
            await prisma.reclamation.findMany({
              // Rattachées par l'INSCRIPTION — la seule clé (socle L00).
              where: { enrollmentId: { in: idsInscriptions } },
              select: {
                numero: true,
                source: true,
                objet: true,
                statut: true,
                dateReception: true,
                dateReponse: true,
                reponse: true,
                actionsCorrectives: true,
                enrollmentId: true,
                etapes: {
                  select: { etape: true, contenu: true, auteurNom: true, creeLe: true },
                },
              },
            })
          ).map((r) => ({
            ...r,
            source: String(r.source),
            statut: String(r.statut),
            etapes: r.etapes.map((e) => ({ ...e, etape: String(e.etape) })),
            essai: essaiInscription(r.enrollmentId),
          }));
  } catch {
    avertissements.push(`⚠️ Les réclamations n'ont pas pu être lues : ${NON_CONSTAT}`);
  }

  // Adaptation : la donnée de santé n'est CHARGÉE que pour le référent.
  const referent = lecteurEstReferentHandicap(lecteur.role);
  let lignesIndicateur10: string[] | null = null;
  if (referent) {
    try {
      const idsInscriptions = session.enrollments.map((e) => e.id);
      const positionnements =
        idsInscriptions.length === 0
          ? []
          : await prisma.questionnaire.findMany({
              where: {
                enrollmentId: { in: idsInscriptions },
                type: "positionnement",
                reponduAt: { not: null },
              },
              select: { enrollmentId: true, reponses: true, reponduAt: true },
            });
      lignesIndicateur10 = (
        await sectionIndicateur10Session(
          session.enrollments.map((e) => ({
            ...e,
            questionnaires: positionnements.filter((q) => q.enrollmentId === e.id),
          })),
          session,
        )
      ).lignes;
    } catch {
      avertissements.push(`⚠️ Le bloc Adaptation n'a pas pu être lu : ${NON_CONSTAT}`);
    }
  }

  return {
    session: {
      numero: session.numero,
      titre: session.titreSession ?? "",
      estTestInterne: sessionEssai,
    },
    elements,
    blocs: [
      blocMoyens(moyens),
      blocReclamations(reclamations),
      blocAdaptation({ referent, lignesIndicateur10 }),
    ],
    horsDossier,
    avertissements,
  };
}
