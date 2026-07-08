/**
 * Qualiopi — Supports : rendu PDF 16:9 du diaporama de PROJECTION.
 *
 * @react-pdf/renderer en page PAYSAGE 16:9 (1 slide = 1 page), design premium
 * (fond de couleur par type de slide, gros titres lisibles au projecteur, texte
 * minimal). Charte QUALIOPI_BRAND_*. NE PAS "use client" — rendu serveur.
 *
 * Les notes orateur ne sont PAS rendues ici (elles vivent dans le .pptx éditable
 * et/ou le guide d'animation). Ce PDF = ce qui est projeté à l'écran uniquement.
 */

import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { registerQualiopiPdfFonts } from "@/server/qualiopi/documents/fonts";
import {
  QUALIOPI_BRAND_COLORS as C,
  QUALIOPI_BRAND_FONTS as F,
} from "@/server/qualiopi/brand/brand-tokens";
import type { DeckModel, Slide } from "./deck-model";

registerQualiopiPdfFonts();

// 16:9 en points PDF (1 pt = 1/72"). 720×405 pt ≈ 25.4×14.3 cm.
const W = 720;
const H = 405;

const s = StyleSheet.create({
  page: { width: W, height: H, position: "relative", fontFamily: F.sans, color: C.fg },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  pad: { position: "absolute", top: 48, left: 56, right: 56, bottom: 48 },
  eyebrow: {
    fontSize: 11,
    fontFamily: F.sans,
    fontWeight: "bold",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: C.terracotta,
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontFamily: F.serif,
    fontWeight: "bold",
    lineHeight: 1.12,
    color: C.mocha,
  },
  titleLight: { color: C.paper },
  coverTitle: {
    fontSize: 40,
    fontFamily: F.serif,
    fontWeight: "bold",
    color: C.paper,
    lineHeight: 1.1,
  },
  rule: { width: 90, height: 4, backgroundColor: C.terracotta, marginTop: 18, marginBottom: 18 },
  bullet: { flexDirection: "row", marginBottom: 12, alignItems: "flex-start" },
  bulletDot: { width: 16, fontSize: 18, color: C.terracotta, fontWeight: "bold" },
  bulletText: { flex: 1, fontSize: 18, lineHeight: 1.35, color: C.fg },
  bulletTextLight: { flex: 1, fontSize: 18, lineHeight: 1.35, color: C.paper },
  band: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: C.terracotta,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 8, color: C["fg-muted"], opacity: 0.5 },
  quizOpt: {
    fontSize: 18,
    color: C.fg,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: C.paper,
    borderRadius: 6,
  },
  sectionImg: { position: "absolute", top: 0, right: 0, width: W * 0.42, height: H },
  bigNum: {
    fontSize: 120,
    fontFamily: F.serif,
    fontWeight: "bold",
    color: C.terracotta,
    opacity: 0.14,
  },
});

/** Fond selon le type de slide (contraste projeté). */
function bg(kind: Slide["kind"]): string {
  switch (kind) {
    case "cover":
      return C.mocha;
    case "section":
      return C.primary;
    case "closing":
      return C.mocha;
    case "quiz":
      return C.sand;
    case "synthese":
      return C["terracotta-soft"];
    default:
      return C.paper;
  }
}

function isDark(kind: Slide["kind"]): boolean {
  return kind === "cover" || kind === "section" || kind === "closing";
}

function SlidePage({
  slide,
  index,
  total,
  formation,
  imageData,
}: {
  slide: Slide;
  index: number;
  total: number;
  formation: string;
  imageData?: string;
}): React.ReactElement {
  const dark = isDark(slide.kind);
  const titleStyle = dark ? [s.title, s.titleLight] : [s.title];
  const bulletTxt = dark ? s.bulletTextLight : s.bulletText;

  return (
    <Page size={{ width: W, height: H }} style={s.page}>
      <View style={[s.fill, { backgroundColor: bg(slide.kind) }]} />
      {!dark && <View style={s.band} />}
      {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image n'a pas de prop alt */}
      {slide.kind === "section" && imageData ? (
        <Image src={imageData} style={s.sectionImg} />
      ) : null}

      <View style={s.pad}>
        {slide.eyebrow ? (
          <Text style={[s.eyebrow, dark ? { color: C["mocha-fg"] } : {}]}>{slide.eyebrow}</Text>
        ) : null}

        {slide.kind === "cover" ? (
          <>
            <Text style={s.coverTitle}>{slide.titre}</Text>
            <View style={s.rule} />
          </>
        ) : (
          <Text style={titleStyle}>{slide.titre}</Text>
        )}

        {slide.puces && slide.puces.length > 0 ? (
          <View style={{ marginTop: 22 }}>
            {slide.puces.map((p, i) =>
              slide.kind === "quiz" ? (
                <Text key={i} style={s.quizOpt}>
                  {p}
                </Text>
              ) : (
                <View key={i} style={s.bullet}>
                  <Text style={[s.bulletDot, dark ? { color: C["mocha-fg"] } : {}]}>{"›"}</Text>
                  <Text style={bulletTxt}>{p}</Text>
                </View>
              ),
            )}
          </View>
        ) : null}
      </View>

      <View style={s.footer}>
        <Text style={[s.footerText, dark ? { color: C.paper } : {}]}>{formation}</Text>
        <Text style={[s.footerText, dark ? { color: C.paper } : {}]}>
          {index + 1} / {total}
        </Text>
      </View>
    </Page>
  );
}

export interface DeckPdfProps {
  deck: DeckModel;
  /** Images d'illustration par clé (data URI PNG) — optionnel. */
  images?: Record<string, string>;
}

export function DeckPdf({ deck, images }: DeckPdfProps): React.ReactElement {
  const total = deck.slides.length;
  return (
    <Document>
      {deck.slides.map((slide, i) => (
        <SlidePage
          key={i}
          slide={slide}
          index={i}
          total={total}
          formation={deck.titreFormation}
          {...(slide.imageKey && images?.[slide.imageKey]
            ? { imageData: images[slide.imageKey] }
            : {})}
        />
      ))}
    </Document>
  );
}
