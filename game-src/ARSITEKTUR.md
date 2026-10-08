# ARSITEKTUR.md — Integrasi Token EBT On-Chain untuk "Elebeast: Jungle Dash"

## 1. Pola yang dipakai game ini (fase sekarang)

**Ledger off-chain di browser + saldo on-chain read-only.** Dua sistem berjalan terpisah:

| Aspek | Implementasi sekarang |
|---|---|
| Saldo EBT game | `localStorage` key `elebeast_ebt` — 1 koin = 1 EBT (+bonus tiap 50 m). |
| Toko | `localStorage` key `elebeast_shop` (item permanen: skin, magnet, perisai, pengali x2). |
| Dompet | Deteksi `window.phantom?.solana` → connect → tampil alamat singkat + **saldo EBT on-chain read-only** via `connection.getParsedTokenAccountsByOwner(owner, { mint })` di devnet. |
| Klaim on-chain | **BELUM ADA.** UI menulis jujur: *"Klaim EBT dari game ke wallet (on-chain penuh) butuh server."* |

Alasan pola ini: browser tidak boleh memegang private key treasury, dan klaim yang
trustless butuh tanda tangan server. Tanpa backend, token on-chain tidak bisa
"dicetak" dari hasil main — jadi ledger game tetap off-chain sampai backend ada.

Konstanta yang harus diganti saat packaging:

```js
const ELEBEAST_MINT = "EBT_MINT_PLACEHOLDER"; // <-- diganti alamat mint asli
```

## 2. Arsitektur doc menuju integrasi penuh (on-chain penuh)

### 2.1 Komponen
```
[Browser/game] --(1) klaim--> [Backend API] --(2) transfer/mint--> [Solana devnet/mainnet]
      |                              |
      +--(3) baca saldo on-chain-----+        [Treasury wallet / Squads multisig]
```

1. **Backend API** (Node.js/Express atau serverless): satu-satunya pihak yang memegang
   private key. Endpoint: `POST /claim` (dengan bukti sesi main), `POST /withdraw`,
   `GET /balance/:wallet`.
2. **Hot wallet treasury**: keypair server yang memegang pasokan EBT untuk reward.
   Alternatif lebih aman: **Squads multisig** — pengeluaran besar butuh 2-of-3 signer.
3. **Token EBT (SPL)**: dibuat worker lain di devnet (9 desimal, supply 1.000.000).

### 2.2 Pola deposit / withdraw
- **Deposit (opsional, untuk taruhan/turnamen):** pemain kirim EBT ke alamat treasury
  → backend mendeteksi transfer via websocket/polling → kredit saldo game di database
  (bukan lagi localStorage murni; localStorage jadi cache).
- **Withdraw (klaim reward):** pemain klik "Klaim" → backend validasi (lihat 2.3) →
  server mengirim EBT dari treasury ke wallet pemain via
  `transferChecked` (atau `mintTo` jika treasury = mint authority).
- Selalu tampilkan status transaksi + link Explorer (`?cluster=devnet` → mainnet-beta).

### 2.3 Keamanan (wajib)
- **Private key TIDAK PERNAH di client.** Semua penandatanganan di server.
- **Bukti main anti-curang:** tiap sesi main menghasilkan *score ticket* — payload
  `{wallet, skor, koin, nonce, timestamp}` yang ditandatangani client TIDAK cukup;
  backend harus memvalidasi kewajaran (batas EBT/menit, pola mustahil = tolak).
  Untuk versi serius: pindahkan otoritas skor ke server (game kirim replay/event,
  bukan angka final).
- **Rate-limit withdraw:** mis. maks 1 klaim/10 menit per wallet + batas harian;
  simpan nonce per wallet di DB agar tidak double-claim.
- **Anti-bot:** CAPTCHA/h proof-of-human di klaim pertama, deteksi pola farming.
- **Kunci API & secret** di environment variable server / secret manager, bukan di repo.
- Validasi `mint` di server — jangan percaya mint address kiriman client.

### 2.4 Peran mint authority & freeze authority
- **Mint authority:** boleh mencetak EBT baru. Rekomendasi: setelah distribusi awal,
  **cabut (revoke) mint authority** agar supply 1.000.000 final dan tidak bisa
  dicetak diam-diam → kepercayaan pemain naik. Kalau reward butuh cetak terus,
  pindahkan mint authority ke program/multisig dengan aturan jelas.
- **Freeze authority:** bisa membekukan akun token. Berguna darurat (akun eksploiter),
  tapi sentralistik — pertimbangkan dicabut juga setelah fase awal, atau dipegang multisig.
- Treasury untuk reward sebaiknya **PDA/ATA terpisah** dari mint authority.

### 2.5 Data yang pindah ke server (migrasi dari localStorage)
| Sekarang (localStorage) | Nanti (server DB) |
|---|---|
| `elebeast_ebt` | kolom `balance` per user (wallet = identitas) |
| `elebeast_shop` | tabel `inventory` per user |
| `elebeast_high` | leaderboard global |

## 3. Checklist menuju mainnet
- [ ] Buat **keypair baru milik user** untuk treasury & mint authority (jangan pakai key dev).
- [ ] Deploy token EBT di **mainnet-beta** (verifikasi metadata: nama, simbol, logo, desimal).
- [ ] Putuskan & umumkan kebijakan mint/freeze authority (revoke atau multisig).
- [ ] Backend claim/withdraw + DB + rate-limit + anti-bot, di-host dengan HTTPS.
- [ ] Audit: review kode transfer, uji di devnet dengan skenario curang (skor palsu, replay attack).
- [ ] Ganti `ELEBEAST_MINT` di `game.html` + `clusterApiUrl('mainnet-beta')` + link Explorer tanpa `?cluster=devnet`.
- [ ] Uji end-to-end: main → klaim → EBT masuk Phantom (mainnet) → tercatat di Explorer.
- [ ] Cadangan: backup keypair treasury di tempat aman (offline), siapkan rotasi darurat.
