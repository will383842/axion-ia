// Les rendus apporteurs figés par FAC-10 (même entrée, même HTML avant et après l'extraction).
import { renderToStaticMarkup } from "react-dom/server";

import { ContratLisible } from "@/app/apporteur/dossier/[id]/[jeton]/ContratLisible";
import { Coquille, EcranEtat, EcranInvalide } from "@/app/apporteur/dossier/[id]/[jeton]/Coquille";
import { DepotPiece } from "@/app/apporteur/dossier/[id]/[jeton]/DepotPiece";
import { FormulaireRetrouver } from "@/app/apporteur/dossier/retrouver/FormulaireRetrouver";

const CONTRAT = [
  "## Article 1 — Objet",
  "Le **présent contrat** définit les *conditions* de la présentation.",
  "### 1.1 Durée",
  "> Une citation.",
  "| Col A | Col B |\n|---|---|\n| 1 | 2 |",
  "---",
  "Fin.",
].join("\n\n");

export function rendus(): Record<string, string> {
  const piece = { statut: "a_retransmettre" as const, motif: "illisible", nomFichier: "a.pdf" };
  return {
    coquilleAvecTitre: renderToStaticMarkup(
      <Coquille titre="Votre dossier">
        <p>contenu</p>
      </Coquille>,
    ),
    coquilleSansTitre: renderToStaticMarkup(
      <Coquille>
        <p>contenu</p>
      </Coquille>,
    ),
    ecranEtat: renderToStaticMarkup(
      <EcranEtat pastilleTexte="P" titre="T" ligne="L">
        <p>suite</p>
      </EcranEtat>,
    ),
    ecranEtatSucces: renderToStaticMarkup(
      <EcranEtat pastilleTexte="P" titre="T" ligne="L" succes />,
    ),
    ecranInvalide: renderToStaticMarkup(<EcranInvalide />),
    contrat: renderToStaticMarkup(<ContratLisible texte={CONTRAT} />),
    depotVide: renderToStaticMarkup(
      <DepotPiece
        id="i"
        jeton="j"
        type="rib"
        libelle="RIB"
        aide="Votre RIB"
        piece={null}
        motifLibelle={null}
      />,
    ),
    depotARenvoyer: renderToStaticMarkup(
      <DepotPiece
        id="i"
        jeton="j"
        type="vigilance"
        libelle="Attestation"
        aide="Moins de 6 mois"
        facultatif
        piece={piece}
        motifLibelle="Illisible"
        avecDate
      />,
    ),
    depotConforme: renderToStaticMarkup(
      <DepotPiece
        id="i"
        jeton="j"
        type="kbis"
        libelle="Kbis"
        aide="aide"
        piece={{ statut: "conforme", motif: null, nomFichier: "k.pdf" }}
        motifLibelle={null}
      />,
    ),
    retrouver: renderToStaticMarkup(<FormulaireRetrouver />),
  };
}
