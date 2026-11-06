/**
 * Confirmation de commande au client (CGV art. 5.2 et 6.2).
 *
 * ⛔ SEULE porte d'entrée : l'action EXPLICITE de contresignature d'Axion-IA (lot 4, à brancher).
 * Jamais un cron, jamais un webhook : le contrat est formé à la contresignature (art. 6.2), pas à
 * la signature du client. `declencheur` est un littéral exprès : un appelant qui voudrait
 * l'invoquer d'ailleurs doit mentir dans son propre code, ce que la revue voit.
 *
 * INERTE si `qualiopi.devis_formules.actif` est éteint ET que le devis porte une offre à formules
 * (aucun e-mail ne part pour un devis à formules tant que le lot est éteint). Un devis classique
 * (sans offre) n'est pas concerné par l'interrupteur.
 *
 * Pièces jointes : le devis signé (clé R2 fournie par l'appelant) et les CGV acceptées (PDF
 * rendu depuis la version en vigueur, déposé sous une clé déterministe `documents/cgv/`).
 *
 * Ne lève pas pour un refus attendu : retourne un résultat typé.
 */

import { CGV_VERSION, CGV_VERSION_LIBELLE } from "@/content/cgv-version";
import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/r2-storage";
import { enqueueEmail } from "@/server/queue/queues";
import { rendreCgvPdf } from "@/server/cgv-pdf";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import {
  computeTotauxFacture,
  regimeTvaDepuisConfig,
  TAUX_TVA_STANDARD,
} from "@/server/qualiopi/legal/tva";
import type { LigneFacturable, TotauxFacture } from "@/server/qualiopi/legal/tva";
import { offreDevisV1, type Formule } from "./offre-devis";
import { totauxFormule } from "./offre-calculs";
import { formulesActives } from "./interrupteur-formules";

export interface DevisConfirmation {
  readonly id: string;
  readonly numero: string;
  readonly lignes: unknown;
  readonly offre: unknown;
  readonly client: { readonly raisonSociale: string; readonly contactEmail: string | null };
}

export interface DependancesConfirmation {
  lireDevis(devisId: string): Promise<DevisConfirmation | null>;
  formulesActives(): Promise<boolean>;
  regimeEtTaux(): Promise<{ regime: ReturnType<typeof regimeTvaDepuisConfig>; taux: number }>;
  pdfCgv(): Promise<Buffer>;
  deposer(key: string, buffer: Buffer): Promise<void>;
  enfiler: typeof enqueueEmail;
}

export interface DemandeConfirmationCommande {
  /** Littéral : seule l'action explicite de contresignature d'Axion-IA déclenche cet envoi. */
  readonly declencheur: "contresignature_axion_explicite";
  readonly devisId: string;
  /** Clé R2 du PDF du devis SIGNÉ. */
  readonly pdfDevisSigneR2Key: string;
  /** Devis à formules : choix du client (formule + automatisations retenues). */
  readonly choix?: {
    readonly formule: Formule;
    readonly automatisationsRetenues?: readonly string[];
  };
}

export type ResultatConfirmation =
  | { readonly envoye: true; readonly garePourValidation: boolean }
  | {
      readonly envoye: false;
      readonly raison:
        | "devis_introuvable"
        | "formules_eteintes"
        | "pas_d_adresse"
        | "choix_requis"
        | "file_indisponible";
    };

const LIBELLE_FORMULE: Record<Formule, string> = { achat: "Achat", abonnement: "Abonnement" };

const eur = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

/** Clé R2 déterministe : une version de CGV = un objet, réécrit à l'identique. */
export const cleCgvAcceptees = (version: string = CGV_VERSION): string =>
  `documents/cgv/CGV-${version}.pdf`;

const dependancesParDefaut: DependancesConfirmation = {
  lireDevis: (id) =>
    prisma.devis.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        lignes: true,
        offre: true,
        client: { select: { raisonSociale: true, contactEmail: true } },
      },
    }),
  formulesActives: () => formulesActives(),
  regimeEtTaux: async () => ({
    regime: regimeTvaDepuisConfig(await getQualiopiConfig("regime_tva")),
    taux: (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD,
  }),
  pdfCgv: () => rendreCgvPdf(),
  deposer: async (key, buffer) => {
    await uploadToR2(key, buffer, "application/pdf");
  },
  enfiler: enqueueEmail,
};

export async function envoyerConfirmationCommande(
  demande: DemandeConfirmationCommande,
  deps: DependancesConfirmation = dependancesParDefaut,
): Promise<ResultatConfirmation> {
  const devis = await deps.lireDevis(demande.devisId);
  if (devis === null) return { envoye: false, raison: "devis_introuvable" };

  const aOffre = devis.offre !== null && devis.offre !== undefined;
  if (aOffre && !(await deps.formulesActives())) {
    return { envoye: false, raison: "formules_eteintes" };
  }
  const email = devis.client.contactEmail?.trim() ?? "";
  if (email === "") return { envoye: false, raison: "pas_d_adresse" };

  let totaux: TotauxFacture;
  let formuleRetenue: string | undefined;
  if (aOffre) {
    if (demande.choix === undefined) return { envoye: false, raison: "choix_requis" };
    const offre = offreDevisV1.parse(devis.offre);
    totaux = totauxFormule(
      offre,
      demande.choix.formule,
      demande.choix.automatisationsRetenues ?? [],
    );
    formuleRetenue = LIBELLE_FORMULE[demande.choix.formule];
  } else {
    const { regime, taux } = await deps.regimeEtTaux();
    const lignes = (Array.isArray(devis.lignes) ? devis.lignes : []) as LigneFacturable[];
    totaux = computeTotauxFacture(lignes, regime, taux);
  }

  const cleCgv = cleCgvAcceptees();
  await deps.deposer(cleCgv, await deps.pdfCgv());

  const res = await deps.enfiler(
    "devis-commande-confirmation",
    email,
    "fr",
    {
      clientNom: devis.client.raisonSociale,
      numero: devis.numero,
      ...(formuleRetenue !== undefined ? { formuleRetenue } : {}),
      montantHtLabel: eur(totaux.totalHtCents),
      montantTvaLabel: eur(totaux.totalTvaCents),
      montantTtcLabel: eur(totaux.totalTtcCents),
      cgvVersionLabel: CGV_VERSION_LIBELLE,
    },
    {
      jobId: `devis-commande-confirmation-${devis.id}`,
      attachments: [
        { filename: `${devis.numero}-signe.pdf`, r2Key: demande.pdfDevisSigneR2Key },
        { filename: `CGV-${CGV_VERSION}.pdf`, r2Key: cleCgv },
      ],
      entityType: "Devis",
      entityId: devis.id,
    },
  );
  if (!res.enqueued && res.garePourValidation !== true) {
    return { envoye: false, raison: "file_indisponible" };
  }
  return { envoye: true, garePourValidation: res.garePourValidation === true };
}
