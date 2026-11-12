/**
 * Chargeur de la page de l'assistant de devis (fiche S12). LECTURE SEULE : aucune écriture
 * pendant le rendu (les liens Next sont préchargés). Un devis brouillon rouvert est hydraté
 * EN MÉMOIRE ; le brouillon d'assistant naît à la première sauvegarde (S06).
 *
 * Reprend la logique de `qualiopi/devis/new/page.tsx` : clients, offres actives, textes par
 * défaut de la bibliothèque, aide du projet, `clientId` retenu seulement s'il existe.
 * `redirection` est un chemin RELATIF à `/<locale>/<adminPrefix>` (la page y ajoute son préfixe).
 */
import { prisma } from "@/lib/prisma";
import { isUuid } from "@/lib/is-uuid";
import { chargerAideDuProjet, type AideDuProjet } from "@/features/dossier-client/aide-du-projet";
import type { TexteCopie } from "@/components/admin/qualiopi/devis-formules/saisie";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { listClients } from "@/server/qualiopi/crm/clients";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import { listOffres } from "@/server/qualiopi/offres/offres";
import {
  regimeTvaDepuisConfig,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";
import { devisVersPayload, type DevisPourAssistant } from "./conversion";
import { MODELES_DEVIS, appliquerModele, type IdModeleDevis } from "./modeles";
import { lirePayload, payloadVide, type PayloadAssistantV1 } from "./payload";

export interface ClientOption {
  id: string;
  numero: string;
  raisonSociale: string;
}
export interface OffreOption {
  tierId: string | null;
  code: string;
  titreFr: string;
  prixLabelFr: string;
  prixHtCents: number | null;
  noteDevisFr: string | null;
}
export type AideProjet = NonNullable<AideDuProjet["aide"]>;

export interface ContexteAssistant {
  brouillon: { id: string; revision: number } | null;
  payloadInitial: PayloadAssistantV1;
  clients: ClientOption[];
  offres: OffreOption[];
  textesParDefaut: TexteCopie[];
  formulesActives: boolean;
  regimeTva: RegimeTva;
  tauxStandard: number;
  aide: AideProjet | null;
  rencontreId: string | null;
}

export interface EntreeChargeur {
  adminId: string;
  /** Rôle de l'admin : la garde A2 de l'aide du projet en a besoin. */
  role?: string | null;
  brouillonId?: string;
  devisId?: string;
  clientId?: string;
  projetId?: string;
  rencontreId?: string;
  venteBrouillonId?: string;
  modele?: string;
}

/** Redirection (chemin relatif à `/<locale>/<adminPrefix>`), avec le motif quand un refus la cause. */
export interface RedirectionAssistant {
  redirection: string;
  message?: string;
}

/** Statut d'un brouillon mis de côté : jamais rouvert (la ligne reste, aucune suppression). */
export const STATUT_BROUILLON_A_L_ECART = "a_l_ecart";

export async function chargerAssistantDevis(
  i: EntreeChargeur,
): Promise<RedirectionAssistant | ContexteAssistant> {
  const [clientsBruts, offresBrutes, formulesOn, regimeBrut, tauxBrut] = await Promise.all([
    listClients(),
    listOffres({ actifOnly: true }),
    formulesActives(),
    getQualiopiConfig("regime_tva"),
    getQualiopiConfig("taux_tva_standard_percent"),
  ]);
  const regimeTva = regimeTvaDepuisConfig(regimeBrut);
  const tauxStandard = tauxBrut || TAUX_TVA_STANDARD;

  const clients: ClientOption[] = clientsBruts.map((c) => ({
    id: c.id,
    numero: c.numero,
    raisonSociale: c.raisonSociale,
  }));
  // Montants en CENTIMES déjà résolus côté serveur (jamais `pricing.ts` dans le bundle admin).
  const offres: OffreOption[] = offresBrutes.map((o) => ({
    tierId: o.offre.tierId,
    code: o.offre.code,
    titreFr: o.offre.titreFr,
    prixLabelFr: o.prixLabelFr,
    prixHtCents: o.prixHtEur === null ? null : Math.round(o.prixHtEur * 100),
    noteDevisFr: o.noteDevisFr,
  }));
  const textesParDefaut: TexteCopie[] = formulesOn
    ? (
        await prisma.devisTexteBibliotheque.findMany({
          where: { archiveAt: null, actifParDefaut: true },
          orderBy: [{ formule: "asc" }, { nature: "asc" }, { ordre: "asc" }],
          select: { id: true, version: true, texte: true },
        })
      ).map((t) => ({
        bibliothequeId: t.id,
        version: String(t.version),
        texte: t.texte,
        actif: true,
      }))
    : [];

  let brouillon: ContexteAssistant["brouillon"] = null;
  let payload: PayloadAssistantV1 | null = null;

  if (i.devisId && isUuid(i.devisId)) {
    const devis = await prisma.devis.findUnique({
      where: { id: i.devisId },
      select: {
        id: true,
        statut: true,
        clientId: true,
        refClient: true,
        activite: true,
        dateValidite: true,
        updatedAt: true,
        offre: true,
        lignes: true,
        financementSuggere: true,
        montantOpcoEstimeCents: true,
      },
    });
    if (devis) {
      // Un devis envoyé, accepté… n'est jamais modifié : on renvoie à sa fiche.
      if (devis.statut !== "brouillon") return { redirection: `/qualiopi/devis/${devis.id}` };
      const lie = await prisma.devisAssistantBrouillon.findFirst({
        where: {
          devisId: devis.id,
          createdByAdminId: i.adminId,
          statut: { not: STATUT_BROUILLON_A_L_ECART },
        },
        select: { id: true, revision: true, payload: true },
      });
      // Un brouillon déjà lié au devis porte SON contenu (récit, textes, champs hors moteur) :
      // on le relit au lieu de réhydrater depuis le devis, sous peine de le perdre.
      const lu = lie ? lirePayload(lie.payload) : null;
      const ouverture = devisVersPayload(devis as unknown as DevisPourAssistant, tauxStandard);
      if ("refus" in ouverture) {
        // Un devis créé par l'assistant (brouillon lié lisible) se rouvre même s'il est
        // « classique OPCO » — et SEULEMENT pour ce motif : une offre illisible ou une ligne à
        // TVA non standard restent refusées. Sans brouillon lisible, on renvoie à sa fiche.
        if (ouverture.motif !== "opco" || !lu || !lu.ok)
          return { redirection: `/qualiopi/devis/${devis.id}`, message: ouverture.refus };
      } else {
        payload = ouverture.payload;
      }
      if (lie) {
        brouillon = { id: lie.id, revision: lie.revision };
        if (lu && lu.ok) payload = lu.payload;
      }
    }
  }

  if (!payload && i.brouillonId && isUuid(i.brouillonId)) {
    // Brouillon d'un autre admin : ignoré (comme s'il n'existait pas).
    const b = await prisma.devisAssistantBrouillon.findFirst({
      where: { id: i.brouillonId, createdByAdminId: i.adminId },
      select: { id: true, revision: true, payload: true, statut: true, devisId: true },
    });
    // Mis à l'écart : ne se rouvre pas, on ouvre un assistant vide.
    if (b?.statut === STATUT_BROUILLON_A_L_ECART) return { redirection: "/qualiopi/devis/new" };
    if (b?.devisId) {
      // Lié à un devis déjà envoyé (ou plus brouillon) : on renvoie à la fiche, jamais d'édition.
      const lieDevis = await prisma.devis.findUnique({
        where: { id: b.devisId },
        select: { id: true, statut: true },
      });
      if (lieDevis && lieDevis.statut !== "brouillon")
        return { redirection: `/qualiopi/devis/${lieDevis.id}` };
    }
    if (b) {
      const lu = lirePayload(b.payload);
      if (lu.ok) {
        payload = lu.payload;
        brouillon = { id: b.id, revision: b.revision };
      }
    }
  }

  if (!payload) {
    // Ouvert VIDE par défaut (décision du 29/09).
    payload = payloadVide(tauxStandard);
    const modele = MODELES_DEVIS.find((m) => m.id === i.modele)?.id;
    if (modele) payload = appliquerModele(payload, modele as IdModeleDevis);
    // `clientId` retenu seulement s'il correspond à un client CRM réel.
    if (clients.some((c) => c.id === i.clientId)) payload.clientId = i.clientId as string;
    if (i.venteBrouillonId && isUuid(i.venteBrouillonId)) {
      const v = await prisma.venteBrouillon.findFirst({
        where: { id: i.venteBrouillonId, createdByAdminId: i.adminId },
        select: { id: true },
      });
      if (v) payload.venteBrouillonId = v.id;
    }
  }

  const rencontreId = isUuid(i.rencontreId) ? (i.rencontreId as string) : null;
  if (rencontreId && !brouillon) payload.rencontreId = payload.rencontreId ?? rencontreId;

  const clientRetenu =
    payload.clientId && clients.some((c) => c.id === payload.clientId)
      ? payload.clientId
      : undefined;
  const { projetId, aide } = await chargerAideDuProjet({
    role: i.role,
    clientId: clientRetenu,
    projetId: i.projetId,
  });
  if (projetId !== null && !brouillon) payload.projetId = projetId;

  return {
    brouillon,
    payloadInitial: payload,
    clients,
    offres,
    textesParDefaut,
    formulesActives: formulesOn,
    regimeTva,
    tauxStandard,
    aide: aide ?? null,
    rencontreId: rencontreId ?? payload.rencontreId,
  };
}
