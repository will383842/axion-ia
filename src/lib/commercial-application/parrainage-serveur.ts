// La capture du code de parrainage, côté SERVEUR — INT-T52-A (REQ-SEC-037).
//
// Appelée par les deux actions du tunnel (premier contact, dossier complet), et elles seules.
// Le code n'est compté que s'il a la forme d'un code : une visite sans code ne consomme rien.
// Le limiteur est le module partagé `@/lib/rate-limit`, appelé sans être modifié : en refus sur
// panne, sous une clé à trois segments (son signal de panne ne rapporte que le préfixe). Le
// hachage de l'adresse réseau est salé (`hashIp`) ; s'il est impossible, le code ne part pas.
// Le module n'est jamais importé par un composant client : il porte le cache et les alertes.

import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { notify } from "@/server/notifications";

import {
  CAPTURES_DE_PARRAINAGE,
  cleDuCompteurDeParrainage,
  codeDeParrainageCapte,
  codeDeParrainageTransmis,
  suivreLaPanneDuCompteur,
} from "./parrainage";

/**
 * Le code capté, s'il a la forme d'un code ET si le compteur l'admet sans panne ; sinon `null`.
 * La réponse au visiteur n'en dépend jamais : la candidature part dans tous les cas.
 */
export async function codeDeParrainageAdmis(
  capture: unknown,
  ip: string | null | undefined,
): Promise<string | null> {
  const code = codeDeParrainageCapte(capture);
  if (code === null) return null;
  let empreinte: string | null;
  try {
    empreinte = hashIp(ip);
  } catch {
    return null;
  }
  if (empreinte === null) return null;
  const verdict = await checkRateLimit(cleDuCompteurDeParrainage(empreinte), {
    limit: CAPTURES_DE_PARRAINAGE.limite,
    windowSec: CAPTURES_DE_PARRAINAGE.fenetreSecondes,
    surPanne: "refuser",
  });
  if (suivreLaPanneDuCompteur(verdict.panne, Date.now())) {
    // Une alerte de catégorie fermée, sans adresse ni empreinte : la panne seule, et sa durée.
    await notify({
      category: "MONITORING_ALERT",
      payload: {
        kind: "parrainage-limiteur-en-panne",
        details: { panneDepuisSecondes: CAPTURES_DE_PARRAINAGE.alertePanneSecondes },
      },
    }).catch(() => undefined);
  }
  return codeDeParrainageTransmis(code, { allowed: verdict.allowed, panne: verdict.panne });
}
