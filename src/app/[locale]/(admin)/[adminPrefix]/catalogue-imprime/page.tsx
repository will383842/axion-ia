// Admin — relecture du catalogue imprimé AVANT tirage KDP.
//
// POURQUOI CETTE PAGE (2026-08-16, demande Will)
//
// Le catalogue papier est distribué en main propre : un prix faux ne se corrige
// pas. Depuis le branchement SSOT (`scripts/export-catalogue-kdp.ts`), les FAITS
// du livre — prix, durée, titre, format, accroche — viennent d'ici, du site.
// Cette page les affiche exactement comme ils partiront à l'impression, pour
// qu'on puisse les relire sans ouvrir un PDF de 20 Mo.
//
// CE QU'ELLE NE MONTRE PAS, ET POURQUOI
//
// Pas l'état des 4 PDF KDP. Ils vivent hors dépôt, sur le poste de fabrication
// (`Catalogue_formations_Axion_IA/catalogue-kdp`) ; la console tourne dans un
// conteneur en production et n'y a aucun accès. Afficher une fraîcheur qu'on ne
// peut pas mesurer serait pire que de ne rien afficher — on croirait le
// catalogue à jour. Décision Will 2026-08-16 : relire le contenu, pas les
// fichiers.
//
// L'ÉCRITURE DU LIVRE N'EST PAS ICI NON PLUS. Objectifs, lignes avant/après,
// rubrique et effectif sont figés côté générateur (`objectifs-livre.cjs`,
// `prose-livre.cjs`) parce qu'ils sont écrits pour le papier — les objectifs du
// site font 225 caractères contre 58 pour ceux du livre, les verser tels quels
// ferait déborder les cadres. Cette page dit donc ce que le SITE pilote.
import { stat } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageHeader } from "@/components/admin/ui";
import { FORMATIONS_V2, type FormationV2 } from "@/content/formations/catalog-v2";
import {
  formatDureeFr,
  getFormationModalites,
  formatModalitesFr,
} from "@/content/formations/catalog-v2-facts";
import { formatFormationPrice } from "@/content/pricing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Catalogue imprimé · Axion-IA" };

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

/**
 * ⚠️ La matrice tarifaire est indexée par `categorie`, PAS par `gamme` — les
 * deux champs existent sur FormationV2 et se confondent. Passer `gamme` rend
 * « Sur devis » partout : un catalogue sans un seul prix. Même piège que dans
 * `scripts/export-catalogue-kdp.ts`, où l'erreur a réellement été commise.
 */
function prixImprime(f: FormationV2): string {
  if (f.surDevis || !f.categorie) return "Sur devis";
  return formatFormationPrice(f.categorie, f.duree, "fr");
}

// ── LE CATALOGUE A4 48 PAGES ────────────────────────────────────────────────
//
// Contrairement aux 4 PDF du livre KDP, les livrables A4 sont DANS le dépôt,
// sous `public/` — donc dans l'image Docker, donc mesurables ici. On lit leur
// taille sur le disque du conteneur : c'est exactement l'octet servi au
// visiteur, pas une supposition.
//
// On n'affiche PAS de date de fichier. Dans une image Docker, les dates de
// modification sont celles de la copie, pas celles de la fabrication : elles
// diraient toutes la même chose et donneraient une fausse fraîcheur. C'est la
// même règle que pour les PDF KDP plus haut — ne pas afficher ce qu'on ne
// mesure pas.
//
// LE FICHIER IMPRIMEUR N'EST PAS ICI, ET NE DOIT PAS L'ÊTRE. Le CMJN fait
// 25 Mo, porte le fond perdu et les repères : le publier sous `public/` le
// rendrait téléchargeable par n'importe qui. Il vit sur le poste de
// fabrication. On le dit, plutôt que de laisser chercher.
interface Livrable {
  fichier: string; // chemin sous public/, tel qu'il est servi
  nom: string;
  usage: string;
}

const LIVRABLES_A4: Livrable[] = [
  {
    fichier: "catalogue/index.html",
    nom: "Le feuilletoir",
    usage:
      "Le catalogue qui se tourne page par page, en doubles. C’est le lien à partager : il porte un aperçu Open Graph, donc il s’affiche avec une image dans WhatsApp ou LinkedIn.",
  },
  {
    fichier: "catalogue-formations-ia-axion-ia.pdf",
    nom: "Le PDF, pages à l’unité",
    usage:
      "48 pages, à envoyer par mail ou à imprimer chez soi. S’ouvre en doubles pages dans un lecteur qui respecte la mise en page.",
  },
  {
    fichier: "catalogue/catalogue-axion-ia.pdf",
    nom: "Le PDF en doubles pages",
    usage: "25 planches de 420 × 297 mm, sans fond perdu ni repère : la lecture à l’écran.",
  },
  {
    fichier: "catalogue/og-catalogue.jpg",
    nom: "L’image de partage",
    usage:
      "1200 × 630. C’est la vignette que WhatsApp, LinkedIn ou Slack affichent quand on partage le lien du feuilletoir.",
  },
];

function poidsLisible(octets: number): string {
  return octets >= 1_048_576
    ? `${(octets / 1_048_576).toFixed(1)} Mo`
    : `${Math.round(octets / 1024)} Ko`;
}

async function mesurerLivrables() {
  return Promise.all(
    LIVRABLES_A4.map(async (l) => {
      try {
        const s = await stat(path.join(process.cwd(), "public", l.fichier));
        return { ...l, poids: poidsLisible(s.size), present: true };
      } catch {
        // Un livrable absent de l'image est un vrai signal : le lien public
        // renverra 404. Mieux vaut le voir ici que par un visiteur.
        return { ...l, poids: "—", present: false };
      }
    }),
  );
}

export default async function CatalogueImprimePage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const offres = FORMATIONS_V2.map((f) => ({
    slug: f.slugFr,
    titre: f.titreFr,
    duree: formatDureeFr(f),
    format: formatModalitesFr(getFormationModalites(f)),
    prix: prixImprime(f),
    accroche: f.accrocheFr,
    surDevis: f.surDevis || !f.categorie,
    manque: [
      !f.titreFr && "titre",
      !f.accrocheFr && "accroche",
      !f.programme?.length && "programme",
    ].filter(Boolean) as string[],
  }));

  const incomplets = offres.filter((o) => o.manque.length > 0);
  const surDevis = offres.filter((o) => o.surDevis);
  const livrables = await mesurerLivrables();
  const manquants = livrables.filter((l) => !l.present);

  return (
    <div>
      <AdminPageHeader
        title="Catalogues imprimés"
        description="Deux éditions. Le catalogue A4 48 pages, en ligne et partageable — ses fichiers sont accessibles ci-dessous. Et le livre KDP, dont cette page relit les prix avant tirage : distribué en main propre, un prix faux ne se corrige pas."
      />

      {/* ── Catalogue A4 : les fichiers, accessibles d'ici ──────────────── */}
      <section className="admin-card" style={{ marginBottom: "var(--space-admin-4)" }}>
        <h2 className="admin-section-title">Catalogue A4 · 48 pages — en ligne</h2>

        {manquants.length > 0 ? (
          <p
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-admin-2)",
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={18} aria-hidden="true" />
            {manquants.length} fichier(s) absent(s) de l’image :{" "}
            {manquants.map((m) => m.nom).join(", ")} — le lien public renverra 404.
          </p>
        ) : null}

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fichier</th>
                <th>À quoi il sert</th>
                <th style={{ textAlign: "right" }}>Poids</th>
              </tr>
            </thead>
            <tbody>
              {livrables.map((l) => (
                <tr key={l.fichier}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {l.present ? (
                      <a
                        href={`/${l.fichier}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {l.nom}
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    ) : (
                      <span style={{ fontWeight: 600, opacity: 0.6 }}>{l.nom} — absent</span>
                    )}
                    <div style={{ fontSize: "0.8em", opacity: 0.6 }}>/{l.fichier}</div>
                  </td>
                  <td style={{ fontSize: "0.9em" }}>{l.usage}</td>
                  <td
                    style={{
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {l.poids}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: "var(--space-admin-3)", marginBottom: 0 }}>
          <b>Le fichier pour l’imprimeur n’est pas ici, et ne doit pas y être.</b> Le CMJN fait 25
          Mo, porte le fond perdu et les repères de coupe : le mettre en ligne le rendrait
          téléchargeable par n’importe qui. Il vit sur le poste de fabrication, dans{" "}
          <code className="admin-code-inline">
            Catalogue_formations_Axion_IA/catalogue-axion-ia-v2/export/
          </code>
          . Le même dossier contient un PDF de <i>relecture</i> avec les traits de coupe —{" "}
          <b>celui-là ne part jamais à l’imprimeur non plus</b>.
        </p>

        <p style={{ marginTop: "var(--space-admin-3)", marginBottom: 0, opacity: 0.75 }}>
          Les poids sont lus sur le disque du conteneur : c’est l’octet réellement servi. Aucune
          date n’est affichée — dans une image Docker, les dates de fichier sont celles de la copie,
          pas de la fabrication, et donneraient une fausse fraîcheur. Les 22 QR imprimés se
          repointent dans <b>QR codes › Catalogue</b>, sans réimprimer.
        </p>
      </section>

      <h2 className="admin-section-title" style={{ marginBottom: "var(--space-admin-3)" }}>
        Livre KDP — relecture des prix avant tirage
      </h2>

      <section className="admin-card" style={{ marginBottom: "var(--space-admin-4)" }}>
        <h2 className="admin-section-title">Avant de commander un tirage</h2>
        <ol style={{ margin: 0, paddingLeft: "1.2em", lineHeight: 1.7 }}>
          <li>Relire les {offres.length} offres ci-dessous — surtout les prix.</li>
          <li>
            Régénérer les données :{" "}
            <code className="admin-code-inline">pnpm tsx scripts/export-catalogue-kdp.ts</code>
          </li>
          <li>
            Reconstruire et exporter les 4 PDF (cf.{" "}
            <code className="admin-code-inline">catalogue-kdp/README.md</code>).
          </li>
        </ol>
        <p style={{ marginBottom: 0, marginTop: "var(--space-admin-3)" }}>
          L’état des PDF n’est pas affichable ici : ils vivent sur le poste de fabrication, hors
          dépôt. La console n’y a pas accès et ne peut pas mesurer leur fraîcheur.
        </p>
      </section>

      {incomplets.length > 0 ? (
        <section className="admin-card" style={{ marginBottom: "var(--space-admin-4)" }}>
          <h2
            className="admin-section-title"
            style={{ display: "flex", alignItems: "center", gap: "var(--space-admin-2)" }}
          >
            <AlertTriangle size={20} aria-hidden="true" />
            {incomplets.length} offre(s) incomplète(s)
          </h2>
          <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
            {incomplets.map((o) => (
              <li key={o.slug}>
                <b>{o.slug}</b> — manque : {o.manque.join(", ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Offre</th>
              <th>Durée</th>
              <th>Format</th>
              <th style={{ textAlign: "right" }}>Prix imprimé</th>
            </tr>
          </thead>
          <tbody>
            {offres.map((o) => (
              <tr key={o.slug}>
                <td>
                  <div style={{ fontWeight: 600 }}>{o.titre}</div>
                  <div style={{ fontSize: "0.85em", opacity: 0.7 }}>{o.accroche}</div>
                </td>
                <td>{o.duree}</td>
                <td style={{ fontSize: "0.9em" }}>{o.format}</td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {o.prix}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: "var(--space-admin-4)", opacity: 0.75 }}>
        {offres.length} offres au catalogue du site, dont {surDevis.length} sur devis. Le livre en
        imprime 21 : la composition et l’ordre sont portés par{" "}
        <code className="admin-code-inline">catalogue-kdp/objectifs-livre.cjs</code>, parce qu’une
        double-page est produite par entrée et que les numéros du sommaire sont écrits en dur —
        ajouter une offre décalerait toute la pagination, et l’épaisseur du dos avec elle.
      </p>
    </div>
  );
}
