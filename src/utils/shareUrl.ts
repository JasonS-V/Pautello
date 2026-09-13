import { Score } from '../types/music';

/**
 * Compresses a Score into a URL-safe Base64 string using gzip if available
 */
export async function compressScoreToHash(score: Score): Promise<string> {
  const json = JSON.stringify(score);

  if (typeof CompressionStream !== 'undefined') {
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
      const buffer = await new Response(stream).arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return encodeURIComponent(btoa(binary));
    } catch {
      // Fallback if streaming fails
      return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
    }
  }

  // Fallback for environments without CompressionStream
  return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
}

/**
 * Decompresses a URL-safe Base64 string back into a Score
 */
export async function decompressScoreFromHash(hash: string): Promise<Score | null> {
  if (!hash || !hash.trim()) return null;

  try {
    const cleanHash = hash.startsWith('#share=')
      ? hash.slice(7)
      : hash.startsWith('#')
      ? hash.slice(1)
      : hash;

    const decodedBinary = atob(decodeURIComponent(cleanHash));

    if (typeof DecompressionStream !== 'undefined') {
      try {
        const bytes = new Uint8Array(decodedBinary.length);
        for (let i = 0; i < decodedBinary.length; i++) {
          bytes[i] = decodedBinary.charCodeAt(i);
        }
        const blob = new Blob([bytes]);
        const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
        const text = await new Response(stream).text();
        return JSON.parse(text) as Score;
      } catch {
        // Fallback if data was raw Base64
        return JSON.parse(decodeURIComponent(escape(decodedBinary))) as Score;
      }
    }

    return JSON.parse(decodeURIComponent(escape(decodedBinary))) as Score;
  } catch (err) {
    console.error('Error al decodificar partitura compartida:', err);
    return null;
  }
}
