# P-03 — DNS

**Méthode** : `nslookup` via DNS Google (8.8.8.8).

## A / AAAA

```
axion-ia.com  A     172.67.180.158   (Cloudflare anycast)
axion-ia.com  A     104.21.51.131    (Cloudflare anycast)
axion-ia.com  AAAA  2606:4700:3035::6815:3383
axion-ia.com  AAAA  2606:4700:3036::ac43:b49e
```

→ ✅ DNS orange proxy Cloudflare confirmé. Origin `178.105.55.15` (Hetzner Nuremberg CPX32) jamais exposé directement.

## MX (Namecheap forwarder)

```
MX 10 eforward1.registrar-servers.com
MX 10 eforward2.registrar-servers.com
MX 10 eforward3.registrar-servers.com
MX 15 eforward4.registrar-servers.com
MX 20 eforward5.registrar-servers.com
```

→ ⚠️ Reception emails = forwarder Namecheap (`eforward*.registrar-servers.com`). Pas un MX direct vers AxionIA/PowerMTA. Cohérent avec une stratégie de transit forwarder → boîte personnelle. **Pour `dpo@axion-ia.com` et `contact@axion-ia.com` à confirmer routage cible Will**.

## TXT / SPF / DKIM / DMARC

```
SPF  : axion-ia.com TXT "v=spf1 include:spf.efwd.registrar-servers.com ~all"
DKIM (resend._domainkey)  : NXDOMAIN  ← Resend interdit, attendu
DKIM (powermta._domainkey) : non testé (clé custom AxionIA selon ADR)
DMARC (_dmarc.axion-ia.com) : NXDOMAIN ⚠️
```

## Findings

1. **🚨 P0-DNS-01 — DMARC ABSENT** : aucun enregistrement TXT `_dmarc.axion-ia.com`. Sans DMARC, les emails d'AxionIA (transactionnels + marketing PowerMTA + MailWizz) peuvent être usurpés et discardés sans alerte. **Action critique** : ajouter `v=DMARC1; p=quarantine; rua=mailto:dmarc@axion-ia.com; sp=quarantine; pct=100` (ou `p=none` en phase d'observation). Cross-confirmer AGT-12 + AGT-09 (RGPD email trust).
2. **P1-DNS-01 — SPF couvre seulement le forwarder MX** : SPF actuel autorise `spf.efwd.registrar-servers.com` mais **ne couvre PAS PowerMTA outbound** (cabinet envoie via PowerMTA selon `.env.example`). Tous mails sortants AxionIA (booking confirmation, newsletter, gdpr-export) sont **SPF-fail** → SpamAssassin score+, livraison dégradée. **Action** : ajouter `include:<powermta-spf>` ou IP du worker.
3. **P1-DNS-02 — DKIM signing key origin** : pas de TXT `selector._domainkey.axion-ia.com` testé (sélecteur AxionIA inconnu sans configuration PowerMTA visible). Tester avec `mail-tester.com` pour scoring complet (`[ACTION WILL]`).
4. **P2-DNS-01 — DNSSEC** : status mémoire `axionia_session_2026-05-09_cloudflare_phase5` = "reporté ~16 mai". AGT-12 confirme API CF = `status: pending`. **Action mineure** : ajouter DS record côté Namecheap registrar.
5. **P2-DNS-02 — TTL DNS** : non mesuré (`dig` avec TTL ne renvoie pas via nslookup standard). À mesurer ultérieurement.

## Synthèse

- ✅ IPv4 + IPv6 proxified Cloudflare, origin masqué.
- ✅ MX configuré (forwarder Namecheap).
- ✅ SPF présent (mais limité).
- 🚨 **DMARC absent** — P0 (cf. consolidation Pass B).
- ⚠️ DKIM PowerMTA non documenté côté DNS.
- ⚠️ DNSSEC pending.

Email deliverability est probablement **dégradée** en l'état. À confirmer via mail-tester.com.
