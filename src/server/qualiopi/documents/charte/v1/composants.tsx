/**
 * Charte v1 — composants de style des PDF (cartes arrondies, contraste, total mis en avant).
 *
 * ⛔ MODULE GELÉ : l'empreinte de chaque fichier est figée par `EMPREINTES_CHARTES`
 * (`templates/gabarit-empreinte.spec.ts`). Un gabarit déjà signé s'y appuie : toute évolution de
 * style se fait dans un nouveau dossier `charte/v2`, jamais ici.
 *
 * Contraintes du moteur @react-pdf respectées : `borderRadius` oui ; ni dégradé, ni ombre, ni
 * grille, ni graisse 800 ; jamais de bordure d'un seul côté sur un bloc arrondi ; colonnes en
 * flex avec des séparateurs vides (pas de `gap`) ; aucun caractère hors des polices.
 *
 * Tous les composants sont des fonctions PURES (aucun hook) : les tests les invoquent
 * directement pour en extraire le texte.
 *
 * NE PAS "use client" — rendu serveur exclusif.
 */

import React from "react";
import { Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { registerQualiopiPdfFonts } from "@/server/qualiopi/documents/fonts";
import { SEGMENT_ESSAI } from "@/server/qualiopi/essai/numerotation";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import type { DataColumn } from "@/server/qualiopi/documents/base-layout";
import {
  CHARTE_COULEURS as C,
  CHARTE_ESPACES as E,
  CHARTE_PIED as P,
  CHARTE_RAYONS as R,
  CHARTE_TYPO as T,
} from "./couleurs";

registerQualiopiPdfFonts();

const G = T.graisses;

// ============================================================
// Styles
// ============================================================

const s = StyleSheet.create({
  page: {
    paddingTop: E.margeHaut,
    paddingHorizontal: E.margeCote,
    paddingBottom: E.basReserve,
    fontFamily: T.police,
    fontSize: T.corps.taille,
    lineHeight: T.corps.interligne,
    fontWeight: G.normale,
    color: C.texte,
    backgroundColor: C.fond,
  },
  lisere: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: E.hauteurLisere,
    flexDirection: "row",
  },
  lisereBande: { flex: 1, height: E.hauteurLisere },
  bandeau: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  bandeauGauche: { flex: 1, paddingRight: 12 },
  bandeauDroite: { flex: 1 },
  marque: { fontSize: T.marque.taille, fontWeight: G.grasse, color: C.texte },
  bandeauSurTitre: {
    fontSize: T.surTitre.taille,
    fontWeight: G.grasse,
    letterSpacing: T.surTitre.interlettrage,
    textTransform: "uppercase",
    color: C.terracotta,
    textAlign: "right",
  },
  bandeauDoc: {
    fontSize: T.petit.taille,
    fontWeight: G.moyenne,
    color: C.texte,
    textAlign: "right",
    marginTop: 2,
  },
  filigrane: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 72,
    fontWeight: G.grasse,
    color: C.sombreSecondaire,
    opacity: 0.18,
    transform: "rotate(-45deg)",
  },
  filigraneMarque: {
    position: "absolute",
    top: "40%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 68,
    fontWeight: G.grasse,
    color: C.terracotta,
    opacity: 0.16,
    transform: "rotate(-45deg)",
  },
  avis: {
    backgroundColor: C.carte,
    borderWidth: 1,
    borderColor: C.terracotta,
    borderRadius: R.carte,
    paddingVertical: E.carteV,
    paddingHorizontal: E.carteH,
    marginBottom: E.ecartCartes,
  },
  avisTitre: {
    fontSize: T.petit.taille,
    fontWeight: G.grasse,
    color: C.terracotta,
    marginBottom: 2,
  },
  avisTexte: { fontSize: T.petit.taille, color: C.texte },
  pied: {
    position: "absolute",
    bottom: P.bas,
    left: E.margeCote,
    right: E.margeCote,
    borderTopWidth: P.filet,
    borderTopColor: C.grisChaud,
    paddingTop: P.espaceHaut,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  piedIdentite: { flex: 1, paddingRight: 12 },
  piedOrg: { fontSize: T.pied.taille, fontWeight: G.grasse, color: C.texte },
  piedLigne: { fontSize: T.pied.taille, color: C.texte, marginTop: P.espaceEntreLignes },
  piedPage: { fontSize: T.pied.taille, color: C.texte },

  surTitre: {
    fontSize: T.surTitre.taille,
    fontWeight: G.grasse,
    letterSpacing: T.surTitre.interlettrage,
    textTransform: "uppercase",
    color: C.terracotta,
    marginBottom: 4,
  },
  titre1: {
    fontSize: T.titre1.taille,
    fontWeight: G.grasse,
    lineHeight: T.titre1.interligne,
    letterSpacing: T.titre1.interlettrage,
    color: C.texte,
    marginBottom: 8,
  },
  titre2: {
    fontSize: T.titre2.taille,
    fontWeight: G.grasse,
    letterSpacing: T.titre2.interlettrage,
    color: C.texte,
    marginBottom: 6,
  },
  titre3: { fontSize: T.titreCarte.taille, fontWeight: G.grasse, color: C.texte, marginBottom: 4 },
  chapo: {
    fontSize: T.corps.taille,
    fontWeight: G.moyenne,
    lineHeight: T.corps.interligne,
    color: C.texte,
    marginBottom: 10,
  },
  texte: { fontSize: T.corps.taille, lineHeight: T.corps.interligne, color: C.texte },

  carte: {
    backgroundColor: C.carte,
    borderWidth: 1,
    borderColor: C.bordureCarte,
    borderRadius: R.carte,
    paddingVertical: E.carteV,
    paddingHorizontal: E.carteH,
    marginBottom: E.ecartCartes,
  },
  titreCarte: {
    fontSize: T.titreCarte.taille,
    fontWeight: G.grasse,
    color: C.texte,
    marginBottom: 4,
  },
  tuile: {
    flex: 1,
    backgroundColor: C.bleuDoux,
    borderRadius: R.tuile,
    paddingVertical: E.carteV,
    paddingHorizontal: E.carteH,
  },
  tuileLibelle: { fontSize: T.petit.taille, fontWeight: G.moyenne, color: C.bleu, marginBottom: 2 },
  tuileValeur: { fontSize: T.titreCarte.taille, fontWeight: G.grasse, color: C.texte },
  sombre: {
    backgroundColor: C.sombre,
    borderRadius: R.carte,
    paddingVertical: E.carteV,
    paddingHorizontal: E.carteH,
    marginBottom: E.ecartCartes,
  },
  sombreTitre: {
    fontSize: T.titreCarte.taille,
    fontWeight: G.grasse,
    color: C.sombreSurTitre,
    marginBottom: 4,
  },
  sombreTexte: { fontSize: T.corps.taille, lineHeight: T.corps.interligne, color: C.sombreTexte },
  sombreLegende: { fontSize: T.petit.taille, color: C.sombreSecondaire, marginTop: 4 },
  doux: {
    backgroundColor: C.bleuDoux,
    borderRadius: R.carte,
    paddingVertical: E.carteV,
    paddingHorizontal: E.carteH,
    marginBottom: E.ecartCartes,
  },
  douxTitre: {
    fontSize: T.titreCarte.taille,
    fontWeight: G.grasse,
    color: C.bleu,
    marginBottom: 4,
  },
  douxTexte: { fontSize: T.corps.taille, lineHeight: T.corps.interligne, color: C.texte },
  puceLigne: { flexDirection: "row", alignItems: "flex-start", marginBottom: 3 },
  puce: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.terracotta,
    marginTop: 5,
    marginRight: 8,
  },
  puceTexte: { flex: 1, fontSize: T.corps.taille, lineHeight: T.corps.interligne, color: C.texte },
  pastille: {
    alignSelf: "flex-start",
    backgroundColor: C.bleuDoux,
    borderRadius: R.pastille,
    paddingVertical: 2,
    paddingHorizontal: 9,
  },
  pastilleTexte: { fontSize: T.petit.taille, fontWeight: G.grasse, color: C.bleu },
  champ: {
    flexDirection: "row",
    paddingVertical: 3,
    marginBottom: 2,
    borderBottomWidth: 0.75,
    borderBottomColor: C.grisChaud,
  },
  champLibelle: {
    width: 150,
    paddingRight: 8,
    fontSize: T.petit.taille,
    fontWeight: G.grasse,
    color: C.texte,
  },
  champValeur: { flex: 1, fontSize: T.corps.taille, color: C.texte },
  champManque: { flex: 1, fontSize: T.corps.taille, fontWeight: G.grasse, color: C.terracotta },

  tableau: { marginBottom: 12 },
  tableauEntete: {
    flexDirection: "row",
    backgroundColor: C.grisChaud,
    borderRadius: R.ligneTableau,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 3,
  },
  tableauEnteteCellule: { fontSize: T.petit.taille, fontWeight: G.grasse, color: C.texte },
  tableauLigne: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.75,
    borderBottomColor: C.grisChaud,
  },
  tableauCellule: { fontSize: T.corps.taille, color: C.texte },
  separateurColonne: { width: 8 },

  totaux: {
    backgroundColor: C.carte,
    borderWidth: 1,
    borderColor: C.bordureCarte,
    borderRadius: R.carte,
    paddingVertical: E.carteV,
    paddingHorizontal: E.carteH,
    marginBottom: E.ecartCartes,
  },
  totauxLigne: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totauxLibelle: { fontSize: T.corps.taille, color: C.texte },
  totauxMontant: {
    fontSize: T.corps.taille,
    fontWeight: G.moyenne,
    color: C.texte,
    textAlign: "right",
  },
  totauxFinale: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 0.75,
    borderTopColor: C.grisChaud,
  },
  totauxFinaleLibelle: { fontSize: T.titreCarte.taille, fontWeight: G.grasse, color: C.texte },
  totauxFinaleMontant: {
    fontSize: T.montantTotal.taille,
    // Interligne serré : hérité de la page (1,4), il rendait la ligne plus haute que la carte
    // (le grand montant débordait sous la bordure).
    lineHeight: 1,
    fontWeight: G.grasse,
    color: C.terracotta,
    textAlign: "right",
  },
  signature: {
    backgroundColor: C.carte,
    borderWidth: 1.5,
    borderColor: C.terracotta,
    borderRadius: R.carte,
    paddingVertical: E.carteV,
    paddingHorizontal: E.carteH,
    marginTop: 16,
  },
});

// ============================================================
// Utilitaires locaux (copies : ceux de base-layout ne sont pas exportés)
// ============================================================

/** Joint des fragments non vides avec un séparateur (ignore "", null, undefined). */
function joinDefined(parts: Array<string | null | undefined>, sep: string): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(sep);
}

/** `true` si le nœud est purement textuel : à envelopper dans un `<Text>` (sinon le texte est perdu). */
function estTextuel(node: React.ReactNode): boolean {
  if (typeof node === "string" || typeof node === "number") return true;
  if (Array.isArray(node)) return node.every((n) => estTextuel(n));
  return false;
}

function enTexte(node: React.ReactNode, style: (typeof s)[keyof typeof s]): React.ReactNode {
  return estTextuel(node) ? <Text style={style}>{node}</Text> : node;
}

// ============================================================
// Page
// ============================================================

export interface PageCharteProps {
  docTitle: string;
  docNumber: string;
  identite: OrganismeIdentite;
  estCopie?: boolean;
  estSpecimen?: boolean;
  specimenMotif?: string;
  eyebrow?: string;
  children: React.ReactNode;
}

/**
 * Page A4 de la charte v1. Mêmes propriétés que `QualiopiPage`.
 *
 * Ce qui est IDENTIQUE à `QualiopiPage`, mot pour mot : le pied de page (organisme, adresse,
 * SIRET, NDA ou son absence, Qualiopi, contact, pagination) et les bandeaux SPÉCIMEN et ESSAI.
 *
 * Ce qui DIFFÈRE : l'en-tête est ALLÉGÉ. Il ne porte plus que la marque et
 * « {docTitle} N° {docNumber} » ; l'adresse et les identifiants que `QualiopiPage` répète sous
 * le nom de l'organisme n'y sont plus, ils restent dans le pied (aucune mention n'est perdue).
 * `docNumber` est le numéro SEUL, sans « N° » : l'en-tête l'ajoute.
 */
export function PageCharte({
  docTitle,
  docNumber,
  identite,
  estCopie = false,
  estSpecimen = false,
  specimenMotif,
  eyebrow = "Organisme de formation",
  children,
}: PageCharteProps): React.ReactElement {
  const identifiants = joinDefined(
    [
      identite.siret ? `SIRET ${identite.siret}` : "",
      identite.nda
        ? `NDA ${identite.nda}`
        : "Déclaration d'activité non encore enregistrée (art. L.6351-1 C. trav.)",
      identite.qualiopi ? `Qualiopi ${identite.qualiopi}` : "",
    ],
    "  ·  ",
  );
  const contact = joinDefined([identite.email, identite.telephone, identite.site], "  ·  ");
  // Une pièce d'essai se reconnaît à son numéro (même détection que `QualiopiPage`).
  const estEssai = docNumber.includes(SEGMENT_ESSAI);

  return (
    <Page size="A4" style={s.page}>
      <View style={s.lisere} fixed>
        {C.lisere.map((couleur) => (
          <View key={couleur} style={[s.lisereBande, { backgroundColor: couleur }]} />
        ))}
      </View>

      {estEssai && (
        <Text style={s.filigraneMarque} fixed>
          ESSAI
        </Text>
      )}
      {estCopie && <Text style={s.filigrane}>COPIE</Text>}
      {estSpecimen && <Text style={s.filigraneMarque}>SPÉCIMEN</Text>}

      <View style={s.bandeau} fixed>
        <View style={s.bandeauGauche}>
          <Text style={s.marque}>{identite.raisonSociale || "Axion-IA SAS"}</Text>
        </View>
        <View style={s.bandeauDroite}>
          {eyebrow ? <Text style={s.bandeauSurTitre}>{eyebrow}</Text> : null}
          <Text style={s.bandeauDoc}>{`${docTitle} N° ${docNumber}`}</Text>
        </View>
      </View>

      {estSpecimen && (
        <View style={s.avis}>
          <Text style={s.avisTitre}>SPÉCIMEN — sans valeur juridique</Text>
          <Text style={s.avisTexte}>
            {specimenMotif ??
              "Identité de l'organisme incomplète : ce document ne peut pas être remis à un client ou un auditeur."}
          </Text>
        </View>
      )}

      {estEssai && (
        <View style={s.avis}>
          <Text style={s.avisTitre}>ESSAI — pièce sans valeur</Text>
          <Text style={s.avisTexte}>
            Pièce d&apos;une session d&apos;essai interne : numéro hors suite légale, jamais remise
            à un client ou un auditeur comme pièce réelle.
          </Text>
        </View>
      )}

      {children}

      <View style={s.pied} fixed>
        <View style={s.piedIdentite}>
          <Text style={s.piedOrg}>
            {joinDefined([identite.raisonSociale || "Axion-IA SAS", identite.adresseSiege], " — ")}
          </Text>
          {identifiants ? <Text style={s.piedLigne}>{identifiants}</Text> : null}
          {contact ? <Text style={s.piedLigne}>{contact}</Text> : null}
        </View>
        <Text
          style={s.piedPage}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          fixed
        />
      </View>
    </Page>
  );
}

// ============================================================
// Textes
// ============================================================

export function SurTitre({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Text style={s.surTitre}>{children}</Text>;
}

export function Titre({
  niveau = 1,
  children,
}: {
  niveau?: 1 | 2 | 3;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Text style={niveau === 1 ? s.titre1 : niveau === 2 ? s.titre2 : s.titre3}>{children}</Text>
  );
}

export function Chapo({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Text style={s.chapo}>{children}</Text>;
}

// ============================================================
// Blocs
// ============================================================

export function Carte({
  titre,
  insecable = false,
  children,
}: {
  titre?: string;
  /** `true` : la carte ne se coupe pas entre deux pages. */
  insecable?: boolean;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={s.carte} wrap={!insecable}>
      {titre ? <Text style={s.titreCarte}>{titre}</Text> : null}
      {enTexte(children, s.texte)}
    </View>
  );
}

/** Petite tuile libellé / valeur ; `flex: 1` : à placer dans une rangée, séparées par un `<View>` vide. */
export function Tuile({
  libelle,
  valeur,
}: {
  libelle: string;
  valeur: string;
}): React.ReactElement {
  return (
    <View style={s.tuile} wrap={false}>
      <Text style={s.tuileLibelle}>{libelle}</Text>
      <Text style={s.tuileValeur}>{valeur}</Text>
    </View>
  );
}

export function BlocSombre({
  titre,
  legende,
  children,
}: {
  titre?: string;
  legende?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={s.sombre} wrap={false}>
      {titre ? <Text style={s.sombreTitre}>{titre}</Text> : null}
      {enTexte(children, s.sombreTexte)}
      {legende ? <Text style={s.sombreLegende}>{legende}</Text> : null}
    </View>
  );
}

export function EncadreDoux({
  titre,
  children,
}: {
  titre?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={s.doux} wrap={false}>
      {titre ? <Text style={s.douxTitre}>{titre}</Text> : null}
      {enTexte(children, s.douxTexte)}
    </View>
  );
}

/** Liste à puces : puce = rond de 4 pt. Chaque ligne reste d'un bloc (la puce ne se sépare pas du texte). */
export function ListePuces({ items }: { items: string[] }): React.ReactElement {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={s.puceLigne} wrap={false}>
          <View style={s.puce} />
          <Text style={s.puceTexte}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function Pastille({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <View style={s.pastille}>
      <Text style={s.pastilleTexte}>{children}</Text>
    </View>
  );
}

/** Ligne libellé / valeur. Obligatoire et vide : « Non renseigné » (comme `FieldRow`), jamais masqué. */
export function LigneChamp({
  label,
  value,
  required = false,
}: {
  label: string;
  value: string;
  required?: boolean;
}): React.ReactElement {
  const manque = !value || !value.trim() || value.trim() === "—";
  return (
    <View style={s.champ}>
      <Text style={s.champLibelle}>{label}</Text>
      {manque && required ? (
        <Text style={s.champManque}>Non renseigné</Text>
      ) : (
        <Text style={s.champValeur}>{value}</Text>
      )}
    </View>
  );
}

// ============================================================
// Tableau
// ============================================================

export interface TableauProps {
  columns: DataColumn[];
  rows: Array<Record<string, React.ReactNode>>;
  /** Lignes vides à ajouter (émargement papier). Défaut 0. */
  emptyRows?: number;
  /** Hauteur minimale des lignes. */
  minRowHeight?: number;
}

/** Alignement d'une colonne : à droite (ou au centre) SEULEMENT si `align` le demande, sinon à gauche. */
function alignement(c: DataColumn): "left" | "right" | "center" {
  return c.align ?? "left";
}

/** Même interface que `DataTable`. En-tête gris chaud arrondi, filets fins, lignes sécables d'une page à l'autre. */
export function Tableau({
  columns,
  rows,
  emptyRows = 0,
  minRowHeight,
}: TableauProps): React.ReactElement {
  const colonne = (c: DataColumn) => ({ flex: c.flex ?? 1, textAlign: alignement(c) });
  const ligne = minRowHeight ? [s.tableauLigne, { minHeight: minRowHeight }] : s.tableauLigne;

  const cellules = (donnees: (c: DataColumn) => React.ReactNode) =>
    columns.map((c, i) => (
      <React.Fragment key={c.key}>
        {i > 0 ? <View style={s.separateurColonne} /> : null}
        <View style={{ flex: c.flex ?? 1 }}>{donnees(c)}</View>
      </React.Fragment>
    ));

  return (
    <View style={s.tableau}>
      <View style={s.tableauEntete} wrap={false}>
        {cellules((c) => (
          <Text style={[s.tableauEnteteCellule, { textAlign: alignement(c) }]}>{c.header}</Text>
        ))}
      </View>
      {rows.map((row, idx) => (
        <View key={idx} style={ligne} wrap={false}>
          {cellules((c) => {
            const v = row[c.key];
            return typeof v === "string" || typeof v === "number" ? (
              <Text style={[s.tableauCellule, { textAlign: colonne(c).textAlign }]}>{v}</Text>
            ) : (
              (v ?? <Text style={s.tableauCellule}> </Text>)
            );
          })}
        </View>
      ))}
      {Array.from({ length: emptyRows }).map((_, idx) => (
        <View key={`vide-${idx}`} style={ligne} wrap={false}>
          {cellules(() => (
            <Text style={s.tableauCellule}> </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ============================================================
// Totaux et signature
// ============================================================

export interface LigneTotal {
  libelle: string;
  /** Montant DÉJÀ formaté par l'appelant. Ce composant n'effectue aucun calcul. */
  montant: string;
}

/** Carte de totaux : lignes reçues telles quelles ; la DERNIÈRE est mise en avant (grand, terracotta). */
export function CarteTotaux({ lignes }: { lignes: LigneTotal[] }): React.ReactElement {
  const courantes = lignes.slice(0, -1);
  const derniere = lignes.length > 0 ? lignes[lignes.length - 1] : undefined;
  return (
    <View style={s.totaux} wrap={false}>
      {courantes.map((l, i) => (
        <View key={i} style={s.totauxLigne}>
          <Text style={s.totauxLibelle}>{l.libelle}</Text>
          <Text style={s.totauxMontant}>{l.montant}</Text>
        </View>
      ))}
      {derniere ? (
        <View
          style={
            courantes.length > 0
              ? s.totauxFinale
              : [s.totauxFinale, { marginTop: 0, paddingTop: 0, borderTopWidth: 0 }]
          }
        >
          <Text style={s.totauxFinaleLibelle}>{derniere.libelle}</Text>
          <Text style={s.totauxFinaleMontant}>{derniere.montant}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Cadre de signature : carte blanche, bordure 1.5 terracotta, jamais coupée entre deux pages.
 * Le `SignatureZone` existant y sera placé tel quel, en enfant.
 */
export function BlocSignature({
  titre,
  children,
}: {
  titre: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={s.signature} wrap={false}>
      <Text style={s.titreCarte}>{titre}</Text>
      {children}
    </View>
  );
}
