/**
 * Qualiopi — Devis de prestation (CRM).
 *
 * Miroir commercial de la facture (facture.tsx) :
 *   - Identité + adresse du siège de l'émetteur (en-tête + pied via QualiopiPage).
 *   - SIRET / NDA (bloc émetteur, `required`). Plus de mention Qualiopi depuis la v5 (décision 22).
 *   - N° de devis, date d'émission, date de validité, référence client.
 *   - Lignes avec taux de TVA par ligne (devis mixtes formation 0 % + conseil 20 %).
 *   - Totaux HT / TVA (ventilation par taux) / TTC via computeTotauxFacture.
 *   - Estimation OPCO / reste à charge (indicative, non contractuelle).
 *   - Mention TVA dérivée du régime (exonération 261-4-4° / franchise 293 B).
 *   - Bloc signature « Bon pour accord » (nom/fonction, date, signature).
 *   - Mention « Devis gratuit, valable jusqu'au {dateValidite} ».
 *
 * Montants en centimes d'euro (prixUnitaireHtCents) pour éviter les erreurs
 * d'arrondi flottant. Le numéro affiché est celui du Devis CRM (pré-construit
 * par l'appelant — PAS le numéro du registre DocumentGenere).
 *
 * NE PAS "use client" — rendu serveur exclusif (@react-pdf/renderer).
 */

import React from "react";
import { Document, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  QualiopiPage,
  DocSection,
  FieldRow,
  NdaFieldRow,
  DataTable,
  LegalCallout,
  SignatureZone,
  formatEurosFromCents,
  type PreuvesParPartie,
} from "@/server/qualiopi/documents/base-layout";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import type { LigneFacture } from "@/server/qualiopi/documents/templates/facture";
import {
  computeTotauxFacture,
  mentionTva,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";
import type { VueFormule, VueFormules } from "@/server/qualiopi/devis/vue-formules";
import type { ChoixImprimable } from "@/server/qualiopi/devis/choix-exemplaire";
import {
  brandColor,
  QUALIOPI_PDF_TYPE as T,
  QUALIOPI_PDF_SPACE as S,
} from "@/server/qualiopi/brand/brand-tokens";

// ============================================================
// Styles spécifiques (totaux + signature « Bon pour accord »)
// ============================================================

const styles = StyleSheet.create({
  totalsBlock: {
    marginTop: S.xl,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    width: 240,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border"),
  },
  totalLabel: {
    fontSize: T.base,
    flex: 1,
    color: brandColor("fg-soft"),
    fontWeight: "bold",
  },
  totalValue: {
    fontSize: T.base,
    color: brandColor("fg"),
    fontFamily: "Inconsolata",
    textAlign: "right",
  },
  totalTtcRow: {
    flexDirection: "row",
    width: 240,
    paddingVertical: S.md,
    backgroundColor: brandColor("mocha"),
    paddingHorizontal: S.md,
    marginTop: S.xs,
    borderRadius: S.radius,
  },
  totalTtcLabel: {
    fontSize: T.lg,
    flex: 1,
    color: brandColor("primary-fg"),
    fontWeight: "bold",
  },
  totalTtcValue: {
    fontSize: T.lg,
    color: brandColor("primary-fg"),
    fontFamily: "Inconsolata",
    fontWeight: "bold",
    textAlign: "right",
  },
  // ── Formules A / B côte à côte (devis à formules) ──
  formulesRow: { flexDirection: "row", marginTop: S.md },
  formuleCol: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderColor: brandColor("border-strong"),
    borderRadius: S.radius,
    padding: S.md,
  },
  formuleGap: { width: S.md },
  formuleTitre: {
    fontSize: T.md,
    fontWeight: "bold",
    color: brandColor("mocha"),
    marginBottom: S.sm,
  },
  formuleSousTitre: {
    fontSize: T.xs,
    fontWeight: "bold",
    color: brandColor("fg-soft"),
    marginTop: S.sm,
    marginBottom: S.xs,
  },
  fRow: { flexDirection: "row", paddingVertical: 2 },
  fLabel: { fontSize: T.xs, flex: 1, color: brandColor("fg") },
  fValue: {
    fontSize: T.xs,
    color: brandColor("fg"),
    fontFamily: "Inconsolata",
    textAlign: "right",
  },
  fNote: { fontSize: T.xs, color: brandColor("fg-muted"), marginBottom: 2 },
  legalLine: {
    fontSize: T.xs,
    color: brandColor("fg"),
    lineHeight: T.lineNormal,
    marginBottom: S.xs,
  },
  // Bloc « Bon pour accord » — signature manuscrite du client.
  accordBox: {
    marginTop: S.xxl,
    borderWidth: 1,
    borderColor: brandColor("border-strong"),
    borderRadius: S.radius,
    backgroundColor: brandColor("bg"),
    padding: S.lg,
  },
  accordTitle: {
    fontSize: T.md,
    fontWeight: "bold",
    color: brandColor("mocha"),
    marginBottom: S.xs,
  },
  accordHint: {
    fontSize: T.xs,
    fontStyle: "italic",
    color: brandColor("fg-muted"),
    marginBottom: S.lg,
  },
  // Bloc « Formule retenue par le client » (exemplaire signé d'un devis à formules).
  choixTitle: {
    fontSize: T.sm,
    fontWeight: "bold",
    color: brandColor("mocha"),
    marginBottom: S.xs,
  },
  choixLine: {
    fontSize: T.xs,
    color: brandColor("fg"),
    lineHeight: T.lineNormal,
    marginBottom: 2,
  },
  choixSceau: {
    fontSize: T.xs,
    color: brandColor("fg-muted"),
    marginTop: S.xs,
  },
  // Encadré du choix : MÊME cadre que `accordBox`, mais SANS `wrap={false}` — un choix long
  // (nombreuses automatisations, lignes récurrentes) peut dépasser une page ; un bloc insécable
  // plus haut que la page serait rogné. Le « Bon pour accord » + signatures, eux, restent insécables.
  choixBox: {
    marginTop: S.xxl,
    borderWidth: 1,
    borderColor: brandColor("border-strong"),
    borderRadius: S.radius,
    backgroundColor: brandColor("bg"),
    padding: S.lg,
  },
  accordBoxApresChoix: { marginTop: S.lg },
  // ⚠️ `accordLine` a été retiré avec les trois lignes « Nom / Date / Signature »
  // à remplir au stylo : `SignatureZone` porte désormais les cadres, vides ou
  // renseignés. Le laisser aurait été du style mort.
});

// ============================================================
// Types de données
// ============================================================

export interface ClientDevis {
  /**
   * Le destinataire est-il une PERSONNE PHYSIQUE ?
   *
   * 🔴 Ce champ manquait : le devis d'un particulier s'intitulait « Raison
   * sociale : Prenom Nom » et lui opposait une clause en langage B2B pur —
   * « elles prevalent sur toutes conditions d'achat du client ». Un particulier
   * n'a pas de conditions d'achat.
   *
   * Derive au serveur, jamais decide ici. Absent = professionnel (refus prudent).
   */
  estPersonnePhysique?: boolean;
  raisonSociale: string;
  siret?: string;
  adresse?: string;
  email?: string;
}

export interface DevisData {
  numero: string;
  dateEmission: string;
  /** Date limite de validité du devis (formatée fr-FR). */
  dateValidite: string;
  /** Référence client / n° de bon de commande (exigé ETI/grands comptes/OPCO). */
  refClient?: string;
  identite: OrganismeIdentite;
  client: ClientDevis;
  lignes: LigneFacture[];
  /**
   * Devis à formules (v3) : vue prête à imprimer des formules A et/ou B. ABSENTE = mise en
   * page historique (détail des prestations + totaux), inchangée.
   */
  formules?: VueFormules;
  /**
   * Régime de TVA appliqué (assujetti 20 % / exonération 261-4-4° / franchise
   * 293 B). Capturé depuis la config au moment de l'émission (instantané).
   */
  regimeTva: RegimeTva;
  /** Taux standard appliqué en régime assujetti (%). Défaut 20. */
  tauxTvaStandardPercent?: number;
  /** Libellé de l'activité facturée (SSOT ACTIVITE_LABELS). */
  activiteLabel?: string;
  /** Libellé du financement suggéré (OPCO, CPF, France Travail…). */
  financementSuggere?: string;
  /** Prise en charge financeur estimée (centimes) — indicative. */
  montantOpcoEstimeCents?: number;
  /** Reste à charge client estimé (centimes) — indicatif. */
  resteAChargeCents?: number;
  /**
   * Sous-lot 8G — mention qui REMPLACE l'estimation quand le financement
   * mutualisé n'est pas accessible faute de certification (L.6316-1).
   *
   * 🔴 Sa présence retire les montants du bloc : ce n'est pas un complément
   * d'information, c'est une substitution. Un devis qui porterait à la fois
   * « Prise en charge estimée : 2 400 € » et « aucune estimation n'est
   * communiquée » se lirait comme une contradiction, et le client retiendrait
   * le chiffre. Résolue par `regimeEstimationMutualisee()` chez l'appelant, une
   * seule fois, avec l'état réel du drapeau de certification.
   */
  mentionEstimationIndisponible?: string;
  estCopie?: boolean;
  /**
   * Preuves de signature RÉELLEMENT apposées, par partie.
   *
   * 🔴 ABSENTES = cadres vides à remplir au stylo, comportement historique
   * INCHANGÉ. Ce n'est pas un état dégradé : le circuit papier reste un chemin
   * de plein droit — c'est le seul qui fonctionne quand le client veut imprimer,
   * signer et scanner. Supprimer les cadres vides serait une régression.
   *
   * Renseignées, elles font rendre le tracé, l'horodatage et l'empreinte au bas
   * du devis, SOUS les totaux. C'est ce qui fait que le client signe la pièce
   * qu'il a lue, et non un document séparé à trois champs.
   */
  signatures?: PreuvesParPartie;
  /**
   * Choix SCELLÉ du client (devis à formules), injecté par `exemplaire-signe.ts` seulement
   * quand le sceau de la ligne client est cohérent avec l'offre figée. ABSENT = rendu
   * identique à celui d'avant (original, devis classique, sceau incohérent).
   */
  choixRetenu?: ChoixImprimable;
}

// ============================================================
// Devis à formules — blocs d'affichage (v3)
// ============================================================

const pct = (n: number): string => String(n).replace(".", ",");
const eur = (c: number): string => formatEurosFromCents(c);

function FRow({ label, value }: { label: string; value?: string }): React.ReactElement {
  return (
    <View style={styles.fRow}>
      <Text style={styles.fLabel}>{label}</Text>
      {value !== undefined ? <Text style={styles.fValue}>{value}</Text> : null}
    </View>
  );
}

function FormuleColonne({ f }: { f: VueFormule }): React.ReactElement {
  const a = f.abonnement;
  const m = f.maintenance;
  return (
    <View style={styles.formuleCol}>
      <Text style={styles.formuleTitre}>{f.titre}</Text>

      <Text style={styles.formuleSousTitre}>Prestations</Text>
      {f.lignes.map((l, i) => (
        <View key={i}>
          <FRow label={l.designation} value={eur(l.totalHtCents)} />
          <Text style={styles.fNote}>
            {`${l.quantite} × ${eur(l.prixUnitaireHtCents)} HT — TVA ${pct(l.tauxTvaPercent)} %${
              l.precision ? ` — ${l.precision}` : ""
            }`}
          </Text>
        </View>
      ))}

      {f.options.length > 0 ? (
        <View>
          <Text style={styles.formuleSousTitre}>Options (non comprises dans le total)</Text>
          {f.options.map((l, i) => (
            <View key={i}>
              <FRow label={l.designation} value={eur(l.totalHtCents)} />
              <Text style={styles.fNote}>
                {`HT — TVA ${pct(l.tauxTvaPercent)} %${l.precision ? ` — ${l.precision}` : ""}`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: S.sm }}>
        <FRow label="Total HT" value={eur(f.totalHtCents)} />
        <FRow label="TVA" value={eur(f.totalTvaCents)} />
        <FRow label="Total TTC" value={eur(f.totalTtcCents)} />
      </View>

      <Text style={styles.formuleSousTitre}>Paiement de la partie ponctuelle (HT)</Text>
      {f.phases.map((p) => (
        <View key={p.rang}>
          <FRow label={`${p.libelle} — ${p.pourcentage} %`} value={eur(p.montantHtCents)} />
          <Text style={styles.fNote}>{p.declencheur}</Text>
        </View>
      ))}

      {a ? (
        <View>
          <Text style={styles.formuleSousTitre}>Abonnement</Text>
          <FRow
            label={`Mensualité (TVA ${pct(a.tauxTvaPercent)} %)`}
            value={`${eur(a.mensuelCatalogueHtCents)} HT`}
          />
          {a.periodes.map((p) => (
            <View key={p.mois}>
              <FRow
                label={`${p.mois} mois${p.remisePercent > 0 ? ` — remise ${pct(p.remisePercent)} %` : ""}`}
                value={`${eur(p.prixPeriodeHtCents)} HT`}
              />
              <Text style={styles.fNote}>{`soit ${eur(p.mensuelNetHtCents)} HT par mois`}</Text>
            </View>
          ))}
          <Text style={styles.fNote}>{a.terme}</Text>
          <Text style={styles.fNote}>{a.modeAvance}</Text>
          <FRow
            label="Engagement"
            value={a.engagementMois > 0 ? `${a.engagementMois} mois` : "Sans engagement"}
          />
          <FRow label={a.reconduction} />
          <FRow label="Préavis de résiliation" value={`${a.preavisMois} mois`} />
          <FRow
            label="Indemnité de sortie anticipée (maximum)"
            value={
              a.indemniteSortieMaxHtCents !== null
                ? `${eur(a.indemniteSortieMaxHtCents)} HT`
                : "Aucune"
            }
          />
        </View>
      ) : null}

      {m ? (
        <View>
          <Text style={styles.formuleSousTitre}>
            {`Maintenance — ${m.obligatoire ? "obligatoire" : "facultative"}`}
          </Text>
          <FRow label="Mensualité" value={`${eur(m.mensuelHtCents)} HT`} />
          <Text style={styles.fNote}>
            {`${m.moisOfferts > 0 ? `${m.moisOfferts} mois offerts. ` : ""}Paiement par périodes de ${m.periodesMois.join(", ")} mois.`}
          </Text>
        </View>
      ) : null}

      {f.hebergementMensuelHtCents !== null ? (
        <View>
          <Text style={styles.formuleSousTitre}>Hébergement chez Axion-IA</Text>
          <FRow label="Mensualité" value={`${eur(f.hebergementMensuelHtCents)} HT`} />
        </View>
      ) : null}
    </View>
  );
}

function FormulesBloc({ v }: { v: VueFormules }): React.ReactElement {
  return (
    <View>
      <DocSection title={v.formules.length > 1 ? "Nos formules, côte à côte" : "Formule proposée"}>
        <View style={styles.formulesRow}>
          {v.formules.map((f, i) => (
            <React.Fragment key={f.formule}>
              {i > 0 ? <View style={styles.formuleGap} /> : null}
              <FormuleColonne f={f} />
            </React.Fragment>
          ))}
        </View>
      </DocSection>

      <DocSection title="Garantie">
        <FRow
          label={
            v.garantieJours === null
              ? "Aucune garantie contractuelle n'est prévue."
              : `Corrections gratuites pendant ${v.garantieJours} jours après la livraison.`
          }
        />
      </DocSection>

      {v.servicesTiers.length > 0 || v.plafondAConfirmer ? (
        <DocSection title="Services tiers et frais d'infrastructure (hors total, réglés à leurs fournisseurs)">
          {v.servicesTiers.map((s, i) => (
            <FRow
              key={i}
              label={`${s.nom} — ${s.obligatoire ? "obligatoire" : "facultatif"}, ${s.rythme}`}
              value={
                s.estimationHtCents !== null
                  ? `${eur(s.estimationHtCents)} HT (indicatif)`
                  : "à confirmer"
              }
            />
          ))}
          {v.plafondAConfirmer ? (
            <FRow
              label={`Frais à confirmer : ${v.plafondAConfirmer.texte} — plafond`}
              value={`${eur(v.plafondAConfirmer.montantHtCents)} HT`}
            />
          ) : null}
        </DocSection>
      ) : null}

      {v.textes.length > 0 ? (
        <DocSection title="Informations complémentaires">
          {v.textes.map((t, i) => (
            <Text key={i} style={styles.legalLine}>
              {t}
            </Text>
          ))}
        </DocSection>
      ) : null}
    </View>
  );
}

// ============================================================
// Composant principal
// ============================================================

export function DevisPdf({ data }: { data: DevisData }): React.ReactElement {
  const { identite } = data;

  const tauxStandard = data.tauxTvaStandardPercent ?? TAUX_TVA_STANDARD;
  const totaux = computeTotauxFacture(data.lignes, data.regimeTva, tauxStandard);
  const tauxLigne = (ligne: LigneFacture): number =>
    typeof ligne.tauxTvaPercent === "number"
      ? ligne.tauxTvaPercent
      : data.regimeTva === "assujetti"
        ? tauxStandard
        : 0;
  const mentionRegimeTva = mentionTva(data.regimeTva);
  // Renvoi aux CGV. `identite.site` peut être vide (config Qualiopi non
  // renseignée) : dans ce cas on énonce quand même l'opposabilité et le canal
  // de communication, plutôt que de rendre une URL tronquée du type « /conditions-generales ».
  const siteBase = identite.site.replace(/\/+$/, "");
  // 🔴 2026-08-25, cahier D4-3 — la phrase « Elles prévalent sur toutes
  // conditions d'achat du client, sauf dérogation écrite et signée des deux
  // parties » est une clause ENTRE PROFESSIONNELS : elle règle le conflit entre
  // CGV du vendeur et conditions d'achat de l'acheteur. **Un particulier n'a pas
  // de conditions d'achat**, et la lui opposer n'a aucun sens.
  //
  // ⛔ Elle est OMISE pour une personne physique, pas remplacée. On n'invente
  // pas ici de mention consumériste — ni rétractation, ni médiation : le droit
  // de rétractation de dix jours (L.6353-5) est porté par le CONTRAT DE
  // FORMATION, qui est la pièce contractuelle du particulier, et l'ajouter au
  // devis serait écrire une clause absente du gabarit.
  //
  // L'acceptation des CGV, elle, RESTE : elle est due dans les deux cas.
  const cgvOpposabilite =
    data.client.estPersonnePhysique === true
      ? ""
      : " Elles prévalent sur toutes conditions d'achat du client, sauf dérogation écrite et signée des deux parties.";
  const cgvMention = siteBase
    ? `L'acceptation du présent devis emporte acceptation des Conditions générales de vente d'${identite.raisonSociale || "Axion-IA"}, consultables sur ${siteBase}/conditions-generales et communiquées sur simple demande.${cgvOpposabilite}`
    : `L'acceptation du présent devis emporte acceptation des Conditions générales de vente, communiquées sur simple demande.${cgvOpposabilite}`;
  // Sous-lot 8G — la mention d'indisponibilité PRIME sur les montants : voir le
  // commentaire de `mentionEstimationIndisponible`. Le bloc reste affiché (le
  // client doit savoir que le dispositif existe), seuls les chiffres partent.
  const estimationIndisponible =
    data.mentionEstimationIndisponible !== undefined &&
    data.mentionEstimationIndisponible.trim() !== "";
  const afficheEstimation =
    estimationIndisponible ||
    data.montantOpcoEstimeCents !== undefined ||
    data.resteAChargeCents !== undefined;

  return (
    <Document>
      <QualiopiPage
        docTitle="Devis"
        docNumber={`N° ${data.numero}`}
        // Décision 22 (v5) : pas de pied Qualiopi sur le devis. `base-layout` teste `qualiopi`
        // en vérité : chaîne vide = ligne absente. base-layout lui-même reste intact (archives).
        identite={{ ...identite, qualiopi: "" }}
        {...(data.estCopie === true ? { estCopie: true } : {})}
      >
        {/* Informations du devis */}
        <DocSection title="Informations du devis">
          <FieldRow label="N° de devis" value={data.numero} required />
          <FieldRow label="Date d'émission" value={data.dateEmission} required />
          <FieldRow label="Valable jusqu'au" value={data.dateValidite} required />
          {data.refClient !== undefined && data.refClient !== "" && (
            <FieldRow label="Référence client / commande" value={data.refClient} />
          )}
          {data.activiteLabel !== undefined && data.activiteLabel !== "" && (
            <FieldRow label="Activité" value={data.activiteLabel} />
          )}
        </DocSection>

        {/* Émetteur — SIRET/NDA en `required` (jamais masqués) */}
        <DocSection title="Émetteur">
          <FieldRow label="Raison sociale" value={identite.raisonSociale} required />
          <FieldRow label="Adresse du siège" value={identite.adresseSiege} required />
          <FieldRow label="SIRET de l'organisme" value={identite.siret} required />
          <NdaFieldRow label="N° déclaration activité (NDA)" nda={identite.nda} />
        </DocSection>

        {/* Client */}
        <DocSection title="Client">
          <FieldRow
            label={data.client.estPersonnePhysique === true ? "Nom et prénom" : "Raison sociale"}
            value={data.client.raisonSociale}
            required
          />
          {data.client.siret ? <FieldRow label="SIRET" value={data.client.siret} /> : null}
          {data.client.adresse ? <FieldRow label="Adresse" value={data.client.adresse} /> : null}
          {data.client.email ? <FieldRow label="Email" value={data.client.email} /> : null}
        </DocSection>

        {data.formules !== undefined ? (
          <FormulesBloc v={data.formules} />
        ) : (
          <>
            {/* Détail des prestations */}
            <DocSection title="Détail des prestations">
              <DataTable
                columns={[
                  { key: "designation", header: "Désignation", flex: 3 },
                  { key: "qte", header: "Qté", flex: 0.8, align: "right" },
                  { key: "pu", header: "P.U. HT", flex: 1.4, align: "right" },
                  { key: "tva", header: "TVA", flex: 0.8, align: "right" },
                  { key: "total", header: "Total HT", flex: 1.4, align: "right" },
                ]}
                rows={data.lignes.map((ligne) => ({
                  designation: ligne.designation,
                  qte: String(ligne.quantite),
                  pu: formatEurosFromCents(ligne.prixUnitaireHtCents),
                  tva: `${tauxLigne(ligne)} %`,
                  total: formatEurosFromCents(ligne.quantite * ligne.prixUnitaireHtCents),
                }))}
              />
            </DocSection>

            {/* Totaux — ventilation TVA par taux (régime de TVA appliqué) */}
            <View style={styles.totalsBlock}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total HT</Text>
                <Text style={styles.totalValue}>{formatEurosFromCents(totaux.totalHtCents)}</Text>
              </View>
              {totaux.ventilation.map((v) => (
                <View key={v.tauxPercent} style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    {totaux.ventilation.length > 1
                      ? `TVA ${v.tauxPercent} % (base ${formatEurosFromCents(v.baseHtCents)})`
                      : `TVA (${v.tauxPercent} %)`}
                  </Text>
                  <Text style={styles.totalValue}>{formatEurosFromCents(v.montantTvaCents)}</Text>
                </View>
              ))}
              <View style={styles.totalTtcRow}>
                <Text style={styles.totalTtcLabel}>Total TTC</Text>
                <Text style={styles.totalTtcValue}>
                  {formatEurosFromCents(totaux.totalTtcCents)}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Estimation de financement (indicative — jamais contractuelle) */}
        {afficheEstimation ? (
          <LegalCallout variant="info" title="Estimation de financement">
            {estimationIndisponible
              ? [
                  data.financementSuggere !== undefined && data.financementSuggere !== ""
                    ? `Financement envisagé : ${data.financementSuggere}. `
                    : "",
                  data.mentionEstimationIndisponible ?? "",
                ].join("")
              : [
                  data.financementSuggere !== undefined && data.financementSuggere !== ""
                    ? `Financement suggéré : ${data.financementSuggere}. `
                    : "",
                  data.montantOpcoEstimeCents !== undefined
                    ? `Prise en charge estimée : ${formatEurosFromCents(data.montantOpcoEstimeCents)}. `
                    : "",
                  data.resteAChargeCents !== undefined
                    ? `Reste à charge estimé : ${formatEurosFromCents(data.resteAChargeCents)}. `
                    : "",
                  "Estimation indicative, non contractuelle — sous réserve de l'accord de prise en charge du financeur.",
                ].join("")}
          </LegalCallout>
        ) : null}

        {/* Mention TVA (régime) + validité du devis */}
        <LegalCallout variant="legal" title="Conditions du devis">
          {/* Mention de TVA selon le régime (exonération 261-4-4° ou franchise
              293 B). En régime assujetti : pas de mention d'exonération, la TVA
              figure dans les totaux. */}
          {mentionRegimeTva ? <Text style={styles.legalLine}>{mentionRegimeTva}</Text> : null}
          <Text style={styles.legalLine}>
            {`Devis gratuit, valable jusqu'au ${data.dateValidite}. Au-delà de cette date, les conditions (tarifs, disponibilités) sont susceptibles d'être révisées.`}
          </Text>
          {/* 🔴 2026-08-14 — le devis ne renvoyait à AUCUNE condition générale.
              La convention, la convention tripartite et le contrat de formation
              annexent bien les CGV : le volet formation était couvert. Le devis
              ne l'était pas — c'est-à-dire précisément le canal des prestations
              d'audit, d'implémentation, de site web et de coaching, celles qui
              portent le plus de risque (systèmes du Client, fournisseurs tiers,
              contenus générés).

              Or les CGV n'ont d'effet que si le Client en a eu connaissance
              AVANT de s'engager (art. 1119 C. civ.). Le renvoi doit donc figurer
              sur la pièce que le Client LIT et SIGNE, au-dessus de sa signature
              — pas dans un document séparé qu'on lui aurait éventuellement
              transmis. C'est la même leçon que le circuit « Bon pour accord »
              ci-dessous : on signe ce qu'on a sous les yeux. */}
          <Text style={styles.legalLine}>{cgvMention}</Text>
          {/* L15 (NC12, indicateur 26) — le référent handicap et la possibilité
              d'adaptation figurent sur la pièce que le client lit et signe. */}
          <Text style={styles.legalLine}>
            {
              "Situation de handicap : notre référent handicap étudie avec vous, avant la formation, les adaptations possibles (supports, rythme, accès, modalités). Contact : handicap@axion-ia.com."
            }
          </Text>
        </LegalCallout>

        {/* ── Bon pour accord — en bas du document, SOUS les totaux ──

            🔴 C'est ICI que la signature doit apparaître, et pas ailleurs : le
            signataire doit avoir les lignes, les quantités, les prix unitaires,
            la TVA et les totaux SOUS LES YEUX au moment où il s'engage. C'était
            précisément le défaut du circuit fournisseur — le client lisait ce
            document-ci et en signait un autre, à trois champs, qui ne désignait
            pas son objet.

            ⚠️ `SignatureZone` rend chaque modalité POUR CE QU'ELLE EST et
            n'affiche jamais une case « signé » sans dire de quoi elle est faite.
            Tant qu'aucune preuve n'existe, elle rend les cadres vides — le
            circuit papier reste ouvert. */}
        {data.choixRetenu !== undefined && (
          <View style={styles.choixBox}>
            <Text style={styles.choixTitle}>Formule retenue par le client</Text>
            <Text style={styles.choixLine}>{data.choixRetenu.formuleLibelle}</Text>
            {data.choixRetenu.automatisations.length > 0 && (
              <Text style={styles.choixLine}>
                Automatisations retenues : {data.choixRetenu.automatisations.join(", ")}
              </Text>
            )}
            <Text style={styles.choixLine}>
              Total ponctuel : {data.choixRetenu.totalPonctuelHtLisible} HT —{" "}
              {data.choixRetenu.totalPonctuelTtcLisible} TTC
            </Text>
            {data.choixRetenu.recurrent.map((ligne) => (
              <Text key={ligne} style={styles.choixLine}>
                {ligne}
              </Text>
            ))}
            <Text style={styles.choixSceau}>
              Choix scellé avec la signature du client - empreinte {data.choixRetenu.empreinteChoix}
            </Text>
          </View>
        )}
        <View
          style={
            data.choixRetenu !== undefined
              ? [styles.accordBox, styles.accordBoxApresChoix]
              : styles.accordBox
          }
          wrap={false}
        >
          <Text style={styles.accordTitle}>Bon pour accord</Text>
          <Text style={styles.accordHint}>
            Le client accepte le présent devis dans son intégralité : désignations, quantités, prix
            unitaires, taux de TVA et totaux ci-dessus, ainsi que les Conditions générales de vente
            rappelées ci-dessus, dont il reconnaît avoir pris connaissance.
          </Text>
          {/* 🔴 L'emplacement de DATE n'est affiché que tant que personne n'a
              signé, et il ne doit pas disparaître du chemin papier : sur une
              pièce contractuelle, c'est la date qui prouve QUAND l'engagement a
              été pris — et l'art. L.6353-1 exige que la convention soit conclue
              AVANT le début de l'action. Une fois la signature apposée,
              `SignatureApposee` porte l'horodatage réel, et laisser en plus une
              ligne à remplir inviterait à en écrire une autre, contradictoire. */}
          <SignatureZone
            {...(data.signatures?.client == null && data.signatures?.axionia == null
              ? { faitLe: "……………………………………, le ……………………………" }
              : {})}
            parties={[
              {
                titre: "Pour le client",
                nom: data.client.raisonSociale,
                mention: "Nom, qualité, signature — précédée de la mention « Bon pour accord »",
                signature: data.signatures?.client ?? null,
              },
              {
                // L'organisme CONCLUT : il contresigne ce que le client a
                // accepté. L'ordre suit le SSOT (`parties-requises.ts`), où
                // `axionia` figure en dernier — ce n'est pas décoratif.
                titre: "Pour l'organisme",
                nom: identite.raisonSociale,
                mention: "Nom, qualité, signature et cachet",
                signature: data.signatures?.axionia ?? null,
              },
            ]}
          />
        </View>
      </QualiopiPage>
    </Document>
  );
}
