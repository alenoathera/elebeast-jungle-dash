// Generate devnet keypairs (treasury + player-test) in solana-keygen JSON format.
import { Keypair } from '@solana/web3.js';
import { writeFileSync } from 'fs';

const out = (name) => {
  const kp = Keypair.generate();
  // solana-keygen format: JSON array of the 64-byte secret key
  writeFileSync(
    new URL(`../keys/${name}.json`, import.meta.url),
    JSON.stringify(Array.from(kp.secretKey))
  );
  console.log(`${name}: pubkey=${kp.publicKey.toBase58()}`);
  return kp.publicKey.toBase58();
};

out('treasury');
out('player-test');
console.log('DONE: keypairs saved to ~/workspace/elebeast/keys/ (DEVNET ONLY)');
