"use client";
// use-client: clipboard API + state pour feedback "copié".
//
// KB-10 — Bouton "Citer cette page" (BibTeX + APA + permalink).

import { useState } from "react";

interface Props {
  readonly title: string;
  readonly authorName: string;
  readonly publishedAt: Date | null;
  readonly url: string;
}

function buildBibTeX({ title, authorName, publishedAt, url }: Props): string {
  const year = publishedAt ? publishedAt.getFullYear() : new Date().getFullYear();
  const key = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return `@misc{${key}-${year},
  title = {${title}},
  author = {${authorName}},
  year = {${year}},
  url = {${url}}
}`;
}

function buildAPA({ title, authorName, publishedAt, url }: Props): string {
  const date = publishedAt ? publishedAt.toISOString().slice(0, 10) : "n.d.";
  return `${authorName} (${date}). ${title}. Axion-IA. ${url}`;
}

export function ShareCitationButton(props: Props) {
  const [copied, setCopied] = useState<"bibtex" | "apa" | "url" | null>(null);

  async function handleCopy(type: "bibtex" | "apa" | "url", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // noop
    }
  }

  return (
    <details className="border-border my-6 rounded border p-4">
      <summary className="text-fg cursor-pointer text-sm font-semibold">
        Citer cette page
      </summary>
      <div className="mt-3 space-y-3">
        <div>
          <button
            type="button"
            onClick={() => handleCopy("url", props.url)}
            className="admin-button-ghost text-xs"
          >
            {copied === "url" ? "✓ Copié" : "Copier le lien permanent"}
          </button>
          <code className="text-fg-soft mt-1 block text-xs">{props.url}</code>
        </div>
        <div>
          <button
            type="button"
            onClick={() => handleCopy("apa", buildAPA(props))}
            className="admin-button-ghost text-xs"
          >
            {copied === "apa" ? "✓ Copié" : "Copier APA"}
          </button>
          <pre className="text-fg-soft mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-xs">
            {buildAPA(props)}
          </pre>
        </div>
        <div>
          <button
            type="button"
            onClick={() => handleCopy("bibtex", buildBibTeX(props))}
            className="admin-button-ghost text-xs"
          >
            {copied === "bibtex" ? "✓ Copié" : "Copier BibTeX"}
          </button>
          <pre className="text-fg-soft mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-xs">
            {buildBibTeX(props)}
          </pre>
        </div>
      </div>
    </details>
  );
}
