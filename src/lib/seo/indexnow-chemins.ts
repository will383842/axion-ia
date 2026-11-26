// Chemins stratégiques envoyés à IndexNow après chaque mise en ligne.
// Isolés du script `scripts/indexnow-ping.ts` (qui lance `void main()` à l'import, donc
// non testable) pour pouvoir être verrouillés par un test.
export const STRATEGIC_PATHS = [
  "/",
  "/audit",
  "/interventions",
  "/implementation",
  "/methodologie",
  "/comparaisons",
  "/stack-ia",
  "/implantations",
  "/blog",
  "/devenir-commercial-ia",
] as const;
