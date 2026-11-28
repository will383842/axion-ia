import { Section } from "@/components/layout/Section";
import { FriseEtapes, type EtapeFrise } from "./visuels/FriseEtapes";

/** Méthode : frise d'étapes (un `h3` par étape, dans une liste ordonnée). */
export function MethodeCollaborateur({
  donnees,
}: {
  donnees: { titre: string; etapes: ReadonlyArray<EtapeFrise>; conclusion?: string | undefined };
}) {
  return (
    <Section tone="sand" title={donnees.titre}>
      <FriseEtapes etapes={donnees.etapes} conclusion={donnees.conclusion} ton="creme" />
    </Section>
  );
}
