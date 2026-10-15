// Banc @formateurs, équipe sécurité — la SESSION de la console, remplacée.
//
// Chargé À LA PLACE de `src/auth.ts` dans le seul processus `tsx` du banc
// (`crochets.ts`), jamais dans l'application. La session est celle que le
// scénario pose (`poserSession`) : un identifiant d'administrateur RÉEL de la
// base du banc et un rôle. Les Server Actions vérifient ensuite le rôle avec
// leur propre code — c'est ce code-là que le banc éprouve.

export interface SessionBanc {
  readonly user: { readonly id: string; readonly role: string; readonly email?: string };
}

let courante: SessionBanc | null = null;

export function poserSession(session: SessionBanc | null): void {
  courante = session;
}

export async function auth(): Promise<SessionBanc | null> {
  return courante;
}

export const handlers = {};
export async function signIn(): Promise<never> {
  throw new Error("banc @formateurs : signIn n'existe pas dans le banc");
}
export async function signOut(): Promise<void> {}
