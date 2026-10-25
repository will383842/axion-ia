/**
 * Le fil unique des échanges d'une fiche client (lot 1 fiche client, PR-3, 25/10/2026).
 *
 * Avant : l'onglet « Échanges » ne montrait que les rendez-vous ; chaque e-mail parti, annulé ou
 * en attente, et les courriers du questionnaire avant audit, n'étaient lisibles qu'ailleurs
 * (verif/I-trace-fiche.md). Ici, UN fil chronologique (le plus récent d'abord) qui réunit :
 *   · les rendez-vous (rencontres) ;
 *   · les e-mails du journal rattachés à la fiche (objet seulement, clic vers la copie) ;
 *   · les e-mails en attente de validation (clic vers « E-mails à valider ») ;
 *   · les courriers du questionnaire non partis (prévus, annulés, retenus, en échec) et les
 *     messages Telegram : les courriers PARTIS sont déjà dans le journal des e-mails.
 *
 * Limite dite : le fil porte les e-mails des RENDEZ-VOUS et du QUESTIONNAIRE de la fiche (rattachés par
 * l'entité visée), plus tout e-mail de la file « à valider » de la fiche. Les autres familles (devis,
 * factures, sessions) ne sont pas rattachées ici.
 *
 * ⛔ Objet seulement : jamais le corps, jamais l'adresse du destinataire. Lecture seule.
 * Une lecture en panne rend sa part vide : le fil s'affiche avec ce qui reste.
 */

import { prisma } from "@/lib/prisma";
import { idsLiesAuClient } from "@/features/admin-emails/rattachement-client";
import { LIBELLES_STATUT_EMAIL } from "@/features/admin-emails/statut-libelles";
import { LIBELLE_NATURE, LIBELLE_STATUT } from "@/features/questionnaire-preaudit/libelles-courrier";
import type { EmailLogStatus } from "../../../prisma/generated/client";

export type GenreEchange = "rendez_vous" | "email" | "email_en_attente" | "questionnaire";

export interface EchangeDuFil {
  readonly cle: string;
  readonly genre: GenreEchange;
  readonly date: Date;
  readonly titre: string;
  /** « Envoyé », « Annulé », « prévu »... */
  readonly etat: string;
  /** Adresse interne de la copie ou de la page, ou `null`. */
  readonly lien: string | null;
}

const PAR_SOURCE = 100;

/** Fusionne et trie (le plus récent d'abord). PUR : testé sans base. */
export function assemblerFil(parts: ReadonlyArray<ReadonlyArray<EchangeDuFil>>): EchangeDuFil[] {
  return parts
    .flat()
    .slice()
    .sort((a, b) => b.date.getTime() - a.date.getTime() || a.cle.localeCompare(b.cle));
}

export interface FilLu {
  readonly fil: EchangeDuFil[];
  /** Nombre de sources qui n'ont pas pu être lues : le fil est alors incomplet, et on le dit. */
  readonly sourcesEnPanne: number;
}

const LIBELLE_STATUT_RENDEZ_VOUS: Readonly<Record<string, string>> = {
  planifie: "à venir",
  tenu: "a eu lieu",
  annule: "annulé",
  absent: "client absent",
  reporte: "reporté",
};

export async function lireFilDesEchanges(clientId: string, adminPrefix: string): Promise<FilLu> {
  const base = `/fr/${adminPrefix}`;
  let sourcesEnPanne = 0;
  const sans = async <T>(p: Promise<T[]>): Promise<T[]> =>
    p.catch((e: unknown) => {
      sourcesEnPanne += 1;
      console.warn("[fil-des-echanges] source illisible", e instanceof Error ? e.message : e);
      return [] as T[];
    });

  const rendezVous = sans(
    prisma.rencontre
      .findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: PAR_SOURCE,
        select: { id: true, titre: true, debutPrevu: true, createdAt: true, statut: true },
      })
      .then((rs) =>
        rs.map(
          (r): EchangeDuFil => ({
            cle: `rdv:${r.id}`,
            genre: "rendez_vous",
            date: r.debutPrevu ?? r.createdAt,
            titre: r.titre,
            etat: r.statut === null ? "rendez-vous" : `rendez-vous ${LIBELLE_STATUT_RENDEZ_VOUS[r.statut] ?? r.statut}`,
            lien: `${base}/rendez-vous/rencontres/${r.id}`,
          }),
        ),
      ),
  );

  const emails = sans(
    idsLiesAuClient(clientId).then(async (ids) => {
      if (ids.length === 0) return [];
      const logs = await prisma.emailLog.findMany({
        where: { entityId: { in: ids } },
        orderBy: { createdAt: "desc" },
        take: PAR_SOURCE,
        select: {
          id: true,
          template: true,
          status: true,
          createdAt: true,
          sentAt: true,
          contenu: { select: { subject: true } },
        },
      });
      return logs.map(
        (l): EchangeDuFil => ({
          cle: `mail:${l.id}`,
          genre: "email",
          date: l.sentAt ?? l.createdAt,
          titre: l.contenu?.subject ?? l.template,
          etat: LIBELLES_STATUT_EMAIL[l.status as EmailLogStatus] ?? l.status,
          lien: `${base}/emails-envoyes/${l.id}`,
        }),
      );
    }),
  );

  const enAttente = sans(
    prisma.emailOutbox
      .findMany({
        where: { clientId, statut: { in: ["a_valider", "refuse"] } },
        orderBy: { createdAt: "desc" },
        take: PAR_SOURCE,
        select: { id: true, sujet: true, statut: true, createdAt: true },
      })
      .then((os) =>
        os.map(
          (o): EchangeDuFil => ({
            cle: `outbox:${o.id}`,
            genre: "email_en_attente",
            date: o.createdAt,
            titre: o.sujet,
            etat: o.statut === "a_valider" ? "En attente de votre validation" : "Écarté",
            lien: `${base}/qualiopi/emails`,
          }),
        ),
      ),
  );

  const courriers = sans(
    prisma.questionnaireAvantAuditCourrier
      .findMany({
        where: {
          questionnaire: { rencontre: { clientId } },
          // « retenu » est exclu : l'e-mail retenu est déjà dans la file « à valider » (ligne
          // « E-mail à valider »), puis dans le journal une fois validé. Les tests (nature « essai »)
          // n'ont rien à faire dans le fil d'un client.
          OR: [{ canal: "telegram" }, { statut: { in: ["prevu", "en_cours", "annule", "echec"] } }],
          NOT: [{ canal: "journal" }, { nature: "essai" }],
        },
        orderBy: [{ faitLe: { sort: "desc", nulls: "last" } }, { prevuLe: "desc" }],
        take: PAR_SOURCE,
        select: {
          id: true,
          nature: true,
          statut: true,
          prevuLe: true,
          faitLe: true,
          questionnaire: { select: { rencontreId: true } },
        },
      })
      .then((cs) =>
        cs.map(
          (c): EchangeDuFil => ({
            cle: `courrier:${c.id}`,
            genre: "questionnaire",
            date: c.faitLe ?? c.prevuLe,
            titre: `Questionnaire avant audit : ${LIBELLE_NATURE[c.nature] ?? c.nature}`,
            etat: LIBELLE_STATUT[c.statut] ?? c.statut,
            lien:
              c.questionnaire?.rencontreId != null
                ? `${base}/rendez-vous/rencontres/${c.questionnaire.rencontreId}`
                : null,
          }),
        ),
      ),
  );

  const fil = assemblerFil(await Promise.all([rendezVous, emails, enAttente, courriers]));
  return { fil, sourcesEnPanne };
}
