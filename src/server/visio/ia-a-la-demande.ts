/**
 * La PORTE des étapes à la demande (chantier visio, PR 7) : questionnaire,
 * lecture des réponses, e-mail de suivi rédigé par l'IA.
 *
 * Ces étapes envoient à OpenAI (États-Unis) des paroles de vrais clients : les
 * faits validés du dossier, les réponses collées depuis un e-mail. Elles
 * suivent donc le MÊME drapeau que l'enregistrement (`modeEnregistrement`,
 * qui passe par `modeEffectif` : `ouvert` n'est effectif que si la notice
 * publique l'annonce) :
 *
 *   · `ouvert`  — permises ;
 *   · `pilote`  — seulement sur une rencontre de TEST (client fictif) ;
 *   · `ferme`   — jamais.
 *
 * Tant que ces préalables (DPA signé, notice publiée, sous-traitant inscrit)
 * ne sont pas remplis, rien d'un vrai client ne part chez OpenAI par ce
 * chemin. Le modèle fixe de l'e-mail de suivi (sans IA) reste libre.
 *
 * Vérifiée DEUX fois : par le geste de Will (refus motivé, rien n'est
 * programmé) et par le worker avant tout appel (défense en profondeur).
 * Garde : `les-etapes-a-la-demande-suivent-le-drapeau.spec.ts`.
 */

import type { PrismaClient } from "../../../prisma/generated/client";
import type { ModeEnregistrement } from "./drapeau";

/** Règle PURE : l'IA peut-elle traiter cette rencontre dans ce mode ? */
export function iaALaDemandePermise(mode: ModeEnregistrement, estTestInterne: boolean): boolean {
  return mode === "ouvert" || (mode === "pilote" && estTestInterne);
}

export const MESSAGE_IA_A_LA_DEMANDE_FERMEE =
  "La préparation par l'IA n'est pas encore ouverte pour les vrais clients (la notice de confidentialité ne l'annonce pas) : rien n'est parti chez OpenAI.";

/** La rencontre est-elle une rencontre de test (client fictif) ? Inconnue : non. */
export async function estRencontreDeTest(
  db: Pick<PrismaClient, "rencontre">,
  rencontreId: string,
): Promise<boolean> {
  const r = await db.rencontre.findUnique({
    where: { id: rencontreId },
    select: { estTestInterne: true },
  });
  return r?.estTestInterne === true;
}
