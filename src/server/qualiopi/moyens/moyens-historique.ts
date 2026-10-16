/**
 * 🔴 CHANTIER QNC, LOT L07 — MODIFICATION MOTIVÉE D'UN MOYEN (NC7, indicateur 17).
 *
 * Quand `qualiopi.moyens.actif` est allumé, on ne modifie plus un moyen
 * pédagogique « à sec » : chaque modification (y compris la désactivation)
 *   1. exige un MOTIF d'au moins 10 caractères ;
 *   2. refuse une date de vérification antérieure à la création de la ligne ;
 *   3. écrit, dans la MÊME transaction, la ligne de `moyens_pedagogiques_historique`
 *      (avant / après / motif / auteur) — table en ajout seul ;
 *   4. ne supprime jamais : désactiver = `actif: false`.
 *
 * ÉTEINT, rien ne change : l'appelant garde le chemin historique de
 * `moyens-service.ts`, qui n'est pas touché par ce lot.
 *
 * Les dates sont posées par le serveur (`maintenant` vient de l'horloge du
 * serveur, jamais du navigateur).
 */

import {
  differencesMoyen,
  validerDateVerification,
  validerMotif,
} from "@/server/qualiopi/moyens/moyens-regles";

export type CodeRefusMoyen =
  | "motif_requis"
  | "date_anterieure_creation"
  | "date_future"
  | "date_invalide"
  | "introuvable"
  | "rien_a_changer";

export class MoyenRefuse extends Error {
  constructor(readonly code: CodeRefusMoyen) {
    super(`moyen refusé : ${code}`);
    this.name = "MoyenRefuse";
  }
}

export const MESSAGES_REFUS_MOYEN: Record<CodeRefusMoyen, string> = {
  motif_requis: "Indiquez le motif de la modification (10 caractères au moins).",
  date_anterieure_creation:
    "La date de vérification ne peut pas être antérieure à la création du moyen.",
  date_future: "La date de vérification ne peut pas être dans le futur.",
  date_invalide: "La date de vérification n'est pas valide.",
  introuvable: "Moyen pédagogique introuvable.",
  rien_a_changer: "Aucune modification : rien n'a été enregistré.",
};

export interface ChampsMoyen {
  categorie?: string;
  libelle?: string;
  description?: string;
  localisation?: string;
  actif?: boolean;
  dateVerification?: Date | null;
}

interface LigneMoyen {
  id: string;
  categorie: string;
  libelle: string;
  description: string;
  localisation: string;
  actif: boolean;
  dateVerification: Date | null;
  createdAt: Date;
}

/** Le strict nécessaire d'une transaction Prisma — injectable en test. */
export interface ClientMoyens {
  $transaction<T>(fn: (tx: TxMoyens) => Promise<T>): Promise<T>;
}

export interface TxMoyens {
  moyenPedagogique: {
    findUnique(args: { where: { id: string } }): Promise<LigneMoyen | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<LigneMoyen>;
  };
  moyenPedagogiqueHistorique: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

const CHAMPS_COMPARES = [
  "categorie",
  "libelle",
  "description",
  "localisation",
  "actif",
  "dateVerification",
] as const;

function photo(l: LigneMoyen): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const c of CHAMPS_COMPARES) o[c] = l[c];
  return o;
}

/** JSON stockable : les dates deviennent des chaînes ISO. */
function enJson(o: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) r[k] = v instanceof Date ? v.toISOString() : v;
  return r;
}

export interface AuteurMoyen {
  readonly id: string | null;
  readonly nom: string;
}

/**
 * Modifie un moyen avec motif et historique. Lève `MoyenRefuse` (aucune écriture)
 * si une règle n'est pas tenue.
 */
export async function modifierMoyenMotive(
  client: ClientMoyens,
  id: string,
  champs: ChampsMoyen,
  entree: { motif: string | null | undefined; auteur: AuteurMoyen; maintenant: Date },
): Promise<{ id: string; historiqueCree: true }> {
  const motif = validerMotif(entree.motif);
  if (!motif.ok) throw new MoyenRefuse("motif_requis");

  return client.$transaction(async (tx) => {
    const actuel = await tx.moyenPedagogique.findUnique({ where: { id } });
    if (actuel === null) throw new MoyenRefuse("introuvable");

    if (champs.dateVerification instanceof Date) {
      const r = validerDateVerification(
        champs.dateVerification,
        actuel.createdAt,
        entree.maintenant,
      );
      if (!r.ok) {
        throw new MoyenRefuse(
          r.raison === "anterieure_creation"
            ? "date_anterieure_creation"
            : r.raison === "future"
              ? "date_future"
              : "date_invalide",
        );
      }
    }

    const demande: Record<string, unknown> = {};
    for (const c of CHAMPS_COMPARES) if (champs[c] !== undefined) demande[c] = champs[c];
    const diff = differencesMoyen(photo(actuel), demande);
    if (diff.vide) throw new MoyenRefuse("rien_a_changer");

    await tx.moyenPedagogique.update({ where: { id }, data: demande });
    await tx.moyenPedagogiqueHistorique.create({
      data: {
        moyenId: id,
        avant: enJson(diff.avant),
        apres: enJson(diff.apres),
        motif: motif.motif,
        auteurId: entree.auteur.id,
        auteurNom: entree.auteur.nom,
      },
    });
    return { id, historiqueCree: true as const };
  });
}
