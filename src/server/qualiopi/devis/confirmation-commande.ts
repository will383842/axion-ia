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
 * Pièces jointes : le devis signé (clé R2 fournie par l'appelant) et les CGV de la version
 * réellement ACCEPTÉE par le client (`cgvVersion` enregistrée à sa signature), jamais celles en
 * vigueur au moment de la contresignature. Le PDF n'est produit que pour la version en vigueur ;
 * une version antérieure n'est jointe que si son PDF existe déjà sous la clé `documents/cgv/`.
 * Sinon rien n'est joint et le retour le dit (`cgvJointes: false`). La clé R2 est adressée par
 * la version : un objet existant est réutilisé, jamais réécrit.
 *
 * Ne lève pas pour un refus attendu : retourne un résultat typé.
 */

import { CGV_VERSION, CGV_VERSION_LIBELLE } from "@/content/cgv-version";
import { prisma } from "@/lib/prisma";
import { existsInR2, uploadToR2 } from "@/lib/r2-storage";
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
  readonly documentGenereId: string | null;
  readonly lignes: unknown;
  readonly offre: unknown;
  readonly client: { readonly raisonSociale: string; readonly contactEmail: string | null };
}

export interface DependancesConfirmation {
  lireDevis(devisId: string): Promise<DevisConfirmation | null>;
  formulesActives(): Promise<boolean>;
  regimeEtTaux(): Promise<{ regime: ReturnType<typeof regimeTvaDepuisConfig>; taux: number }>;
  /** `cgvVersion` enregistrée à la signature du client (ligne non révoquée), ou `null`. */
  versionCgvAcceptee(documentGenereId: string): Promise<string | null>;
  /** Le PDF des CGV de cette version existe-t-il déjà dans R2 ? */
  cgvExiste(key: string): Promise<boolean>;
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
  | {
      readonly envoye: true;
      readonly garePourValidation: boolean;
      /** Vrai si le PDF des CGV acceptées est en pièce jointe. */
      readonly cgvJointes: boolean;
      /** Version des CGV acceptées par le client, `null` si introuvable. */
      readonly cgvVersionAcceptee: string | null;
    }
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

/** « 2026-10-04 » → « 4 octobre 2026 » ; une version non datée est citée telle quelle. */
function libelleVersionCgv(version: string): string {
  if (version === CGV_VERSION) return CGV_VERSION_LIBELLE;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version);
  if (m === null) return version;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

const dependancesParDefaut: DependancesConfirmation = {
  lireDevis: (id) =>
    prisma.devis.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        documentGenereId: true,
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
  versionCgvAcceptee: async (documentGenereId) => {
    const ligne = await prisma.documentSignature.findFirst({
      where: { documentGenereId, partie: "client", revokedAt: null, cgvVersion: { not: null } },
      orderBy: { signeAt: "desc" },
      select: { cgvVersion: true },
    });
    return ligne?.cgvVersion ?? null;
  },
  cgvExiste: (key) => existsInR2(key),
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

  // CGV de la version ACCEPTÉE par le client. Introuvable → on n'en cite ni n'en joint aucune.
  const versionAcceptee =
    devis.documentGenereId === null
      ? null
      : (await deps.versionCgvAcceptee(devis.documentGenereId))?.trim() || null;
  let cleCgv: string | null = null;
  if (versionAcceptee !== null) {
    const cle = cleCgvAcceptees(versionAcceptee);
    if (await deps.cgvExiste(cle)) {
      cleCgv = cle; // déjà déposée : réutilisée, jamais réécrite
    } else if (versionAcceptee === CGV_VERSION) {
      await deps.deposer(cle, await deps.pdfCgv());
      cleCgv = cle;
    }
    // Version antérieure sans PDF archivé : le texte d'alors n'est pas reconstituable.
  }
  const cgvJointes = cleCgv !== null;

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
      ...(versionAcceptee !== null ? { cgvVersionLabel: libelleVersionCgv(versionAcceptee) } : {}),
      cgvJointes,
    },
    {
      jobId: `devis-commande-confirmation-${devis.id}`,
      attachments: [
        { filename: `${devis.numero}-signe.pdf`, r2Key: demande.pdfDevisSigneR2Key },
        ...(cleCgv !== null && versionAcceptee !== null
          ? [{ filename: `CGV-${versionAcceptee}.pdf`, r2Key: cleCgv }]
          : []),
      ],
      entityType: "Devis",
      entityId: devis.id,
    },
  );
  if (!res.enqueued && res.garePourValidation !== true) {
    return { envoye: false, raison: "file_indisponible" };
  }
  return {
    envoye: true,
    garePourValidation: res.garePourValidation === true,
    cgvJointes,
    cgvVersionAcceptee: versionAcceptee,
  };
}
