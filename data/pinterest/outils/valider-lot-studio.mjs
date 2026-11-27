// Contrôle de data/pinterest/lot-studio-60.json avec les règles de `lireLotEpingles` du Studio
// (src/domaine/epingles/format-lot.ts, branche feat/pinterest-pr6) : copie pure, sans zod.
// Usage : node data/pinterest/outils/valider-lot-studio.mjs [fichier] [domaine]
import fs from "fs";
import path from "path";
import { motsInterditsEnvoiZernio } from "./mots-interdits-studio.mjs";

const fichier = process.argv[2] ?? "data/pinterest/lot-studio-60.json";
const domaine = (process.argv[3] ?? "axion-ia.com").toLowerCase();
const NOM_IMAGE = /^[\w.-]{1,120}\.(jpe?g|png|webp)$/i;
const CLES = ["titre", "description", "url", "tableau", "texteAlternatif", "contenuIA", "image"];
const norm = (s) => s.replace(/\s+/g, " ").trim();
const propre = (s) => motsInterditsEnvoiZernio(s).length === 0;
function lienDuSite(lien, dom) {
  let u; try { u = new URL(lien.trim()); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  return u.hostname.toLowerCase().replace(/\.$/, "") === dom;
}
function dimensions(p) { // en-tête PNG ou JPEG
  const b = fs.readFileSync(p);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  let i = 2; while (i < b.length) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2); } return [0, 0];
}
const brut = fs.readFileSync(fichier, "utf8");
const j = JSON.parse(brut);
const erreursFichier = [];
if (!j || Array.isArray(j) || typeof j !== "object") erreursFichier.push("objet { version, epingles } attendu");
if (j.version !== 1) erreursFichier.push("version 1 attendue");
if (!Array.isArray(j.epingles) || j.epingles.length === 0 || j.epingles.length > 500) erreursFichier.push("epingles : 1 à 500");
if (Buffer.byteLength(brut) > 1024 * 1024) erreursFichier.push("fichier > 1 Mo");
if (erreursFichier.length) { console.error(erreursFichier.join("\n")); process.exit(1); }
let ok = 0; const empreintes = new Set();
j.epingles.forEach((e, i) => {
  const err = [];
  for (const k of Object.keys(e)) if (!CLES.includes(k)) err.push(`clé inconnue « ${k} » (strict)`);
  const titre = typeof e.titre === "string" ? norm(e.titre) : "";
  if (!titre || titre.length > 100) err.push(`titre : 1 à 100 signes (${titre.length})`);
  if (!propre(e.titre ?? "")) err.push("titre : mot interdit");
  const d = (e.description ?? "").trim();
  if (!d || d.length > 800) err.push(`description : 1 à 800 signes (${d.length})`); // règle du Studio : 800 ; consigne : 500
  if (d.length > 500) err.push(`description > 500 signes (${d.length})`);
  if (!propre(d)) err.push("description : mot interdit");
  if (typeof e.url !== "string" || !lienDuSite(e.url, domaine)) err.push("lien : https vers le site, domaine exact");
  if (!propre(e.url ?? "")) err.push("lien : mot interdit");
  if (typeof e.tableau !== "string" || !e.tableau.trim()) err.push("tableau manquant");
  if (Array.isArray(e.tableau) || /\s\/\s/.test(e.tableau ?? "")) err.push("tableau : un seul nom, sans section");
  const alt = typeof e.texteAlternatif === "string" ? norm(e.texteAlternatif) : "";
  if (!alt || alt.length > 500) err.push(`texte alternatif : 1 à 500 signes (${alt.length})`);
  if (!propre(alt)) err.push("texte alternatif : mot interdit");
  if (typeof e.contenuIA !== "boolean") err.push("contenuIA : vrai ou faux obligatoire");
  if (typeof e.image !== "string" || !NOM_IMAGE.test(e.image)) err.push("image : nom de fichier");
  else {
    const dir = i < 30 ? "images" : "images-lot2";
    const p = path.join(path.dirname(fichier), dir, e.image);
    if (!fs.existsSync(p)) err.push(`image absente : ${dir}/${e.image}`);
    else { const [w, h] = dimensions(p); if (w < 1000 || Math.abs(w / h - 2 / 3) > 0.01 * (2 / 3)) err.push(`image : ratio 2:3 et ≥ 1000 px (${w}x${h})`);
      const cle = fs.statSync(p).size + ":" + e.image; if (empreintes.has(cle)) err.push("image en double"); empreintes.add(cle); }
  }
  const tout = [e.titre, e.description, e.texteAlternatif, e.url].join(" ");
  if (/\d\s?(€|euros?)/i.test(tout) || /[!]/.test(tout) || /\p{Extended_Pictographic}/u.test(tout)) err.push("prix, point d'exclamation ou emoji");
  if (err.length) console.log(`#${i + 1} REFUSÉE : ${err.join(" ; ")}`); else ok++;
});
console.log(`${ok}/${j.epingles.length} valides`);
process.exit(ok === j.epingles.length ? 0 : 1);
