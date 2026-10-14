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
 *     depuis 90 jours au plus ; à partir de J+2 seulement (émargement en retard,
 *     relevé importé le lendemain : le taux doit être définitif) ;
 *   - jamais en double : un certificat existant pour ce stagiaire et cette session,
 *     quel que soit son état (même annulé à la main, même copie), arrête tout ;
 *   - jamais pour une session annulée ou reportée (seul `realisee` est lu) ;
 *   - n'ENVOIE rien : aucun e-mail, aucune notification. ⚠️ Comme après le clic de la
 *     console, la pièce devient VISIBLE dans l'espace du stagiaire (portail, pièce
 *     « après réalisation ») ; la transmettre au client ou au financeur reste humain.
 *
 * Ne lève jamais. Journal : identifiants seuls.
 */

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { produireCertificatRealisation } from "@/server/qualiopi/documents/production/producteurs";

import {
  CLE_CERTIFICAT_AUTO,
  DELAI_CERTIFICAT_AUTO_JOURS,
  FENETRE_CERTIFICAT_AUTO_JOURS,
  lireDebutCertificatAuto,
} from "./certificat-auto-allumage";

/** Au plus par passage, les sessions les plus récentes d'abord ; le reste le lendemain. */
export const CERTIFICATS_AUTO_PAR_PASSAGE = 100;

export { CLE_CERTIFICAT_AUTO };
export const ACTION_CERTIFICAT_AUTO = "qualiopi.document.certificat_realisation.genere_auto";
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
    // Toute la fenêtre est lue (90 jours au plus : un volume borné), PUIS les inscriptions
    // déjà pourvues sont écartées, et seulement alors la limite s'applique : une limite
    // posée sur la requête laisserait les pièces déjà faites occuper les places.
    const lus = await prisma.enrollment.findMany({
      where: {
        ...inscriptionsActives(),
        session: {
          statut: "realisee",
          dateFin: {
            gte: borne,
            lte: new Date(maintenant.getTime() - DELAI_CERTIFICAT_AUTO_JOURS * JOUR_MS),
          },
        },
      },
      orderBy: { session: { dateFin: "desc" } },
      select: { id: true, traineeId: true, sessionId: true },
    });
    if (lus.length === 0) return { etat: "fait", ...RIEN };

    const existants = await prisma.documentGenere.findMany({
      where: {
        type: "certificat_realisation",
        sessionId: { in: [...new Set(lus.map((c) => c.sessionId))] },
        traineeId: { in: [...new Set(lus.map((c) => c.traineeId))] },
      },
      select: { sessionId: true, traineeId: true },
    });
    const deja = new Set(existants.map((p) => `${p.sessionId}:${p.traineeId}`));
    const candidats = lus.filter((c) => !deja.has(`${c.sessionId}:${c.traineeId}`));
    let dejaPresents = lus.length - candidats.length;

    let crees = 0;
    let refuses = 0;
    let erreurs = 0;
    for (const c of candidats.slice(0, CERTIFICATS_AUTO_PAR_PASSAGE)) {
      try {
        // Relu juste avant : un clic en console pendant le passage (des PDF à rendre,
        // donc des minutes) ne doit pas recevoir une seconde pièce numérotée.
        const entreTemps = await prisma.documentGenere.findFirst({
          where: {
            type: "certificat_realisation",
            sessionId: c.sessionId,
            traineeId: c.traineeId,
          },
          select: { id: true },
        });
        if (entreTemps !== null) {
          dejaPresents++;
          continue;
        }
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
