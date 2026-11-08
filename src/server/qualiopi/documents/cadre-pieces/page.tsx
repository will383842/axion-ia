/**
 * Cadre RECOPIÉ NON signable (page) — copie de `QualiopiPage` de base-layout.tsx,
 * styles via `pdfStylesPieces` (palette définitive). Ne remplace RIEN : les gabarits
 * signables gardent `base-layout.tsx`. Pied et filigranes recopiés à l'identique.
 *
 * Polices : enregistrées au chargement du module, comme base-layout (sinon Fraunces
 * est perdue quand ce module est importé seul).
 */
import React from "react";
import { Page, Text, View } from "@react-pdf/renderer";
import { registerQualiopiPdfFonts } from "@/server/qualiopi/documents/fonts";
import { SEGMENT_ESSAI } from "@/server/qualiopi/essai/numerotation";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { pdfStylesPieces } from "@/server/qualiopi/documents/cadre-pieces/styles-blocs";

registerQualiopiPdfFonts();

const pdfStyles = pdfStylesPieces;

interface QualiopiPageProps {
  docTitle: string;
  docNumber: string;
  identite: OrganismeIdentite;
  estCopie?: boolean;
  /**
   * Document déclassé faute d'identité complète : filigrane « SPÉCIMEN » et
   * bandeau d'explication en tête. Injecté par `generateDocument`, jamais
   * par les appelants (cf. `avecMarquageSpecimen`).
   */
  estSpecimen?: boolean;
  /** Motif du déclassement, affiché dans le bandeau (champs manquants). */
  specimenMotif?: string;
  /** Sur-titre optionnel au-dessus de la raison sociale (ex. « Organisme de formation »). */
  eyebrow?: string;
  children: React.ReactNode;
}

/** Joint des fragments non vides avec un séparateur (ignore "", null, undefined). */
function joinDefined(parts: Array<string | null | undefined>, sep: string): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(sep);
}

/**
 * Wrapper de page A4 avec en-tête organisme, encart numéro de document,
 * filigrane "COPIE" optionnel, et pied de page paginé portant l'identité +
 * l'adresse postale complète de l'OF (répétée sur chaque page — pièce d'audit).
 *
 * Les templates de documents l'enveloppent dans `<Document>`.
 */
export function QualiopiPage({
  docTitle,
  docNumber,
  identite,
  estCopie = false,
  estSpecimen = false,
  specimenMotif,
  eyebrow = "Organisme de formation",
  children,
}: QualiopiPageProps): React.ReactElement {
  const footerIds = joinDefined(
    [
      identite.siret ? `SIRET ${identite.siret}` : "",
      // 🔴 L'absence de NDA est DITE, pas passée sous silence.
      //
      // Le pied de page omettait simplement la mention : un auditeur ne voyait
      // rien, et ne pouvait pas distinguer un oubli de saisie d'une situation
      // légitime. Or elle l'est souvent — l'art. L.6351-1 fait courir le délai
      // de déclaration à compter de la PREMIÈRE convention, si bien qu'au
      // moment de l'émettre l'organisme n'a pas encore de numéro.
      //
      // ⚠️ La formulation ne prétend PAS qu'un dossier a été déposé (« en cours
      // d'enregistrement » serait une affirmation invérifiable, fausse si rien
      // n'a été déposé). Elle constate l'absence et cite l'article qui la rend
      // possible. C'est la même règle que partout ailleurs dans ce dépôt : dire
      // ce qui est, jamais ce qui arrange.
      identite.nda
        ? `NDA ${identite.nda}`
        : "Déclaration d'activité non encore enregistrée (art. L.6351-1 C. trav.)",
      identite.qualiopi ? `Qualiopi ${identite.qualiopi}` : "",
    ],
    "  ·  ",
  );
  const footerContact = joinDefined([identite.email, identite.telephone, identite.site], "  ·  ");
  // QNC L02 — une pièce d'essai se reconnaît à son numéro (`-ESSAI-`, hors
  // suite légale) : aucun gabarit n'a de drapeau à transmettre, et la copie
  // signée ou la réimpression d'une pièce d'essai garde son filigrane.
  const estEssai = docNumber.includes(SEGMENT_ESSAI);

  return (
    <Page size="A4" style={pdfStyles.page}>
      {/* Filigrane ESSAI (QNC L02) — `fixed` : répété sur chaque page. */}
      {estEssai && (
        <Text style={pdfStyles.watermarkSpecimen} fixed>
          ESSAI
        </Text>
      )}

      {/* Filigrane COPIE */}
      {estCopie && <Text style={pdfStyles.watermark}>COPIE</Text>}

      {/* Filigrane SPÉCIMEN — identité de l'OF incomplète (art. L.6353-1 C. trav.,
          L441-9 C. com.). Le document reste produit pour que la chaîne soit
          exerçable, mais ne peut pas être confondu avec une pièce valable. */}
      {estSpecimen && <Text style={pdfStyles.watermarkSpecimen}>SPÉCIMEN</Text>}

      {/* En-tête */}
      <View style={pdfStyles.header} fixed>
        <View style={pdfStyles.headerLeft}>
          {eyebrow ? <Text style={pdfStyles.headerEyebrow}>{eyebrow}</Text> : null}
          <Text style={pdfStyles.headerTitle}>{identite.raisonSociale || "Axion-IA SAS"}</Text>
          {identite.adresseSiege ? (
            <Text style={pdfStyles.headerMeta}>{identite.adresseSiege}</Text>
          ) : null}
          {footerIds ? <Text style={pdfStyles.headerMeta}>{footerIds}</Text> : null}
        </View>
        <View style={pdfStyles.headerDocBox}>
          <Text style={pdfStyles.headerDocLabel}>{docTitle}</Text>
          <Text style={pdfStyles.headerDocNumber}>{docNumber}</Text>
        </View>
      </View>

      {/* Bandeau SPÉCIMEN — dit explicitement pourquoi le document est déclassé
          et ce qu'il faut renseigner. Le filigrane seul ne suffit pas : le
          lecteur doit savoir quoi corriger. */}
      {estSpecimen && (
        <View style={pdfStyles.specimenBanner}>
          <Text style={pdfStyles.specimenBannerTitle}>SPÉCIMEN — sans valeur juridique</Text>
          <Text style={pdfStyles.specimenBannerText}>
            {specimenMotif ??
              "Identité de l'organisme incomplète : ce document ne peut pas être remis à un client, un financeur ou un auditeur."}
          </Text>
        </View>
      )}

      {estEssai && (
        <View style={pdfStyles.specimenBanner}>
          <Text style={pdfStyles.specimenBannerTitle}>ESSAI — pièce sans valeur</Text>
          <Text style={pdfStyles.specimenBannerText}>
            Pièce d&apos;une session d&apos;essai interne : numéro hors suite légale, jamais remise
            à un client, un financeur ou un auditeur comme pièce réelle.
          </Text>
        </View>
      )}

      {/* Contenu */}
      {children}

      {/* Pied de page — répété sur chaque page (fixed) */}
      <View style={pdfStyles.footer} fixed>
        <View style={pdfStyles.footerIdentity}>
          <Text style={pdfStyles.footerOrg}>
            {joinDefined([identite.raisonSociale || "Axion-IA SAS", identite.adresseSiege], " — ")}
          </Text>
          {footerIds ? <Text style={pdfStyles.footerLine}>{footerIds}</Text> : null}
          {footerContact ? <Text style={pdfStyles.footerLine}>{footerContact}</Text> : null}
        </View>
        <Text
          style={pdfStyles.footerPage}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          fixed
        />
      </View>
    </Page>
  );
}
