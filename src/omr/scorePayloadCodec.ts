import { Score } from '../types/music';
import { normalizeScore } from '../utils/scoreSchema';

export const PAUTELLO_PAYLOAD_PREFIX = 'PAUTELLO_V1:';
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_TEXT_KEYWORD = 'pautello';

/**
 * Codifica una cadena UTF-8 a Base64 estándar compatible con navegador y Node.js.
 */
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodifica una cadena Base64 a UTF-8.
 */
function base64ToUtf8(b64: string): string {
  const clean = b64.replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Serializa un objeto `Score` en una cadena firmada `PAUTELLO_V1:<base64>`.
 */
export function encodeScorePayload(score: Score): string {
  const json = JSON.stringify(score);
  return `${PAUTELLO_PAYLOAD_PREFIX}${utf8ToBase64(json)}`;
}

/**
 * Extrae y valida un `Score` desde cualquier texto que contenga una firma `PAUTELLO_V1:<base64>`.
 * Soporta saltos de línea o espacios intercalados por motores de extracción de texto de PDF.
 */
export function decodeScorePayloadFromText(text: string): Score | null {
  if (!text) return null;
  const idx = text.indexOf(PAUTELLO_PAYLOAD_PREFIX);
  if (idx < 0) return null;

  const afterPrefix = text.slice(idx + PAUTELLO_PAYLOAD_PREFIX.length);
  // Extraer caracteres Base64 contiguos (ignorando espacios/saltos de línea del PDF si están antes del delimitador final)
  const endMarkerIdx = afterPrefix.indexOf(':END_PAUTELLO');
  const rawSegment =
    endMarkerIdx >= 0
      ? afterPrefix.slice(0, endMarkerIdx).replace(/\s+/g, '')
      : (afterPrefix.match(/^[A-Za-z0-9+/=]+/) || [''])[0];

  if (!rawSegment) return null;

  try {
    const json = base64ToUtf8(rawSegment);
    const parsed = JSON.parse(json) as unknown;
    return normalizeScore(parsed);
  } catch {
    return null;
  }
}

/**
 * Empaqueta la carga útil con delimitador explícito para inserción en capas de texto de PDF o SVG.
 */
export function formatEmbeddedScoreMarker(score: Score): string {
  return `${encodeScorePayload(score)}:END_PAUTELLO`;
}

/* ============================================================================
 * CRC32 para chunks binarios PNG (ISO 3309 / ITU-T V.42)
 * ============================================================================ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeUint32BE(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function readUint32BE(source: Uint8Array, offset: number): number {
  return (
    ((source[offset] << 24) |
      (source[offset + 1] << 16) |
      (source[offset + 2] << 8) |
      source[offset + 3]) >>>
    0
  );
}

function hasPngSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

/**
 * Inyecta un chunk `tEXt` con la partitura codificada dentro de un binario PNG,
 * justo antes del chunk final `IEND`.
 */
export function injectScoreIntoPngBytes(pngBytes: Uint8Array, score: Score): Uint8Array {
  if (!hasPngSignature(pngBytes)) return pngBytes;

  const payload = formatEmbeddedScoreMarker(score);
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(PNG_TEXT_KEYWORD);
  const valBytes = encoder.encode(payload);

  // tEXt data = keyword + 0x00 + text
  const chunkDataLen = keyBytes.length + 1 + valBytes.length;
  const chunkTotalLen = 4 + 4 + chunkDataLen + 4; // length + type + data + crc
  const chunk = new Uint8Array(chunkTotalLen);

  writeUint32BE(chunk, 0, chunkDataLen);
  // 'tEXt' = 0x74, 0x45, 0x58, 0x74
  chunk[4] = 0x74;
  chunk[5] = 0x45;
  chunk[6] = 0x58;
  chunk[7] = 0x74;
  chunk.set(keyBytes, 8);
  chunk[8 + keyBytes.length] = 0;
  chunk.set(valBytes, 8 + keyBytes.length + 1);

  const crcInput = chunk.subarray(4, 8 + chunkDataLen);
  writeUint32BE(chunk, 8 + chunkDataLen, crc32(crcInput));

  // Localizar el inicio del chunk IEND
  let offset = 8;
  let iendOffset = -1;
  while (offset + 8 <= pngBytes.length) {
    const length = readUint32BE(pngBytes, offset);
    const type = String.fromCharCode(
      pngBytes[offset + 4],
      pngBytes[offset + 5],
      pngBytes[offset + 6],
      pngBytes[offset + 7]
    );
    if (type === 'IEND') {
      iendOffset = offset;
      break;
    }
    offset += 12 + length;
  }

  if (iendOffset < 0) return pngBytes;

  const out = new Uint8Array(pngBytes.length + chunk.length);
  out.set(pngBytes.subarray(0, iendOffset), 0);
  out.set(chunk, iendOffset);
  out.set(pngBytes.subarray(iendOffset), iendOffset + chunk.length);
  return out;
}

/**
 * Lee los chunks `tEXt` de un binario PNG y devuelve el `Score` si contiene
 * una firma válida de Pautello.
 */
export function extractScoreFromPngBytes(pngBytes: Uint8Array): Score | null {
  if (!hasPngSignature(pngBytes)) return null;

  const decoder = new TextDecoder();
  let offset = 8;
  while (offset + 8 <= pngBytes.length) {
    const length = readUint32BE(pngBytes, offset);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > pngBytes.length) break;

    const type = String.fromCharCode(
      pngBytes[offset + 4],
      pngBytes[offset + 5],
      pngBytes[offset + 6],
      pngBytes[offset + 7]
    );

    if (type === 'tEXt') {
      const data = pngBytes.subarray(dataStart, dataEnd);
      const nullIdx = data.indexOf(0);
      if (nullIdx > 0) {
        const keyword = decoder.decode(data.subarray(0, nullIdx));
        if (keyword === PNG_TEXT_KEYWORD) {
          const text = decoder.decode(data.subarray(nullIdx + 1));
          const decoded = decodeScorePayloadFromText(text);
          if (decoded) return decoded;
        }
      }
    }

    if (type === 'IEND') break;
    offset = dataEnd + 4;
  }

  return null;
}
