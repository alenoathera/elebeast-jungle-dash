// Step 3b: Finish EBT token after 03's mint tx landed but confirmation failed.
// Reuses recovered mint STP2Vp77b8hSaeiHbaSGp2vFS9Y2szSk4mc4dnT4dd5.
// All sends use REST polling (no websockets — wss is broken through this egress proxy).
import {
  Connection, Keypair, PublicKey, Transaction, TransactionInstruction,
  SystemProgram, SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { readFileSync, writeFileSync } from 'fs';

const RPC = 'https://solana-devnet.api.onfinality.io/public';
const MINT = new PublicKey('STP2Vp77b8hSaeiHbaSGp2vFS9Y2szSk4mc4dnT4dd5');
const METADATA_URI = 'https://muse.ai/files/1441877695666055/2231722141076411/usw0wr5rapnkelfa8bjtnxx1/elebeast-metadata.json';
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

const connection = new Connection(RPC, 'confirmed');
const load = (n) => Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(new URL(`../keys/${n}.json`, import.meta.url), 'utf8'))));
const treasury = load('treasury');
const player = load('player-test');
console.log('treasury:', treasury.publicKey.toBase58());
console.log('mint:', MINT.toBase58());

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

// --- 1. Treasury ATA ---
const ata = await getAssociatedTokenAddress(MINT, treasury.publicKey);
console.log('treasury ATA:', ata.toBase58());
if (!(await connection.getAccountInfo(ata))) {
  const ix = createAssociatedTokenAccountInstruction(treasury.publicKey, ata, treasury.publicKey, MINT);
  const sig = await sendAndConfirmRest(new Transaction().add(ix), [treasury]);
  console.log('ATA created, sig:', sig);
} else {
  console.log('ATA already exists, skipping creation');
}

// --- 2. Mint 1,000,000 EBT to treasury ---
const SUPPLY_BASE = BigInt(1_000_000) * BigInt(1_000_000_000);
const balBefore = await connection.getTokenAccountBalance(ata).then((b) => b.value.amount).catch(() => '0');
console.log('treasury EBT before mint:', balBefore);
if (balBefore === '0') {
  const ix = createMintToInstruction(MINT, ata, treasury.publicKey, SUPPLY_BASE);
  const sig = await sendAndConfirmRest(new Transaction().add(ix), [treasury]);
  console.log('mintTo sig:', sig);
} else {
  console.log('supply already minted, skipping mintTo');
}

// --- 3. Metaplex metadata (manual create_metadata_accounts_v3) ---
const [metadataPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), MINT.toBuffer()],
  TOKEN_METADATA_PROGRAM_ID
);
console.log('metadata PDA:', metadataPda.toBase58());
if (!(await connection.getAccountInfo(metadataPda))) {
  const str = (s) => {
    const b = Buffer.from(s, 'utf8');
    const len = Buffer.alloc(4); len.writeUInt32LE(b.length, 0);
    return Buffer.concat([len, b]);
  };
  const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n, 0); return b; };
  const dataV2 = Buffer.concat([
    str('Elebeast'), str('EBT'), str(METADATA_URI), u16(0),
    Buffer.from([0]), Buffer.from([0]), Buffer.from([0]),
  ]);
  const ixData = Buffer.concat([Buffer.from([33]), dataV2, Buffer.from([1]), Buffer.from([0])]);
  const ix = new TransactionInstruction({
    programId: TOKEN_METADATA_PROGRAM_ID,
    keys: [
      { pubkey: metadataPda, isSigner: false, isWritable: true },
      { pubkey: MINT, isSigner: false, isWritable: true },
      { pubkey: treasury.publicKey, isSigner: true, isWritable: false },
      { pubkey: treasury.publicKey, isSigner: true, isWritable: true },
      { pubkey: treasury.publicKey, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: ixData,
  });
  const sig = await sendAndConfirmRest(new Transaction().add(ix), [treasury]);
  console.log('metadata sig:', sig);
} else {
  console.log('metadata already exists, skipping');
}

// --- 4. Test transfer 100 EBT to player-test + verify ---
const playerAta = await getAssociatedTokenAddress(MINT, player.publicKey);
if (!(await connection.getAccountInfo(playerAta))) {
  const ix = createAssociatedTokenAccountInstruction(treasury.publicKey, playerAta, player.publicKey, MINT);
  const sig = await sendAndConfirmRest(new Transaction().add(ix), [treasury]);
  console.log('player ATA created, sig:', sig);
}
const pBalBefore = await connection.getTokenAccountBalance(playerAta).then((b) => b.value.amount).catch(() => '0');
if (pBalBefore === '0') {
  const ix = createTransferInstruction(ata, playerAta, treasury.publicKey, BigInt(100) * BigInt(1_000_000_000));
  const sig = await sendAndConfirmRest(new Transaction().add(ix), [treasury]);
  console.log('transfer sig:', sig);
}
const tBal = await connection.getTokenAccountBalance(ata);
const pBal = await connection.getTokenAccountBalance(playerAta);
console.log('treasury EBT balance:', tBal.value.uiAmountString);
console.log('player   EBT balance:', pBal.value.uiAmountString);

// --- 5. Verify mint account (supply/decimals/authorities) ---
const mintAcc = await connection.getAccountInfo(MINT);
const d = mintAcc.data;
let o = 0;
const readOpt = () => { const t = d.readUInt32LE(o); o += 4; if (t === 1) { const k = new PublicKey(d.slice(o, o + 32)).toBase58(); o += 32; return k; } return null; };
const mintAuth = readOpt();
const supply = d.readBigUInt64LE(o); o += 8;
const decimals = d.readUInt8(o); o += 1;
o += 1; // isInitialized
const freezeAuth = readOpt();
console.log('mint supply (base units):', supply.toString());
console.log('mint decimals:', decimals);
console.log('mintAuthority:', mintAuth, '| expected treasury:', treasury.publicKey.toBase58());
console.log('freezeAuthority:', freezeAuth);

// --- 6. Decode on-chain metadata ---
const acc = await connection.getAccountInfo(metadataPda);
if (!acc) { console.log('metadata account: NOT FOUND'); process.exit(1); }
let mo = 1 + 1 + 32 + 32;
const readStr = () => { const len = acc.data.readUInt32LE(mo); mo += 4; const s = acc.data.slice(mo, mo + len).toString('utf8').replace(/\0+$/, ''); mo += len; return s; };
console.log('on-chain metadata name:', JSON.stringify(readStr()));
console.log('on-chain metadata symbol:', JSON.stringify(readStr()));
console.log('on-chain metadata uri:', readStr());

// --- 7. Write mint.txt + token.json ---
writeFileSync(new URL('../mint.txt', import.meta.url), MINT.toBase58() + '\n');
const token = {
  mint: MINT.toBase58(),
  name: 'Elebeast',
  symbol: 'EBT',
  supply: '1000000',
  decimals: 9,
  network: 'devnet',
  rpc_used: RPC,
  treasury_pubkey: treasury.publicKey.toBase58(),
  player_test_pubkey: player.publicKey.toBase58(),
  metadata_uri: METADATA_URI,
  logo_url: 'https://muse.ai/files/1441877695666055/1098886222508887/jf5ksxnkum6s1yoy2i6ttnaj/logo.png',
  explorer_url: `https://explorer.solana.com/address/${MINT.toBase58()}?cluster=devnet`,
  authorities: {
    mint_authority: 'treasury (retained, NOT renounced)',
    freeze_authority: 'treasury (retained, NOT renounced)',
    metadata_update_authority: 'treasury (retained)',
  },
  standard: 'SPL Token (classic)',
};
writeFileSync(new URL('../token.json', import.meta.url), JSON.stringify(token, null, 2) + '\n');
console.log('DONE: mint + supply + metadata + test transfer complete. Files: mint.txt, token.json');
