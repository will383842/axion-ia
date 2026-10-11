// E-mails aux FORMATEURS INDÉPENDANTS (F1 à F60) — un seul châssis pour tous (lot L-ENV).
//
// Les textes vivent dans `formateur-independant-textes.ts` (NON VALIDÉS : rien ne part tant
// que Will ne les a pas validés, cf. l'adaptateur d'envoi). Ce fichier ne fait que les mettre
// en page sur le gabarit commun (`_layout.tsx`, bouton terracotta), comme les e-mails
// apporteurs : famille B sans rangée sociale, signature du fondateur ; famille A (lien
// personnel, code de signature) sans soupape ni réseau.
//
// Payload lu :
//   · `prenom`      — « Bonjour Prénom, » ;
//   · `etape`       — 1, 2… : l'étape d'une relance (J+3, J+7…), 1 par défaut ;
//   · `bouton`      — 1, 2… : le bouton à afficher quand un e-mail en propose plusieurs ;
//   · `lien`        — l'adresse du bouton, calculée par l'adaptateur (jamais le jeton du
//                     dossier dans le pied : `lienEspace` est recalculé à part) ;
//   · `valeurs`     — ce qui remplit les [crochets] ;
//   · `texteLibre`  — le texte réécrit par Will dans la console, à la place du corps.

import { Text } from "@react-email/components";
import type { ReactElement } from "react";

import { EmailLayout, emailStyles } from "./_layout";
import {
  LIGNE_OPPOSITION,
  TEXTES_FORMATEUR,
  type GabaritFormateurIndependant,
  type VarianteTexteFormateur,
} from "./formateur-independant-textes";
import type { Locale } from "../../../../prisma/generated/client";

interface Payload {
  prenom?: unknown;
  etape?: unknown;
  bouton?: unknown;
  lien?: unknown;
  valeurs?: unknown;
  texteLibre?: unknown;
}

function texte(x: unknown): string | null {
  return typeof x === "string" && x.trim() !== "" ? x.trim() : null;
}

function rang(x: unknown): number {
  return typeof x === "number" && Number.isInteger(x) && x >= 1 ? x - 1 : 0;
}

/** La variante demandée (étape), la première si l'étape n'existe pas. */
export function varianteDe(
  gabarit: GabaritFormateurIndependant,
  payload: Record<string, unknown>,
): VarianteTexteFormateur {
  const vs: readonly VarianteTexteFormateur[] = TEXTES_FORMATEUR[gabarit].variantes;
  return vs[rang((payload as Payload).etape)] ?? vs[0]!;
}

/** Remplit les [crochets] connus ; les autres restent tels quels (visibles à l'aperçu). */
export function remplir(gabarit: string, payload: Record<string, unknown>): string {
  const v = (payload as Payload).valeurs;
  const valeurs =
    v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  return gabarit.replace(/\[([^[\]]+)\]/g, (tout, cle: string) => {
    const val = Object.prototype.hasOwnProperty.call(valeurs, cle) ? texte(valeurs[cle]) : null;
    return val ?? tout;
  });
}

function premiereSouhaitable(paragraphes: readonly string[], objet: string): string {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const phrases = paragraphes
    .flatMap((p) => p.split("\n"))
    .flatMap((l) => l.replace(/^•\s*/, "").split(/(?<=[.!?:])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return phrases.find((s) => norm(s) !== norm(objet)) ?? "Axion-IA, formateurs indépendants";
}

export const sujetFormateur =
  (gabarit: GabaritFormateurIndependant) =>
  (_locale: Locale, payload: Record<string, unknown>): string =>
    remplir(varianteDe(gabarit, payload).objet, payload);

function Paragraphe({ texte: t }: { texte: string }): ReactElement {
  const lignes = t.split("\n");
  return (
    <Text style={emailStyles.paragraphStyle}>
      {lignes.map((l, i) => (
        <span key={i}>
          {i > 0 ? <br /> : null}
          {l}
        </span>
      ))}
    </Text>
  );
}

export function composantFormateur(gabarit: GabaritFormateurIndependant) {
  function EmailFormateurIndependant({
    locale,
    payload,
  }: {
    locale: Locale;
    payload: Record<string, unknown>;
  }): ReactElement {
    const fiche = TEXTES_FORMATEUR[gabarit];
    const p = payload as Payload;
    const v = varianteDe(gabarit, payload);
    const objet = remplir(v.objet, payload);
    const libre = texte(p.texteLibre);
    const paragraphes = libre
      ? libre
          .split(/\n\s*\n/)
          .map((x) => x.trim())
          .filter(Boolean)
      : v.paragraphes.map((x) => remplir(x, payload));
    const libelle = v.boutons[rang(p.bouton)] ?? v.boutons[0] ?? null;
    const lien = texte(p.lien);
    const prenom = texte(p.prenom);
    return (
      <EmailLayout
        famille={fiche.famille}
        preview={premiereSouhaitable(paragraphes, objet)}
        title={objet}
        locale={locale === "fr" ? "fr" : "en"}
        {...(libelle && lien
          ? { cta: { label: libelle, href: lien }, ctaSecret: fiche.famille === "A" }
          : {})}
        sansReseauxSociaux
        signature="fondateur-court"
      >
        <Text style={emailStyles.paragraphStyle}>{prenom ? `Bonjour ${prenom},` : "Bonjour,"}</Text>
        {paragraphes.map((x, i) => (
          <Paragraphe key={i} texte={x} />
        ))}
        {fiche.sollicitation ? (
          <Text
            style={{
              ...emailStyles.paragraphStyle,
              fontSize: "13px",
              color: emailStyles.COLORS.textMuted,
            }}
          >
            {LIGNE_OPPOSITION}
          </Text>
        ) : null}
      </EmailLayout>
    );
  }
  return EmailFormateurIndependant;
}

/** Les entrées du registre des gabarits (`index.tsx`), une par e-mail. */
export const ENTREES_FORMATEUR_INDEPENDANT = Object.fromEntries(
  (Object.keys(TEXTES_FORMATEUR) as GabaritFormateurIndependant[]).map((g) => [
    g,
    { subject: sujetFormateur(g), component: composantFormateur(g) },
  ]),
) as Record<
  GabaritFormateurIndependant,
  {
    subject: (locale: Locale, payload: Record<string, unknown>) => string;
    component: ReturnType<typeof composantFormateur>;
  }
>;
