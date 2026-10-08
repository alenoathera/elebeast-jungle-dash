// Step 5: Write ~/workspace/elebeast/token.json summary.
import { Keypair, PublicKey } from '@solana/web3.js';
import { readFileSync, writeFileSync } from 'fs';

const pubkeyOf = (n) => Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(new URL(`../keys/${n}.json`, import.meta.url), 'utf8')))).publicKey.toBase58();
const mint = readFileSync(new URL('../mint.txt', import.meta.url), 'utf8').trim();

const token = {
  mint,
  name: 'Elebeast',
  symbol: 'EBT',
  supply: '1000000',
  decimals: 9,
  network: 'devnet',
  rpc_used: 'https://solana-devnet.api.onfinality.io/public',
  treasury_pubkey: pubkeyOf('treasury'),
  player_test_pubkey: pubkeyOf('player-test'),
  metadata_uri: 'https://muse.ai/files/1441877695666055/2231722141076411/usw0wr5rapnkelfa8bjtnxx1/elebeast-metadata.json',
  logo_url: 'https://muse.ai/files/1441877695666055/1098886222508887/jf5ksxnkum6s1yoy2i6ttnaj/logo.png',
  logo_expires_at: '2026-10-10T15:26:16+00:00',
  metadata_expires_at: '2026-10-10T15:43:01+00:00',
  explorer_url: `https://explorer.solana.com/address/${mint}?cluster=devnet`,
  authorities: {
    mint_authority: 'treasury (retained, NOT renounced)',
    freeze_authority: 'treasury (retained, NOT renounced)',
    metadata_update_authority: 'treasury (retained)',
  },
  standard: 'SPL Token (classic)',
};

writeFileSync(new URL('../token.json', import.meta.url), JSON.stringify(token, null, 2) + '\n');
console.log('wrote ~/workspace/elebeast/token.json');
console.log(JSON.stringify(token, null, 2));
