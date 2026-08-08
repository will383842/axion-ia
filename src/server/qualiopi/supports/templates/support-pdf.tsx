/**
 * Qualiopi — Template PDF unique et paramétrique pour les supports de formation (T13).
 *
 * Rend tous les types de supports via un seul composant `SupportPdf`.
 * La mise en page s'adapte selon `data.type` (en-tête différencié, styles spéciaux).
 *
 * Charte : base-layout (QualiopiPage, DocSection, FieldRow, pdfStyles) + brand-tokens.
 * ZÉRO couleur en dur — uniquement brandColor().
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { QualiopiPage, DocSection, pdfStyles } from "@/server/qualiopi/documents/base-layout";
import { brandColor, QUALIOPI_BRAND_FONTS } from "@/server/qualiopi/brand/brand-tokens";
import type { SupportRenderInput, SupportContenu, BlocContenu } from "../types";

// ============================================================
// Styles locaux (zéro hex en dur)
// ============================================================

const local = StyleSheet.create({
  typeTag: {
    fontSize: 8,
    color: brandColor("primary-fg"),
    backgroundColor: brandColor("primary"),
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: "flex-start",
    marginBottom: 8,
    fontFamily: QUALIOPI_BRAND_FONTS.mono,
  },
  typeTagFormateur: {
    backgroundColor: brandColor("terracotta"),
  },
  typeTagStagiaire: {
    backgroundColor: brandColor("primary"),
  },
  typeTagEval: {
    backgroundColor: brandColor("mocha"),
  },
  paragraph: {
    fontSize: 10,
    color: brandColor("fg"),
    marginBottom: 4,
    lineHeight: 1.5,
  },
  bulletItem: {
    fontSize: 10,
    color: brandColor("fg"),
    paddingLeft: 10,
    marginBottom: 3,
    lineHeight: 1.5,
  },
  objectifItem: {
    fontSize: 10,
    color: brandColor("primary"),
    paddingLeft: 10,
    marginBottom: 3,
    lineHeight: 1.5,
    fontWeight: "bold",
  },
  exerciceBox: {
    borderLeftWidth: 3,
    borderLeftColor: brandColor("terracotta"),
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 6,
    backgroundColor: brandColor("sand"),
  },
  exerciceTitle: {
    fontSize: 10,
    fontFamily: QUALIOPI_BRAND_FONTS.serif,
    fontWeight: "bold",
    color: brandColor("terracotta"),
    marginBottom: 3,
  },
  noteBox: {
    borderLeftWidth: 2,
    borderLeftColor: brandColor("sage"),
    paddingLeft: 8,
    paddingVertical: 3,
    marginBottom: 4,
    backgroundColor: brandColor("sage-soft"),
  },
  noteText: {
    fontSize: 9,
    color: brandColor("fg-soft"),
    lineHeight: 1.4,
    fontStyle: "italic",
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  versionText: {
    fontSize: 8,
    color: brandColor("fg-muted"),
    fontFamily: QUALIOPI_BRAND_FONTS.mono,
  },
  grilleItem: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border"),
    marginBottom: 2,
  },
  grilleItemText: {
    fontSize: 10,
    color: brandColor("fg"),
    flex: 1,
  },

  // ---- Couverture (page de garde premium) ----
  coverPage: {
    paddingTop: 90,
    paddingHorizontal: 56,
    paddingBottom: 64,
    fontFamily: QUALIOPI_BRAND_FONTS.sans,
    backgroundColor: brandColor("paper"),
    position: "relative",
  },
  coverBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: brandColor("terracotta"),
  },
  coverEyebrow: {
    fontSize: 9,
    fontFamily: QUALIOPI_BRAND_FONTS.sans,
    fontWeight: "bold",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: brandColor("terracotta"),
    marginBottom: 6,
  },
  coverOrg: {
    fontSize: 13,
    fontFamily: QUALIOPI_BRAND_FONTS.serif,
    fontWeight: "bold",
    color: brandColor("mocha"),
    marginBottom: 48,
  },
  coverTypeLabel: {
    fontSize: 11,
    fontFamily: QUALIOPI_BRAND_FONTS.mono,
    color: brandColor("terracotta-deep"),
    letterSpacing: 1,
    marginBottom: 10,
  },
  coverTitle: {
    fontSize: 30,
    fontFamily: QUALIOPI_BRAND_FONTS.serif,
    fontWeight: "bold",
    color: brandColor("mocha"),
    lineHeight: 1.15,
    marginBottom: 20,
  },
  coverRule: {
    width: 80,
    height: 3,
    backgroundColor: brandColor("terracotta"),
    marginBottom: 24,
  },
  coverMetaBox: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: brandColor("border"),
    paddingTop: 16,
  },
  coverMetaRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  coverMetaLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: brandColor("fg-muted"),
    width: 90,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  coverMetaValue: {
    fontSize: 10,
    color: brandColor("fg"),
    flex: 1,
  },
  coverFooter: {
    position: "absolute",
    bottom: 44,
    left: 56,
    right: 56,
    borderTopWidth: 1,
    borderTopColor: brandColor("border"),
    paddingTop: 10,
  },
  coverFooterLine: {
    fontSize: 8,
    color: brandColor("fg-muted"),
    marginTop: 1,
  },

  // ---- Sommaire ----
  tocRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("sand"),
    marginBottom: 2,
  },
  tocNum: {
    fontSize: 10,
    fontFamily: QUALIOPI_BRAND_FONTS.mono,
    color: brandColor("terracotta-deep"),
    width: 24,
  },
  tocLabel: {
    fontSize: 10,
    color: brandColor("fg"),
    flex: 1,
  },
});

// ============================================================
// Helpers de rendu
// ============================================================

function typeTagStyle(type: SupportRenderInput["type"]) {
  if (type === "slides_formateur" || type === "guide_animation")
    return [local.typeTag, local.typeTagFormateur];
  if (type === "grille_eval") return [local.typeTag, local.typeTagEval];
  return [local.typeTag, local.typeTagStagiaire];
}

// Badge de type sur la page de garde et l'en-tête de contenu. Le style du
// badge est en MAJUSCULES ; les MOTS sont ceux du SSOT SUPPORT_TYPE_LABELS
// (support-builder.ts) — trois tables divergeaient avant le 2026-08-05, la
// parité MAJUSCULES ↔ SSOT est verrouillée par support-labels.spec.ts.
// Exportée pour ce test de parité.
export function typeLabelFr(type: SupportRenderInput["type"]): string {
  const labels: Record<SupportRenderInput["type"], string> = {
    slides_formateur: "LIVRET DE PROJECTION (FORMATEUR)",
    slides_stagiaire: "SUPPORT DE COURS (STAGIAIRE)",
    livret_stagiaire: "LIVRET STAGIAIRE",
    memo: "MÉMO RÉCAPITULATIF",
    guide_animation: "GUIDE D'ANIMATION",
    exercices: "CAHIER D'EXERCICES",
    grille_eval: "GRILLE D'ÉVALUATION",
    kit_formateur_imprime: "KIT FORMATEUR IMPRIMÉ",
  };
  return labels[type];
}

// ============================================================
// Rendu d'un BlocContenu
// ============================================================

function RenderBloc({ bloc }: { bloc: BlocContenu }): React.ReactElement {
  switch (bloc.type) {
    case "paragraphe":
      return <Text style={local.paragraph}>{bloc.texte ?? ""}</Text>;

    case "liste":
      return (
        <View>
          {(bloc.items ?? []).map((item, i) => (
            <Text key={i} style={local.bulletItem}>
              {"• "}
              {item}
            </Text>
          ))}
        </View>
      );

    case "objectif":
      return (
        <View>
          {(bloc.items ?? []).map((item, i) => (
            <Text key={i} style={local.objectifItem}>
              {"✓ "}
              {item}
            </Text>
          ))}
        </View>
      );

    case "exercice":
      return (
        <View style={local.exerciceBox}>
          {bloc.texte ? <Text style={local.exerciceTitle}>{bloc.texte}</Text> : null}
          {(bloc.items ?? []).map((item, i) => (
            <Text key={i} style={local.bulletItem}>
              {"• "}
              {item}
            </Text>
          ))}
        </View>
      );

    case "note":
      return (
        <View style={local.noteBox}>
          <Text style={local.noteText}>{bloc.texte ?? ""}</Text>
        </View>
      );

    default: {
      const _n: never = bloc.type;
      return <Text style={local.paragraph}>{String(_n)}</Text>;
    }
  }
}

// ============================================================
// Rendu d'une SectionContenu avec styles adaptés par type
// ============================================================

function RenderSection({
  section,
  type,
}: {
  section: SupportContenu["sections"][number];
  type: SupportRenderInput["type"];
}): React.ReactElement {
  // Pour la grille_eval : présentation spéciale items inline
  const isGrille = type === "grille_eval";

  if (isGrille) {
    return (
      <DocSection title={section.titre}>
        {section.blocs.map((bloc, i) => {
          if (bloc.type === "liste" && bloc.items) {
            return (
              <View key={i}>
                {bloc.items.map((item, j) => (
                  <View key={j} style={local.grilleItem}>
                    <Text style={local.grilleItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            );
          }
          return <RenderBloc key={i} bloc={bloc} />;
        })}
      </DocSection>
    );
  }

  return (
    <DocSection title={section.titre}>
      {section.blocs.map((bloc, i) => (
        <RenderBloc key={i} bloc={bloc} />
      ))}
    </DocSection>
  );
}

// ============================================================
// Couverture (page de garde premium)
// ============================================================

/** Formate une date ISO en JJ/MM/AAAA (défensif — retourne "" si invalide). */
function formatDateFr(iso: string | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function CoverPage({
  data,
  identite,
}: {
  data: SupportPdfProps["data"];
  identite: SupportPdfProps["identite"];
}): React.ReactElement {
  const formation = data.contenu.meta?.formation ?? data.titre;
  const modalite = data.contenu.meta?.modalite;
  const date = formatDateFr(data.contenu.meta?.date);
  const ids = [
    identite.qualiopi ? `Qualiopi ${identite.qualiopi}` : "",
    identite.nda ? `NDA ${identite.nda}` : "",
    identite.siret ? `SIRET ${identite.siret}` : "",
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Page size="A4" style={local.coverPage}>
      <View style={local.coverBand} fixed />
      <Text style={local.coverEyebrow}>Organisme de formation</Text>
      <Text style={local.coverOrg}>{identite.raisonSociale || "Axion-IA SAS"}</Text>

      <Text style={local.coverTypeLabel}>{typeLabelFr(data.type)}</Text>
      <Text style={local.coverTitle}>{formation}</Text>
      <View style={local.coverRule} />

      <View style={local.coverMetaBox}>
        {modalite ? (
          <View style={local.coverMetaRow}>
            <Text style={local.coverMetaLabel}>Modalité</Text>
            <Text style={local.coverMetaValue}>{modalite}</Text>
          </View>
        ) : null}
        <View style={local.coverMetaRow}>
          <Text style={local.coverMetaLabel}>Version</Text>
          <Text style={local.coverMetaValue}>{`v${String(data.version).padStart(2, "0")}`}</Text>
        </View>
        {date ? (
          <View style={local.coverMetaRow}>
            <Text style={local.coverMetaLabel}>Édité le</Text>
            <Text style={local.coverMetaValue}>{date}</Text>
          </View>
        ) : null}
      </View>

      <View style={local.coverFooter} fixed>
        {ids ? <Text style={local.coverFooterLine}>{ids}</Text> : null}
        <Text style={local.coverFooterLine}>
          Document pédagogique interne — reproduction interdite sans autorisation.
        </Text>
      </View>
    </Page>
  );
}

/** Sommaire : liste numérotée des sections (rendu si ≥ 4 sections). */
function Sommaire({ sections }: { sections: SupportContenu["sections"] }): React.ReactElement {
  return (
    <DocSection title="Sommaire">
      {sections.map((s, i) => (
        <View key={i} style={local.tocRow}>
          <Text style={local.tocNum}>{String(i + 1).padStart(2, "0")}</Text>
          <Text style={local.tocLabel}>{s.titre}</Text>
        </View>
      ))}
    </DocSection>
  );
}

// ============================================================
// Composant principal
// ============================================================

export interface SupportPdfProps {
  data: {
    type: SupportRenderInput["type"];
    titre: string;
    contenu: SupportContenu;
    version: number;
  };
  identite: SupportRenderInput["identite"];
}

/**
 * Template PDF paramétrique pour les supports de formation pédagogiques.
 * Enveloppé dans `<Document>` — prêt pour `renderPdfToBuffer`.
 */
export function SupportPdf({ data, identite }: SupportPdfProps): React.ReactElement {
  const docNumber = `v${String(data.version).padStart(2, "0")}`;
  const docTitle = data.titre;

  const sections = data.contenu.sections;
  const showSommaire = sections.length >= 4;

  return (
    <Document>
      {/* Page de garde premium */}
      <CoverPage data={data} identite={identite} />

      {/* Pages de contenu (en-tête + pied paginé de la charte) */}
      <QualiopiPage docTitle={docTitle} docNumber={docNumber} identite={identite}>
        {/* Tag type + version */}
        <View style={local.metaRow}>
          <Text style={typeTagStyle(data.type)}>{typeLabelFr(data.type)}</Text>
          <Text style={local.versionText}>Version {data.version}</Text>
        </View>

        {/* Sommaire (supports à plusieurs sections) */}
        {showSommaire ? <Sommaire sections={sections} /> : null}

        {/* Contenu — sections */}
        {sections.map((section, i) => (
          <RenderSection key={i} section={section} type={data.type} />
        ))}

        {/* Note légère de bas de document si méta disponible */}
        {data.contenu.meta?.formation ? (
          <Text style={pdfStyles.legalNote}>
            Document pédagogique interne — Formation : {data.contenu.meta.formation}
          </Text>
        ) : null}
      </QualiopiPage>
    </Document>
  );
}
