/* global importScripts, libheif */
/**
 * HEIC/HEIF decoder worker (JustTools). Decodes with libheif compiled to
 * WebAssembly, off the main thread, so the page stays responsive while large
 * iPhone photos are converted. libheif is served from /vendor/libheif/.
 *
 * Message in:  { id, buffer: ArrayBuffer, all: boolean }
 * Message out: { id, ok: true, total, images: [{ width, height, data: ArrayBuffer }] }
 *           or { id, ok: false, error: string }
 */
importScripts('/vendor/libheif/libheif.js');

let ready = null;

function load() {
  if (!ready) {
    ready = new Promise((resolve, reject) => {
      const options = {
        locateFile: (path) => `/vendor/libheif/${path}`,
        onRuntimeInitialized: () => resolve(options),
      };
      try {
        libheif(options);
      } catch (err) {
        reject(err);
      }
    });
  }
  return ready;
}

function render(image) {
  const width = image.get_width();
  const height = image.get_height();
  return new Promise((resolve, reject) => {
    image.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, (out) => {
      if (out) resolve({ width, height, data: out.data.buffer });
      else reject(new Error('display'));
    });
  });
}

self.onmessage = async (event) => {
  const { id, buffer, all } = event.data;
  try {
    const lib = await load();
    const decoder = new lib.HeifDecoder();
    const found = decoder.decode(new Uint8Array(buffer));
    if (!found || !found.length) throw new Error('not-heif');
    const wanted = all ? found : found.slice(0, 1);
    const images = [];
    for (const image of wanted) images.push(await render(image));
    for (const image of found) if (image.free) image.free();
    self.postMessage({ id, ok: true, total: found.length, images }, images.map((i) => i.data));
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
