// Le contrat rempli, rendu en HTML lisible à partir de son markdown léger (`##`, `###`,
// `**gras**`, `*italique*`, tableaux `|`, citations `>`). Même découpage que le PDF
// (`contrat-pdf.tsx`) : ce que l'apporteur lit est ce qu'il signe. Composant SERVEUR,
// sans `dangerouslySetInnerHTML` : le texte n'est jamais interprété comme du HTML.

import type { ReactNode } from "react";

function enLigne(texte: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let i = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texte))) {
    if (m.index > i) out.push(texte.slice(i, m.index));
    const brut = m[0];
    out.push(
      brut.startsWith("**") ? (
        <strong key={n++} className="font-semibold">
          {brut.slice(2, -2)}
        </strong>
      ) : (
        <em key={n++}>{brut.slice(1, -1)}</em>
      ),
    );
    i = m.index + brut.length;
  }
  if (i < texte.length) out.push(texte.slice(i));
  return out;
}

export function ContratLisible({ texte }: { texte: string }) {
  const blocs: ReactNode[] = [];
  let n = 0;
  for (const brut of texte.split(/\n{2,}/)) {
    const b = brut.trim();
    if (!b || b === "---") continue;
    if (b.startsWith("## ")) {
      blocs.push(
        <h3 key={n++} className="mt-6 mb-3 text-center font-serif text-[20px] font-medium first:mt-0">
          {b.slice(3).trim()}
        </h3>,
      );
    } else if (b.startsWith("### ")) {
      blocs.push(
        <h4 key={n++} className="text-terracotta-deep border-border mt-5 mb-2 border-b pb-1 text-[16px] font-bold">
          {b.slice(4).trim()}
        </h4>,
      );
    } else if (b.startsWith("|")) {
      const lignes = b.split("\n").filter((l) => l.startsWith("|") && !/^\|\s*-+/.test(l));
      const cellules = (l: string) =>
        l
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const [entete, ...corps] = lignes;
      blocs.push(
        <div key={n++} className="my-3 overflow-x-auto">
          <table className="border-border w-full border text-[14px]">
            {entete ? (
              <thead className="bg-terracotta-soft">
                <tr>
                  {cellules(entete).map((c, j) => (
                    <th key={j} scope="col" className="border-border border p-1.5 text-left font-semibold">
                      {enLigne(c)}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {corps.map((l, i) => (
                <tr key={i}>
                  {cellules(l).map((c, j) => (
                    <td key={j} className="border-border border p-1.5 align-top">
                      {enLigne(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (b.startsWith(">")) {
      blocs.push(
        <blockquote key={n++} className="bg-sand my-2 rounded-lg p-3">
          {enLigne(b.replace(/^>\s?/gm, "").replace(/\n/g, " "))}
        </blockquote>,
      );
    } else {
      blocs.push(
        <p key={n++} className="my-2">
          {enLigne(b.replace(/\n/g, " "))}
        </p>,
      );
    }
  }
  return <div className="text-fg text-[15px] leading-relaxed break-words">{blocs}</div>;
}
