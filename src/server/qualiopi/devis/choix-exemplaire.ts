/**
 * Choix imprimable sur l'exemplaire signé d'un devis à formules — PUR.
 *
 * L'exemplaire signé est rendu à la demande, avant que `devis.choixRetenu` soit rempli
 * (l'acceptation vient APRÈS la contresignature) : la seule source du choix est donc le
 * `choixOffre` SCELLÉ de la ligne de signature du client (sceau V4), jamais `devis.choixRetenu`.
 *
 * Mêmes vérifications que `acceptation-formules.ts` (`preparer`) : un choix qui ne passerait
 * pas l'acceptation ne s'imprime pas. Aucune levée : `null` + motif, l'appelant n'imprime
 * rien et alerte sans bloquer le rendu.
 *
 * Aucun import Prisma, aucune horloge.
 */
import { recapitulerChoix, type RecapChoix } from "./choix-affichage";
import { validerChoixSignature } from "./choix-signature";
import { sha256Choix, sha256Offre, type ChoixCanonique } from "./offre-calculs";
import { offreDevisV1 } from "./offre-devis";

export type ChoixImprimable = RecapChoix & {
  /** Empreinte SHA-256 (hex) du choix scellé à la signature du client. */
  readonly empreinteChoix: string;
};

export type MotifChoixNonImprimable =
  | "sceau_non_v4"
  | "choix_absent"
  | "offre_illisible"
  | "offre_alteree"
  | "choix_illisible"
  | "choix_altere"
  | "choix_autre_devis"
  | "choix_autre_offre"
  | "choix_invalide"
  | "choix_non_canonique";

export type ResultatChoixImprimable =
  | { readonly ok: true; readonly choix: ChoixImprimable }
  | { readonly ok: false; readonly motif: MotifChoixNonImprimable };

export interface DevisPourChoix {
  readonly offre: unknown;
  readonly offreSha256: string;
  readonly numero: string;
}

export interface LigneClientPourChoix {
  readonly hashVersion: number;
  readonly choixOffre: unknown;
  readonly choixOffreSha256: string | null;
}

const non = (motif: MotifChoixNonImprimable): ResultatChoixImprimable => ({ ok: false, motif });

export function choixImprimable(
  devis: DevisPourChoix,
  ligne: LigneClientPourChoix,
): ResultatChoixImprimable {
  if (ligne.hashVersion !== 4) return non("sceau_non_v4");
  if (ligne.choixOffre == null || ligne.choixOffreSha256 == null) return non("choix_absent");

  const offre = offreDevisV1.safeParse(devis.offre);
  if (!offre.success) return non("offre_illisible");
  let empreinteOffre: string;
  try {
    empreinteOffre = sha256Offre(offre.data);
  } catch {
    return non("offre_illisible");
  }
  if (empreinteOffre !== devis.offreSha256) return non("offre_alteree");

  const choix = ligne.choixOffre as ChoixCanonique;
  let empreinteChoix: string;
  try {
    empreinteChoix = sha256Choix(choix);
  } catch {
    return non("choix_illisible");
  }
  if (empreinteChoix !== ligne.choixOffreSha256) return non("choix_altere");
  if (choix.devisNumero !== devis.numero) return non("choix_autre_devis");
  if (choix.offreSha256 !== devis.offreSha256) return non("choix_autre_offre");

  const rederive = validerChoixSignature(
    { offre: offre.data, devisNumero: devis.numero, offreSha256: devis.offreSha256 },
    {
      formule: choix.formule,
      automatisationsRetenues: choix.automatisationsRetenues,
      maintenanceRetenue: choix.maintenanceRetenue,
      periodiciteMois: choix.periodiciteMois,
    },
  );
  if (!rederive.ok) return non("choix_invalide");
  if (rederive.sha256Choix !== empreinteChoix) return non("choix_non_canonique");

  return { ok: true, choix: { ...recapitulerChoix(offre.data, choix), empreinteChoix } };
}
