/**
 * Confirmation de commande au client (CGV art. 5.2 et 6.2).
 *
 * ⛔ SEULE porte d'entrée : l'action EXPLICITE de contresignature d'Axion-IA, branchée dans
 * `apres-signature.ts` (devis à formules) et dans la reprise manuelle de l'acceptation.
 * Jamais un cron, jamais un webhook : le contrat est formé à la contresignature (art. 6.2), pas à
 * la signature du client. `declencheur` est un littéral exprès : un appelant qui voudrait
 * l'invoquer d'ailleurs doit mentir dans son propre code, ce que la revue voit.
 *
 * INERTE si `qualiopi.devis_formules.actif` est éteint ET que le devis porte une offre à formules
 * (aucun e-mail ne part pour un devis à formules tant que le lot est éteint). Un devis classique
 * (sans offre) n'est pas concerné par l'interrupteur.
 *
 * 🔴 L'e-mail est TOUJOURS garé dans la corbeille « à valider » (`exigerValidation: true`) :
 * jamais d'envoi automatique au client, quel que soit le mode du client.
 *
 * Le choix du client se lit sur `devis.choixRetenu` (copie vérifiée du choix scellé, écrite à
 * l'acceptation), pas sur l'appelant. Le devis doit être accepté, et l'exemplaire signé doit
 * exister (`documentGenere.exemplaireSigneKey`) : pas de confirmation sans pièce.
 * Anti-rejeu : un `jobId` déjà gardé en corbeille ou déjà journalisé refuse l'envoi ; une base
 * muette refuse aussi (`etat_inconnu`) plutôt que de risquer un doublon.
 *
 * Champs de payload ajoutés (`automatisationsRetenues`, `recurrent`) : FACULTATIFS, l'ancien
 * worker rend le nouveau payload.
 *
 * Pièces jointes : le devis signé (clé R2 de l'exemplaire signé) et les CGV de la version
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
import { jobIdDejaGare } from "@/server/email/outbox-service";
import { rendreCgvPdf } from "@/server/cgv-pdf";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import {
  computeTotauxFacture,
  regimeTvaDepuisConfig,
  TAUX_TVA_STANDARD,
} from "@/server/qualiopi/legal/tva";
import type { LigneFacturable, TotauxFacture } from "@/server/qualiopi/legal/tva";
import { offreDevisV1, type Formule } from "./offre-devis";
import { totauxFormule, type ChoixCanonique } from "./offre-calculs";
import { recapitulerChoix } from "./choix-affichage";
import { formulesActives } from "./interrupteur-formules";

export interface DevisConfirmation {
  readonly id: string;
  readonly numero: string;
  readonly documentGenereId: string | null;
  readonly lignes: unknown;
  readonly offre: unknown;
  readonly statut: string;
  readonly clientId: string;
  readonly formuleRetenue: string | null;
  /** Copie vérifiée du choix scellé, écrite à l'acceptation. */
  readonly choixRetenu: unknown;
  /** Clé R2 de l'exemplaire signé (`documentGenere.exemplaireSigneKey`), `null` si absent. */
  readonly exemplaireSigneKey: string | null;
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
  /** `true` : déjà gardé en corbeille ou déjà journalisé. `null` : base muette, état inconnu. */
  dejaEnvoyee(jobId: string): Promise<boolean | null>;
  enfiler: typeof enqueueEmail;
  /**
   * Exécute `corps` sous un verrou exclusif propre au devis (défaut : verrou consultatif
   * Postgres tenu pendant la transaction). Le contrôle `dejaEnvoyee` ET la mise en corbeille
   * doivent s'y trouver ensemble : sinon deux appels simultanés (deux clics, deux onglets,
   * contresignature concurrente) passent tous deux le contrôle avant que l'un ait posé sa ligne.
   */
  sousVerrou<T>(devisId: string, corps: () => Promise<T>): Promise<T>;
}

export interface DemandeConfirmationCommande {
  /** Littéral : seule l'action explicite de contresignature d'Axion-IA déclenche cet envoi. */
  readonly declencheur: "contresignature_axion_explicite";
  readonly devisId: string;
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
        | "non_accepte"
        | "exemplaire_absent"
        | "deja_envoyee"
        | "etat_inconnu"
        | "file_indisponible";
    };

const STATUTS_CONFIRMABLES: readonly string[] = ["accepte", "transforme_convention"];

const LIBELLE_FORMULE: Record<Formule, string> = { achat: "Achat", abonnement: "Abonnement" };

const eur = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

/** Clé R2 déterministe : une version de CGV = un objet (même clé par version : un renvoi remplace l'objet par un contenu identique, jamais par une autre version). */
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
  lireDevis: async (id) => {
    const d = await prisma.devis.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        documentGenereId: true,
        lignes: true,
        offre: true,
        statut: true,
        clientId: true,
        formuleRetenue: true,
        choixRetenu: true,
        documentGenere: { select: { exemplaireSigneKey: true } },
        client: { select: { raisonSociale: true, contactEmail: true } },
      },
    });
    if (d === null) return null;
    const { documentGenere, ...reste } = d;
    return { ...reste, exemplaireSigneKey: documentGenere?.exemplaireSigneKey ?? null };
  },
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
  dejaEnvoyee: async (jobId) => {
    const gare = await jobIdDejaGare(jobId);
    if (gare === null) return null;
    if (gare) return true;
    try {
      return (await prisma.emailLog.findFirst({ where: { jobId }, select: { id: true } })) !== null;
    } catch {
      return null;
    }
  },
  enfiler: enqueueEmail,
  // Sans migration : `email_outbox.job_id` n'est pas unique, le verrou consultatif tient lieu
  // d'unicité. La ligne de corbeille est posée par une autre connexion, mais elle est validée
  // avant que ce `corps` (donc la transaction et le verrou) ne se termine : le suivant la voit.
  sousVerrou: (devisId, corps) =>
    prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`devis-commande-confirmation-${devisId}`}))`;
        return corps();
      },
      { timeout: 30_000, maxWait: 10_000 },
    ),
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
  // Un devis à formules n'est confirmé qu'une fois ACCEPTÉ, avec son choix recopié.
  if (aOffre && !STATUTS_CONFIRMABLES.includes(devis.statut)) {
    return { envoye: false, raison: "non_accepte" };
  }
  if (aOffre && (devis.choixRetenu === null || devis.choixRetenu === undefined)) {
    return { envoye: false, raison: "non_accepte" };
  }
  // Pas de confirmation sans pièce : le devis signé est la pièce jointe.
  const cleExemplaire = devis.exemplaireSigneKey?.trim() ?? "";
  if (cleExemplaire === "") return { envoye: false, raison: "exemplaire_absent" };
  const email = devis.client.contactEmail?.trim() ?? "";
  if (email === "") return { envoye: false, raison: "pas_d_adresse" };

  // Anti-rejeu : un seul envoi par devis, base muette comprise.
  const jobId = `devis-commande-confirmation-${devis.id}`;
  const deja = await deps.dejaEnvoyee(jobId);
  if (deja === null) return { envoye: false, raison: "etat_inconnu" };
  if (deja) return { envoye: false, raison: "deja_envoyee" };

  let totaux: TotauxFacture;
  let formuleRetenue: string | undefined;
  let automatisationsRetenues: readonly string[] | undefined;
  let recurrent: readonly string[] | undefined;
  if (aOffre) {
    const offre = offreDevisV1.parse(devis.offre);
    const choix = devis.choixRetenu as ChoixCanonique;
    totaux = totauxFormule(offre, choix.formule, choix.automatisationsRetenues);
    formuleRetenue = LIBELLE_FORMULE[choix.formule];
    const recap = recapitulerChoix(offre, choix);
    automatisationsRetenues = recap.automatisations;
    recurrent = recap.recurrent;
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

  const enfilerConfirmation = () =>
    deps.enfiler(
      "devis-commande-confirmation",
      email,
      "fr",
      {
        clientNom: devis.client.raisonSociale,
        numero: devis.numero,
        ...(formuleRetenue !== undefined ? { formuleRetenue } : {}),
        ...(automatisationsRetenues !== undefined && automatisationsRetenues.length > 0
          ? { automatisationsRetenues: [...automatisationsRetenues] }
          : {}),
        ...(recurrent !== undefined && recurrent.length > 0 ? { recurrent: [...recurrent] } : {}),
        montantHtLabel: eur(totaux.totalHtCents),
        montantTvaLabel: eur(totaux.totalTvaCents),
        montantTtcLabel: eur(totaux.totalTtcCents),
        ...(versionAcceptee !== null
          ? { cgvVersionLabel: libelleVersionCgv(versionAcceptee) }
          : {}),
        cgvJointes,
      },
      {
        jobId,
        // 🔴 Jamais d'e-mail client automatique : toujours la corbeille « à valider ».
        exigerValidation: true,
        clientId: devis.clientId,
        sujet: `Confirmation de commande — devis ${devis.numero}`,
        attachments: [
          { filename: `${devis.numero}-signe.pdf`, r2Key: cleExemplaire },
          ...(cleCgv !== null && versionAcceptee !== null
            ? [{ filename: `CGV-${versionAcceptee}.pdf`, r2Key: cleCgv }]
            : []),
        ],
        entityType: "Devis",
        entityId: devis.id,
      },
    );

  // 🔴 Sous verrou : le contrôle est REFAIT (un appel concurrent a pu garer la confirmation
  // depuis le contrôle rapide ci-dessus), puis la mise en corbeille suit sans fenêtre.
  const sousVerrou = await deps.sousVerrou(devis.id, async () => {
    const dejaSousVerrou = await deps.dejaEnvoyee(jobId);
    if (dejaSousVerrou === null) return { refus: "etat_inconnu" as const };
    if (dejaSousVerrou) return { refus: "deja_envoyee" as const };
    return { res: await enfilerConfirmation() };
  });
  if ("refus" in sousVerrou) return { envoye: false, raison: sousVerrou.refus };
  const res = sousVerrou.res;
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
