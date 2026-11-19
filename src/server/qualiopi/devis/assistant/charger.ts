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
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { listClients } from "@/server/qualiopi/crm/clients";
import { libelleSalutationEmails } from "@/server/qualiopi/crm/libelle-salutation";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import { listOffres } from "@/server/qualiopi/offres/offres";
import {
  regimeTvaDepuisConfig,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";
import { devisVersPayload, type DevisPourAssistant } from "./conversion";
import { MODELES_DEVIS, appliquerModele, type IdModeleDevis } from "./modeles";
import { payloadVersEtat } from "@/components/admin/qualiopi/assistant-devis/vers-payload";
import { lirePayload, payloadVide, type PayloadAssistantV1 } from "./payload";

export interface ClientOption {
  id: string;
  numero: string;
  raisonSociale: string;
  type: "entreprise" | "particulier";
  adresse: string | null;
  contactNom: string | null;
  /** = `contactEmail` de la fiche. */
  email: string | null;
  /** Ce que le gabarit d'e-mail écrira en tête (`libelleSalutationEmails`). */
  salutation: string;
  /** Fiche du banc d'essai (relation `testInterne` non nulle). */
  ficheEssai: boolean;
}
/** Textes de la bibliothèque proposés à l'étape des formules (aucune phrase écrite ici). */
export interface BibliothequeAssistant {
  avantages: { A: string[]; B: string[] };
  aSavoir: { A: string[]; B: string[] };
  delais: string;
  garantie: string;
  plafond: string;
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
  bibliotheque: BibliothequeAssistant;
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
  /** Libellé du lien de la carte de message (défaut côté page : « Ouvrir la fiche du devis »). */
  libelleLien?: string;
}

/** Statut d'un brouillon mis de côté : jamais rouvert (la ligne reste, aucune suppression). */
export const STATUT_BROUILLON_A_L_ECART = "a_l_ecart";

/**
 * Bibliothèque : textes non archivés et déjà validés (`aValider` faux). achat → A, abonnement → B ;
 * avantage → avantages, inconvénient → à savoir. Délais, garantie et plafond : la bibliothèque ne
 * porte aucun repère qui les distingue (la formule `commun` mêle prérequis et clauses, sans
 * rubrique) ; on ne devine pas, et aucune phrase n'est écrite ici : chaîne vide, l'écran
 * propose alors sa saisie libre.
 */
async function chargerBibliotheque(): Promise<BibliothequeAssistant> {
  const b: BibliothequeAssistant = {
    avantages: { A: [], B: [] },
    aSavoir: { A: [], B: [] },
    delais: "",
    garantie: "",
    plafond: "",
  };
  const lignes = await prisma.devisTexteBibliotheque.findMany({
    where: { archiveAt: null, aValider: false },
    orderBy: [{ formule: "asc" }, { nature: "asc" }, { ordre: "asc" }],
    select: { formule: true, nature: true, texte: true },
  });
  for (const l of lignes) {
    const cle = l.formule === "achat" ? "A" : l.formule === "abonnement" ? "B" : null;
    if (cle === null) continue;
    if (l.nature === "avantage") b.avantages[cle].push(l.texte);
    else if (l.nature === "inconvenient") b.aSavoir[cle].push(l.texte);
  }
  return b;
}

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

  const essais = await prisma.client
    .findMany({ where: { testInterne: { isNot: null } }, select: { id: true } })
    .then((l) => new Set(l.map((x) => x.id)))
    .catch(() => new Set<string>());
  const clients: ClientOption[] = clientsBruts.map((c) => ({
    id: c.id,
    numero: c.numero,
    raisonSociale: c.raisonSociale,
    type: c.type,
    adresse: c.adresse ?? null,
    contactNom: c.contactNom ?? null,
    email: c.contactEmail ?? null,
    salutation: libelleSalutationEmails(c),
    ficheEssai: essais.has(c.id),
  }));
  const bibliotheque = await chargerBibliotheque();
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
    if (!devis)
      return {
        redirection: "/qualiopi/devis",
        message: "Devis introuvable.",
        libelleLien: "Retour à la liste des devis",
      };
    // Un devis envoyé, accepté… n'est jamais modifié : on renvoie à sa fiche.
    if (devis.statut !== "brouillon") return { redirection: `/qualiopi/devis/${devis.id}` };
    const fiche = `/qualiopi/devis/${devis.id}`;
    const versFiche = (message: string): RedirectionAssistant => ({
      redirection: fiche,
      message,
      libelleLien: "Ouvrir la fiche du devis",
    });
    // L'assistant ne rouvre QUE les devis qu'il a créés (ligne liée posée par `lier()` du
    // finaliseur), sans filtre de compte : le refus d'un autre compte se dit, il ne se cache pas.
    const lie = await prisma.devisAssistantBrouillon.findUnique({
      where: { devisId: devis.id },
      select: {
        id: true,
        revision: true,
        payload: true,
        statut: true,
        createdByAdminId: true,
        clientId: true,
      },
    });
    // Refus APRÈS l'existence du lien : jamais vers la fiche (son bouton renvoie à l'assistant :
    // cul-de-sac). Classique → écran de correction ; à formules → l'éditeur d'avant. Formules
    // ÉTEINTES : l'éditeur d'avant n'existe pas (/modifier renverrait ici) → la fiche, qui
    // n'affiche alors aucun bouton de modification : fin propre, pas de boucle.
    const refus = (message: string): RedirectionAssistant =>
      devis.offre === null
        ? { redirection: `${fiche}/corriger`, message, libelleLien: "Corriger le brouillon" }
        : !formulesOn
          ? versFiche(message)
          : {
            redirection: `${fiche}/modifier?sans-assistant=1`,
            message,
            libelleLien: "Modifier sans l'assistant",
          };
    const sansAssistant = "Ce devis a été préparé sans l'assistant : ";
    if (!lie) {
      // JAMAIS vers /modifier (il renvoie ici : boucle).
      if (devis.offre === null)
        return {
          redirection: `${fiche}/corriger`,
          message: `${sansAssistant}corrigez-le depuis son écran de correction.`,
          libelleLien: "Corriger le brouillon",
        };
      return versFiche(`${sansAssistant}modifiez-le depuis sa fiche.`);
    }
    if (lie.statut === STATUT_BROUILLON_A_L_ECART)
      return refus("Le brouillon d'assistant de ce devis a été mis à l'écart.");
    if (lie.createdByAdminId !== i.adminId)
      return refus(
        "Ce devis a été préparé dans l'assistant par un autre compte : seul ce compte peut le rouvrir.",
      );
    const illisible = "Le brouillon d'assistant de ce devis est illisible ; rien n'a été modifié.";
    const lu = lirePayload(lie.payload);
    if (!lu.ok) return refus(illisible);
    const etat = payloadVersEtat(lu.payload);
    if (etat.source !== "ecran") return refus(illisible);
    if (
      lu.payload.clientId !== devis.clientId ||
      etat.etat.clientId !== devis.clientId ||
      (lie.clientId !== null && lie.clientId !== devis.clientId)
    )
      return refus("Le client du brouillon ne correspond pas à celui du devis.");
    // Brouillon périmé : le devis a bougé hors de l'assistant depuis la dernière synchronisation
    // (même comparaison que le finaliseur). Lecture seule, rien n'est effacé.
    const majLe = lu.payload.sync.devisMajLe;
    if (majLe !== null && new Date(majLe).getTime() !== devis.updatedAt.getTime())
      return refus(
        `Ce devis a été modifié hors de l'assistant depuis son dernier enregistrement ici : ${
          devis.offre === null
            ? "corrigez-le depuis son écran de correction."
            : formulesOn
              ? "modifiez-le sans l'assistant."
              : "ouvrez sa fiche."
        }`,
      );
    // Barrière seulement : une offre illisible ou une TVA non standard restent refusées ; le
    // contenu rouvert est TOUJOURS celui du brouillon, jamais une réhydratation du devis.
    const ouverture = devisVersPayload(
      devis as unknown as DevisPourAssistant,
      tauxStandard,
      isQualiopiCertificationObtenue(),
    );
    if ("refus" in ouverture && ouverture.motif !== "opco") return refus(ouverture.refus);
    payload = lu.payload;
    brouillon = { id: lie.id, revision: lie.revision };
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
      // Brouillon LIÉ à un devis : jamais rouvert par ce chemin (un brouillon illisible s'ouvrirait
      // vide et ferait un doublon). `?devis=` applique toutes les gardes et ne renvoie jamais ici.
      const lieDevis = await prisma.devis.findUnique({
        where: { id: b.devisId },
        select: { id: true, statut: true },
      });
      if (!lieDevis)
        return {
          redirection: "/qualiopi/devis",
          message: "Devis introuvable.",
          libelleLien: "Retour à la liste des devis",
        };
      if (lieDevis.statut === "brouillon")
        return { redirection: `/qualiopi/devis/new?devis=${lieDevis.id}` };
      return {
        redirection: `/qualiopi/devis/${lieDevis.id}`,
        message:
          "Ce brouillon est lié à un devis qui n'est plus un brouillon : il ne se rouvre pas.",
        libelleLien: "Ouvrir la fiche du devis",
      };
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
    bibliotheque,
    formulesActives: formulesOn,
    regimeTva,
    tauxStandard,
    aide: aide ?? null,
    rencontreId: rencontreId ?? payload.rencontreId,
  };
}
