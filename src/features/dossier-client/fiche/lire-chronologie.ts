/**
 * Lit tout ce que l'onglet Activité montre (lot B2). LECTURE SEULE : aucune écriture.
 *
 * Réutilise tel quel `lireFilDesEchanges` (rendez-vous, e-mails partis, e-mails à valider,
 * courriers du questionnaire) et lui ajoute les sources qu'il n'a pas : tâches, notes, devis,
 * factures et paiements. Chaque source est protégée : une panne rend sa part vide et incrémente
 * `sourcesEnPanne`, jamais un faux « rien ».
 *
 * ⛔ Jamais d'adresse e-mail ni de corps de message. Une note se déchiffre par
 * `dechiffrerParoleOuNull` et n'est jamais journalisée.
 */

import { prisma } from "@/lib/prisma";
import { dechiffrerParoleOuNull } from "@/lib/chiffrer-parole";
import { lireFilDesEchanges } from "@/features/dossier-client/fil-des-echanges";
import { lireClient360Cache } from "@/components/admin/dossier-client/fiche/contexte";
import {
  assemblerChronologie,
  etatTache,
  type EvenementActivite,
} from "@/features/dossier-client/fiche/chronologie";

const PAR_SOURCE = 100;

export interface ChronologieLue {
  readonly evenements: EvenementActivite[];
  readonly sourcesEnPanne: number;
}

/** Le NOM de chaque destinataire connu de la fiche, par clé d'événement. Jamais l'adresse. */
async function nomsDesDestinataires(
  clientId: string,
  cles: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const idsLog = cles.filter((c) => c.startsWith("mail:")).map((c) => c.slice(5));
  const idsOutbox = cles.filter((c) => c.startsWith("outbox:")).map((c) => c.slice(7));
  const [logs, outbox, adresses] = await Promise.all([
    idsLog.length === 0
      ? []
      : prisma.emailLog.findMany({
          where: { id: { in: idsLog } },
          select: { id: true, recipient: true },
        }),
    idsOutbox.length === 0
      ? []
      : prisma.emailOutbox.findMany({
          where: { id: { in: idsOutbox } },
          select: { id: true, recipient: true },
        }),
    prisma.clientContactAdresse.findMany({
      where: { contact: { clientId } },
      select: { email: true, contact: { select: { nom: true } } },
    }),
  ]);
  const nomParAdresse = new Map(adresses.map((a) => [a.email.toLowerCase(), a.contact.nom]));
  const noms = new Map<string, string>();
  for (const l of logs) {
    const nom = nomParAdresse.get(l.recipient.toLowerCase());
    if (nom !== undefined) noms.set(`mail:${l.id}`, nom);
  }
  for (const o of outbox) {
    const nom = nomParAdresse.get(o.recipient.toLowerCase());
    if (nom !== undefined) noms.set(`outbox:${o.id}`, nom);
  }
  return noms;
}

export async function lireChronologie(
  clientId: string,
  adminPrefix: string,
  maintenant: Date,
): Promise<ChronologieLue> {
  let sourcesEnPanne = 0;
  const sans = async <T>(p: Promise<T[]>): Promise<T[]> =>
    p.catch((e: unknown) => {
      sourcesEnPanne += 1;
      console.warn("[chronologie] source illisible", e instanceof Error ? e.message : e);
      return [] as T[];
    });

  // 1. Le fil existant : rendez-vous + e-mails + courriers.
  const fil = sans(
    lireFilDesEchanges(clientId, adminPrefix).then(async (lu) => {
      sourcesEnPanne += lu.sourcesEnPanne;
      // Les noms sont un confort : leur panne ne coûte pas l'e-mail lui-même.
      const noms = await nomsDesDestinataires(
        clientId,
        lu.fil
          .filter((x) => x.genre === "email" || x.genre === "email_en_attente")
          .map((x) => x.cle),
      ).catch(() => new Map<string, string>());
      return lu.fil.map((x): EvenementActivite => {
        if (x.genre === "rendez_vous") {
          return {
            cle: x.cle,
            type: "rendez_vous",
            date: x.date,
            titre: x.titre,
            etat: x.etat,
            nuance: x.etat.endsWith("a eu lieu") ? "fait" : "prevu",
            lien: x.lien,
            libelleLien: "Ouvrir le rendez-vous",
          };
        }
        if (x.genre === "email_en_attente") {
          const aValider = x.etat !== "Écarté";
          return {
            cle: x.cle,
            type: "email",
            date: x.date,
            titre: x.titre,
            etat: x.etat,
            nuance: aValider ? "a_valider" : "neutre",
            lien: x.lien,
            libelleLien: "Ouvrir la validation",
            destinataire: noms.get(x.cle) ?? null,
          };
        }
        if (x.genre === "email") {
          return {
            cle: x.cle,
            type: "email",
            date: x.date,
            titre: x.titre,
            etat: x.etat,
            nuance: x.statutEmail === "sent" ? "fait" : "neutre",
            lien: x.lien,
            libelleLien: "Voir la copie",
            destinataire: noms.get(x.cle) ?? null,
          };
        }
        return {
          cle: x.cle,
          type: "email",
          date: x.date,
          titre: x.titre,
          etat: x.etat,
          nuance: "neutre",
          lien: x.lien,
          libelleLien: "Ouvrir",
        };
      });
    }),
  );

  // 2. Tâches (écrites par un autre lot : on ne fait que lire).
  const taches = sans(
    prisma.clientTache
      .findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: PAR_SOURCE,
        select: { id: true, intitule: true, echeanceLe: true, faiteLe: true, createdAt: true },
      })
      .then((ts) =>
        ts.map((t): EvenementActivite => {
          const { etat, nuance } = etatTache(t, maintenant);
          return {
            cle: `tache:${t.id}`,
            type: "tache",
            date: t.faiteLe ?? t.createdAt,
            titre: t.intitule,
            etat,
            nuance,
            lien: null,
          };
        }),
      ),
  );

  // 3. Notes : le texte est déchiffré ici, jamais journalisé.
  const notes = sans(
    prisma.clientNote
      .findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: PAR_SOURCE,
        select: {
          id: true,
          auteurLabel: true,
          contenuChiffre: true,
          epinglee: true,
          createdAt: true,
        },
      })
      .then((ns) =>
        ns.map((n): EvenementActivite => {
          let texte: string | null = null;
          let illisible = false;
          try {
            texte = dechiffrerParoleOuNull(n.contenuChiffre);
          } catch {
            illisible = true;
          }
          return {
            cle: `note:${n.id}`,
            type: "note",
            date: n.createdAt,
            titre: `Note de ${n.auteurLabel}`,
            etat: illisible ? "Lecture impossible" : n.epinglee ? "Note épinglée" : "Note",
            nuance: "neutre",
            lien: null,
            texte,
            epinglee: n.epinglee,
          };
        }),
      ),
  );

  // 4. Argent : devis et factures de la fiche 360 (déjà lue pour la page), paiements encaissés.
  const devisEtFactures = sans(
    lireClient360Cache(clientId).then((c) => {
      if (c === null) return [];
      const devis = c.devis
        .filter((d) => d.statut === "envoye" || d.statut === "accepte")
        .map((d): EvenementActivite => ({
          cle: `devis:${d.id}`,
          type: "argent",
          date: d.createdAt,
          titre: `Devis envoyé n° ${d.numero}`,
          etat: d.statut === "accepte" ? "Devis accepté" : "Devis envoyé",
          nuance: "argent",
          lien: null,
          montant: { cents: d.montantTotalHtCents, base: "ht" },
        }));
      const factures = c.facturesFormation
        .filter((f) => f.avoirDeId === null && f.emiseAt !== null && f.statut !== "brouillon")
        .map((f): EvenementActivite => ({
          cle: `facture:${f.id}`,
          type: "argent",
          date: f.emiseAt as Date,
          titre: `Facture envoyée n° ${f.numero}`,
          etat: "Facture envoyée",
          nuance: "argent",
          lien: null,
          montant: { cents: f.montantHtCents, base: "ht" },
        }));
      return [...devis, ...factures];
    }),
  );

  const paiements = sans(
    prisma.payment
      .findMany({
        where: { status: "succeeded", paidAt: { not: null }, factureFormation: { clientId } },
        orderBy: { paidAt: "desc" },
        take: PAR_SOURCE,
        select: { id: true, amountCents: true, paidAt: true },
      })
      .then((ps) =>
        ps.map((p): EvenementActivite => ({
          cle: `paiement:${p.id}`,
          type: "argent",
          date: p.paidAt as Date,
          titre: "Paiement reçu",
          etat: "Paiement reçu",
          nuance: "argent",
          lien: null,
          montant: { cents: p.amountCents, base: "ttc" },
        })),
      ),
  );

  const evenements = assemblerChronologie(
    await Promise.all([fil, taches, notes, devisEtFactures, paiements]),
  );
  return { evenements, sourcesEnPanne };
}
