/**
 * UnAUnTarget — Section "Pour qui ?" (5 personas) du service `un-a-un`.
 *
 * Sprint A Phase 2 — extrait depuis `src/app/[locale]/un-a-un/page.tsx`.
 * Réutilisé sur les ~430 pages ville (Phase 5). Pas de variation ville-aware
 * intentionnellement : les 5 personas sont génériques (manager / commercial /
 * RH / opérateur / dirigeant) et ne dépendent pas de la géo.
 *
 * Server Component pur, zéro JS.
 */

import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";

interface UnAUnTargetProps {
  readonly isFr: boolean;
}

export function UnAUnTarget({ isFr }: UnAUnTargetProps) {
  return (
    <Section
      eyebrow={isFr ? "Pour qui ?" : "Who for?"}
      title={isFr ? "Tout collaborateur" : "Any employee"}
      titleEm={isFr ? "qui veut vraiment maîtriser l'IA" : "who wants to truly master AI"}
      tone="sand"
    >
      <Container className="text-fg max-w-3xl space-y-5 text-lg leading-relaxed">
        <p>
          {isFr
            ? "Le 1-to-1 n'est pas réservé aux dirigeants. Il s'adresse à n'importe quel collaborateur de TPE, PME, ETI ou grande entreprise qui a un poste précis, des outils précis, et des objectifs précis — et qui veut intégrer l'IA dans son travail réel, pas dans un cours théorique."
            : "The 1-to-1 is not reserved for executives. It is for any employee in a small business, SME, mid-cap or large enterprise who has a specific role, specific tools, and specific objectives — and who wants to integrate AI into their actual work, not in a theoretical course."}
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            {isFr
              ? "Manager d'équipe qui veut gagner du temps sur le reporting et le pilotage"
              : "Team manager who wants to save time on reporting and management"}
          </li>
          <li>
            {isFr
              ? "Commercial qui veut accélérer la prospection et la rédaction de propositions"
              : "Sales rep who wants to accelerate prospecting and proposal writing"}
          </li>
          <li>
            {isFr
              ? "RH qui veut automatiser les tâches répétitives (fiches de poste, onboarding, suivi)"
              : "HR professional who wants to automate repetitive tasks (job descriptions, onboarding, tracking)"}
          </li>
          <li>
            {isFr
              ? "Opérateur ou technicien qui veut utiliser l'IA pour documenter, analyser et décider plus vite"
              : "Operator or technician who wants to use AI to document, analyse and decide faster"}
          </li>
          <li>
            {isFr
              ? "Dirigeant qui veut comprendre et piloter l'IA sans passer par l'IT"
              : "Executive who wants to understand and steer AI without going through IT"}
          </li>
        </ul>
      </Container>
    </Section>
  );
}
