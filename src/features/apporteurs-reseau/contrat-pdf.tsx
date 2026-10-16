/**
 * Le contrat d'apporteur en PDF : le texte v2 rempli au nom de l'apporteur, puis, une fois
 * signé, un CERTIFICAT DE SIGNATURE en dernière page (qui a signé, quand, avec quelles
 * cases, et l'empreinte du texte signé).
 *
 * Signature électronique simple (art. 1366-1367 du code civil, eIDAS « simple ») : le
 * texte est figé par son empreinte SHA-256 au moment où l'apporteur signe ; la Société
 * contresigne ensuite le MÊME texte, dont l'empreinte est recalculée et comparée.
 *
 * Polices standard du PDF (Helvetica) : le texte n'utilise que des caractères de leur
 * jeu (accents, «», —, €, œ). Rendu serveur exclusif.
 */

import "server-only";

import { createHash } from "node:crypto";

import React from "react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

import { CONTRAT_V2_MARKDOWN, CONTRAT_VERSION } from "./contrat-v2";
import { ACCEPTATIONS, DECLARATIONS, STATUTS_JURIDIQUES } from "./regles";

export interface ValeursContrat {
  identite: string;
  statutJuridique: string;
  siren: string;
  /** SIRET de l'établissement (plusieurs activités) ; absent des signatures d'avant le 08/10. */
  siret?: string;
  siege: string;
  qualite: string;
  grilleDate: string;
  /** Contrat 2.5 : dénomination d'un Apporteur société, « représentée par » `identite`. */
  denomination?: string;
}

export interface SignatureApporteur {
  nomTape: string;
  signeAt: string;
  ipHash: string | null;
  navigateur: string | null;
  acceptations: string[];
  declarations: string[];
}

export interface SignatureSociete {
  nom: string;
  signeAt: string;
}

/** Le libellé contractuel du statut (« micro-entrepreneur », « SAS »…). */
export function libelleStatut(valeur: string): string {
  return STATUTS_JURIDIQUES.find((s) => s.valeur === valeur)?.libelle ?? valeur;
}

/**
 * La qualité au sens de la clause attributive de juridiction (art. 14). Contrat 2.7 : un
 * entrepreneur individuel est commerçant ou non selon son immatriculation au RCS — le dossier ne le
 * dit pas, le texte renvoie donc au registre.
 */
export const QUALITE_ENTREPRENEUR_INDIVIDUEL =
  "entrepreneur individuel commerçant s'il est immatriculé au registre du commerce et des sociétés, entrepreneur individuel non commerçant dans le cas contraire";

export function qualiteDuStatut(valeur: string): string {
  return valeur === "micro_entrepreneur" || valeur === "entrepreneur_individuel"
    ? QUALITE_ENTREPRENEUR_INDIVIDUEL
    : "société commerciale";
}

/** Le texte rempli : c'est lui qui est signé, et dont on garde l'empreinte. */
export function texteDuContrat(v: ValeursContrat): string {
  const table: Record<string, string> = {
    APPORTEUR_IDENTITE: v.identite,
    // Contrat 2.5 : une société signe par la personne physique qui la représente (identite).
    APPORTEUR_PARTIE: v.denomination ?? v.identite,
    APPORTEUR_IMMATRICULE: v.denomination ? "immatriculée" : "immatriculé",
    APPORTEUR_REPRESENTANT: v.denomination ? `, représentée par ${v.identite}` : "",
    APPORTEUR_SIGNATAIRE: v.denomination
      ? `${v.denomination}, représentée par ${v.identite}`
      : v.identite,
    APPORTEUR_STATUT: libelleStatut(v.statutJuridique),
    APPORTEUR_SIREN: v.siren,
    // Contrat 2.4 : avec un SIRET, « SIRET de l'établissement …, dont l'établissement est situé … » ;
    // sans SIRET, « dont l'adresse est … ». Ni libellé d'activité ni code NAF : l'Apporteur reste
    // l'Apporteur (art. 1.4, contrat d'apport d'affaires).
    APPORTEUR_ETABLISSEMENT: v.siret
      ? `SIRET de l'établissement ${v.siret}, dont l'établissement est situé ${v.siege}`
      : `dont l'adresse est ${v.siege}`,
    APPORTEUR_SIEGE: v.siege,
    APPORTEUR_QUALITE: v.qualite,
    GRILLE_DATE: v.grilleDate,
  };
  return CONTRAT_V2_MARKDOWN.replace(/\{\{([A-Z_]+)\}\}/g, (m, k: string) => table[k] ?? m);
}

export function empreinte(texte: string): string {
  return createHash("sha256").update(texte, "utf8").digest("hex");
}

// ── Rendu ────────────────────────────────────────────────────────────────

const C = {
  texte: "#241d15",
  doux: "#6b6153",
  terracotta: "#c24a1b",
  fonce: "#8c3010",
  trait: "#eee2d2",
  fond: "#f7ebe2",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 50,
    fontFamily: "Helvetica",
    fontSize: 9.4,
    color: C.texte,
  },
  titre: { fontFamily: "Helvetica-Bold", fontSize: 16, textAlign: "center", marginBottom: 14 },
  h3: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
    color: C.fonce,
    marginTop: 12,
    marginBottom: 5,
    paddingBottom: 2,
    borderBottomWidth: 0.6,
    borderBottomColor: C.trait,
  },
  p: { marginBottom: 5 },
  quote: { marginBottom: 5, padding: 6, backgroundColor: "#f6f1e8", color: "#3a3025" },
  gras: { fontFamily: "Helvetica-Bold" },
  italique: { fontFamily: "Helvetica-Oblique" },
  tableau: { marginVertical: 5, borderWidth: 0.6, borderColor: C.trait },
  ligne: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: C.trait },
  entete: { backgroundColor: C.fond },
  cellule: { flex: 1, padding: 3, fontSize: 8.4 },
  pied: {
    position: "absolute",
    bottom: 26,
    left: 50,
    right: 50,
    fontSize: 7.5,
    color: C.doux,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  certif: { marginTop: 8, padding: 10, borderWidth: 0.8, borderColor: C.terracotta },
  certifTitre: { fontFamily: "Helvetica-Bold", fontSize: 13, color: C.fonce, marginBottom: 8 },
  petit: { fontSize: 8.2, color: C.doux },
});

const WIN_ANSI_EXTRA = new Set(
  [..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"].map((c) => c.codePointAt(0) as number),
);
const ESPACES_FINES = /[ -​  　]/g;

function enWinAnsi(c: string): boolean {
  const n = c.codePointAt(0) as number;
  return (
    n === 0x0a || (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || WIN_ANSI_EXTRA.has(n)
  );
}

/**
 * Mise en forme POUR LE PDF seulement (le texte signé et son empreinte ne bougent pas) :
 * les polices standard ne connaissent que WinAnsi ; un caractère hors alphabet (ł, ő…)
 * laisserait un trou. On le remplace par son équivalent ASCII le plus proche (normalisation
 * NFD sans diacritiques), sinon par « ? ».
 */
export function pourPdf(texte: string): string {
  const sansFines = texte.replace(ESPACES_FINES, " ").replace(/‑/g, "-");
  let out = "";
  for (const c of sansFines) {
    if (enWinAnsi(c)) {
      out += c;
      continue;
    }
    const base = c.normalize("NFD").replace(/[̀-ͯ]/g, "");
    const aMap = (
      { ł: "l", Ł: "L", đ: "d", Đ: "D", ø: "o", Ø: "O", ı: "i" } as Record<string, string>
    )[c];
    const rendu = aMap ?? base;
    out += [...rendu].every((x) => enWinAnsi(x)) && rendu.length > 0 ? rendu : "?";
  }
  return out;
}

/** `**gras**` et `*italique*` en ligne. */
function enLigne(texte: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let i = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(texte))) {
    if (m.index > i) out.push(texte.slice(i, m.index));
    const brut = m[0];
    out.push(
      brut.startsWith("**") ? (
        <Text key={n++} style={s.gras}>
          {brut.slice(2, -2)}
        </Text>
      ) : (
        <Text key={n++} style={s.italique}>
          {brut.slice(1, -1)}
        </Text>
      ),
    );
    i = m.index + brut.length;
  }
  if (i < texte.length) out.push(texte.slice(i));
  return out;
}

function blocs(markdown: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const paras = markdown.split(/\n{2,}/);
  let n = 0;
  for (const brut of paras) {
    const b = brut.trim();
    if (!b || b === "---") continue;
    if (b.startsWith("## ")) {
      out.push(
        <Text key={n++} style={s.titre} break={b.includes("Annexe")}>
          {b.slice(3).trim()}
        </Text>,
      );
    } else if (b.startsWith("### ")) {
      out.push(
        <Text key={n++} style={s.h3} minPresenceAhead={40}>
          {b.slice(4).trim()}
        </Text>,
      );
    } else if (b.startsWith("|")) {
      const lignes = b.split("\n").filter((l) => l.startsWith("|") && !/^\|\s*-+/.test(l));
      out.push(
        <View key={n++} style={s.tableau} wrap={false}>
          {lignes.map((l, i) => (
            <View key={i} style={i === 0 ? [s.ligne, s.entete] : s.ligne}>
              {l
                .replace(/^\||\|$/g, "")
                .split("|")
                .map((c, j) => (
                  <Text key={j} style={i === 0 ? [s.cellule, s.gras] : s.cellule}>
                    {enLigne(c.trim())}
                  </Text>
                ))}
            </View>
          ))}
        </View>,
      );
    } else if (b.startsWith(">")) {
      out.push(
        <Text key={n++} style={s.quote}>
          {enLigne(b.replace(/^>\s?/gm, "").replace(/\n/g, " "))}
        </Text>,
      );
    } else {
      out.push(
        <Text key={n++} style={s.p}>
          {enLigne(b.replace(/\n/g, " "))}
        </Text>,
      );
    }
  }
  return out;
}

/** Depuis le contrat 2.5, la signature tient en deux cases (avant : une case par engagement). */
export function deuxCases(version: string): boolean {
  // Comparaison PAR COMPOSANTE (analyse du 09/10) : « 2.10 » est après « 2.5 », pas « 2.1 ».
  const [maj = 0, min = 0] = version.split(".").map((x) => Number.parseInt(x, 10) || 0);
  return maj > 2 || (maj === 2 && min >= 5);
}

function Certificat({
  sha,
  version,
  apporteur,
  societe,
}: {
  sha: string;
  version: string;
  apporteur: SignatureApporteur | null;
  societe: SignatureSociete | null;
}) {
  const libelle = (cle: string) =>
    ACCEPTATIONS.find((a) => a.cle === cle)?.texte ??
    DECLARATIONS.find((d) => d.cle === cle)?.texte ??
    cle;
  return (
    <View break>
      <Text style={s.certifTitre}>Certificat de signature électronique</Text>
      <Text style={s.p}>
        Document : contrat d&apos;apporteur d&apos;affaires, version {version}, et ses annexes.
        Empreinte SHA-256 du texte signé :
      </Text>
      <Text style={[s.p, s.gras]}>{sha}</Text>
      <View style={s.certif}>
        <Text style={s.gras}>Signature de l&apos;Apporteur</Text>
        {apporteur ? (
          <>
            <Text style={s.p}>
              Signé par « {apporteur.nomTape} » le {apporteur.signeAt}, depuis son lien personnel.
            </Text>
            <Text style={s.petit}>
              Adresse IP (empreinte) : {apporteur.ipHash ?? "non relevée"} · Navigateur :{" "}
              {apporteur.navigateur ?? "non relevé"}
            </Text>
            {deuxCases(version) ? (
              // Contrat 2.5 : deux cases ont été cochées, chacune listant ses engagements. Le
              // certificat le dit tel quel (une preuve inexacte se conteste) et groupe par case.
              <>
                <Text style={[s.p, { marginTop: 5 }]}>
                  Engagements acceptés (2 cases cochées, chacune listant ses engagements) :
                </Text>
                {(
                  [
                    ["Case 1 — « Je certifie que : »", apporteur.declarations],
                    [
                      "Case 2 — « J'ai lu le contrat et je l'accepte, en particulier : »",
                      apporteur.acceptations,
                    ],
                  ] as const
                ).map(([titre, cles]) => (
                  <React.Fragment key={titre}>
                    <Text style={[s.petit, s.gras, { marginTop: 3 }]}>{titre}</Text>
                    {cles.map((c) => (
                      <Text key={c} style={s.petit}>
                        · {libelle(c)}
                      </Text>
                    ))}
                  </React.Fragment>
                ))}
              </>
            ) : (
              <>
                <Text style={[s.p, { marginTop: 5 }]}>Cases cochées avant la signature :</Text>
                {[...apporteur.declarations, ...apporteur.acceptations].map((c) => (
                  <Text key={c} style={s.petit}>
                    · {libelle(c)}
                  </Text>
                ))}
              </>
            )}
          </>
        ) : (
          <Text style={s.petit}>Pas encore signé.</Text>
        )}
      </View>
      <View style={s.certif}>
        <Text style={s.gras}>Signature de la Société</Text>
        {societe ? (
          <Text style={s.p}>
            Contresigné pour AXION IA SAS par {societe.nom}, Président, le {societe.signeAt}. Le
            contrat est conclu à cette date.
          </Text>
        ) : (
          <Text style={s.petit}>
            En attente de la contresignature de la Société. Le contrat n&apos;est conclu qu&apos;à
            cette contresignature.
          </Text>
        )}
      </View>
    </View>
  );
}

export async function rendreContratPdf(entree: {
  texte: string;
  /** Version du texte SIGNÉ (enregistrée dans la signature) ; par défaut, la version courante. */
  version?: string;
  apporteur: SignatureApporteur | null;
  societe: SignatureSociete | null;
}): Promise<Buffer> {
  // L'empreinte porte sur le texte SIGNÉ ; seule la mise en page passe par `pourPdf`.
  const sha = empreinte(entree.texte);
  const texte = pourPdf(entree.texte);
  const apporteur = entree.apporteur
    ? { ...entree.apporteur, nomTape: pourPdf(entree.apporteur.nomTape) }
    : null;
  const societe = entree.societe ? { ...entree.societe, nom: pourPdf(entree.societe.nom) } : null;
  const doc = (
    <Document title="Contrat d'apporteur d'affaires" author="AXION IA SAS" language="fr">
      <Page size="A4" style={s.page} wrap>
        {blocs(texte)}
        <Certificat
          sha={sha}
          version={entree.version ?? CONTRAT_VERSION}
          apporteur={apporteur}
          societe={societe}
        />
        <View style={s.pied} fixed>
          <Text>Contrat d&apos;apporteur d&apos;affaires · AXION IA SAS</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
  const flux = await pdf(doc).toBuffer();
  return await new Promise<Buffer>((resolve, reject) => {
    const morceaux: Buffer[] = [];
    flux.on("data", (c: Buffer | Uint8Array) =>
      morceaux.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
    );
    flux.on("end", () => resolve(Buffer.concat(morceaux)));
    flux.on("error", reject);
  });
}
