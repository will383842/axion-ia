import { SectionFiche } from "./visuels/SectionFiche";
import { FriseParcours, type JalonParcours } from "./visuels/FriseParcours";
import type { EnteteProp } from "./BlocsTransformation";

/** Parcours : faits fournis par la personne ; aucun nombre de collaborateurs. */
export function ParcoursSection({
  donnees,
  entete,
  id = "parcours",
}: {
  donnees: { titre: string; blocs: ReadonlyArray<JalonParcours> };
  entete?: EnteteProp;
  id?: string;
}) {
  return (
    <SectionFiche
      id={id}
      ton="papier"
      entete={entete ?? { surTitre: "Parcours", question: donnees.titre }}
    >
      <FriseParcours jalons={donnees.blocs} />
    </SectionFiche>
  );
}
