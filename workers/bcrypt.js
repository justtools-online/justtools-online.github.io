/* global importScripts, hashwasm */
/**
 * Bcrypt worker (JustTools). Hashes and verifies with hash-wasm's bcrypt,
 * off the main thread, so high costs don't freeze the page. hash-wasm is
 * served from /vendor/hash-wasm/.
 *
 * Message in:  { id, op: 'hash', password: Uint8Array, salt: Uint8Array, cost, version }
 *           or { id, op: 'verify', password: Uint8Array, hash }   (hash already in $2a$ form)
 * Message out: { id, ok: true, result, ms } or { id, ok: false, error }
 */
importScripts('/vendor/hash-wasm/bcrypt.umd.min.js');

self.onmessage = async (e) => {
  const { id, op } = e.data;
  const t0 = performance.now();
  try {
    let result;
    if (op === 'hash') {
      const { password, salt, cost, version } = e.data;
      const h = await hashwasm.bcrypt({ password, salt, costFactor: cost, outputType: 'encoded' });
      result = `$${version}$${h.slice(4)}`;
    } else {
      result = await hashwasm.bcryptVerify({ password: e.data.password, hash: e.data.hash });
    }
    self.postMessage({ id, ok: true, result, ms: performance.now() - t0 });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err && err.message ? err.message : String(err) });
  }
};
