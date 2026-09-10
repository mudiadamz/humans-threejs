import { readFile } from 'node:fs/promises';
import { createHumans as createBrowserHumans } from './create-humans.js';

/** Node entry: loads bytes from disk/URL without DOM, fetch-file, or ProgressEvent. */
export async function createHumans(options = {}) {
  const modelData = { ...options.modelData };
  for (const sex of ['male', 'female']) {
    if (modelData[sex]) continue;
    const url = new URL(options.modelUrls?.[sex] ?? `./human-${sex}.glb`, import.meta.url);
    if (url.protocol === 'file:') {
      const buffer = await readFile(url);
      modelData[sex] = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } else {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Model request failed: ${response.status} ${url}`);
      modelData[sex] = await response.arrayBuffer();
    }
  }
  return createBrowserHumans({ ...options, modelData });
}
