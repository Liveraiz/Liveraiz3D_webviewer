/**
 * Decode CSV/text bytes: UTF-8 first, falling back to CP949 (EUC-KR),
 * which Korean Windows tools use when saving CSV (e.g. "cm³" → A9 F8).
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
export function decodeText(buffer) {
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
        return new TextDecoder("euc-kr").decode(buffer);
    }
}

/**
 * Read a File/Blob as text with encoding detection.
 * @param {Blob} file
 * @returns {Promise<string>}
 */
export async function readFileText(file) {
    return decodeText(await file.arrayBuffer());
}
