// Step 4: Transfer test + verification.
// - Creates player-test ATA, transfers 100 EBT from treasury
// - Prints both balances
// - Reads back on-chain Metaplex metadata (name/symbol/uri) and prints it
import {
  Connection, Keypair, PublicKey,
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount, transfer, getAccount,
} from '@solana/spl-token';
import { readFileSync } from 'fs';

const RPC = 'https://solana-devnet.api.onfinality.io/public';
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

const connection = new Connection(RPC, 'confirmed');
const load = (n) => Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(new URL(`../keys/${n}.json`, import.meta.url), 'utf8'))));
const treasury = load('treasury');
const player = load('player-test');
const mint = new PublicKey(readFileSync(new URL('../mint.txt', import.meta.url), 'utf8').trim());
console.log('mint:', mint.toBase58());

// player ATA (funded by treasury) + transfer 100 EBT
const playerAta = await getOrCreateAssociatedTokenAccount(connection, treasury, mint, player.publicKey);
console.log('player ATA:', playerAta.address.toBase58());
const treasuryAta = (await getOrCreateAssociatedTokenAccount(connection, treasury, mint, treasury.publicKey)).address;
const sig = await transfer(connection, treasury, treasuryAta, playerAta.address, treasury.publicKey, BigInt(100) * BigInt(1_000_000_000));
console.log('transfer sig:', sig);

// balances
const tBal = await connection.getTokenAccountBalance(treasuryAta);
const pBal = await connection.getTokenAccountBalance(playerAta.address);
console.log('treasury EBT balance:', tBal.value.uiAmountString);
console.log('player   EBT balance:', pBal.value.uiAmountString);

// mint info: supply + authorities (must be retained)
const mintInfo = await connection.getParsedAccountInfo(mint);
const md = mintInfo.value.data.parsed.info;
console.log('mint supply (base units):', md.supply);
console.log('mint decimals:', md.decimals);
console.log('mintAuthority retained:', md.mintAuthority, '(treasury:', treasury.publicKey.toBase58() + ')');
console.log('freezeAuthority retained:', md.freezeAuthority);

// on-chain metadata decode (name/symbol/uri)
const [metadataPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
  TOKEN_METADATA_PROGRAM_ID
);
const acc = await connection.getAccountInfo(metadataPda);
if (!acc) { console.log('metadata account: NOT FOUND'); process.exit(1); }
let o = 1 + 1 + 32 + 32; // discriminator + key + update_authority + mint
const readStr = () => { const len = acc.data.readUInt32LE(o); o += 4; const s = acc.data.slice(o, o + len).toString('utf8').replace(/\0+$/, ''); o += len; return s; };
const name = readStr(), symbol = readStr(), uri = readStr();
console.log('on-chain metadata name:', JSON.stringify(name));
console.log('on-chain metadata symbol:', JSON.stringify(symbol));
console.log('on-chain metadata uri:', uri);
console.log('DONE: transfer test + metadata verification complete');
