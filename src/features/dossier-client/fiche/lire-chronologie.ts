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
import {
  LIBELLE_STATUT_RENDEZ_VOUS,
  lireFilDesEchanges,
} from "@/features/dossier-client/fil-des-echanges";
import { nomsDesDestinataires } from "@/features/dossier-client/fiche/noms-destinataires";
import { lireClient360Cache } from "@/components/admin/dossier-client/fiche/contexte";
import {
  assemblerChronologie,
  etatTache,
  type EvenementActivite,
  type NuanceActivite,
} from "@/features/dossier-client/fiche/chronologie";

/** Plafond de lecture par source : les compteurs s'arrêtent là, et l'interface le dit. */
export const PAR_SOURCE = 100;

const ETAT_DEVIS: Readonly<Record<string, string>> = {
  envoye: "Devis envoyé",
  accepte: "Devis accepté",
  refuse: "Devis refusé",
  expire: "Devis expiré",
  transforme_convention: "Devis signé · convention créée",
};

export interface ChronologieLue {
  readonly evenements: EvenementActivite[];
  readonly sourcesEnPanne: number;
}

const ETAT_RENDEZ_VOUS = (statut: string): string =>
  `rendez-vous ${LIBELLE_STATUT_RENDEZ_VOUS[statut]}`;

/** Couleur d'un rendez-vous, par correspondance EXACTE sur les libellés du fil (jamais `endsWith`). */
export function nuanceRendezVous(etat: string): NuanceActivite {
  if (etat === ETAT_RENDEZ_VOUS("planifie")) return "prevu";
  if (etat === ETAT_RENDEZ_VOUS("tenu")) return "fait";
  if (etat === ETAT_RENDEZ_VOUS("absent")) return "probleme";
  return "neutre"; // annulé, reporté, sans statut
}

const MODE_PAIEMENT: Readonly<Record<string, string>> = {
  card: "Carte bancaire",
  sepa_credit_transfer: "Virement",
  cheque: "Chèque",
  cash: "Espèces",
};

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
            nuance: nuanceRendezVous(x.etat),
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
            nuance:
              x.statutEmail === "sent"
                ? "fait"
                : x.statutEmail === "failed" || x.statutEmail === "bounced"
                  ? "probleme"
                  : "neutre",
            lien: x.lien,
            libelleLien: "Voir la copie",
            destinataire: noms.get(x.cle) ?? null,
          };
        }
        // Courrier du questionnaire : un message Telegram n'est jamais un « E-mail ».
        const telegram = x.canal === "telegram";
        return {
          cle: x.cle,
          type: telegram ? "message" : "email",
          date: x.date,
          titre: x.titre,
          etat: x.etat,
          nuance: x.statutCourrier === "echec" ? "probleme" : "neutre",
          lien: x.lien,
          libelleLien: "Ouvrir",
          ...(telegram ? { mot: "Message Telegram" } : {}),
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

  // 4a. Devis : lecture dédiée (la fiche 360 n'en garde que 10 et ne dit pas la date d'envoi).
  const devis = sans(
    prisma.devis
      .findMany({
        where: { clientId, sentAt: { not: null } },
        orderBy: { sentAt: "desc" },
        take: PAR_SOURCE,
        select: {
          id: true,
          numero: true,
          statut: true,
          montantTotalHtCents: true,
          sentAt: true,
          acceptedAt: true,
        },
      })
      .then((ds) =>
        ds.map((d): EvenementActivite => ({
          cle: `devis:${d.id}`,
          type: "argent",
          date: d.sentAt as Date,
          titre:
            d.statut === "refuse" || d.statut === "expire"
              ? `Devis n° ${d.numero}`
              : `Devis envoyé n° ${d.numero}`,
          etat: ETAT_DEVIS[d.statut] ?? "Devis envoyé",
          nuance: "argent",
          lien: null,
          montant: { cents: d.montantTotalHtCents, base: "ht" },
        })),
      ),
  );

  // 4b. Factures de la fiche 360 (déjà lue pour la page).
  const factures = sans(
    lireClient360Cache(clientId).then((c) => {
      if (c === null) return [];
      return c.facturesFormation
        .filter((f) => f.avoirDeId === null && f.emiseAt !== null && f.statut !== "brouillon")
        .map((f): EvenementActivite => {
          const annulee = f.statut === "annulee";
          return {
            cle: `facture:${f.id}`,
            type: "argent",
            date: f.emiseAt as Date,
            titre: annulee ? `Facture n° ${f.numero}` : `Facture envoyée n° ${f.numero}`,
            etat: annulee ? "Facture annulée" : "Facture envoyée",
            nuance: annulee ? "neutre" : "argent",
            lien: null,
            montant: { cents: f.montantHtCents, base: "ht" },
          };
        });
    }),
  );

  const paiements = sans(
    prisma.payment
      .findMany({
        where: {
          status: { in: ["succeeded", "refunded"] },
          paidAt: { not: null },
          factureFormation: { clientId },
        },
        orderBy: { paidAt: "desc" },
        take: PAR_SOURCE,
        select: { id: true, amountCents: true, paidAt: true, mode: true, type: true, status: true },
      })
      .then((ps) =>
        ps.map((p): EvenementActivite => {
          const remboursement = p.type === "refund";
          const rembourse = p.status === "refunded";
          return {
            cle: `paiement:${p.id}`,
            type: "argent",
            date: p.paidAt as Date,
            titre: remboursement ? "Remboursement" : "Paiement reçu",
            etat: rembourse
              ? "Remboursé"
              : (p.mode !== null && MODE_PAIEMENT[p.mode]) ||
                (remboursement ? "Versé" : "Encaissé"),
            nuance: rembourse ? "neutre" : "argent",
            lien: null,
            ...(remboursement ? { mot: "Remboursement" } : {}),
            montant: { cents: Math.abs(p.amountCents), base: "ttc" },
          };
        }),
      ),
  );

  const evenements = assemblerChronologie(
    await Promise.all([fil, taches, notes, devis, factures, paiements]),
  );
  return { evenements, sourcesEnPanne };
}
