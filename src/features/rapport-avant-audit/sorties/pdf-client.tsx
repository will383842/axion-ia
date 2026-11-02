/**
 * Rapport avant audit — PDF CLIENT (2026-11-02).
 *
 * Rend la `VueClient` (jamais la base complète : le filtre est la seule porte d'entrée).
 * Charte Axion via les tokens de marque (Fraunces / Manrope, aucune couleur en dur).
 *
 * 🔴 Import serveur / worker UNIQUEMENT — jamais depuis une page cliente (budget bundle).
 * 🔴 `assainirEspacesPdf` est importé, jamais recopié (fines insécables → « / » sinon).
 * 🔴 Pas de `lineHeight` sur la `Page` : il fait disparaître le pied `fixed` (voir
 *    `plan-production-pdf.tsx`). L'interligne est porté par les styles de texte.
 *
 * NE PAS "use client".
 */

/* eslint-disable react/no-unescaped-entities -- texte français : l'apostrophe droite est voulue (rendu PDF, pas du HTML) */
import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import {
  brandColor,
  QUALIOPI_BRAND_FONTS as F,
  QUALIOPI_PDF_TYPE as T,
  QUALIOPI_PDF_SPACE as S,
} from "@/server/qualiopi/brand/brand-tokens";
import { registerQualiopiPdfFonts } from "@/server/qualiopi/documents/fonts";
import { assainirEspacesPdf } from "@/server/qualiopi/documents/base-layout";

import type { BaseAudit } from "../base-audit-schema";
import {
  filtrerPourClient,
  LIBELLE_CATEGORIE,
  LIBELLE_TENDANCE,
  type VueClient,
} from "./filtre-client";

registerQualiopiPdfFonts();

export const MENTION_IA =
  "Rapport préparé avec l'aide d'une intelligence artificielle et relu par Axion IA.";

/** Emoji, flèches, dingbats : aucune police du dossier ne les porte (voir plan-production-pdf). */
const NON_IMPRIMABLES =
  /[\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}\u{200D}]/gu;

function txt(v: string | null | undefined): string {
  return assainirEspacesPdf(v ?? "").replace(NON_IMPRIMABLES, "");
}

function dateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return txt(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

function euros(n: number | null): string {
  return n === null ? "—" : `${Math.round(n).toLocaleString("fr-FR")} €`;
}

export const styles = StyleSheet.create({
  page: {
    paddingTop: S.page,
    paddingHorizontal: S.page,
    paddingBottom: 56,
    fontSize: T.base,
    fontFamily: F.sans,
    color: brandColor("fg"),
    backgroundColor: brandColor("paper"),
  },
  couverture: { flexGrow: 1, justifyContent: "center" },
  eyebrow: {
    fontSize: T.sm,
    letterSpacing: T.trackingWide,
    textTransform: "uppercase",
    color: brandColor("terracotta"),
    marginBottom: S.xl,
  },
  titreCouverture: {
    fontFamily: F.serif,
    fontSize: T.display + 12,
    color: brandColor("mocha"),
    marginBottom: S.xl,
  },
  regle: {
    borderBottomWidth: 2,
    borderBottomColor: brandColor("terracotta"),
    width: 80,
    marginBottom: S.xxl,
  },
  societe: { fontSize: T.lg, color: brandColor("fg-soft"), marginBottom: S.md },
  dateCouverture: { fontSize: T.sm, color: brandColor("fg-muted"), marginBottom: S.xxxl },
  mention: {
    fontSize: T.sm,
    lineHeight: T.lineNormal,
    color: brandColor("fg-soft"),
    backgroundColor: brandColor("sand"),
    borderLeftWidth: 3,
    borderLeftColor: brandColor("terracotta"),
    borderRadius: S.radius,
    paddingVertical: S.lg,
    paddingHorizontal: S.xl,
  },
  titreSection: {
    fontFamily: F.serif,
    fontSize: T.xl,
    color: brandColor("mocha"),
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border-strong"),
    paddingBottom: S.md,
    marginBottom: S.xl,
    marginTop: S.xxl,
  },
  sousTitre: {
    fontSize: T.md,
    fontWeight: "bold",
    color: brandColor("mocha"),
    marginBottom: S.md,
    marginTop: S.lg,
  },
  intro: {
    fontSize: T.sm,
    lineHeight: T.lineNormal,
    color: brandColor("fg-muted"),
    marginBottom: S.xl,
  },
  texte: { fontSize: T.base, lineHeight: T.lineRelaxed, marginBottom: S.md },
  vide: {
    fontSize: T.sm,
    lineHeight: T.lineNormal,
    fontStyle: "italic",
    color: brandColor("fg-muted"),
  },
  carte: {
    borderWidth: 1,
    borderColor: brandColor("border"),
    borderRadius: S.radius,
    padding: S.xl,
    marginBottom: S.lg,
  },
  carteTitre: {
    fontSize: T.md,
    fontWeight: "bold",
    color: brandColor("mocha"),
    marginBottom: S.sm,
  },
  meta: { fontSize: T.xs, color: brandColor("fg-muted"), marginBottom: S.md },
  citation: {
    fontFamily: F.serif,
    fontStyle: "italic",
    fontSize: T.sm,
    lineHeight: T.lineNormal,
    color: brandColor("fg-soft"),
    borderLeftWidth: 2,
    borderLeftColor: brandColor("border-strong"),
    paddingLeft: S.lg,
    marginBottom: S.sm,
  },
  puce: { flexDirection: "row", marginBottom: S.sm },
  puceMarque: { width: 10, color: brandColor("terracotta") },
  puceTexte: { flex: 1, fontSize: T.base, lineHeight: T.lineNormal },
  rappel: {
    fontSize: T.xs,
    lineHeight: T.lineNormal,
    color: brandColor("terracotta-deep"),
    marginTop: S.sm,
  },
  ligne: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border"),
    paddingVertical: S.md,
  },
  cellule: { flex: 1, fontSize: T.sm },
  celluleForte: { flex: 1, fontSize: T.sm, fontWeight: "bold" },
  pied: {
    position: "absolute",
    left: S.page,
    right: S.page,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: brandColor("border"),
    paddingTop: S.md,
  },
  piedTexte: { fontSize: T.xs, color: brandColor("fg-muted") },
});

function Puce({ children }: { children: string }): React.ReactElement {
  return (
    <View style={styles.puce} wrap={false}>
      <Text style={styles.puceMarque}>•</Text>
      <Text style={styles.puceTexte}>{txt(children)}</Text>
    </View>
  );
}

function Pied({ societe }: { societe: string }): React.ReactElement {
  return (
    <View style={styles.pied} fixed>
      <Text style={styles.piedTexte}>{txt(`${societe} · Rapport avant audit · Axion IA`)}</Text>
      <Text
        style={styles.piedTexte}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

const Titre = ({ children }: { children: string }): React.ReactElement => (
  <Text style={styles.titreSection} minPresenceAhead={80}>
    {txt(children)}
  </Text>
);

export function RapportClientPdf({ vue }: { vue: VueClient }): React.ReactElement {
  const ev = vue.evolution;
  return (
    <Document
      title={txt(`Rapport avant audit — ${vue.raisonSociale}`)}
      author="Axion IA"
      subject="Rapport avant audit"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.couverture}>
          <Text style={styles.eyebrow}>Axion IA</Text>
          <Text style={styles.titreCouverture}>Rapport avant audit</Text>
          <View style={styles.regle} />
          <Text style={styles.societe}>{txt(vue.raisonSociale)}</Text>
          <Text style={styles.dateCouverture}>{dateFr(vue.genereLe)}</Text>
          <Text style={styles.mention}>{MENTION_IA}</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Titre>Ce que vous nous avez dit</Titre>
        <Text style={styles.intro}>
          Voici, avec vos mots, ce que vous attendez de cet accompagnement et ce qui vous pèse. Tout
          le reste de ce rapport part de là.
        </Text>
        {vue.besoins.length === 0 ? (
          <Text style={styles.vide}>Aucun besoin n'a été exprimé dans les réponses reçues.</Text>
        ) : (
          vue.besoins.map((b) => (
            <View key={b.id} style={styles.carte} wrap={false}>
              <Text style={styles.carteTitre}>{txt(b.enonce)}</Text>
              <Text style={styles.meta}>
                {LIBELLE_CATEGORIE[b.categorie]} · importance {b.intensite} · évoqué par{" "}
                {b.nbPersonnes} {b.nbPersonnes > 1 ? "personnes" : "personne"}
              </Text>
              {b.motsDesEquipes.map((c, i) => (
                <Text key={i} style={styles.citation}>
                  « {txt(c)} »
                </Text>
              ))}
            </View>
          ))
        )}

        {vue.comprehension.length > 0 ? (
          <Titre>Ce que nous avons compris de votre entreprise</Titre>
        ) : null}
        {vue.comprehension.map((s) => (
          <View key={s.cle}>
            <Text style={styles.sousTitre} minPresenceAhead={40}>
              {txt(s.titre)}
            </Text>
            {s.elements.map((e, i) => (
              <Puce key={i}>
                {`${e.libelle} : ${e.valeur}${e.confiance === "probable" ? " (à confirmer)" : ""}`}
              </Puce>
            ))}
          </View>
        ))}

        <Titre>L'évolution de votre chiffre d'affaires</Titre>
        {ev.exercices.length === 0 ? (
          <Text style={styles.vide}>
            Nous n'avons pas trouvé de chiffres publiés suffisamment sûrs pour en parler.
          </Text>
        ) : (
          <View>
            <View style={styles.ligne}>
              <Text style={styles.celluleForte}>Année</Text>
              <Text style={styles.celluleForte}>Chiffre d'affaires</Text>
              <Text style={styles.celluleForte}>Résultat net</Text>
              <Text style={styles.celluleForte}>Effectif</Text>
            </View>
            {ev.exercices.map((x) => (
              <View key={x.annee} style={styles.ligne} wrap={false}>
                <Text style={styles.cellule}>{x.annee}</Text>
                <Text style={styles.cellule}>{txt(euros(x.chiffreAffairesEur))}</Text>
                <Text style={styles.cellule}>{txt(euros(x.resultatNetEur))}</Text>
                <Text style={styles.cellule}>{txt(x.effectif ?? "—")}</Text>
              </View>
            ))}
            {ev.tendance !== "indeterminee" ? (
              <Text style={[styles.texte, { marginTop: S.lg }]}>
                {`Tendance : activité ${LIBELLE_TENDANCE[ev.tendance]}.`}
                {ev.lecture ? ` ${txt(ev.lecture)}` : ""}
              </Text>
            ) : null}
          </View>
        )}

        <Titre>Ce qui vous fait perdre du temps, service par service</Titre>
        {vue.difficultesParService.length === 0 ? (
          <Text style={styles.vide}>Aucune difficulté n'a été décrite par service.</Text>
        ) : (
          vue.difficultesParService.map((d) => (
            <View key={d.service} wrap={false}>
              <Text style={styles.sousTitre}>{txt(d.service)}</Text>
              {d.difficultes.map((x, i) => (
                <Puce key={`d${i}`}>{x}</Puce>
              ))}
              {d.tachesRepetitives.map((x, i) => (
                <Puce key={`t${i}`}>{`Tâche répétitive : ${x}`}</Puce>
              ))}
            </View>
          ))
        )}

        <Titre>Nos pistes, classées</Titre>
        <Text style={styles.intro}>
          Chaque piste rappelle le besoin qu'elle sert. Gain et effort sont des ordres de grandeur
          qualitatifs, pas des engagements.
        </Text>
        {vue.pistes.length === 0 ? (
          <Text style={styles.vide}>Aucune piste n'est retenue à ce stade.</Text>
        ) : (
          vue.pistes.map((p) => (
            <View key={p.id} style={styles.carte} wrap={false}>
              <Text style={styles.carteTitre}>{txt(`${p.rang}. ${p.titre}`)}</Text>
              <Text style={styles.meta}>
                Gain attendu : {p.gain} · effort : {p.effort}
              </Text>
              <Text style={styles.texte}>{txt(p.description)}</Text>
              {p.besoinsServis.map((b) => (
                <Text key={b.id} style={styles.rappel}>
                  {txt(`Répond à votre besoin : ${b.enonce}`)}
                </Text>
              ))}
            </View>
          ))
        )}
        {vue.pistesHorsDemande.length > 0 ? (
          <View>
            <Text style={styles.sousTitre} minPresenceAhead={60}>
              Idées hors de votre demande
            </Text>
            <Text style={styles.intro}>
              Nous les signalons parce qu'elles nous ont semblé utiles ; elles ne répondent à aucun
              besoin que vous avez exprimé et ne sont pas classées.
            </Text>
            {vue.pistesHorsDemande.map((p) => (
              <Puce key={p.id}>{`${p.titre} — ${p.description}`}</Puce>
            ))}
          </View>
        ) : null}

        <Titre>La préparation de notre venue</Titre>
        {vue.preparationVenue.length === 0 ? (
          <Text style={styles.vide}>Nous n'avons pas de question particulière à vous poser.</Text>
        ) : (
          <View>
            <Text style={styles.intro}>
              Voici les points que nous aborderons avec vous sur place.
            </Text>
            {vue.preparationVenue.map((q, i) => (
              <Puce key={i}>{q.question}</Puce>
            ))}
          </View>
        )}

        {vue.sources.length > 0 ? (
          <View>
            <Titre>Nos sources</Titre>
            {vue.sources.map((s, i) => (
              <Puce key={i}>{s.url ? `${s.reference} — ${s.url}` : s.reference}</Puce>
            ))}
          </View>
        ) : null}

        <Text style={[styles.meta, { marginTop: S.xxxl }]}>{MENTION_IA}</Text>
        <Pied societe={vue.raisonSociale} />
      </Page>
    </Document>
  );
}

/** Rend le rapport client en PDF. Filtre d'abord : la base complète n'entre jamais dans le rendu. */
export async function genererPdfClient(base: BaseAudit): Promise<Buffer> {
  registerQualiopiPdfFonts();
  const stream = await pdf(<RapportClientPdf vue={filtrerPourClient(base)} />).toBuffer();
  return new Promise<Buffer>((resolve, reject) => {
    const morceaux: Buffer[] = [];
    stream.on("data", (m: Buffer | Uint8Array) =>
      morceaux.push(Buffer.isBuffer(m) ? m : Buffer.from(m)),
    );
    stream.on("end", () => resolve(Buffer.concat(morceaux)));
    stream.on("error", reject);
  });
}
