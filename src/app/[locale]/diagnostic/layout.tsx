// Layout de `/[locale]/diagnostic` — le Score IA TPE-PME.
//
// Cette adresse était une page d'atterrissage publicitaire au layout NU (`FunnelShellStyle`
// masquait l'en-tête et le pied de page) et en `noindex`. Elle porte désormais un outil
// indexable : elle reprend l'en-tête et le pied de page standards du site public, rendus par
// `[locale]/layout`. Aucune métadonnée de robots ici : `page.tsx` déclare l'indexation.
// Pas de Clarity sur ce questionnaire (la route reste dans `AD_LANDING_SEGMENTS`) : aucun
// enregistrement de session ne doit voir les réponses.

export default function DiagnosticLayout({ children }: { children: React.ReactNode }) {
  return children;
}
