/**
 * Mise en file du PRÉAVIS aux clients actifs (chantier visio, PR 1).
 *
 * Appelé par `scripts/visio/envoyer-preavis.ts`, qui ne fait que lire ses
 * arguments et imprimer des COMPTES. Toute la logique est ici, testée.
 *
 * ## Trois garanties
 *
 * 1. **À BLANC par défaut** : sans `envoyer: true`, rien n'est mis en file.
 * 2. **Jamais d'envoi direct** : chaque préavis est mis en file avec
 *    `exigerValidation: true`, donc garé dans « E-mails à valider », quelles
 *    que soient les règles d'automatisation. Will le relit ; c'est lui qui le
 *    fait partir (ordre permanent : rien ne part à un client sans sa
 *    validation). Garde : `__tests__/le-script-de-preavis-ne-part-qu-en-attente-de-validation.spec.ts`.
 * 3. **Rejouable** : une adresse qui a déjà un préavis dans la file de
 *    validation (à valider, approuvé ou envoyé) n'en reçoit pas un second. Un
 *    préavis REFUSÉ par Will peut être remis en file.
 *
 * ## L'entité responsable
 *
 * Lue par `resolveLegalIdentity()` (réglages légaux de la console, repli sur la
 * SSOT), jamais écrite ici, et passée au gabarit dans la charge utile.
 *
 * La date d'effet, elle, n'est PAS dans la charge utile : le gabarit la
 * calcule au rendu (voir l'en-tête de `preavis-sous-traitants.tsx`).
 */

import type { LecteurClients } from "./preavis-destinataires";
import { clientsActifsPourPreavis } from "./preavis-destinataires";

/** Nom du gabarit — une seule écriture, reprise partout. */
export const GABARIT_PREAVIS = "preavis-sous-traitants" as const;

export interface ArgumentsPreavis {
  readonly envoyer: boolean;
  /** Message d'erreur : rien ne doit être fait. */
  readonly erreur?: string;
}

/**
 * `--dry-run` (défaut) ou `--envoyer`. Tout autre argument est refusé : un
 * script qui écrit à des clients ne devine pas ce qu'on a voulu dire.
 */
export function lireArgumentsPreavis(argv: readonly string[]): ArgumentsPreavis {
  const inconnus = argv.filter((a) => a !== "--dry-run" && a !== "--envoyer");
  if (inconnus.length > 0) {
    return { envoyer: false, erreur: `Argument inconnu : ${inconnus.join(" ")}.` };
  }
  if (argv.includes("--dry-run") && argv.includes("--envoyer")) {
    return { envoyer: false, erreur: "--dry-run et --envoyer sont incompatibles." };
  }
  return { envoyer: argv.includes("--envoyer") };
}

/** Signature utile de `enqueueEmail` (injectée pour les tests). */
export type MettreEnFile = (
  template: typeof GABARIT_PREAVIS,
  to: string,
  locale: "fr",
  payload: Record<string, unknown>,
  options: { exigerValidation: true; clientId: string; sujet?: string },
) => Promise<{ garePourValidation?: boolean; corbeilleIndisponible?: boolean }>;

export interface LecteurOutbox {
  emailOutbox: {
    findMany(args: {
      where: { template: typeof GABARIT_PREAVIS; statut: { not: "refuse" } };
      select: { recipient: true };
    }): Promise<Array<{ recipient: string }>>;
  };
}

export interface DependancesPreavis {
  readonly prisma: LecteurClients & LecteurOutbox;
  readonly identite: () => Promise<{ legalName: string; dpoContact: string }>;
  readonly mettreEnFile: MettreEnFile;
}

export interface BilanPreavis {
  readonly mode: "a-blanc" | "envoi";
  /** Fiches actives (règle B3). */
  readonly actifs: number;
  /** Adresses distinctes à prévenir. */
  readonly destinataires: number;
  readonly sansAdresse: number;
  readonly adressesEnDouble: number;
  /** Adresses qui ont déjà un préavis dans la file de validation. */
  readonly dejaEnFile: number;
  /** Garés dans « E-mails à valider » par cette exécution. */
  readonly misEnFile: number;
  /** Non garés (file indisponible, adresse retenue par la liste de suppression). */
  readonly nonMisEnFile: number;
}

async function dependancesParDefaut(): Promise<DependancesPreavis> {
  const [{ prisma }, { resolveLegalIdentity }, { enqueueEmail }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/legal-identity"),
    import("@/server/queue/queues"),
  ]);
  return {
    prisma: prisma as unknown as LecteurClients & LecteurOutbox,
    identite: resolveLegalIdentity,
    mettreEnFile: enqueueEmail,
  };
}

export async function envoyerPreavis(
  options: { readonly envoyer: boolean },
  deps?: DependancesPreavis,
): Promise<BilanPreavis> {
  const d = deps ?? (await dependancesParDefaut());
  const liste = await clientsActifsPourPreavis(d.prisma);

  const existants = await d.prisma.emailOutbox.findMany({
    where: { template: GABARIT_PREAVIS, statut: { not: "refuse" } },
    select: { recipient: true },
  });
  const dejaVus = new Set(existants.map((e) => e.recipient.toLowerCase()));
  const aPrevenir = liste.destinataires.filter((x) => !dejaVus.has(x.email.toLowerCase()));

  const base = {
    actifs: liste.actifs,
    destinataires: liste.destinataires.length,
    sansAdresse: liste.sansAdresse,
    adressesEnDouble: liste.adressesEnDouble,
    dejaEnFile: liste.destinataires.length - aPrevenir.length,
  };

  if (!options.envoyer) {
    return { mode: "a-blanc", ...base, misEnFile: 0, nonMisEnFile: 0 };
  }

  const id = await d.identite();
  const payload = { responsable: id.legalName, contactRgpd: id.dpoContact };

  let misEnFile = 0;
  let nonMisEnFile = 0;
  for (const dest of aPrevenir) {
    const r = await d.mettreEnFile(GABARIT_PREAVIS, dest.email, "fr", payload, {
      exigerValidation: true,
      clientId: dest.clientId,
    });
    if (r.garePourValidation === true) misEnFile += 1;
    else nonMisEnFile += 1;
  }

  return { mode: "envoi", ...base, misEnFile, nonMisEnFile };
}
