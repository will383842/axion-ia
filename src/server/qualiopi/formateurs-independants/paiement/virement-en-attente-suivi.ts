/**
 * Formateurs indépendants — F38 « Virement en attente : attestation URSSAF » envoyé
 * par le SUIVI QUOTIDIEN (vérification 1, défaut V1-C-8).
 *
 * Avant, F38 ne partait qu'au clic « Prévenir » de la console : un formateur dont le
 * virement était suspendu par son attestation n'en savait rien si personne ne
 * cliquait. Désormais, chaque jour, pour chaque facture de mission DUE (reçue, non
 * payée, non contestée — même règle que « Copier l'IBAN ») dont la garde du virement
 * dit « attestation URSSAF échue à la date de la mission » (la MÊME lecture que la vue
 * « Virements à faire »), F38 part — une seule fois par facture : le journal des envois
 * (hors échec) et la corbeille de validation font foi, clic console compris.
 *
 * Rien n'est payé ni débloqué ici. Ne lève jamais ; identifiants seuls.
 */

import { prisma } from "@/lib/prisma";

import { ISSUE_DESACCORD_NON_RETENU } from "./desaccord-regle";
import { envoyerVirementEnAttente } from "./virement-fait-envoi";
import { etatsVirementsMission } from "./virements-a-faire-lecture";

/** Le motif de suspension qui appelle F38. */
const MOTIF_ATTESTATION = "attestation_urssaf_echue_a_la_mission";

/** Rend le nombre de F38 enfilés à ce passage. */
export async function envoyerF38Dus(maintenant: Date): Promise<number> {
  try {
    const dus = await prisma.trainerStatement.findMany({
      where: {
        origine: "passage_mission",
        statut: "facture_recue",
        payeAt: null,
        avoirDeId: null,
        numeroFacture: { not: null },
        OR: [{ contesteeAt: null }, { contestationCloseIssue: ISSUE_DESACCORD_NON_RETENU }],
      },
      select: { id: true },
      orderBy: { echeanceAt: "asc" },
      take: 200,
    });
    if (dus.length === 0) return 0;
    const etats = await etatsVirementsMission(
      dus.map((d) => d.id),
      maintenant,
    );
    let n = 0;
    for (const { id } of dus) {
      if (!etats.get(id)?.motifs.includes(MOTIF_ATTESTATION)) continue;
      const jobId = `formateur-virement-en-attente-${id}`;
      const [journal, corbeille] = await Promise.all([
        prisma.emailLog.count({ where: { jobId, status: { not: "failed" } } }),
        prisma.emailOutbox.count({ where: { jobId } }),
      ]);
      if (journal + corbeille > 0) continue;
      const r = await envoyerVirementEnAttente(id).catch(() => "indisponible" as const);
      if (r === "envoye") n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}
