/**
 * Petits blocs communs aux gabarits de formation au style de la charte 2027
 * (programme, convocation, attestation, attestation partielle, certificat de réalisation).
 *
 * `charte/v1` est GELÉE : on l'importe, on ne la modifie pas. Ce qui lui manque (note légale,
 * ligne de résultat, bloc de vérification par QR, cadre de signature et de cachet) vit ICI,
 * à côté des gabarits, avec les couleurs et les tailles de la charte (aucun hexadécimal en dur).
 *
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";

import { CHARTE_COULEURS, CHARTE_RAYONS, CHARTE_TYPO, Carte } from "../charte/v1";

const s = StyleSheet.create({
  paragraphe: {
    fontSize: CHARTE_TYPO.corps.taille,
    lineHeight: CHARTE_TYPO.corps.interligne,
    color: CHARTE_COULEURS.texte,
    marginBottom: 4,
  },
  gras: { fontWeight: CHARTE_TYPO.graisses.grasse },
  note: {
    fontSize: CHARTE_TYPO.petit.taille,
    lineHeight: CHARTE_TYPO.corps.interligne,
    color: CHARTE_COULEURS.texte,
    fontStyle: "italic",
    marginTop: 4,
  },
  resultat: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: CHARTE_COULEURS.grisChaud,
  },
  resultatLibelle: {
    width: 150,
    fontSize: CHARTE_TYPO.petit.taille,
    fontWeight: CHARTE_TYPO.graisses.grasse,
    color: CHARTE_COULEURS.texte,
  },
  resultatValeur: { flex: 1, fontSize: CHARTE_TYPO.corps.taille, color: CHARTE_COULEURS.texte },
  qr: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  qrTexte: { flex: 1 },
  qrToken: {
    fontSize: CHARTE_TYPO.petit.taille,
    fontFamily: "Inconsolata",
    color: CHARTE_COULEURS.texte,
    marginBottom: 2,
  },
  qrUrl: {
    fontSize: CHARTE_TYPO.petit.taille,
    color: CHARTE_COULEURS.bleu,
    marginBottom: 2,
  },
  signature: { flexDirection: "row", gap: 10 },
  signatureCadre: {
    flex: 1,
    minHeight: 84,
    padding: 10,
    borderWidth: 1,
    borderColor: CHARTE_COULEURS.grisChaud,
    borderRadius: CHARTE_RAYONS.tuile,
    backgroundColor: CHARTE_COULEURS.fond,
  },
  duree: {
    backgroundColor: CHARTE_COULEURS.bleuDoux,
    borderRadius: CHARTE_RAYONS.carte,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginBottom: 7,
  },
  dureeLibelle: {
    fontSize: CHARTE_TYPO.petit.taille,
    fontWeight: CHARTE_TYPO.graisses.grasse,
    color: CHARTE_COULEURS.texte,
    marginBottom: 3,
  },
  dureeValeur: {
    fontSize: CHARTE_TYPO.titre2.taille,
    fontWeight: CHARTE_TYPO.graisses.grasse,
    color: CHARTE_COULEURS.terracotta,
  },
  dureeNote: {
    fontSize: CHARTE_TYPO.petit.taille,
    color: CHARTE_COULEURS.texte,
    fontStyle: "italic",
    marginTop: 3,
  },
  avertissement: {
    backgroundColor: CHARTE_COULEURS.bleuDoux,
    borderRadius: CHARTE_RAYONS.carte,
    borderLeftWidth: 3,
    borderLeftColor: CHARTE_COULEURS.terracotta,
    paddingVertical: 9,
    paddingHorizontal: 13,
    marginBottom: 7,
  },
  avertissementTitre: {
    fontSize: CHARTE_TYPO.titreCarte.taille,
    fontWeight: CHARTE_TYPO.graisses.grasse,
    color: CHARTE_COULEURS.terracotta,
    marginBottom: 3,
  },
});

/** Paragraphe de corps de texte (`gras` : même taille, graisse forte). */
export function Paragraphe({
  gras = false,
  children,
}: {
  gras?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return <Text style={gras ? [s.paragraphe, s.gras] : s.paragraphe}>{children}</Text>;
}

/** Note légale ou d'explication : petite, en italique. */
export function NoteLegale({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Text style={s.note}>{children}</Text>;
}

/** Carte sans titre qui porte une phrase de l'organisme (phrase certificative, mention légale). */
export function CartePhrase({
  phrase,
  note,
  grande = false,
}: {
  phrase?: string;
  note?: string;
  grande?: boolean;
}): React.ReactElement {
  return (
    <Carte>
      {phrase ? (
        <Text style={[s.paragraphe, grande ? { fontSize: CHARTE_TYPO.titreCarte.taille } : {}]}>
          {phrase}
        </Text>
      ) : null}
      {note ? <NoteLegale>{note}</NoteLegale> : null}
    </Carte>
  );
}

/** Ligne libellé / valeur des résultats. */
export function LigneResultat({
  libelle,
  valeur,
}: {
  libelle: string;
  valeur: string;
}): React.ReactElement {
  return (
    <View style={s.resultat} wrap={false}>
      <Text style={s.resultatLibelle}>{libelle}</Text>
      <Text style={s.resultatValeur}>{valeur}</Text>
    </View>
  );
}

/** Bloc de vérification d'authenticité : QR (si fourni), jeton, adresse, phrase d'explication. */
export function BlocVerification({
  qrDataUrl,
  qrToken,
  url,
  explication,
}: {
  qrDataUrl?: string | undefined;
  qrToken: string;
  url: string;
  explication: string;
}): React.ReactElement {
  return (
    <Carte titre="Vérification d'authenticité" insecable>
      <View style={s.qr}>
        {qrDataUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer n'a pas d'attribut alt
          <Image src={qrDataUrl} style={{ width: 90, height: 90 }} />
        ) : null}
        <View style={s.qrTexte}>
          <Text style={s.qrToken}>{`Token : ${qrToken}`}</Text>
          <Text style={s.qrUrl}>{url}</Text>
          <NoteLegale>{explication}</NoteLegale>
        </View>
      </View>
    </Carte>
  );
}

/** Carte « Signature et cachet » : un cadre de signature (lieu, date, signataire) et un cadre de cachet. */
export function CarteSignatureCachet({
  lignes,
}: {
  /** Lignes du cadre de gauche, telles qu'imprimées. */
  lignes: string[];
}): React.ReactElement {
  return (
    <Carte titre="Signature et cachet" insecable>
      <View style={s.signature}>
        <View style={s.signatureCadre}>
          {lignes.map((ligne, i) => (
            <Paragraphe key={i}>{ligne}</Paragraphe>
          ))}
        </View>
        <View style={s.signatureCadre}>
          <Paragraphe>Cachet de l&apos;organisme</Paragraphe>
        </View>
      </View>
    </Carte>
  );
}

/** Encadré d'avertissement (ex. « Attestation partielle ») : fond bleu doux, liseré terracotta. */
export function EncadreAvertissement({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={s.avertissement} wrap={false}>
      <Text style={s.avertissementTitre}>{titre}</Text>
      <Text style={s.paragraphe}>{children}</Text>
    </View>
  );
}

/** Bloc de durée mis en avant (certificat de réalisation). */
export function BlocDuree({
  libelle,
  valeur,
  note,
}: {
  libelle: string;
  valeur: string;
  note: string;
}): React.ReactElement {
  return (
    <View style={s.duree} wrap={false}>
      <Text style={s.dureeLibelle}>{libelle}</Text>
      <Text style={s.dureeValeur}>{valeur}</Text>
      <Text style={s.dureeNote}>{note}</Text>
    </View>
  );
}
