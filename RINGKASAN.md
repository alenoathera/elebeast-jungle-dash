# Elebeast — Ringkasan Proyek (2026-10-08)

Token crypto **EBT** + game web **Elebeast: Jungle Dash**. Semua keputusan kreatif & teknis dibuat oleh koordinator atas mandat penuh user (athera).

## Token EBT (Solana, SPL klasik)
- **Nama**: Elebeast | **Symbol**: EBT | **Supply**: 1.000.000 | **Desimal**: 9
- **Jaringan**: Solana **devnet** (mainnet menyusul, lihat bawah)
- **Status**: ⏳ MENUNGGU FUNDING — pembuatan script 100% siap, terblokir karena treasury devnet belum punya SOL
- **Treasury (devnet)**: `CKVPWJJm8uZmDsAqnpkgNXZKUeBTDUXbKwgNTCoKWXkM`
- **Alamat mint**: belum ada (dibuat setelah funding) → `~/workspace/elebeast/token.json`
- **Keputusan penting**: SPL Token klasik (bukan Token-2022, bukan pump.fun — pump.fun khusus memecoin dan me-renounce mint authority, tidak cocok untuk token game). Mint authority + freeze authority DIPERTAHANKAN di treasury (untuk cetak reward & bekukan cheater). Metadata via Metaplex Token Metadata (nama/symbol/logo on-chain).
- **Logo**: `assets/logo.png` — maskot gajah buas gaya kartun game. Metadata JSON: `assets/elebeast-metadata.json` (URL publik aktif, diverifikasi HTTP 200).
- **Keypair**: `keys/treasury.json` (devnet SAJA — lihat `keys/README.txt`), `keys/player-test.json` (wallet uji).
- **Script**: `scripts/01-keygen.mjs` … `05-write-token-json.mjs` (siap jalan; `03-create-token.mjs` membuat mint + ATA + mint 1jt EBT + metadata Metaplex sekaligus).

### Kenapa terblokir & cara membuka
- `api.devnet.solana.com` menutup koneksi dari IP mesin ini (empty reply setelah TLS handshake — pola umum pemblokiran/rate-limit agresif IP hosting oleh endpoint publik Solana). RPC publik lain (onfinality — untuk semua operasi SETELAH funding) jalan normal; tapi `requestAirdrop` hanya didukung endpoint resmi.
- **Cara buka (pilih satu)**:
  1. (Disarankan) Klaim via browser di https://faucet.solana.com — masukkan alamat treasury di atas, selesaikan captcha, klaim 2 SOL devnet.
  2. Faucet web lain (mis. https://jumpbit.io/en/solana/devnet-faucet).
  3. Tunggu — kadang blokir IP sementara; coba `solana airdrop` lagi lain waktu.
- **Setelah treasury terisi (±0,05 SOL cukup)**: jalankan `cd ~/workspace/elebeast/scripts && node 03-create-token.mjs` (pakai RPC onfinality yang sudah dikonfigurasi di script), lalu `node 04-test-transfer.mjs`, `node 05-write-token-json.mjs`. Alamat mint akan tersimpan di `~/workspace/elebeast/mint.txt` & `token.json`.

## Game: Elebeast: Jungle Dash
- **Konsep**: endless runner 2D canvas. Gajah buas (Elebeast) lari otomatis menembus hutan; tap/klik/SPASI = lompat (double-jump), panah bawah = menunduk. Hindari batu & burung, kumpulkan koin EBT. Kecepatan & kesulitan naik bertahap (340→900 px/detik). Tabrakan = game over (kecuali punya Perisai).
- **Layar**: Menu (hero art + saldo + rekor), HUD (skor, EBT, pause, mute), Game Over, Toko, Dompet, Pause. Seluruh UI **Bahasa Indonesia**. Responsif desktop + mobile (kontrol sentuh).
- **Ekonomi EBT (in-game)**: 1 koin = 1 EBT + bonus tiap 50 m; saldo di `localStorage 'elebeast_ebt'`. **Toko** (6 item): 3 skin gajah via hue-rotate (Api 300, Hutan 300, Emas 600 EBT), Magnet Koin 500, Perisai 500, EBT x2 permanen 1000.
- **Dompet (devnet)**: tombol "Hubungkan Wallet" — deteksi `window.phantom?.solana`; tampilkan alamat + saldo EBT on-chain via `getParsedTokenAccountsByOwner` + link Explorer devnet. Read-only; UI jujur menyatakan klaim on-chain penuh butuh server.
- **Aset**: 7 gambar AI (hero, sprite gajah/batu/burung/koin dengan chroma-key magenta, 2 lapis background parallax) + 5 efek suara prosedural WebAudio (tanpa file audio).
- **Arsitektur on-chain**: `game-src/ARSITEKTUR.md` — pola ledger off-chain + settlement on-chain (deposit/withdraw via server hot wallet / multisig Squads), keamanan (private key tidak pernah di client), checklist mainnet.
- **File**: sumber di `game-src/` (`game.html` 36 KB + `assets/` + `ARSITEKTUR.md`); versi mandiri (aset di-inline base64) di `game-dist/elebeast-jungle-dash.html` (3,5 MB) — inilah yang di-deploy sebagai web artifact.
- **Testing**: sintaks JS lolos `node --check` (2x). Gameplay di browser & koneksi Phantom BELUM diuji langsung (tidak ada browser di environment build) — disarankan uji manual.

## Yang sudah dites
- ✅ Script token lengkap & syntax OK; koneksi RPC devnet via onfinality OK (`getHealth`, `getBalance`)
- ✅ Metadata JSON + URL logo publik aktif (HTTP 200)
- ✅ Sintaks JS game OK; semua 7 aset berhasil di-generate (2 dicek visual)
- ❌ Mint EBT di devnet — TERBLOKIR funding (lihat atas)
- ❌ Gameplay di browser nyata — belum (tidak ada browser di environment ini)

## Langkah berikutnya menuju mainnet
1. Buka blokir funding (faucet browser) → jalankan script 03–05 → dapat alamat mint devnet.
2. Patch `ELEBEAST_MINT` di game + artifact (ganti `EBT_MINT_PLACEHOLDER`).
3. Uji penuh di devnet: main, beli item, hubungkan Phantom devnet, terima EBT uji.
4. Mainnet (nanti, atas perintah user): buat keypair BARU milik user (jangan pakai key devnet!), isi ±0,05 SOL asli, jalankan ulang script dengan `--url mainnet-beta`, pasang metadata permanen (Arweave/IPFS — URL muse.ai bisa kedaluwarsa), umumkan alamat mint resmi, pertimbangkan multisig Squads untuk mint authority.
