/**
 * Qualiopi — Template PDF générique de registre (docs A3/A7/A8/A17/A18).
 *
 * Rendu tabulaire multi-pages d'un registre (réclamations, veille, revue de
 * direction, partenariats, sous-traitants). EXPORT D'ÉTAT à la volée : PAS un
 * document officiel numéroté (pas de DocumentGenere, pas de rétention 5 ans).
 *
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Document, Text } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DataTable,
  pdfStyles,
  type DataColumn,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// ============================================================
// Types
// ============================================================

export interface RegistreData {
  titre: string;
  sousTitre?: string;
  /** En-têtes de colonnes. */
  colonnes: string[];
  /** Lignes du registre — chaque ligne suit l'ordre de `colonnes`. */
  lignes: string[][];
  /** Mention de bas de page (contexte réglementaire de l'export). */
  mentionBasDePage?: string;
  /** Date d'édition formatée (fr-FR) — affichée dans l'encart numéro. */
  dateEdition: string;
}

// ============================================================
// Composant
// ============================================================

export function RegistrePdf({
  data,
  identite,
}: {
  data: RegistreData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  const columns: DataColumn[] = data.colonnes.map((header, i) => ({
    key: `c${i}`,
    header,
  }));
  const rows = data.lignes.map((ligne) =>
    Object.fromEntries(ligne.map((valeur, i) => [`c${i}`, valeur || "—"])),
  );

  return (
    <Document>
      <QualiopiPage
        docTitle={data.titre}
        docNumber={`Édité le ${data.dateEdition}`}
        identite={identite}
      >
        {data.sousTitre ? <Text style={pdfStyles.paragraph}>{data.sousTitre}</Text> : null}

        {data.lignes.length === 0 ? (
          <Text style={pdfStyles.legalNote}>Aucune entrée enregistrée à ce jour.</Text>
        ) : (
          <DataTable columns={columns} rows={rows} />
        )}

        {data.mentionBasDePage ? (
          <Text style={pdfStyles.legalNote}>{data.mentionBasDePage}</Text>
        ) : null}
      </QualiopiPage>
    </Document>
  );
}
