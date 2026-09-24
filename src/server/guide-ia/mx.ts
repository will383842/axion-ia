/**
 * Le domaine de cette adresse reçoit-il des e-mails ? (lot L2, 2026-09-24)
 *
 * Le guide part tout de suite, à une adresse que personne n'a vérifiée. Une
 * faute de frappe dans le DOMAINE (`gmial.com`, `societe.frr`) produirait un
 * rebond dur sur le compte d'envoi qui porte aussi les factures. On le refuse
 * donc avant d'écrire quoi que ce soit, et on le dit à la personne, qui peut
 * corriger.
 *
 * Trois réponses, et une seule ferme la porte :
 *   · « non »      — le domaine n'existe pas, ou déclare explicitement qu'il ne
 *                    reçoit rien (MX nul, RFC 7505) ;
 *   · « oui »      — un MX existe, ou à défaut une adresse A/AAAA (RFC 5321
 *                    §5.1 : un domaine sans MX reçoit sur son adresse) ;
 *   · « inconnu »  — le DNS ne répond pas (délai, panne). ⚠️ On laisse PASSER :
 *                    une panne de résolveur ne doit pas couper le formulaire.
 *                    Le coupe-circuit des rebonds reste la seconde ceinture.
 */

import { promises as dns } from "node:dns";

export type VerdictMx = "oui" | "non" | "inconnu";

const DELAI_MS = 3_000;

/** Codes qui prouvent l'ABSENCE (et non une panne). */
const CODES_ABSENCE = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

/**
 * Échéance GLOBALE : la vérification entière (MX, puis A, puis AAAA) tient en
 * `DELAI_MS`, pas `DELAI_MS` par résolution — trois délais enchaînés faisaient
 * attendre la personne jusqu'à 9 s. Le minuteur est ANNULÉ dès que la
 * résolution répond : il ne traîne plus 3 s après chaque requête.
 */
function avecDelai<T>(p: Promise<T>, echeance: number): Promise<T> {
  const reste = Math.max(0, echeance - Date.now());
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<T>((_, reject) => {
    minuteur = setTimeout(
      () => reject(Object.assign(new Error("délai DNS"), { code: "ETIMEOUT" })),
      reste,
    );
  });
  return Promise.race([p, delai]).finally(() => clearTimeout(minuteur));
}

function codeDe(e: unknown): string {
  return typeof e === "object" && e !== null && "code" in e
    ? String((e as { code: unknown }).code)
    : "";
}

async function aUneAdresse(domaine: string, echeance: number): Promise<VerdictMx> {
  const resolveurs: ReadonlyArray<(d: string) => Promise<string[]>> = [
    (d) => dns.resolve4(d),
    (d) => dns.resolve6(d),
  ];
  for (const resoudre of resolveurs) {
    try {
      const r = await avecDelai(resoudre(domaine), echeance);
      if (r.length > 0) return "oui";
    } catch (e) {
      if (!CODES_ABSENCE.has(codeDe(e))) return "inconnu";
    }
  }
  return "non";
}

export async function domaineRecoitDesEmails(email: string): Promise<VerdictMx> {
  const domaine = email.trim().toLowerCase().split("@")[1] ?? "";
  if (domaine === "" || !domaine.includes(".")) return "non";
  const echeance = Date.now() + DELAI_MS;
  try {
    const mx = await avecDelai(dns.resolveMx(domaine), echeance);
    if (mx.length === 0) return aUneAdresse(domaine, echeance);
    // RFC 7505 : un seul MX d'échange « . » = « ce domaine ne reçoit rien ».
    if (mx.every((m) => m.exchange === "" || m.exchange === ".")) return "non";
    return "oui";
  } catch (e) {
    const code = codeDe(e);
    if (code === "ENODATA") return aUneAdresse(domaine, echeance);
    if (CODES_ABSENCE.has(code)) return "non";
    return "inconnu";
  }
}
