// Request devnet SOL airdrop to treasury (2 SOL, with retries).
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { readFileSync } from 'fs';

const RPC = 'https://solana-devnet.api.onfinality.io/public';
const connection = new Connection(RPC, 'confirmed');
const secret = Uint8Array.from(JSON.parse(readFileSync(new URL('../keys/treasury.json', import.meta.url), 'utf8')));
const treasury = Keypair.fromSecretKey(secret);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function balance() {
  return (await connection.getBalance(treasury.publicKey)) / LAMPORTS_PER_SOL;
}

console.log('treasury:', treasury.publicKey.toBase58());
console.log('balance before:', await balance(), 'SOL');

let sig = null;
for (let i = 1; i <= 6; i++) {
  try {
    console.log(`airdrop attempt ${i}...`);
    sig = await connection.requestAirdrop(treasury.publicKey, 2 * LAMPORTS_PER_SOL);
    console.log('airdrop sig:', sig);
    await connection.confirmTransaction(sig, 'confirmed');
    break;
  } catch (e) {
    console.log(`attempt ${i} failed:`, e.message.slice(0, 160));
    await sleep(15000);
  }
}

console.log('balance after:', await balance(), 'SOL');
if (sig) console.log('DONE');
else { console.log('FAILED: airdrop did not succeed after retries'); process.exit(1); }
