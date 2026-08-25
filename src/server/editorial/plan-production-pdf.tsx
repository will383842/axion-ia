/**
 * Console éditoriale — le plan de production, en PDF imprimable.
 *
 * ── Pourquoi un troisième format ──────────────────────────────────────────
 *
 * Le Markdown se lit à l'écran, à côté de l'outil de fabrication. Le CSV se
 * suit dans un tableur. Aucun des deux ne s'imprime : le Markdown sort brut
 * ou dépend d'un convertisseur, et un CSV imprimé est illisible dès que le
 * `contenu` d'une slide dépasse la largeur d'une cellule.
 *
 * Le besoin posé est celui-ci : « pour les visuels à créer, il faudrait que
 * je l'aie en PDF pour pouvoir imprimer ce que je veux ». Deux mots comptent
 * dans cette phrase :
 *
 *   - **imprimer** — donc une pagination franche, des cases à cocher au stylo,
 *     un pied de page qui rappelle le périmètre sur CHAQUE feuille (une page
 *     détachée d'un plan ne dit plus de quel plan elle vient) ;
 *   - **ce que je veux** — donc chaque type d'asset commence sur une PAGE
 *     NEUVE. C'est ce qui permet d'imprimer les pages 4 à 9 « les carrousels »
 *     sans emporter la fin des vidéos. Sans ça, le filtre par type reste le
 *     seul découpage possible, et il oblige à retélécharger un fichier par
 *     type.
 *
 * ── Ce que ce module N'EST PAS ────────────────────────────────────────────
 *
 * Ce n'est pas une pièce Qualiopi. Il n'emprunte donc pas `base-layout.tsx`
 * (en-tête d'organisme, mentions légales, zone de signature, filigrane) : un
 * plan de production est un document de travail interne, et le charger des
 * obligations d'une convention le rendrait plus lourd sans le rendre plus
 * juste. Il emprunte en revanche les MÊMES tokens de marque et les MÊMES
 * polices — la charte est une, le document reste reconnaissable.
 *
 * 🔴 `assainirEspacesPdf` est importé, jamais recopié. Les fines insécables
 * d'`Intl` et de la typographie française n'existent dans AUCUNE des huit
 * polices du dossier : @react-pdf bascule alors le fragment sur Helvetica
 * WinAnsi et imprime « / » à la place. Un prédicat recopié finit toujours par
 * diverger de son original — celui-ci reste à un seul endroit.
 *
 * NE PAS "use client" — rendu serveur exclusif.
 */

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { pdf } from "@react-pdf/renderer";
import {
  brandColor,
  QUALIOPI_BRAND_FONTS as F,
  QUALIOPI_PDF_TYPE as T,
  QUALIOPI_PDF_SPACE as S,
} from "@/server/qualiopi/brand/brand-tokens";
import { registerQualiopiPdfFonts } from "@/server/qualiopi/documents/fonts";
import { assainirEspacesPdf } from "@/server/qualiopi/documents/base-layout";
import {
  trierPourProduction,
  avancement,
  TYPES_PLAN,
  type AssetPlan,
  type ContextePlan,
} from "@/server/editorial/plan-production";

registerQualiopiPdfFonts();

/** Le titre humain d'un type d'asset, en tête de sa section. */
const LIBELLE_TYPE: Record<string, string> = {
  video: "Vidéos",
  carrousel: "Carrousels",
  image: "Images",
  photo: "Photos de Williams",
  audio: "Audio",
  document: "Documents",
};

/** Le titre humain d'un rôle de segment. Miroir de celui du Markdown. */
const LIBELLE_ROLE: Record<string, string> = {
  script: "Script",
  prompt: "Prompt de génération",
  slide: "Slide",
  legende: "Légende du post",
  consigne: "Consigne",
};

/** `2026-09-05` → `05/09/2026`. Miroir de la fonction du Markdown. */
function dateFr(iso: string | null): string {
  if (!iso) return "sans date";
  const [a, m, j] = iso.split("-");
  return j && m && a ? `${j}/${m}/${a}` : iso;
}

/**
 * Les caractères qu'aucune des huit polices du dossier ne porte.
 *
 * 🔴 MESURÉ, pas supposé. Un plan rendu avec « Post du 3 octobre 🚀 » sort
 * « Post du 3 octobre =€ », et « … en 5 slides. 👇 » sort « … en 5 slides. =G ».
 * Même mécanique que le « 1/440,00 € » de juillet : face à un codepoint non
 * couvert, @react-pdf bascule le fragment sur Helvetica en WinAnsiEncoding et
 * écrit l'octet de poids faible. Le document ne signale rien — il imprime du
 * charabia à la place.
 *
 * Or les légendes de posts LinkedIn sont PLEINES d'emoji : sans cette passe,
 * chaque plan imprimé en porterait plusieurs.
 *
 * Les plages retenues couvrent les emoji, les dingbats (dont « ✓ »), les
 * flèches, les symboles techniques et les sélecteurs de variante. Elles
 * n'incluent PAS la ponctuation générale (U+2000–U+206F) : le tiret cadratin,
 * les points de suspension et les guillemets français doivent survivre — ils
 * sont couverts par les polices et font la moitié de la charte.
 */
const NON_IMPRIMABLES =
  /[\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}\u{200D}]/gu;

/**
 * Le nettoyage appliqué à TOUT texte qui entre dans le PDF.
 *
 * Deux passes, deux défauts distincts :
 *   1. `assainirEspacesPdf` — les fines insécables, qui s'impriment « / » ;
 *   2. `NON_IMPRIMABLES` — les emoji, qui s'impriment en octets faux.
 *
 * ⚠️ On RETIRE au lieu de remplacer par un signe : un « [emoji] » au milieu
 * d'une légende gêne plus qu'il n'informe. Mais on ne retire pas EN SILENCE —
 * `compterNonImprimables` remonte le compte, et la couverture le dit. Le
 * Markdown et le CSV, eux, conservent tout : c'est là qu'on copie le texte
 * pour le publier, et c'est là que l'emoji compte.
 *
 * `null` devient chaîne vide plutôt que le mot « null » : un brief absent est
 * un blanc à remplir, pas une valeur à imprimer.
 */
function txt(v: string | null | undefined): string {
  return assainirEspacesPdf(v ?? "").replace(NON_IMPRIMABLES, "");
}

/** Combien de caractères l'impression va perdre, sur tout le plan. */
export function compterNonImprimables(assets: readonly AssetPlan[]): number {
  let n = 0;
  const compter = (v: string | null | undefined) => {
    n += (v ?? "").match(NON_IMPRIMABLES)?.length ?? 0;
  };
  for (const a of assets) {
    compter(a.libelle);
    compter(a.titrePost);
    for (const s of a.segments) {
      compter(s.titre);
      compter(s.contenu);
      compter(s.prompt);
    }
  }
  return n;
}

const styles = StyleSheet.create({
  /**
   * 🔴 PAS de `lineHeight` ici — et ce n'est pas un oubli.
   *
   * MESURÉ le 2026-08-25, en extrayant le texte du PDF rendu : un
   * `lineHeight` sur la `Page` fait DISPARAÎTRE le pied `fixed` en entier —
   * périmètre et numéro de page — dès que ce pied contient un
   * `<Text render={…}>`. Le composant est bien invoqué, ses styles sont
   * corrects, et le texte n'est nulle part dans le document produit.
   *
   * L'interligne est donc porté par les styles de TEXTE, un cran plus bas.
   * Le rendu est identique et le pied survit.
   *
   * ⚠️ Ne pas remonter `lineHeight` ici « pour simplifier » : le pied
   * repartirait en silence, et aucun test de buffer ne le verrait.
   * `plan-production-pdf.spec.tsx` monte la garde sur le PDF rendu.
   */
  page: {
    paddingTop: S.page,
    paddingHorizontal: S.page,
    // Réserve la hauteur du pied de page fixe.
    paddingBottom: 52,
    fontSize: T.base,
    fontFamily: F.sans,
    color: brandColor("fg"),
    backgroundColor: brandColor("paper"),
  },

  // ── En-tête de couverture ───────────────────────────────────────────────
  eyebrow: {
    fontSize: T.xs,
    letterSpacing: T.trackingWide,
    textTransform: "uppercase",
    color: brandColor("terracotta"),
    marginBottom: S.sm,
  },
  titre: {
    fontFamily: F.serif,
    fontSize: T.xl,
    color: brandColor("mocha"),
    marginBottom: S.md,
  },
  sousTitre: {
    fontSize: T.sm,
    lineHeight: T.lineNormal,
    color: brandColor("fg-muted"),
    marginBottom: S.xl,
  },
  regleTitre: {
    borderBottomWidth: 2,
    borderBottomColor: brandColor("terracotta"),
    marginBottom: S.xxl,
  },

  // ── Avertissement ───────────────────────────────────────────────────────
  alerte: {
    backgroundColor: brandColor("terracotta-soft"),
    borderLeftWidth: 3,
    borderLeftColor: brandColor("terracotta"),
    paddingVertical: S.lg,
    paddingHorizontal: S.xl,
    borderRadius: S.radius,
    marginBottom: S.xxl,
  },
  alerteTitre: {
    fontSize: T.sm,
    fontWeight: "bold",
    color: brandColor("terracotta-deep"),
    marginBottom: S.xs,
  },
  alerteTexte: {
    fontSize: T.sm,
    lineHeight: T.lineNormal,
    color: brandColor("fg-soft"),
  },

  // ── Sommaire ────────────────────────────────────────────────────────────
  tableau: {
    borderWidth: 1,
    borderColor: brandColor("border"),
    borderRadius: S.radius,
  },
  ligneEntete: {
    flexDirection: "row",
    backgroundColor: brandColor("sand"),
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border-strong"),
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
  },
  ligne: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border"),
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
  },
  ligneDerniere: {
    flexDirection: "row",
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
  },
  // ⚠️ `flex` n'est porté que par des cellules dans un conteneur en LIGNE.
  // Sur un `<Text>` d'un conteneur en colonne, il réclamerait toute la hauteur
  // et le texte suivant se rendrait par-dessus (défaut constaté le 2026-08-03
  // sur un kit OPCO réel, gardé par `pdf-flex-colonne.spec.tsx`).
  colType: { flex: 3, fontSize: T.sm, lineHeight: T.lineNormal },
  colNombre: { flex: 1, fontSize: T.sm, lineHeight: T.lineNormal, textAlign: "right" },
  celluleForte: { fontWeight: "bold" },

  // ── Section d'un type ───────────────────────────────────────────────────
  titreSection: {
    fontFamily: F.serif,
    fontSize: T.lg,
    color: brandColor("mocha"),
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border-strong"),
    paddingBottom: S.md,
    marginBottom: S.xl,
  },

  // ── Bloc d'un asset ─────────────────────────────────────────────────────
  asset: {
    marginBottom: S.xxl,
    paddingBottom: S.xl,
    borderBottomWidth: 1,
    borderBottomColor: brandColor("border"),
  },
  assetEnTete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: S.sm,
  },
  assetTitre: {
    flex: 1,
    fontSize: T.md,
    lineHeight: T.lineTight,
    fontWeight: "bold",
    color: brandColor("mocha"),
    paddingRight: S.xl,
  },
  assetEcheance: {
    fontFamily: F.mono,
    fontSize: T.sm,
    color: brandColor("terracotta-deep"),
  },
  assetMeta: {
    fontSize: T.xs,
    lineHeight: T.lineNormal,
    color: brandColor("fg-muted"),
    marginBottom: S.xl,
  },
  assetVide: {
    fontSize: T.sm,
    lineHeight: T.lineNormal,
    fontStyle: "italic",
    color: brandColor("fg-muted"),
  },

  // ── Segment ─────────────────────────────────────────────────────────────
  segment: {
    flexDirection: "row",
    marginBottom: S.xl,
  },
  // La case à cocher au stylo. Un carré dessiné, jamais un glyphe : « ☐ » et
  // « ✓ » n'existent dans aucune des polices embarquées, et @react-pdf les
  // imprimerait en octets faux.
  caseACocher: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: brandColor("border-strong"),
    borderRadius: 1,
    marginTop: 2,
    marginRight: S.lg,
  },
  caseFaite: {
    backgroundColor: brandColor("sage"),
    borderColor: brandColor("sage"),
  },
  segmentCorps: {
    flex: 1,
  },
  segmentRole: {
    fontSize: T.sm,
    lineHeight: T.lineNormal,
    fontWeight: "bold",
    color: brandColor("fg-soft"),
    marginBottom: S.xs,
  },
  segmentTexte: {
    fontSize: T.sm,
    lineHeight: T.lineNormal,
    marginBottom: S.md,
  },
  promptLabel: {
    fontSize: T.xs,
    fontWeight: "bold",
    letterSpacing: T.trackingWide,
    textTransform: "uppercase",
    color: brandColor("fg-muted"),
    marginBottom: S.xs,
  },
  promptBloc: {
    backgroundColor: brandColor("sand"),
    borderRadius: S.radius,
    paddingVertical: S.lg,
    paddingHorizontal: S.xl,
  },
  promptTexte: {
    fontFamily: F.mono,
    fontSize: T.sm,
    lineHeight: T.lineTight,
    color: brandColor("fg"),
  },

  // ── Pied de page ────────────────────────────────────────────────────────
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
  piedTexte: {
    fontSize: T.xs,
    color: brandColor("fg-muted"),
  },
});

/**
 * Le pied répété — le périmètre du plan, sur CHAQUE feuille.
 *
 * Une page détachée d'une liasse ne dit plus rien d'elle-même : ni de quel
 * plan elle vient, ni si elle est à jour. Le rappel du périmètre et le
 * numéro de page sont ce qui rend une impression partielle exploitable.
 */
function Pied({ perimetre }: { perimetre: string }): React.ReactElement {
  return (
    <View style={styles.pied} fixed>
      <Text style={styles.piedTexte}>{txt(perimetre)}</Text>
      <Text
        style={styles.piedTexte}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

/** Une ligne du sommaire. */
interface LigneSommaire {
  type: string;
  assets: number;
  segments: number;
  faits: number;
}

function sommaire(assets: readonly AssetPlan[]): LigneSommaire[] {
  const lignes: LigneSommaire[] = [];
  for (const t of TYPES_PLAN) {
    const duType = assets.filter((a) => a.type === t);
    if (duType.length === 0) continue;
    lignes.push({
      type: t,
      assets: duType.length,
      segments: duType.reduce((n, a) => n + a.segments.length, 0),
      faits: duType.reduce((n, a) => n + avancement(a).faits, 0),
    });
  }
  return lignes;
}

/** Un segment de brief, avec sa case et son prompt encadré. */
function Segment({ segment }: { segment: AssetPlan["segments"][number] }): React.ReactElement {
  const role = LIBELLE_ROLE[segment.role] ?? segment.role;
  const contenu = txt(segment.contenu);
  const prompt = txt(segment.prompt);

  return (
    <View style={styles.segment} wrap={false}>
      <View style={[styles.caseACocher, ...(segment.fait ? [styles.caseFaite] : [])]} />
      <View style={styles.segmentCorps}>
        <Text style={styles.segmentRole}>
          {role}
          {segment.titre ? ` — ${txt(segment.titre)}` : ""}
        </Text>
        {contenu ? <Text style={styles.segmentTexte}>{contenu}</Text> : null}
        {prompt ? (
          <View>
            <Text style={styles.promptLabel}>
              {segment.role === "slide" ? "Graphisme" : "Prompt — à coller tel quel"}
            </Text>
            <View style={styles.promptBloc}>
              <Text style={styles.promptTexte}>{prompt}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Le bloc d'un asset : son échéance, son avancement, ses segments. */
function BlocAsset({ asset }: { asset: AssetPlan }): React.ReactElement {
  const av = avancement(asset);
  return (
    <View style={styles.asset}>
      {/* `minPresenceAhead` empêche le titre de rester seul en bas de page,
          son premier segment reparti sur la feuille suivante. */}
      <View style={styles.assetEnTete} minPresenceAhead={60}>
        <Text style={styles.assetTitre}>{txt(asset.libelle)}</Text>
        <Text style={styles.assetEcheance}>
          {dateFr(asset.datePost)}
          {asset.heurePost ? ` ${txt(asset.heurePost)}` : ""}
        </Text>
      </View>
      <Text style={styles.assetMeta}>
        Statut : {txt(asset.statut)} · Avancement : {av.faits} / {av.total}
        {asset.titrePost ? ` · Post : ${txt(asset.titrePost)}` : ""}
      </Text>

      {asset.segments.length === 0 ? (
        <Text style={styles.assetVide}>Aucun brief importé pour cet asset.</Text>
      ) : (
        asset.segments.map((s) => <Segment key={`${asset.id}-${s.ordre}`} segment={s} />)
      )}
    </View>
  );
}

/**
 * Le document complet.
 *
 * 🔑 Une `<Page>` par TYPE, et non un flux unique : c'est ce découpage qui
 * répond à « imprimer ce que je veux ». Les carrousels commencent toujours
 * sur une feuille neuve, donc leur plage de pages s'imprime seule.
 */
export function PlanProductionPdf({
  assets,
  contexte,
}: {
  assets: readonly AssetPlan[];
  contexte: ContextePlan;
}): React.ReactElement {
  const tries = trierPourProduction(assets);
  const lignes = sommaire(tries);
  const perimetre = `${contexte.titre} · ${contexte.periode}`;

  // L'avertissement de la couverture cumule ce que l'appelant a passé (la
  // troncature) et ce que l'impression elle-même retire (les emoji). Les deux
  // rendent le document partiel : les taire tous les deux le rendrait faux.
  const perdus = compterNonImprimables(tries);
  const avertissements = [
    contexte.avertissement ?? null,
    perdus > 0
      ? `${perdus} caractère(s) décoratif(s) — emoji, flèches — ont été retirés du ` +
        "texte imprimé : aucune police du document ne les porte, et ils sortiraient " +
        "en caractères faux. Les exports Markdown et CSV les conservent intacts."
      : null,
  ].filter((a): a is string => Boolean(a));

  // Les types réellement présents, dans l'ordre de fabrication. Un type absent
  // ne produit pas de page blanche.
  const typesPresents = TYPES_PLAN.filter((t) => tries.some((a) => a.type === t));
  const inclassables = tries.filter((a) => !TYPES_PLAN.includes(a.type as never));

  return (
    <Document
      title={contexte.titre}
      author="Axion-IA"
      subject={`Plan de production — ${contexte.periode}`}
    >
      {/* ── Couverture : de quoi décider quoi produire avant de tourner les
          pages ──────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.regleTitre}>
          <Text style={styles.eyebrow}>Console éditoriale</Text>
          <Text style={styles.titre}>{txt(contexte.titre)}</Text>
          <Text style={styles.sousTitre}>
            {txt(contexte.periode)} · {tries.length} asset(s) à produire
          </Text>
        </View>

        {avertissements.length > 0 ? (
          <View style={styles.alerte}>
            <Text style={styles.alerteTitre}>Attention</Text>
            {avertissements.map((a, i) => (
              <Text key={i} style={styles.alerteTexte}>
                {txt(a)}
              </Text>
            ))}
          </View>
        ) : null}

        {lignes.length === 0 ? (
          <Text style={styles.assetVide}>Rien à produire sur ce périmètre.</Text>
        ) : (
          <View style={styles.tableau}>
            <View style={styles.ligneEntete}>
              <Text style={[styles.colType, styles.celluleForte]}>Type</Text>
              <Text style={[styles.colNombre, styles.celluleForte]}>Assets</Text>
              <Text style={[styles.colNombre, styles.celluleForte]}>Segments</Text>
              <Text style={[styles.colNombre, styles.celluleForte]}>Faits</Text>
            </View>
            {lignes.map((l, i) => (
              <View
                key={l.type}
                style={i === lignes.length - 1 ? styles.ligneDerniere : styles.ligne}
              >
                <Text style={styles.colType}>{LIBELLE_TYPE[l.type] ?? l.type}</Text>
                <Text style={styles.colNombre}>{l.assets}</Text>
                <Text style={styles.colNombre}>{l.segments}</Text>
                <Text style={styles.colNombre}>{l.faits}</Text>
              </View>
            ))}
          </View>
        )}

        <Pied perimetre={perimetre} />
      </Page>

      {/* ── Une page neuve par type ────────────────────────────────────── */}
      {typesPresents.map((t) => (
        <Page key={t} size="A4" style={styles.page}>
          <Text style={styles.titreSection}>{LIBELLE_TYPE[t] ?? t}</Text>
          {tries
            .filter((a) => a.type === t)
            .map((a) => (
              <BlocAsset key={a.id} asset={a} />
            ))}
          <Pied perimetre={perimetre} />
        </Page>
      ))}

      {/* Un type inconnu du référentiel ne DISPARAÎT pas du plan : il sort
          sous son nom brut. Le faire taire ferait passer un asset à produire
          pour un asset inexistant. */}
      {inclassables.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.titreSection}>Autres types</Text>
          {inclassables.map((a) => (
            <BlocAsset key={a.id} asset={a} />
          ))}
          <Pied perimetre={perimetre} />
        </Page>
      ) : null}
    </Document>
  );
}

/**
 * Rend le plan en PDF binaire.
 *
 * Volontairement local plutôt que `renderPdfToBuffer` de
 * `@/server/qualiopi/documents/render` : celui-ci importe `r2-storage`, donc
 * le client S3, pour une route qui n'archive rien. Ce qu'il apporte en plus —
 * hash SHA-256, upload R2 — sert la traçabilité d'une pièce légale, pas un
 * document de travail qu'on réimprime quand on veut.
 *
 * `toBuffer()` rend un stream Node : `Blob.arrayBuffer()` est absent de jsdom,
 * et les tests Vitest tourneraient à vide.
 */
export async function rendrePlanEnPdf(
  assets: readonly AssetPlan[],
  contexte: ContextePlan,
): Promise<Buffer> {
  const stream = await pdf(<PlanProductionPdf assets={assets} contexte={contexte} />).toBuffer();

  return new Promise<Buffer>((resolve, reject) => {
    const morceaux: Buffer[] = [];
    stream.on("data", (m: Buffer | Uint8Array) =>
      morceaux.push(Buffer.isBuffer(m) ? m : Buffer.from(m)),
    );
    stream.on("end", () => resolve(Buffer.concat(morceaux)));
    stream.on("error", reject);
  });
}
