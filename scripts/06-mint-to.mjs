// Step 6: Mint EBT to any address (devnet). Usage: node 06-mint-to.mjs <address> <amount_ebt>
// REST polling for confirmation (no websockets).
import {
  Connection, Keypair, PublicKey, Transaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from '@solana/spl-token';
import { readFileSync } from 'fs';

const RPC = 'https://solana-devnet.api.onfinality.io/public';
const MINT = new PublicKey(readFileSync(new URL('../mint.txt', import.meta.url), 'utf8').trim());

const toAddr = new PublicKey(process.argv[2]);
const amountEbt = Number(process.argv[3]);
if (!process.argv[2] || !amountEbt || amountEbt <= 0) {
  console.log('Usage: node 06-mint-to.mjs <address> <amount_ebt>');
  process.exit(1);
}

const connection = new Connection(RPC, 'confirmed');
const treasury = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(new URL('../keys/treasury.json', import.meta.url), 'utf8'))));

async function sendAndConfirmRest(tx, signers) {
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = treasury.publicKey;
  tx.sign(...signers);
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  const start = Date.now();
  while (Date.now() - start < 90000) {
    const st = await connection.getSignatureStatuses([sig], { searchTransactionHistory: true });
    const s = st.value[0];
    if (s && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized')) {
      if (s.err) throw new Error('tx failed on-chain: ' + JSON.stringify(s.err) + ' sig=' + sig);
      return sig;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('confirmation timeout for sig ' + sig);
}

const ata = await getAssociatedTokenAddress(MINT, toAddr);
console.log('recipient ATA:', ata.toBase58());
if (!(await connection.getAccountInfo(ata))) {
  const ix = createAssociatedTokenAccountInstruction(treasury.publicKey, ata, toAddr, MINT);
  const sig = await sendAndConfirmRest(new Transaction().add(ix), [treasury]);
  console.log('ATA created, sig:', sig);
} else {
  console.log('ATA already exists');
}

// amount_ebt * 10^9 computed safely:
const units = BigInt(Math.round(amountEbt * 1e9));
const ix = createMintToInstruction(MINT, ata, treasury.publicKey, units);
const sig = await sendAndConfirmRest(new Transaction().add(ix), [treasury]);
console.log('mintTo sig:', sig);

const bal = await connection.getTokenAccountBalance(ata);
console.log(`DONE: minted ${amountEbt} EBT to ${toAddr.toBase58()}`);
console.log('recipient EBT balance:', bal.value.uiAmountString);
