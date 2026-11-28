import { Section } from "@/components/layout/Section";
import { FriseParcours, type JalonParcours } from "./visuels/FriseParcours";

/** Parcours : faits fournis par la personne ; aucun nombre de collaborateurs. */
export function ParcoursSection({
  donnees,
}: {
  donnees: { titre: string; blocs: ReadonlyArray<JalonParcours> };
}) {
  return (
    <Section tone="paper" title={donnees.titre}>
      <FriseParcours jalons={donnees.blocs} />
    </Section>
  );
}
