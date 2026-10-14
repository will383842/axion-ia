// Banc @formateurs, équipe sécurité — trois modules de Next remplacés DANS LE
// SEUL PROCESSUS `tsx` du banc, par les crochets de chargement de Node.
//
// Pourquoi : les Server Actions de la console et de l'espace formateur lisent
// `auth()`, `cookies()` et appellent `revalidatePath`, qui n'existent qu'à
// l'intérieur d'une requête Next. Le banc ne lance aucun serveur Next ; pour
// éprouver les gardes RÉELLES de ces actions (rôle, propriété du dossier,
// jeton), on leur présente une session et des cookies posés par le scénario.
// L'application n'est pas touchée : ni route de test, ni horloge truquée.
//
// À importer EN PREMIER, avant tout module de `src/` (l'exécuteur ne charge le
// scénario qu'en import dynamique, après ce module).

import * as moduleNode from "node:module";

// `registerHooks` (Node ≥ 22.15) manque aux types `@types/node` du dépôt.
interface Resolu {
  readonly url: string;
  readonly format?: string | null;
  readonly shortCircuit?: boolean;
}
type Resoudre = (
  specifier: string,
  context: { readonly parentURL?: string },
  suivant: (specifier: string, context: { readonly parentURL?: string }) => Resolu,
) => Resolu;
const { registerHooks } = moduleNode as unknown as {
  registerHooks: (crochets: { resolve: Resoudre }) => void;
};

const ICI = new URL(".", import.meta.url);
const FAUX_AUTH = new URL("faux-auth.ts", ICI).href;
const FAUX_CACHE = new URL("faux-next-cache.ts", ICI).href;
const FAUX_ENTETES = new URL("faux-next-headers.ts", ICI).href;
const FAUX = new Set([FAUX_AUTH, FAUX_CACHE, FAUX_ENTETES]);

registerHooks({
  resolve(specifier, context, suivant) {
    const resolu = suivant(specifier, context);
    // Un faux module importe le VRAI (`export * from "next/cache"`) : on ne
    // le redirige pas vers lui-même.
    if (context.parentURL !== undefined && FAUX.has(context.parentURL)) return resolu;
    if (resolu.url.endsWith("/src/auth.ts")) return { ...resolu, url: FAUX_AUTH };
    if (specifier === "next/cache") return { ...resolu, url: FAUX_CACHE };
    if (specifier === "next/headers") return { ...resolu, url: FAUX_ENTETES };
    return resolu;
  },
});
