/**
 * Relevé mensuel des apporteurs : rendu PDF A4 (@react-pdf/renderer) à partir de `ContenuReleveV1`
 * SEUL (lot 3d). Le contenu est figé : ce module ne lit ni base ni horloge, ne recalcule aucune
 * règle ni aucun montant. Le relevé n'est PAS une facture : la mention figure en tête et en pied.
 *
 * Sans `server-only` (le worker l'atteint par `tsx`). Date de création du PDF FIXE : deux rendus du
 * même contenu donnent les mêmes octets (`pdfSha256` reproductible). NE PAS "use client".
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

import { IDENTITE_LEGALE, adresseSiegeUneLigne } from "@/lib/identite-legale-ssot";
import { uploadToR2 } from "@/lib/r2-storage";
// Plomberie PDF (charte, polices, nettoyage d'espaces) empruntée à `registre-pdf` : polices
// enregistrées à son import ; aucun import direct du domaine Qualiopi (garde d'isolation).
import { styles as base, txt, enBuffer } from "@/features/conformite-rgpd/registre-pdf";
import { sha256Hex } from "./empreinte";
import type { ContenuReleveV1, LigneReleve, PieceReleve, VirementReleve } from "./types";

const DATE_FIXE = new Date("2026-01-01T00:00:00Z");

const styles = StyleSheet.create({
  mention: { fontSize: 8, marginBottom: 8, lineHeight: 1.4 },
  titreSection: { marginTop: 10, marginBottom: 4, fontSize: 11 },
  ligne: { marginBottom: 5, fontSize: 8.5, lineHeight: 1.4 },
  detail: { fontSize: 7.5, color: "#555555", lineHeight: 1.4 },
  rangee: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2, fontSize: 9 },
  gras: { fontWeight: 700 },
  vide: { fontSize: 9, marginTop: 6 },
});

// ── Formats (purs, sur des centimes entiers et des dates « AAAA-MM-JJ » déjà figées) ──────────

function eur(cents: number): string {
  const signe = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const entier = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${signe}${entier},${String(abs % 100).padStart(2, "0")} €`;
}

function jour(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function moisLisible(periode: string): string {
  const [a, m] = periode.split("-");
  const noms = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];
  return `${noms[Number(m) - 1] ?? m} ${a}`;
}

function libelleStatut(l: LigneReleve): string | null {
  if (!l.statut) return null;
  return l.statut.code === "facturee"
    ? `Facturée, échéance le ${jour(l.statut.echeanceLe)}`
    : `Versée le ${jour(l.statut.verseeLe)}`;
}

function libelleRegle(l: LigneReleve): string | null {
  if (l.regle) return `Règle : ${l.regle.libelle}`;
  if (l.renvoiDecompte) return `Règle : voir le décompte de l'autofacture n° ${l.renvoiDecompte}`;
  return null;
}

const LIBELLE_INDICATIF: Record<string, string> = {
  a_qualifier: "à qualifier",
  en_attente_vigilance: "en attente de vigilance",
  litige: "en litige",
};

// ── Composants ───────────────────────────────────────────────────────────────────────────────

function Rangee({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <View style={styles.rangee} wrap={false}>
      <Text style={fort ? styles.gras : undefined}>{txt(libelle)}</Text>
      <Text style={fort ? styles.gras : undefined}>{txt(valeur)}</Text>
    </View>
  );
}

function BlocLigne({ l }: { l: LigneReleve }) {
  const parties = [
    `${jour(l.dateEmission)} · ${l.parrainage ? "Parrainage (art. 4.6)" : (l.entreprise ?? "Entreprise présentée")}`,
    l.prestation,
    `${eur(l.montantHtCents)} HT · pièce ${l.pieceNumero}`,
  ].filter((p): p is string => !!p);
  const details = [
    l.factureClient
      ? `Facture client ${l.factureClient.numero}${l.factureClient.date ? ` du ${jour(l.factureClient.date)}` : ""}`
      : null,
    l.encaissementIntegralLe
      ? `Encaissée intégralement le ${jour(l.encaissementIntegralLe)}`
      : null,
    l.baseHtCents !== null ? `Base ${eur(l.baseHtCents)} HT` : null,
    l.prixPublicHtCents !== null ? `Prix public ${eur(l.prixPublicHtCents)} HT` : null,
    libelleRegle(l),
    l.versionContrat,
    libelleStatut(l),
  ].filter((p): p is string => !!p);
  return (
    <View style={styles.ligne} wrap={false}>
      <Text>{txt(parties.join(" — "))}</Text>
      {details.length > 0 && <Text style={styles.detail}>{txt(details.join(" · "))}</Text>}
    </View>
  );
}

function BlocPiece({ p }: { p: PieceReleve }) {
  const tva = p.mention293b ? "TVA non applicable, article 293 B du CGI" : `TVA ${eur(p.tvaCents)}`;
  return (
    <View style={styles.ligne} wrap={false}>
      <Text>
        {txt(
          `${p.numero} du ${jour(p.emiseLe)}${p.renvoiFacture ? ` (avoir sur ${p.renvoiFacture})` : ""} : ${eur(p.htCents)} HT · ${tva} · ${eur(p.ttcCents)} TTC`,
        )}
      </Text>
    </View>
  );
}

function BlocVirement({ v }: { v: VirementReleve }) {
  return (
    <View style={styles.ligne} wrap={false}>
      <Text>
        {txt(
          `Autofacture ${v.reference} : ${
            v.compensation
              ? "réglé par compensation (art. 12.4)"
              : `${eur(v.montantTtcCents)} TTC versés le ${jour(v.verseLe)}`
          }`,
        )}
      </Text>
    </View>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={[base.nom, styles.titreSection]}>{txt(titre)}</Text>
      {children}
    </View>
  );
}

export function ReleveMensuelPdf({ contenu }: { contenu: ContenuReleveV1 }) {
  const c = contenu;
  const entete = `Relevé de commissions — ${moisLisible(c.periode)}`;
  return (
    <Document
      title={txt(entete)}
      author={IDENTITE_LEGALE.legalName}
      creator={IDENTITE_LEGALE.legalName}
      producer={IDENTITE_LEGALE.legalName}
      creationDate={DATE_FIXE}
      modificationDate={DATE_FIXE}
    >
      <Page size="A4" style={base.page}>
        <Text style={base.entite}>{txt(IDENTITE_LEGALE.legalName)}</Text>
        <Text style={base.entite}>{txt(adresseSiegeUneLigne())}</Text>
        <Text style={base.titre}>{txt(entete)}</Text>
        <Text style={styles.mention}>{txt(c.mention)}</Text>
        <Text style={styles.detail}>
          {txt(`Arrêté au ${jour(c.coupureAt.slice(0, 10))} (heure de Paris).`)}
        </Text>

        {c.aucunMouvement ? (
          <Text style={styles.vide}>
            {txt(`Pour ${moisLisible(c.periode)} : aucun mouvement ce mois-ci.`)}
          </Text>
        ) : (
          <View>
            {c.facturees.lignes.length > 0 && (
              <Section titre="Commissions facturées dans le mois">
                {c.facturees.lignes.map((l, i) => (
                  <BlocLigne key={`f${i}`} l={l} />
                ))}
                {c.facturees.pieces.map((p) => (
                  <BlocPiece key={p.numero} p={p} />
                ))}
              </Section>
            )}
            {c.avoirs.lignes.length > 0 && (
              <Section titre="Avoirs émis dans le mois">
                {c.avoirs.lignes.map((l, i) => (
                  <BlocLigne key={`a${i}`} l={l} />
                ))}
                {c.avoirs.pieces.map((p) => (
                  <BlocPiece key={p.numero} p={p} />
                ))}
              </Section>
            )}
            {c.virements.length > 0 && (
              <Section titre="Virements du mois">
                {c.virements.map((v) => (
                  <BlocVirement key={v.reference} v={v} />
                ))}
              </Section>
            )}
            <Section titre="Total du mois">
              <Rangee libelle="Facturé HT" valeur={eur(c.totaux.factureHtCents)} />
              <Rangee libelle="Avoirs HT" valeur={eur(-c.totaux.avoirHtCents)} />
              <Rangee libelle="Net HT" valeur={eur(c.totaux.netHtCents)} fort />
              <Rangee libelle="TVA" valeur={eur(c.totaux.tvaCents)} />
              <Rangee libelle="Net TTC" valeur={eur(c.totaux.ttcCents)} />
              <Rangee libelle="Viré dans le mois (TTC)" valeur={eur(c.totaux.vireTtcCents)} />
            </Section>
          </View>
        )}

        {(c.report.facturesNonVirees.length > 0 ||
          c.report.enAttenteAutofacture.length > 0 ||
          c.report.indicatif.lignes.length > 0) && (
          <Section titre="Report : en cours à la fin du mois">
            {c.report.facturesNonVirees.map((r) => (
              <View key={r.pieceNumero} style={styles.ligne} wrap={false}>
                <Text>
                  {txt(
                    `Autofacture ${r.pieceNumero} du ${jour(r.emiseLe)} : ${r.nbLignes} ligne(s), ${eur(r.htCents)} HT, non virée à la coupure, échéance le ${jour(r.echeanceLe)}`,
                  )}
                </Text>
              </View>
            ))}
            {c.report.enAttenteAutofacture.map((r, i) => (
              <View key={`e${i}`} style={styles.ligne} wrap={false}>
                <Text>
                  {txt(
                    `En attente d'autofacture depuis le ${jour(r.depuisLe)} : ${r.entreprise ?? "entreprise présentée"}${r.prestation ? `, ${r.prestation}` : ""}, ${eur(r.montantHtCents)} HT${r.motif ? ` (${r.motif})` : ""}`,
                  )}
                </Text>
              </View>
            ))}
            {c.report.indicatif.lignes.length > 0 && (
              <View>
                <Text style={styles.detail}>
                  {txt(`À titre indicatif, au ${jour(c.report.indicatif.auJour)} :`)}
                </Text>
                {c.report.indicatif.lignes.map((r, i) => (
                  <View key={`i${i}`} style={styles.ligne} wrap={false}>
                    <Text>
                      {txt(
                        `${r.entreprise ?? "Entreprise présentée"}${r.prestation ? `, ${r.prestation}` : ""} : ${LIBELLE_INDICATIF[r.statut] ?? r.statut}${r.montantHtCents !== null ? `, ${eur(r.montantHtCents)} HT` : ""}`,
                      )}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Section>
        )}

        <Section titre={`Cumul de l'année ${c.cumulAnnee.annee}`}>
          <Rangee libelle="Facturé HT" valeur={eur(c.cumulAnnee.factureHtCents)} />
          <Rangee libelle="Avoirs HT" valeur={eur(-c.cumulAnnee.avoirHtCents)} />
          <Rangee libelle="Net HT" valeur={eur(c.cumulAnnee.netHtCents)} fort />
          <Rangee libelle="Net TTC" valeur={eur(c.cumulAnnee.netTtcCents)} />
          <Rangee libelle="Viré (TTC)" valeur={eur(c.cumulAnnee.vireTtcCents)} />
        </Section>

        <Text style={[styles.mention, { marginTop: 12 }]}>{txt(c.mention)}</Text>
        <View style={base.pied} fixed>
          <Text>{txt(`${IDENTITE_LEGALE.legalName} — ${entete}`)}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/**
 * Tous les textes que le PDF affiche, dans l'ordre : sert aux gardes (mention, vocabulaire, PII)
 * sans décoder un PDF compressé. Parcourt l'arbre React en développant les composants fonction.
 */
export function textesDuReleve(contenu: ContenuReleveV1): string[] {
  const sortie: string[] = [];
  const visiter = (n: unknown): void => {
    if (n === null || n === undefined || typeof n === "boolean") return;
    if (typeof n === "string") {
      sortie.push(n);
      return;
    }
    if (typeof n === "number") {
      sortie.push(String(n));
      return;
    }
    if (Array.isArray(n)) {
      n.forEach(visiter);
      return;
    }
    const el = n as React.ReactElement<{ children?: unknown }>;
    if (typeof el.type === "function") {
      visiter((el.type as (p: unknown) => unknown)(el.props));
      return;
    }
    visiter(el.props?.children);
  };
  visiter(<ReleveMensuelPdf contenu={contenu} />);
  return sortie;
}

/**
 * Rend le PDF depuis le contenu figé, le dépose dans R2 sous `cle` et rend sa clé et l'empreinte
 * de ses octets. Échoue (jamais de repli silencieux) si le dépôt échoue : la préparation ne doit
 * pas enregistrer un relevé dont le PDF n'existe pas.
 */
export async function rendreEtStockerPdfReleve(
  contenu: ContenuReleveV1,
  cle: string,
): Promise<{ r2Key: string; sha256: string }> {
  if (!cle.trim()) throw new Error("Clé R2 du relevé vide.");
  const octets = await enBuffer(<ReleveMensuelPdf contenu={contenu} />);
  const sha256 = sha256Hex(octets);
  await uploadToR2(cle, octets, "application/pdf", { sha256, periode: contenu.periode });
  return { r2Key: cle, sha256 };
}
