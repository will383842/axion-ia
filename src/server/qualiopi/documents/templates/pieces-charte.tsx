/**
 * Éléments de mise en page des PIÈCES SIGNÉES (conventions, contrat de formation) au style
 * de la charte 2027 (`charte/v1`, GELÉE : importée, jamais modifiée).
 *
 * Ce fichier ne porte AUCUN texte : il ne fait que poser des cartes, des lignes et des
 * paragraphes autour du texte que les gabarits lui confient. `charte/v1` n'ayant pas de carte
 * « de section » SÉCABLE dotée d'un titre qui ne reste pas seul en bas de page, elle est
 * posée ici avec les mêmes jetons (même précédent : `cpBox` du devis).
 *
 * Rendu serveur exclusif — NE PAS "use client".
 */

import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  CHARTE_COULEURS as C,
  CHARTE_ESPACES as E,
  CHARTE_RAYONS as R,
  CHARTE_TYPO as T,
  LigneChamp,
} from "@/server/qualiopi/documents/charte/v1";

const G = T.graisses;

export const stylesPiece = StyleSheet.create({
  section: {
    marginBottom: E.ecartCartes,
    backgroundColor: C.carte,
    borderWidth: 1,
    borderColor: C.bordureCarte,
    borderRadius: R.carte,
    paddingVertical: E.carteV,
    paddingHorizontal: E.carteH,
  },
  sectionTitre: {
    fontSize: T.titreCarte.taille,
    fontWeight: G.grasse,
    color: C.texte,
    marginBottom: 5,
  },
  sousTitre: {
    fontSize: T.corps.taille,
    fontWeight: G.grasse,
    color: C.bleu,
    marginBottom: 3,
  },
  paragraphe: {
    fontSize: T.corps.taille,
    color: C.texte,
    lineHeight: T.corps.interligne,
    marginBottom: 5,
  },
  mention: {
    fontSize: T.petit.taille,
    color: C.texte,
    lineHeight: T.corps.interligne,
    marginBottom: 6,
  },
  note: {
    fontSize: T.petit.taille,
    color: C.texte,
    lineHeight: T.corps.interligne,
    marginTop: 4,
    marginBottom: 4,
  },
  puce: {
    fontSize: T.corps.taille,
    color: C.texte,
    lineHeight: T.corps.interligne,
    marginBottom: 2,
    paddingLeft: 8,
  },
  annexe: {
    fontSize: T.petit.taille,
    color: C.texte,
    lineHeight: T.corps.interligne,
    marginBottom: 2,
    paddingLeft: 8,
  },
  champListe: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: C.bordureCarte,
  },
  champListeLibelle: {
    width: "34%",
    paddingRight: 8,
    fontSize: T.petit.taille,
    fontWeight: G.grasse,
    color: C.texte,
  },
  champListeValeur: { flex: 1 },
  ligneMontant: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.bordureCarte,
  },
  libelleMontant: { fontSize: T.corps.taille, color: C.texte, flex: 1, paddingRight: 8 },
  valeurMontant: { fontSize: T.corps.taille, fontWeight: G.grasse, color: C.texte },
  gras: { fontWeight: G.grasse },
});

/** Section numérotée : carte sécable, titre jamais seul en bas de page. */
export function SectionCarte({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={stylesPiece.section}>
      <Text style={stylesPiece.sectionTitre} minPresenceAhead={48}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Ligne libellé / valeur : `LigneChamp` de la charte (« Non renseigné » si `required` et vide). */
export function Champ({
  label,
  value,
  required = false,
}: {
  label: string;
  value: string;
  required?: boolean;
}): React.ReactElement {
  return <LigneChamp label={label} value={value} required={required} />;
}

/** Ligne « numéro de déclaration d'activité » : omise tant que le numéro n'existe pas. */
export function ChampNda({ nda, label = "NDA" }: { nda: string; label?: string }) {
  const numero = typeof nda === "string" ? nda.trim() : "";
  if (numero === "") return null;
  return <Champ label={label} value={numero} />;
}

/** Ligne libellé / liste à puces (objectifs). */
export function ChampListe({
  label,
  items,
}: {
  label: string;
  items: readonly string[];
}): React.ReactElement {
  return (
    <View style={stylesPiece.champListe}>
      <Text style={stylesPiece.champListeLibelle}>{label}</Text>
      <View style={stylesPiece.champListeValeur}>
        {items.map((item, i) => (
          <Text key={i} style={stylesPiece.puce}>
            • {item}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Ligne libellé / montant. */
export function LigneMontant({
  libelle,
  montant,
}: {
  libelle: React.ReactNode;
  montant: string;
}): React.ReactElement {
  return (
    <View style={stylesPiece.ligneMontant}>
      <Text style={stylesPiece.libelleMontant}>{libelle}</Text>
      <Text style={stylesPiece.valeurMontant}>{montant}</Text>
    </View>
  );
}

const FORMAT_TAUX_FR = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** Taux à la française : « 12,5 » (virgule), jamais « 12.5 ». Un entier reste inchangé (« 30 »). */
export function tauxFr(n: number): string {
  return FORMAT_TAUX_FR.format(n);
}
