/**
 * Lot 8B — le CERTIFICAT DE RÉALISATION créé à la fin de la formation (décision du
 * dirigeant, étude « qui fait quoi à la fin d'une session », #1519).
 *
 * Jusqu'ici le certificat ne naissait que d'un clic en console, sans alerte s'il
 * manquait — alors que le financeur l'exige pour payer. Désormais, chaque matin
 * (`formation-crons.attestations-auto`), pour chaque stagiaire ACTIF d'une session
 * RÉALISÉE, le certificat est créé par le MÊME service que le clic
 * (`produireCertificatRealisation`) : mêmes gardes (taux mesuré, trace vérifiable),
 * même pièce, même numérotation. Un refus de garde n'est pas une panne : il est compté,
 * et l'alerte `certificat_realisation_manquant` le rend visible.
 *
 *   - 🔴 ÉTEINT par défaut (`formateurs.certificat_realisation_auto`) : rien n'est lu ;
 *   - jamais rétroactif : sessions finies le jour (Paris) de l'allumage ou après, et
 *     depuis 90 jours au plus ;
 *   - jamais en double : un certificat existant pour ce stagiaire et cette session,
 *     quel que soit son état (même annulé à la main, même copie), arrête tout ;
 *   - jamais pour une session annulée ou reportée (seul `realisee` est lu) ;
 *   - n'ENVOIE rien : la pièce est créée et rangée au dossier ; la remettre au client,
 *     au stagiaire ou au financeur reste un geste humain.
 *
 * Ne lève jamais. Journal : identifiants seuls.
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { debutDuJourDeParis } from "@/server/qualiopi/financements/condition-suspensive";
import { jourParis } from "@/server/qualiopi/formateurs-independants/argent/dates";
import {
  cleSettingSignature,
  dateAllumageSignature,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { produireCertificatRealisation } from "@/server/qualiopi/documents/production/producteurs";

export const CLE_CERTIFICAT_AUTO = cleSettingSignature("certificat_auto");
export const ACTION_CERTIFICAT_AUTO = "qualiopi.document.certificat_realisation.genere_auto";
/** Au-delà, un refus de garde n'est plus retenté chaque matin (l'alerte a parlé). */
export const FENETRE_CERTIFICAT_AUTO_JOURS = 90;
const JOUR_MS = 24 * 60 * 60 * 1000;

export interface BilanCertificatsAuto {
  readonly etat: "coupe" | "fait" | "echec";
  readonly crees: number;
  /** Garde du certificat refusée (taux non mesuré, aucune trace vérifiable…). */
  readonly refuses: number;
  /** Un certificat existe déjà pour ce stagiaire et cette session. */
  readonly dejaPresents: number;
  readonly erreurs: number;
}

const RIEN = { crees: 0, refuses: 0, dejaPresents: 0, erreurs: 0 } as const;

export interface ClientAllumageCertificat {
  readonly setting: {
    findUnique(args: {
      where: { key: string };
      select: { value: true; updatedAt: true };
    }): PromiseLike<{ value: unknown; updatedAt: Date | null } | null>;
  };
}

/**
 * Le premier instant couvert : 00:00 (Paris) du jour d'allumage, ou `null` si éteint.
 * Une lecture en échec vaut « éteint ». Lu aussi par l'alerte.
 */
export async function lireDebutCertificatAuto(
  client: ClientAllumageCertificat,
): Promise<Date | null> {
  try {
    const ligne = await client.setting.findUnique({
      where: { key: CLE_CERTIFICAT_AUTO },
      select: { value: true, updatedAt: true },
    });
    if (ligne == null) return null;
    const allume = dateAllumageSignature(ligne.value, ligne.updatedAt ?? null);
    return allume === null ? null : debutDuJourDeParis(jourParis(allume));
  } catch {
    return null;
  }
}

export async function emettreCertificatsFinDeFormation(
  maintenant: Date,
): Promise<BilanCertificatsAuto> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return { etat: "coupe", ...RIEN };
  try {
    const debut = await lireDebutCertificatAuto(prisma);
    if (debut === null) return { etat: "coupe", ...RIEN };
    const borne = new Date(
      Math.max(debut.getTime(), maintenant.getTime() - FENETRE_CERTIFICAT_AUTO_JOURS * JOUR_MS),
    );
    const candidats = await prisma.enrollment.findMany({
      where: {
        ...inscriptionsActives(),
        session: { statut: "realisee", dateFin: { gte: borne } },
      },
      select: { id: true, traineeId: true, sessionId: true },
      take: 200,
    });
    if (candidats.length === 0) return { etat: "fait", ...RIEN };

    const existants = await prisma.documentGenere.findMany({
      where: {
        type: "certificat_realisation",
        sessionId: { in: [...new Set(candidats.map((c) => c.sessionId))] },
        traineeId: { in: [...new Set(candidats.map((c) => c.traineeId))] },
      },
      select: { sessionId: true, traineeId: true },
    });
    const deja = new Set(existants.map((p) => `${p.sessionId}:${p.traineeId}`));

    let crees = 0;
    let refuses = 0;
    let dejaPresents = 0;
    let erreurs = 0;
    for (const c of candidats) {
      if (deja.has(`${c.sessionId}:${c.traineeId}`)) {
        dejaPresents++;
        continue;
      }
      try {
        const r = await produireCertificatRealisation(c.id, {
          metadata: { genereAutomatiquement: true, origine: "fin_de_formation" },
        });
        if (!r.ok) {
          refuses++;
          continue;
        }
        crees++;
        await journaliser(prisma, {
          action: ACTION_CERTIFICAT_AUTO,
          targetType: "Enrollment",
          targetId: c.id,
          changes: {
            documentId: r.documentId,
            numero: r.numero,
            sessionId: c.sessionId,
            ...(r.details ?? {}),
          },
          session: null,
        });
      } catch {
        erreurs++;
      }
    }
    return { etat: "fait", crees, refuses, dejaPresents, erreurs };
  } catch {
    return { etat: "echec", ...RIEN };
  }
}
