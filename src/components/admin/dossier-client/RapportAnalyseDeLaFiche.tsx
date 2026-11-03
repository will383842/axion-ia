// Le bloc « Rapport d'analyse », logé dans l'onglet Questionnaire de la fiche client (2026-11-02).
//
// Composant SERVEUR asynchrone, rendu par `BlocQuestionnaireFiche` (son voisin) : la page fiche
// client est figée par le lot 0 (`les-emplacements-sont-poses.spec.ts`), elle n'est donc pas
// modifiée. Le rôle est relu ICI dans la session (jamais reçu d'un parent) ; une panne de lecture
// n'affecte que ce bloc.
//
// ⚠️ Imports DYNAMIQUES, et c'est voulu : `BlocQuestionnaireFiche` est rendu tel quel par des tests
// de composant (jsdom) où `@/auth` (next-auth) ne se charge pas. Un import statique de la session,
// des actions ou de la base ferait échouer ces tests au chargement ; ici rien n'est chargé tant
// qu'aucune vraie fiche (identifiant valable) n'est affichée.

const ILLISIBLE = (
  <section className="admin-carte mt-[var(--space-admin-6)] text-[length:var(--text-admin-sm)]">
    <h2 className="admin-carte-titre">Rapport d&apos;analyse</h2>
    <p role="status">
      Cette partie de la fiche n&apos;a pas pu être lue. Rechargez la page ; le reste de la fiche
      reste fiable.
    </p>
  </section>
);

/** La lecture seule est dans le `try` ; le rendu se fait après (pas de JSX dans un try/catch). */
async function lire(clientId: string) {
  try {
    const [{ auth }, { accesRapports }, { rapportAvantAuditActif }, { lireEcranRapport }, bloc] =
      await Promise.all([
        import("@/auth"),
        import("@/features/rapport-avant-audit/ecran/brancher"),
        import("@/features/rapport-avant-audit/ecran/interrupteur"),
        import("@/features/rapport-avant-audit/ecran/lecture"),
        import("./BlocRapportAnalyse"),
      ]);
    const session = await auth();
    const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
    const ecran = await lireEcranRapport({
      clientId,
      role,
      interrupteurAllume: rapportAvantAuditActif(),
      acces: accesRapports(),
    });
    return { ecran, Bloc: bloc.BlocRapportAnalyse };
  } catch (e) {
    // Journalisée, jamais avalée en silence : le NOM de l'erreur et le client, aucun contenu.
    console.error(
      `[rapport-avant-audit] lecture du bloc impossible : client=${clientId} ${
        e instanceof Error ? e.name : "erreur inconnue"
      }`,
    );
    return null;
  }
}

export async function RapportAnalyseDeLaFiche({
  clientId,
  ficheHref,
}: {
  clientId: string;
  ficheHref: string;
}): Promise<React.ReactElement> {
  const lu = await lire(clientId);
  if (lu === null) return ILLISIBLE;
  const { ecran, Bloc } = lu;
  return <Bloc ecran={ecran} clientId={clientId} ficheHref={ficheHref} />;
}
