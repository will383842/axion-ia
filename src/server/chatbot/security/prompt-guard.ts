// Prompt-guard (REQ-063) — barrière déterministe ANTI-INJECTION sur l'ENTRÉE
// utilisateur, AVANT tout appel LLM. C'est la première des couches de défense :
//  1. prompt-guard (ici)        → refuse les tentatives d'injection/jailbreak/exfiltration ;
//  2. system-prompt (grounding) → l'IA ne répond que depuis le contexte cité ;
//  3. output-guard (prix/URL)   → bloque les prix/URL inventés en SORTIE.
//
// Heuristique volontairement CONSERVATRICE (peu de faux positifs sur des questions
// commerciales légitimes). Pur (aucune I/O) → testable et build-safe (stub.invalid).

export type PromptGuardReason = "injection" | "exfiltration" | "jailbreak";

export interface PromptGuardResult {
  readonly ok: boolean;
  readonly reason?: PromptGuardReason;
}

/** Normalise : minuscule + suppression des accents (robustesse FR/EN). */
function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Détournement d'instructions ("ignore les instructions précédentes", …).
const INJECTION_PATTERNS: readonly RegExp[] = [
  /\b(ignore|oublie|oubliez|disregard|forget)\b[^.?!]{0,40}\b(instruction|instructions|consigne|consignes|prompt|regle|regles|rule|rules)\b/,
  /\b(nouvelles?|new)\s+(instruction|instructions|consigne|consignes|rule|rules)\b/,
  /\b(instructions?|consignes?)\s+(precedente|precedentes|ci-dessus|above|prior|previous)\b/,
  /\boverride\b[^.?!]{0,20}\b(prompt|instruction|instructions|system)\b/,
];

// Exfiltration du system prompt / des secrets.
const EXFILTRATION_PATTERNS: readonly RegExp[] = [
  /\b(reveal|show|print|repeat|affiche|affichez|repete|repetez|montre|montrez|donne|donnez|divulge|divulgue)\b[^.?!]{0,40}\b(system\s*prompt|prompt\s*system|tes\s+instructions|tes\s+consignes|your\s+(system\s+)?(prompt|instructions)|ton\s+prompt)\b/,
  /\b(what|quel|quelles?)\b[^.?!]{0,30}\b(system\s*prompt|your\s+(system\s+)?(prompt|instructions)|tes\s+instructions)\b/,
  /\b(api[_\s-]?key|cle\s+api|database_url|voyage_api_key|anthropic_api_key|process\.env|variables?\s+d['e]\s*environnement|environment\s+variables?|secret\s+key)\b/,
];

// Jailbreak / changement de rôle ("tu es maintenant…", "developer mode", "DAN").
const JAILBREAK_PATTERNS: readonly RegExp[] = [
  /\b(dan\s+mode|developer\s+mode|mode\s+developpeur|jailbreak|do\s+anything\s+now)\b/,
  /\b(tu\s+es\s+maintenant|tu\s+es\s+desormais|you\s+are\s+now|pretend\s+you\s+are|agis\s+comme\s+si|fais\s+comme\s+si)\b[^.?!]{0,40}\b(sans|aucune?|no|non|libre|unrestricted|illimite)\b/,
  /\b(tu\s+n['e ]a?s?\s+plus\s+de\s+(regles|limites|restrictions)|ignore\s+your\s+(guidelines|rules|restrictions)|no\s+restrictions)\b/,
];

/**
 * Inspecte le message utilisateur. Retourne `{ ok: false, reason }` si une
 * tentative d'injection/exfiltration/jailbreak est détectée, `{ ok: true }` sinon.
 */
export function inspectUserMessage(message: string): PromptGuardResult {
  const text = normalize(message);
  if (EXFILTRATION_PATTERNS.some((re) => re.test(text))) {
    return { ok: false, reason: "exfiltration" };
  }
  if (INJECTION_PATTERNS.some((re) => re.test(text))) {
    return { ok: false, reason: "injection" };
  }
  if (JAILBREAK_PATTERNS.some((re) => re.test(text))) {
    return { ok: false, reason: "jailbreak" };
  }
  return { ok: true };
}
