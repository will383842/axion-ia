// Email INTERNE — récapitulatif complet d'une candidature commerciale (tunnel
// sans CV, Mémorial de l'Isère 2026-08-12).
//
// Destinataire : l'équipe Axion-IA (pas le candidat). Objectif : TOUTES les
// réponses lisibles sur mobile, sans ouvrir la console. Les expériences
// arrivent en ordre anti-chronologique (triées par l'émetteur, re-triées ici
// par sécurité si `periodeSort` est fourni).
//
// Le template est volontairement GÉNÉRIQUE (lignes label/valeur + blocs) : la
// mise en forme des réponses (mois en toutes lettres, oui/non, listes) vit
// dans l'action serveur, seule à connaître le modèle du formulaire.

import { Text } from "@react-email/components";
import { EmailLayout, emailStyles } from "./_layout";
import type { Locale } from "../../../../prisma/generated/client";

interface RecapRow {
  label?: string;
  value?: string;
}

interface RecapExperience {
  /** « Poste — Entreprise ». */
  titre?: string;
  /** « Ville / département ». */
  lieu?: string;
  /** « mars 2019 → aujourd'hui ». */
  periode?: string;
  /** Clé de tri anti-chronologique (« 2019-03 » du début), optionnelle. */
  periodeSort?: string;
  /** Types de clients (« entreprises, mixte »), optionnel. */
  clients?: string;
}

interface Payload {
  prenom?: string;
  nom?: string;
  ville?: string;
  rows?: RecapRow[];
  experiences?: RecapExperience[];
  pitch?: string;
  messageLibre?: string;
  submissionId?: string;
  /** Lien direct vers la fiche console. */
  consoleUrl?: string;
}

export const candidatureCommercialRecapSubject = (
  _locale: Locale,
  p: Record<string, unknown>,
): string => {
  const prenom = typeof p.prenom === "string" ? p.prenom.trim() : "";
  const nom = typeof p.nom === "string" ? p.nom.trim() : "";
  const qui = `${prenom} ${nom}`.trim() || "Candidat";
  const ville = typeof p.ville === "string" && p.ville.trim() ? p.ville.trim() : "—";
  return `[CANDIDATURE COMMERCIAL] ${qui} — ${ville}`;
};

const blockTitleStyle = {
  ...emailStyles.paragraphStyle,
  fontWeight: 700 as const,
  margin: "18px 0 6px",
};

const rowStyle = {
  ...emailStyles.paragraphStyle,
  margin: "0 0 4px",
};

const quoteStyle = {
  ...emailStyles.paragraphStyle,
  margin: "0 0 8px",
  padding: "10px 12px",
  backgroundColor: "#f6f3ee",
  borderLeft: `3px solid ${emailStyles.COLORS.terracotta}`,
  whiteSpace: "pre-wrap" as const,
};

export function CandidatureCommercialRecapEmail({
  locale,
  payload,
}: {
  locale: Locale;
  payload: Record<string, unknown>;
}) {
  const p = payload as unknown as Payload;
  const rows = Array.isArray(p.rows) ? p.rows : [];
  // Tri anti-chronologique défensif : l'action trie déjà, mais un émetteur
  // futur qui l'oublierait ne doit pas inverser la lecture.
  const experiences = (Array.isArray(p.experiences) ? [...p.experiences] : []).sort((a, b) =>
    (b.periodeSort ?? "").localeCompare(a.periodeSort ?? ""),
  );
  const qui = `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || "Candidat";

  return (
    <EmailLayout
      preview={`Candidature commerciale — ${qui}`}
      title={`Candidature commerciale — ${qui}`}
      cta={p.consoleUrl ? { label: "Ouvrir la fiche en console", href: p.consoleUrl } : undefined}
      locale={locale}
    >
      <Text style={emailStyles.paragraphStyle}>
        Récapitulatif interne complet de la candidature (tunnel sans CV). Les expériences sont en
        ordre anti-chronologique.
      </Text>

      {rows.length > 0 ? (
        <>
          <Text style={blockTitleStyle}>Réponses</Text>
          {rows.map((r, i) => (
            <Text key={i} style={rowStyle}>
              <strong>{r.label ?? "—"}</strong> : {r.value ?? "—"}
            </Text>
          ))}
        </>
      ) : null}

      {experiences.length > 0 ? (
        <>
          <Text style={blockTitleStyle}>Parcours (10 dernières années)</Text>
          {experiences.map((e, i) => (
            <Text key={i} style={quoteStyle}>
              <strong>{e.titre ?? "—"}</strong>
              {"\n"}
              {[e.lieu, e.periode].filter(Boolean).join(" · ")}
              {e.clients ? `\nClients : ${e.clients}` : ""}
            </Text>
          ))}
        </>
      ) : null}

      {p.pitch ? (
        <>
          <Text style={blockTitleStyle}>Le candidat en quelques lignes</Text>
          <Text style={quoteStyle}>{p.pitch}</Text>
        </>
      ) : null}

      {p.messageLibre ? (
        <>
          <Text style={blockTitleStyle}>Message libre</Text>
          <Text style={quoteStyle}>{p.messageLibre}</Text>
        </>
      ) : null}

      {p.submissionId ? (
        <Text style={{ ...emailStyles.paragraphStyle, color: emailStyles.COLORS.textMuted }}>
          Référence : {p.submissionId}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
