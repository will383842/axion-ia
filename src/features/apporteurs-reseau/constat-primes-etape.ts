// Lot I (#2464) : l'étape « constat-primes » du passage quotidien. Son propre fichier (plan § 0.5).
// Éteinte tant que `APPORTEUR_CHALLENGES_PRIMES_ENABLED` ne vaut pas exactement « true ».
import { constaterChallenges } from "./challenge-constat";
import { challengesPrimesActifs } from "./interrupteur-challenges-primes";

export async function etapeConstatPrimes(maintenant: Date): Promise<void> {
  if (!challengesPrimesActifs()) return;
  await constaterChallenges(maintenant);
}
