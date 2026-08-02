/**
 * Qualiopi — CONTEXTE DE DÉCISION d'une relance (lecture, hub facturation).
 *
 * ## À quoi ça sert
 *
 * Avant d'envoyer une relance, l'admin doit voir ce qui rend la décision juste
 * ou fautive. La crainte explicite du propriétaire : relancer un client qui a
 * DÉJÀ payé, faute d'avoir pointé sa banque. Un règlement reçu et non saisi
 * dans la console est indiscernable d'un impayé — la base dit « rien reçu »
 * dans les deux cas.
 *
 * Ce module réunit donc, pour chaque relance à traiter :
 *   - le reste dû NET (jamais le TTC total : l'acompte a pu être versé) ;
 *   - l'échéance et l'ancienneté du retard ;
 *   - l'historique des relances déjà envoyées sur cette facture ;
 * et, globalement, la FRAÎCHEUR DU POINTAGE BANCAIRE — date du dernier
 * encaissement enregistré, tous clients confondus.
 *
 * Un pointage vieux de plus d'une semaine ne prouve pas qu'un règlement manque ;
 * il prouve qu'on n'en sait rien. C'est cette incertitude que l'écran doit
 * montrer, pas une certitude qu'on n'a pas.
 *
 * Stub-safe : chaque lecture est enveloppée d'un try/catch et retombe sur une
 * valeur vide. Aucun de ces chiffres ne doit pouvoir faire tomber la page.
 */

import { prisma } from "@/lib/prisma";
import { resteDuNetCents } from "@/server/qualiopi/crm/clients";
import { libellePalier } from "@/server/qualiopi/financements/relance-paliers";

/** Seuil au-delà duquel le pointage bancaire est jugé trop ancien pour relancer. */
export const POINTAGE_BANCAIRE_FRAIS_JOURS = 7;

export interface FraicheurPointageBancaire {
  /** Date du dernier encaissement `succeeded` enregistré, tous clients confondus. */
  dernierEncaissementAt: Date | null;
  /** Jours écoulés depuis, ou `null` si aucun encaissement n'a jamais été saisi. */
  joursDepuis: number | null;
  /** Vrai si le pointage est trop ancien (ou inexistant) pour relancer sereinement. */
  avertissement: boolean;
}

/**
 * Fraîcheur du pointage bancaire.
 *
 * ⚠️ « Aucun encaissement jamais enregistré » est traité comme un AVERTISSEMENT,
 * pas comme un état neutre : c'est le cas où l'on en sait le moins. Rendre
 * `avertissement: false` y serait rassurant à tort.
 */
export async function getFraicheurPointageBancaire(
  now: Date = new Date(),
): Promise<FraicheurPointageBancaire> {
  try {
    const dernier = await prisma.payment.findFirst({
      where: { status: "succeeded", paidAt: { not: null } },
      orderBy: { paidAt: "desc" },
      select: { paidAt: true },
    });
    const dernierEncaissementAt = dernier?.paidAt ?? null;
    if (dernierEncaissementAt === null) {
      return { dernierEncaissementAt: null, joursDepuis: null, avertissement: true };
    }
    const joursDepuis = Math.max(
      0,
      Math.floor((now.getTime() - dernierEncaissementAt.getTime()) / 86_400_000),
    );
    return {
      dernierEncaissementAt,
      joursDepuis,
      avertissement: joursDepuis > POINTAGE_BANCAIRE_FRAIS_JOURS,
    };
  } catch {
    // Stub-safe : au build (Proxy Prisma) ou sur erreur DB, on avertit plutôt
    // que de laisser croire à un pointage frais.
    return { dernierEncaissementAt: null, joursDepuis: null, avertissement: true };
  }
}

/** Une relance déjà envoyée sur une facture (historique affiché à l'admin). */
export interface RelanceEnvoyee {
  palier: string;
  palierLibelle: string;
  envoyeeAt: Date | null;
}

/** Détail de décision d'UNE relance proposée (alimente la boîte de dialogue). */
export interface DetailRelance {
  relanceId: string;
  factureNumero: string;
  clientNom: string;
  /** Reste dû NET en CENTIMES — jamais le TTC total. */
  resteDuCents: number;
  echeanceAt: Date | null;
  joursRetard: number;
  palier: string;
  palierLibelle: string;
  /** Destinataire retenu (email de contact du client), ou null si absent. */
  destinataire: string | null;
  /** Les pénalités sont-elles activées pour ce client ? Faux par défaut. */
  penalitesActives: boolean;
  /** Relances DÉJÀ envoyées sur cette facture, de la plus ancienne à la plus récente. */
  historique: RelanceEnvoyee[];
}

/**
 * Détails de décision pour un lot de relances proposées.
 *
 * Une seule requête pour les factures, une seule pour l'historique : la boîte de
 * dialogue s'ouvre sans aller-retour serveur, et la page ne paie pas une requête
 * par ligne affichée.
 *
 * Les relances dont la facture a disparu (ou qui visent un document booking)
 * sont simplement absentes du résultat — l'appelant retombe alors sur l'envoi
 * sans détail plutôt que d'afficher des zéros trompeurs.
 */
export async function getDetailsRelances(
  relanceIds: readonly string[],
  now: Date = new Date(),
): Promise<Map<string, DetailRelance>> {
  const out = new Map<string, DetailRelance>();
  if (relanceIds.length === 0) return out;

  try {
    const relances = await prisma.relanceProposee.findMany({
      where: { id: { in: [...relanceIds] }, factureFormationId: { not: null } },
      select: {
        id: true,
        palier: true,
        factureFormationId: true,
        factureFormation: {
          select: {
            id: true,
            numero: true,
            statut: true,
            avoirDeId: true,
            montantHtCents: true,
            montantTtcCents: true,
            echeanceAt: true,
            destinataireNom: true,
            client: {
              select: {
                raisonSociale: true,
                contactEmail: true,
                penalitesRetardActives: true,
              },
            },
            payments: { select: { amountCents: true, status: true } },
            avoirs: { select: { montantHtCents: true, montantTtcCents: true, statut: true } },
          },
        },
      },
    });

    const factureIds = relances
      .map((r) => r.factureFormationId)
      .filter((id): id is string => id !== null);

    // Historique : uniquement les relances RÉELLEMENT envoyées. Une proposition
    // ignorée ou reportée n'a rien appris au client, l'afficher comme un
    // antécédent laisserait croire qu'il a déjà été sollicité.
    const envoyees =
      factureIds.length > 0
        ? await prisma.relanceProposee.findMany({
            where: { factureFormationId: { in: factureIds }, statut: "envoyee" },
            orderBy: { traiteeAt: "asc" },
            select: { factureFormationId: true, palier: true, traiteeAt: true },
          })
        : [];

    const historiqueParFacture = new Map<string, RelanceEnvoyee[]>();
    for (const e of envoyees) {
      if (e.factureFormationId === null) continue;
      const liste = historiqueParFacture.get(e.factureFormationId) ?? [];
      liste.push({
        palier: e.palier,
        palierLibelle: libellePalier(e.palier),
        envoyeeAt: e.traiteeAt,
      });
      historiqueParFacture.set(e.factureFormationId, liste);
    }

    for (const r of relances) {
      const f = r.factureFormation;
      if (f === null) continue;
      const resteDuCents = resteDuNetCents({
        statut: f.statut,
        avoirDeId: f.avoirDeId,
        montantHtCents: f.montantHtCents,
        montantTtcCents: f.montantTtcCents,
        payments: f.payments,
        avoirs: f.avoirs,
      });
      const joursRetard =
        f.echeanceAt !== null
          ? Math.max(0, Math.floor((now.getTime() - f.echeanceAt.getTime()) / 86_400_000))
          : 0;
      out.set(r.id, {
        relanceId: r.id,
        factureNumero: f.numero,
        clientNom: f.client?.raisonSociale ?? f.destinataireNom,
        resteDuCents,
        echeanceAt: f.echeanceAt,
        joursRetard,
        palier: r.palier,
        palierLibelle: libellePalier(r.palier),
        destinataire: f.client?.contactEmail ?? null,
        penalitesActives: f.client?.penalitesRetardActives ?? false,
        historique: historiqueParFacture.get(f.id) ?? [],
      });
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * Relances déjà envoyées sur UNE facture (fiche facture).
 * Stub-safe → [] au build ou sur erreur.
 */
export async function getHistoriqueRelancesFacture(
  factureFormationId: string,
): Promise<RelanceEnvoyee[]> {
  try {
    const rows = await prisma.relanceProposee.findMany({
      where: { factureFormationId, statut: "envoyee" },
      orderBy: { traiteeAt: "asc" },
      select: { palier: true, traiteeAt: true },
    });
    return rows.map((r) => ({
      palier: r.palier,
      palierLibelle: libellePalier(r.palier),
      envoyeeAt: r.traiteeAt,
    }));
  } catch {
    return [];
  }
}
