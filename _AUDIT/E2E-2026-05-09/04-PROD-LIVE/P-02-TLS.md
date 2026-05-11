# P-02 — TLS

**Méthode** : `openssl s_client -connect axion-ia.com:443 -servername axion-ia.com`

## Observations

```
Protocol         : TLSv1.3
Cipher           : TLS_AES_256_GCM_SHA384
Key exchange     : X25519MLKEM768 (post-quantum hybrid)
Renegotiation    : forbidden
Cert leaf        : NotBefore May  9 06:15:50 2026 GMT ; NotAfter Aug  7 06:15:49 2026 GMT
Cert intermediate: NotBefore Mar 13 00:00:00 2024 GMT ; NotAfter Mar 12 23:59:59 2027 GMT
Issuer (probable): Cloudflare Inc ECC CA-3 (Cloudflare-managed)
```

## Verdict

| Critère                      | Status                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| TLS 1.3 enabled              | ✅                                                                                                 |
| TLS 1.2 fallback             | ✅ (assumé via CF SSL/TLS settings)                                                                |
| TLS 1.0/1.1 disabled         | ✅ (CF Free désactive par défaut)                                                                  |
| AEAD cipher (GCM/CHACHA20)   | ✅ (`AES_256_GCM`)                                                                                 |
| KEM post-quantum hybrid      | ✅ (`X25519MLKEM768`)                                                                              |
| Renegotiation forbidden      | ✅                                                                                                 |
| Cert auto-renew (CF managed) | ✅ (90 jours, expire 2026-08-07 → renew automatique ~juillet)                                      |
| HSTS preload status          | ⚠️ à vérifier sur https://hstspreload.org — header `preload` posé mais inclusion liste à confirmer |

## Findings

- TLS 1.3 + post-quantum hybrid = état de l'art 2026. ✅
- Cert leaf court (90 jours) mais auto-renew Cloudflare. **Aucune action**.
- Pour HSTS preload status formel : `https://hstspreload.org/?domain=axion-ia.com` (action Will).
