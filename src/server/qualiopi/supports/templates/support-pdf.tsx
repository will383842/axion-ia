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
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
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

function typeLabelFr(type: SupportRenderInput["type"]): string {
  const labels: Record<SupportRenderInput["type"], string> = {
    slides_formateur: "SLIDES FORMATEUR",
    slides_stagiaire: "SUPPORT DE COURS",
    livret_stagiaire: "LIVRET STAGIAIRE",
    memo: "MÉMO",
    guide_animation: "GUIDE D'ANIMATION",
    exercices: "CAHIER D'EXERCICES",
    grille_eval: "GRILLE D'ÉVALUATION",
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

  return (
    <Document>
      <QualiopiPage docTitle={docTitle} docNumber={docNumber} identite={identite}>
        {/* Tag type + version */}
        <View style={local.metaRow}>
          <Text style={typeTagStyle(data.type)}>{typeLabelFr(data.type)}</Text>
          <Text style={local.versionText}>Version {data.version}</Text>
        </View>

        {/* Contenu — sections */}
        {data.contenu.sections.map((section, i) => (
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
