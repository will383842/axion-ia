import { SectionFiche } from "./visuels/SectionFiche";
import { FriseEtapes, type EtapeFrise } from "./visuels/FriseEtapes";
import type { EnteteProp } from "./BlocsTransformation";

/** Méthode : frise d'étapes (un `h3` par étape, dans une liste ordonnée). */
export function MethodeCollaborateur({
  donnees,
  entete,
  id = "methode",
}: {
  donnees: { titre: string; etapes: ReadonlyArray<EtapeFrise>; conclusion?: string | undefined };
  entete?: EnteteProp;
  id?: string;
}) {
  return (
    <SectionFiche
      id={id}
      ton="ivoire"
      entete={entete ?? { surTitre: "Méthode", question: donnees.titre }}
    >
      <FriseEtapes etapes={donnees.etapes} conclusion={donnees.conclusion} ton="ivoire" />
    </SectionFiche>
  );
}
