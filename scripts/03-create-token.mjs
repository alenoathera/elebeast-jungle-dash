// Step 3: Create EBT SPL token on devnet + Metaplex metadata.
// Creates: mint (decimals 9), treasury ATA, 1,000,000 EBT minted,
//          on-chain metadata (name/symbol/uri) via Token Metadata program.
// Mint authority + freeze authority + metadata update authority = treasury (RETAINED, not renounced).
import {
  Connection, Keypair, PublicKey, Transaction, TransactionInstruction,
  SystemProgram, SYSVAR_RENT_PUBKEY, sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createMint, getOrCreateAssociatedTokenAccount, mintTo,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { readFileSync, writeFileSync } from 'fs';

const RPC = 'https://solana-devnet.api.onfinality.io/public';
const METADATA_URI = 'https://muse.ai/files/1441877695666055/2231722141076411/usw0wr5rapnkelfa8bjtnxx1/elebeast-metadata.json';
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

const connection = new Connection(RPC, 'confirmed');
const treasury = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(new URL('../keys/treasury.json', import.meta.url), 'utf8')))
);
console.log('treasury:', treasury.publicKey.toBase58());

const sol = await connection.getBalance(treasury.publicKey).then((b) => b / 1e9);
console.log('treasury balance:', sol, 'SOL');
if (sol < 0.02) {
  console.log('FUNDING_REQUIRED: treasury needs devnet SOL first.');
  console.log('Send devnet SOL (e.g. via https://jumpbit.io/en/solana/devnet-faucet) to:');
  console.log(treasury.publicKey.toBase58());
  process.exit(2);
}

// --- 1. Create mint (SPL classic, decimals 9) ---
const mintAuthority = treasury.publicKey;
const freezeAuthority = treasury.publicKey; // retained per spec
const mint = await createMint(connection, treasury, mintAuthority, freezeAuthority, 9);
console.log('MINT:', mint.toBase58());

// --- 2. Treasury ATA + mint 1,000,000 EBT ---
const ata = await getOrCreateAssociatedTokenAccount(connection, treasury, mint, treasury.publicKey);
console.log('treasury ATA:', ata.address.toBase58());
const SUPPLY_BASE = BigInt(1_000_000) * BigInt(1_000_000_000); // 1M * 10^9
const mintSig = await mintTo(connection, treasury, mint, ata.address, treasury.publicKey, SUPPLY_BASE);
console.log('mintTo sig:', mintSig);

// --- 3. Metaplex metadata (manual create_metadata_accounts_v3) ---
const [metadataPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
  TOKEN_METADATA_PROGRAM_ID
);
console.log('metadata PDA:', metadataPda.toBase58());

const str = (s) => {
  const b = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(4); len.writeUInt32LE(b.length, 0);
  return Buffer.concat([len, b]);
};
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n, 0); return b; };

// DataV2: name, symbol, uri, seller_fee_basis_points, creators=None, collection=None, uses=None
const dataV2 = Buffer.concat([
  str('Elebeast'),
  str('EBT'),
  str(METADATA_URI),
  u16(0),
  Buffer.from([0]), // creators: None
  Buffer.from([0]), // collection: None
  Buffer.from([0]), // uses: None
]);
// create_metadata_accounts_v3: discriminator 33, data, is_mutable=true, collection_details=None
const ixData = Buffer.concat([Buffer.from([33]), dataV2, Buffer.from([1]), Buffer.from([0])]);

const ix = new TransactionInstruction({
  programId: TOKEN_METADATA_PROGRAM_ID,
  keys: [
    { pubkey: metadataPda, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: treasury.publicKey, isSigner: true, isWritable: false },  // mint authority
    { pubkey: treasury.publicKey, isSigner: true, isWritable: true },   // payer
    { pubkey: treasury.publicKey, isSigner: false, isWritable: false }, // update authority
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ],
  data: ixData,
});
const metaSig = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [treasury]);
console.log('metadata sig:', metaSig);

writeFileSync(new URL('../mint.txt', import.meta.url), mint.toBase58() + '\n');
console.log('DONE: mint saved to ~/workspace/elebeast/mint.txt');
