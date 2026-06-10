/**
 * Qualiopi — Template PDF : Questionnaire de satisfaction à chaud.
 *
 * 17 questions réparties :
 *   A) Contenu (4 questions), B) Animation/formateur (4),
 *   C) Organisation/logistique (3), D) Résultats/apports (2),
 *   Recommandation (Oui/Non/NSP), E) Commentaires libres (3).
 * Note globale /10. Nom optionnel (confidentiel).
 * Indicateur Qualiopi n°31.
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  pdfStyles,
  DocSection,
  FieldRow,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { brandColor } from "@/server/qualiopi/brand/brand-tokens";

// ============================================================
// Styles locaux
// ============================================================

const localStyles = StyleSheet.create({
  questionRow: {
    marginBottom: 10,
  },
  questionText: {
    fontSize: 10,
    color: brandColor("fg"),
    marginBottom: 4,
    fontWeight: "bold",
  },
  scaleRow: {
    flexDirection: "row",
    gap: 10,
  },
  scaleOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scaleBox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: brandColor("border-strong"),
    borderRadius: 7,
  },
  scaleLabel: {
    fontSize: 9,
    color: brandColor("fg-soft"),
  },
  yesNoRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 4,
  },
  yesNoOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  yesNoBox: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: brandColor("border-strong"),
  },
  yesNoLabel: {
    fontSize: 10,
    color: brandColor("fg"),
  },
  freeTextBox: {
    borderWidth: 1,
    borderColor: brandColor("border"),
    minHeight: 36,
    padding: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  noteGlobaleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: brandColor("sand"),
    borderRadius: 2,
    padding: 10,
    marginBottom: 12,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: brandColor("mocha"),
    flex: 1,
  },
  noteValueBox: {
    borderWidth: 2,
    borderColor: brandColor("terracotta"),
    borderRadius: 4,
    width: 50,
    height: 28,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
});

// ============================================================
// Types
// ============================================================

export interface SatisfactionData {
  numero: string;
  estCopie?: boolean;
  intituleFormation: string;
  dateSession: string;
  /** Nom optionnel (confidentiel). */
  nomStagiaire?: string;
}

// ============================================================
// Helpers
// ============================================================

/** Rendu d'une question avec échelle 1–5 (radio). */
function ScaleQuestion({ label, num }: { label: string; num: number }): React.ReactElement {
  return (
    <View style={localStyles.questionRow}>
      <Text style={localStyles.questionText}>
        {num}. {label}
      </Text>
      <View style={localStyles.scaleRow}>
        {([1, 2, 3, 4, 5] as const).map((v) => (
          <View key={v} style={localStyles.scaleOption}>
            <View style={localStyles.scaleBox} />
            <Text style={localStyles.scaleLabel}>{v}</Text>
          </View>
        ))}
        <Text style={[localStyles.scaleLabel, { marginLeft: 4, fontStyle: "italic" }]}>
          (1 = pas du tout satisfait · 5 = très satisfait)
        </Text>
      </View>
    </View>
  );
}

/** Rendu d'une question de commentaire libre. */
function FreeComment({ label, num }: { label: string; num: number }): React.ReactElement {
  return (
    <View style={localStyles.questionRow}>
      <Text style={localStyles.questionText}>
        {num}. {label}
      </Text>
      <View style={localStyles.freeTextBox} />
    </View>
  );
}

// ============================================================
// Composant
// ============================================================

export function SatisfactionPdf({
  data,
  identite,
}: {
  data: SatisfactionData;
  identite: OrganismeIdentite;
}): React.ReactElement {
  return (
    <Document>
      <QualiopiPage
        docTitle="Questionnaire de satisfaction à chaud"
        docNumber={data.numero}
        identite={identite}
        {...(data.estCopie !== undefined ? { estCopie: data.estCopie } : {})}
      >
        {/* Mention indicateur + intro */}
        <View style={{ marginBottom: 10 }}>
          <Text style={pdfStyles.legalNote}>
            Indicateur Qualiopi n°31 — Recueil de la satisfaction des bénéficiaires. Questionnaire
            anonyme (nom facultatif).
          </Text>
        </View>

        {/* En-tête formation */}
        <View style={{ marginBottom: 10 }}>
          <FieldRow label="Formation" value={data.intituleFormation} />
          <FieldRow label="Date de session" value={data.dateSession} />
          <FieldRow label="Nom (facultatif — confidentiel)" value={data.nomStagiaire ?? ""} />
        </View>

        {/* Note globale */}
        <View style={localStyles.noteGlobaleBox}>
          <Text style={localStyles.noteLabel}>Note globale de la formation</Text>
          <View style={localStyles.noteValueBox}>
            <Text style={{ fontSize: 12, fontWeight: "bold", color: brandColor("terracotta") }}>
              /10
            </Text>
          </View>
        </View>

        {/* A) Contenu */}
        <DocSection title="A — Contenu de la formation">
          <ScaleQuestion
            num={1}
            label="Les objectifs pédagogiques étaient clairs et adaptés à mes attentes."
          />
          <ScaleQuestion
            num={2}
            label="Le contenu était pertinent par rapport à mon activité professionnelle."
          />
          <ScaleQuestion
            num={3}
            label="La progression pédagogique était logique et bien structurée."
          />
          <ScaleQuestion
            num={4}
            label="Les supports et ressources mis à disposition étaient utiles."
          />
        </DocSection>

        {/* B) Animation / formateur */}
        <DocSection title="B — Animation et formateur / formatrice">
          <ScaleQuestion num={5} label="Le formateur maîtrisait les sujets traités." />
          <ScaleQuestion num={6} label="Les explications étaient claires et accessibles." />
          <ScaleQuestion
            num={7}
            label="Le formateur prenait en compte les questions et difficultés des participants."
          />
          <ScaleQuestion
            num={8}
            label="Le rythme et l'animation maintenaient mon attention et ma motivation."
          />
        </DocSection>

        {/* C) Organisation / logistique */}
        <DocSection title="C — Organisation et logistique">
          <ScaleQuestion
            num={9}
            label="Les informations pratiques (convocation, lieu/lien, horaires) étaient claires."
          />
          <ScaleQuestion
            num={10}
            label="Le cadre et les conditions de formation étaient adaptés (espace, matériel, connexion)."
          />
          <ScaleQuestion
            num={11}
            label="L'organisation générale (accueil, pauses, suivi) était satisfaisante."
          />
        </DocSection>

        {/* D) Résultats / apports */}
        <DocSection title="D — Résultats et apports personnels">
          <ScaleQuestion num={12} label="Cette formation a répondu à mes besoins et objectifs." />
          <ScaleQuestion
            num={13}
            label="Je me sens en mesure d'appliquer les compétences acquises dans mon travail."
          />
        </DocSection>

        {/* Recommandation */}
        <DocSection title="Recommanderiez-vous cette formation ?">
          <View style={localStyles.yesNoRow}>
            {(["Oui", "Non", "Ne sait pas"] as const).map((opt) => (
              <View key={opt} style={localStyles.yesNoOption}>
                <View style={localStyles.yesNoBox} />
                <Text style={localStyles.yesNoLabel}>{opt}</Text>
              </View>
            ))}
          </View>
        </DocSection>

        {/* E) Commentaires libres */}
        <DocSection title="E — Vos commentaires">
          <FreeComment
            num={14}
            label="Points forts de la formation (ce qui vous a le plus apporté)"
          />
          <FreeComment num={15} label="Axes d'amélioration (ce que vous modifieriez)" />
          <FreeComment num={16} label="Besoins ou attentes complémentaires pour la suite" />
        </DocSection>

        {/* Question 17 — synthèse ouverte */}
        <DocSection title="Synthèse">
          <FreeComment num={17} label="Commentaire libre — tout autre remarque ou suggestion" />
        </DocSection>

        <Text style={pdfStyles.legalNote}>
          Données traitées conformément au RGPD — Indicateur 31. Résultats agrégés pour amélioration
          continue. Droit d'accès : {identite.dpoEmail || identite.email || "contact@formation"}.
        </Text>
      </QualiopiPage>
    </Document>
  );
}
