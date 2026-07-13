"use client";
// use-client: lecture d'un CSV côté client (file.text()), parsing en lignes de factures, puis importerFacturesHistoriqueAction — état local du rapport d'import.

/**
 * ImportFacturesHistoriqueForm — Reprise d'historique : import de factures
 * émises HORS système (avant Axion-IA) pour que dashboards et balance âgée
 * soient exhaustifs dès le jour 1.
 *
 * CSV attendu (1re ligne = en-têtes ; séparateur `,` ou `;` auto-détecté) :
 *   numero, date_emission (AAAA-MM-JJ), client_nom, montant_ht (€),
 *   montant_ttc (€, optionnel), statut (emise|payee), activite (optionnel)
 *
 * Les montants € sont convertis en centimes côté client. Les numéros AXI-FACT/
 * AXI-AVO sont refusés par le serveur (séquence légale) ; les doublons sont
 * ignorés (import idempotent). Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importerFacturesHistoriqueAction } from "@/server/actions/qualiopi/facturation-hub";

interface FactureImport {
  numero: string;
  dateEmission: string;
  clientNom: string;
  montantHtCents: number;
  montantTtcCents?: number;
  statut: "emise" | "payee";
  activite?: "formation" | "un_a_un" | "audit" | "implementation" | "site_web";
}

const ACTIVITES = ["formation", "un_a_un", "audit", "implementation", "site_web"] as const;

/**
 * Convertit un montant en centimes entiers. Gère les formats FR ET EN :
 * « 1 234,56 » / « 1.234,56 » (FR), « 1234.56 » / « 1,234.56 » (EN),
 * « 1.500 » / « 1,500 » (milliers sans décimale → 1500).
 *
 * Règle robuste (monétaire) : on regarde le DERNIER séparateur. S'il est suivi
 * d'exactement 1 ou 2 chiffres → c'est la décimale (les autres séparateurs sont
 * des milliers, retirés). S'il est suivi de 3 chiffres (ou 0) → c'est un
 * séparateur de milliers (un montant n'a jamais 3 décimales) → tous retirés,
 * entier. Lève l'ambiguïté « 1.500 » qui vaut 1500 €, pas 1,50 €.
 */
function euroToCents(raw: string): number | null {
  const s = raw.replace(/[^0-9,.-]/g, "");
  if (s === "" || s === "-") return null;
  const lastSep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  let normalized: string;
  if (lastSep === -1) {
    normalized = s;
  } else {
    const decimals = s.length - lastSep - 1;
    if (decimals === 1 || decimals === 2) {
      // Séparateur décimal : on retire les groupements dans la partie entière.
      const intPart = s.slice(0, lastSep).replace(/[.,]/g, "");
      const decPart = s.slice(lastSep + 1);
      normalized = `${intPart}.${decPart}`;
    } else {
      // Séparateur(s) de milliers uniquement → entier en euros.
      normalized = s.replace(/[.,]/g, "");
    }
  }
  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Découpe une ligne CSV en champs (séparateur donné), gère les guillemets doubles. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // retire les diacritiques (NFD)
    .replace(/[^a-z0-9]/g, "");
}

/** Parse le CSV en factures + collecte les erreurs de ligne (1-indexées). */
function parseCsv(text: string): { factures: FactureImport[]; erreurs: string[] } {
  const erreurs: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (lines.length < 2) {
    return {
      factures: [],
      erreurs: ["Le fichier ne contient pas de données (en-tête + 1 ligne)."],
    };
  }

  const headerLine = lines[0] ?? "";
  const delimiter =
    (headerLine.match(/;/g)?.length ?? 0) >= (headerLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = splitCsvLine(headerLine, delimiter).map(normalizeHeader);
  const col = (names: string[]): number => headers.findIndex((h) => names.includes(h));

  const iNumero = col(["numero", "num", "facture"]);
  const iDate = col(["dateemission", "date", "dateemise", "emisele"]);
  const iClient = col(["clientnom", "client", "raisonsociale", "nom"]);
  const iHt = col(["montantht", "ht", "montanthteur"]);
  const iTtc = col(["montantttc", "ttc", "montantttceur"]);
  const iStatut = col(["statut", "status", "etat"]);
  const iActivite = col(["activite", "activity"]);

  const missing: string[] = [];
  if (iNumero < 0) missing.push("numero");
  if (iDate < 0) missing.push("date_emission");
  if (iClient < 0) missing.push("client_nom");
  if (iHt < 0) missing.push("montant_ht");
  if (iStatut < 0) missing.push("statut");
  if (missing.length > 0) {
    return { factures: [], erreurs: [`Colonnes manquantes : ${missing.join(", ")}.`] };
  }

  const factures: FactureImport[] = [];
  for (let r = 1; r < lines.length; r++) {
    const rowLine = lines[r];
    if (rowLine === undefined) continue;
    const cells = splitCsvLine(rowLine, delimiter);
    const numero = (cells[iNumero] ?? "").trim();
    const dateEmission = (cells[iDate] ?? "").trim();
    const clientNom = (cells[iClient] ?? "").trim();
    const htCents = euroToCents(cells[iHt] ?? "");
    const statutRaw = (cells[iStatut] ?? "").trim().toLowerCase();

    if (numero === "" || clientNom === "" || dateEmission === "" || htCents === null) {
      erreurs.push(`Ligne ${r + 1} : champ obligatoire manquant ou montant HT invalide.`);
      continue;
    }
    // Bornes du schéma serveur revalidées ici pour NE PAS faire échouer tout le
    // lot sur une seule ligne (le serveur rejette sinon l'import entier).
    if (numero.length < 3 || numero.length > 40) {
      erreurs.push(`Ligne ${r + 1} : numéro « ${numero} » invalide (3 à 40 caractères).`);
      continue;
    }
    if (clientNom.length > 250) {
      erreurs.push(`Ligne ${r + 1} : nom client trop long (250 caractères max).`);
      continue;
    }
    if (statutRaw !== "emise" && statutRaw !== "payee") {
      erreurs.push(`Ligne ${r + 1} : statut « ${statutRaw} » invalide (emise|payee).`);
      continue;
    }

    const facture: FactureImport = {
      numero,
      dateEmission,
      clientNom,
      montantHtCents: htCents,
      statut: statutRaw,
    };
    if (iTtc >= 0) {
      const ttc = euroToCents(cells[iTtc] ?? "");
      if (ttc !== null) facture.montantTtcCents = ttc;
    }
    if (iActivite >= 0) {
      const act = (cells[iActivite] ?? "").trim().toLowerCase();
      if ((ACTIVITES as readonly string[]).includes(act)) {
        facture.activite = act as (typeof ACTIVITES)[number];
      }
    }
    factures.push(facture);
  }

  return { factures, erreurs };
}

export function ImportFacturesHistoriqueForm(): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [rapport, setRapport] = useState<{ importees: number; ignorees: number } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setError(null);
    setParseErrors([]);
    setRapport(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setParseErrors([]);
    setRapport(null);
    if (!file) {
      setError("Sélectionnez un fichier CSV.");
      return;
    }
    startTransition(async () => {
      let content: string;
      try {
        content = await file.text();
      } catch {
        setError("Impossible de lire le fichier.");
        return;
      }
      const { factures, erreurs } = parseCsv(content);
      setParseErrors(erreurs);
      if (factures.length === 0) {
        setError("Aucune facture valide à importer.");
        return;
      }
      // Le serveur plafonne à 500 lignes par import : on l'annonce ici plutôt
      // qu'un rejet global après aller-retour.
      if (factures.length > 500) {
        setError(
          `${factures.length} lignes valides — l'import est limité à 500 lignes. Scindez le fichier.`,
        );
        return;
      }
      const res = await importerFacturesHistoriqueAction({ factures });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setRapport(res.data);
      router.refresh();
    });
  }

  const fileCls =
    "mt-1 block w-full text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] file:mr-4 file:rounded file:border-0 file:bg-[color:var(--color-admin-surface)] file:px-[var(--space-admin-3)] file:py-[var(--space-admin-2)] file:text-[length:var(--text-admin-sm)] file:font-medium file:text-[color:var(--color-admin-fg)]";

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <form onSubmit={handleSubmit} className="space-y-[var(--space-admin-4)]">
        <div>
          <label
            htmlFor="import-factures-file"
            className="block text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]"
          >
            Fichier CSV de factures historiques
          </label>
          <input
            id="import-factures-file"
            type="file"
            accept=".csv,.txt"
            onChange={handleFileChange}
            disabled={isPending}
            className={fileCls}
          />
          <p className="mt-1 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Colonnes :{" "}
            <span className="font-mono">
              numero, date_emission (AAAA-MM-JJ), client_nom, montant_ht, montant_ttc, statut
              (emise|payee), activite
            </span>
            . Montants en euros. Séparateur <span className="font-mono">,</span> ou{" "}
            <span className="font-mono">;</span>. Max 500 lignes. Les numéros AXI-FACT/AXI-AVO sont
            refusés ; les doublons ignorés.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
          >
            {error}
          </p>
        )}

        <button type="submit" disabled={isPending || !file} className="admin-button">
          {isPending ? "Import en cours…" : "Importer les factures"}
        </button>
      </form>

      {parseErrors.length > 0 && (
        <div className="mt-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]">
          <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-warning)] uppercase">
            Lignes ignorées ({parseErrors.length})
          </p>
          <ul className="space-y-1">
            {parseErrors.slice(0, 20).map((er, i) => (
              <li
                key={i}
                className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
              >
                {er}
              </li>
            ))}
            {parseErrors.length > 20 && (
              <li className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                … et {parseErrors.length - 20} autre(s).
              </li>
            )}
          </ul>
        </div>
      )}

      {rapport && (
        <div className="mt-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]">
          <p className="text-[length:var(--text-admin-sm)]">
            <span className="font-semibold text-[color:var(--color-admin-success)]">
              {rapport.importees}
            </span>{" "}
            importée(s) ·{" "}
            <span className="text-[color:var(--color-admin-fg-muted)]">
              {rapport.ignorees} ignorée(s) (doublons)
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
