/**
 * Qualiopi — Inventaire des moyens pédagogiques et techniques (doc A14).
 *
 * Preuve documentaire des indicateurs 17 (moyens humains et techniques),
 * 18 (coordination) et 19 (ressources pédagogiques). Liste l'inventaire par
 * catégorie (salles, matériel, plateformes, moyens humains) avec localisation
 * et date de dernière vérification.
 *
 * Document officiel numéroté (DocumentType `inventaire_moyens`, groupe AXI-FORM).
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, Text } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  DataTable,
  LegalCallout,
  pdfStyles,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export type MoyenCategorieData = "salle" | "materiel" | "plateforme" | "humain";

export interface MoyenInventaireData {
  categorie: MoyenCategorieData;
  libelle: string;
  description: string;
  localisation: string;
  actif: boolean;
  /** Date de dernière vérification formatée (fr-FR) — "" si jamais vérifié. */
  dateVerification: string;
}

export interface InventaireMoyensData {
  numero: string;
  estCopie?: boolean;
  /** Date d'édition formatée (fr-FR). */
  dateEdition: string;
  moyens: MoyenInventaireData[];
}

// ============================================================
// Libellés
// ============================================================

const CATEGORIE_LABELS: Record<MoyenCategorieData, string> = {
  salle: "Salles et locaux de formation",
  materiel: "Matériel pédagogique et technique",
  plateforme: "Plateformes et outils numériques",
  humain: "Moyens humains",
};

const CATEGORIE_ORDER: MoyenCategorieData[] = ["salle", "materiel", "plateforme", "humain"];

// ============================================================
// Composant
// ============================================================

export function InventaireMoyensPdf({
  data,
  identite,
}: {
  data: InventaireMoyensData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  return (
    <Document>
      <QualiopiPage
        docTitle="Inventaire des moyens pédagogiques"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie ? { estCopie: true as const } : {})}
      >
        <Text style={pdfStyles.paragraph}>
          Inventaire des moyens pédagogiques, techniques et humains mobilisés par l&apos;organisme
          de formation pour la réalisation de ses prestations — édité le {data.dateEdition}.
        </Text>

        {data.moyens.length === 0 ? (
          <Text style={pdfStyles.legalNote}>Aucun moyen pédagogique enregistré à ce jour.</Text>
        ) : (
          CATEGORIE_ORDER.map((categorie) => {
            const moyens = data.moyens.filter((m) => m.categorie === categorie);
            if (moyens.length === 0) return null;
            return (
              <DocSection key={categorie} title={CATEGORIE_LABELS[categorie]}>
                <DataTable
                  columns={[
                    { key: "libelle", header: "Libellé", flex: 2 },
                    { key: "description", header: "Description", flex: 3 },
                    { key: "localisation", header: "Localisation", flex: 2 },
                    { key: "verification", header: "Vérifié le", flex: 1 },
                    { key: "statut", header: "Statut", flex: 1 },
                  ]}
                  rows={moyens.map((m) => ({
                    libelle: m.libelle,
                    description: m.description || "—",
                    localisation: m.localisation || "—",
                    verification: m.dateVerification || "Non vérifié",
                    statut: m.actif ? "Actif" : "Retiré",
                  }))}
                />
              </DocSection>
            );
          })
        )}

        <LegalCallout variant="legal" title="Référentiel national qualité">
          Cet inventaire documente l&apos;adéquation des moyens humains et techniques aux
          prestations (indicateurs 17 et 18) et les ressources pédagogiques mises à disposition des
          bénéficiaires (indicateur 19). La date de vérification atteste du contrôle périodique de
          la disponibilité et de l&apos;adéquation de chaque moyen.
        </LegalCallout>
      </QualiopiPage>
    </Document>
  );
}
