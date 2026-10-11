/**
 * Formateurs indépendants — LECTURE de l'écran « Contrats à mettre à niveau » (lots L9b,
 * L7d). Lecture seule, EN LOT (un nombre fixe de requêtes, quel que soit le nombre de
 * fiches).
 *
 *   - L9b : les indépendants ACTIFS sans contrat-cadre v3 en vigueur, avec les onze
 *     éléments à reprendre, la date de la liste figée, la date du premier envoi du dossier
 *     de mise à niveau et la fin du délai de grâce ;
 *   - L7d : les indépendants dont le contrat v3+ en vigueur est antérieur à la dernière
 *     version arrêtée.
 *
 * Le nom affiché est celui de la fiche (console authentifiée) ; rien n'est journalisé ici.
 * Module neutre (Prisma).
 */

import { prisma } from "@/lib/prisma";

import { aFaireResigner, versionEnVigueur } from "./contrat-cadre-emission-regles";
import { versionContratAEmettre } from "./contrat-cadre-emission";
import { versionDuContrat } from "./faits-activation";
import {
  concerneParMiseANiveau,
  elementsMiseANiveau,
  finDelaiGrace,
  type CleElement,
  type FaitsMiseANiveau,
} from "./mise-a-niveau-regles";

/** Le gabarit du dossier envoyé : sa première trace après la liste figée date l'envoi. */
export const GABARIT_DOSSIER_MISE_A_NIVEAU = "formateur-dossier-lien";

export interface LigneMiseANiveau {
  readonly trainerId: string;
  readonly nom: string;
  readonly elements: Readonly<Record<CleElement, boolean>>;
  readonly manquants: number;
  readonly listeeLe: Date | null;
  readonly premierEnvoi: Date | null;
  readonly finGrace: Date | null;
  readonly dossierStatut: string | null;
}

export interface LigneAResigner {
  readonly trainerId: string;
  readonly nom: string;
  readonly versionEnVigueur: number;
}

export interface EcranMiseANiveau {
  readonly versionArretee: number | null;
  readonly aMettreANiveau: ReadonlyArray<LigneMiseANiveau>;
  readonly aResigner: ReadonlyArray<LigneAResigner>;
  /** Plus de fiches que la lecture n'en couvre : le dire plutôt que tronquer en silence. */
  readonly tronque: boolean;
}

const PLAFOND = 500;

export async function lireEcranMiseANiveau(maintenant: Date): Promise<EcranMiseANiveau> {
  const fiches = await prisma.trainer.findMany({
    where: {
      statut: "sous_traitant",
      actif: true,
      estFormateur: true,
      organismeSousTraitantId: null,
      finCollaborationAt: null,
    },
    orderBy: [{ nom: "asc" }, { id: "asc" }],
    take: PLAFOND + 1,
    select: {
      id: true,
      prenom: true,
      nom: true,
      statut: true,
      actif: true,
      estFormateur: true,
      organismeSousTraitantId: true,
      finCollaborationAt: true,
      siret: true,
      ndaVerifieListeAt: true,
      regimeTvaHonoraires: true,
      iban: true,
      declarationsVersion: true,
      miseANiveauListeeAt: true,
      dossierStatut: true,
      habilitations: { where: { retireAt: null }, select: { id: true } },
      documents: {
        where: {
          type: {
            in: ["attestation_vigilance_urssaf", "cv", "nda_sous_traitant", "kbis_avis_sirene"],
          },
        },
        select: {
          id: true,
          type: true,
          statutValidation: true,
          fichierUrl: true,
          dateEmission: true,
          dateExpiration: true,
        },
      },
    },
  });
  const tronque = fiches.length > PLAFOND;
  const lues = fiches.slice(0, PLAFOND);
  const versionArretee = versionContratAEmettre();
  if (lues.length === 0) return { versionArretee, aMettreANiveau: [], aResigner: [], tronque };

  const ids = lues.map((f) => f.id);
  const [contrats, controles, preuves, envois] = await Promise.all([
    prisma.documentGenere.findMany({
      where: { trainerId: { in: ids }, type: "contrat_sous_traitance" },
      select: {
        id: true,
        numero: true,
        trainerId: true,
        metadata: true,
        statutSignature: true,
        annuleeAt: true,
      },
    }),
    prisma.verificationRegistreSousTraitance.findMany({
      where: { trainerId: { in: ids } },
      orderBy: { createdAt: "desc" },
      select: {
        trainerId: true,
        verdict: true,
        source: true,
        verifieAt: true,
        createdAt: true,
        siret: true,
      },
    }),
    prisma.preuveVigilance.findMany({
      where: { trainerId: { in: ids } },
      select: { trainerId: true, trainerDocumentId: true, resultat: true },
    }),
    prisma.emailLog.findMany({
      where: {
        entityType: "Trainer",
        entityId: { in: ids },
        template: GABARIT_DOSSIER_MISE_A_NIVEAU,
        status: { in: ["pending", "sent"] },
      },
      orderBy: { createdAt: "asc" },
      select: { entityId: true, createdAt: true },
    }),
  ]);

  const aMettreANiveau: LigneMiseANiveau[] = [];
  const aResigner: LigneAResigner[] = [];
  for (const f of lues) {
    const sesContrats = contrats
      .filter((c) => c.trainerId === f.id)
      .map((c) => ({
        id: c.id,
        numero: c.numero,
        version: versionDuContrat(c.metadata),
        statutSignature: c.statutSignature,
        annuleeAt: c.annuleeAt,
        signatures: 0,
      }));
    const nom = `${f.prenom} ${f.nom}`.replace(/\s+/g, " ").trim();
    const faits: FaitsMiseANiveau = {
      statut: f.statut,
      actif: f.actif,
      estFormateur: f.estFormateur,
      organismeSousTraitantId: f.organismeSousTraitantId,
      finCollaborationAt: f.finCollaborationAt,
      siret: f.siret,
      ndaVerifieListeAt: f.ndaVerifieListeAt,
      regimeTvaHonoraires: f.regimeTvaHonoraires,
      ibanPresent: typeof f.iban === "string" && f.iban !== "",
      declarationsVersion: f.declarationsVersion,
      habilitationsActives: f.habilitations.length,
      contrats: sesContrats,
      controles: controles.filter((c) => c.trainerId === f.id).slice(0, 5),
      pieces: f.documents.filter(
        (d) => d.type === "attestation_vigilance_urssaf" || d.type === "cv",
      ),
      preuvesVigilance: preuves.filter((p) => p.trainerId === f.id),
      piecesAdministratives: f.documents.filter(
        (d) => d.type === "nda_sous_traitant" || d.type === "kbis_avis_sirene",
      ),
    };
    if (concerneParMiseANiveau(faits)) {
      const elements = elementsMiseANiveau(faits, maintenant);
      // Seul un envoi POSTÉRIEUR à la liste figée date la mise à niveau.
      const premierEnvoi =
        f.miseANiveauListeeAt === null
          ? null
          : (envois.find(
              (e) =>
                e.entityId === f.id &&
                e.createdAt.getTime() >= (f.miseANiveauListeeAt as Date).getTime(),
            )?.createdAt ?? null);
      aMettreANiveau.push({
        trainerId: f.id,
        nom,
        elements,
        manquants: Object.values(elements).filter((v) => !v).length,
        listeeLe: f.miseANiveauListeeAt,
        premierEnvoi,
        finGrace: finDelaiGrace(premierEnvoi),
        dossierStatut: f.dossierStatut,
      });
    } else if (aFaireResigner(sesContrats, versionArretee)) {
      aResigner.push({
        trainerId: f.id,
        nom,
        versionEnVigueur: versionEnVigueur(sesContrats) as number,
      });
    }
  }
  return { versionArretee, aMettreANiveau, aResigner, tronque };
}
