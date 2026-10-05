export const MAKER_VOLUME_TABLE_MARKER = '# liveraiz-volume-table-v1';

export function escapeTableText(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
}

export function readVolumeTableCsv(value) {
    const text = String(value ?? '').replace(/^\uFEFF/, '');
    const lineEnd = text.search(/[\r\n]/);
    const firstLine = lineEnd < 0 ? text : text.slice(0, lineEnd);
    const isVolumeTable = firstLine === MAKER_VOLUME_TABLE_MARKER;
    return {
        isVolumeTable,
        text: isVolumeTable ? text.slice(firstLine.length).replace(/^\r?\n/, '') : text,
    };
}

/** CSV cells may contain delimiters, quotes and newlines. Do not split those names apart. */
export function parseTableCsv(value) {
    const text = String(value ?? '');
    let delimiter = ',';
    let quoted = false;
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (character === '"') {
            if (quoted && text[index + 1] === '"') index++;
            else quoted = !quoted;
        } else if (!quoted && character === '\t') {
            delimiter = '\t';
        } else if (!quoted && /[\r\n]/.test(character)) break;
    }

    const rows = [];
    let row = [];
    let cell = '';
    quoted = false;
    let afterQuote = false;
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (quoted) {
            if (character !== '"') cell += character;
            else if (text[index + 1] === '"') { cell += '"'; index++; }
            else { quoted = false; afterQuote = true; }
        } else if (character === delimiter) {
            row.push(cell); cell = ''; afterQuote = false;
        } else if (/[\r\n]/.test(character)) {
            row.push(cell); rows.push(row); row = []; cell = ''; afterQuote = false;
            if (character === '\r' && text[index + 1] === '\n') index++;
        } else if (afterQuote) return null;
        else if (character === '"') {
            if (cell.length) return null;
            quoted = true;
        } else cell += character;
    }
    if (quoted) return null;
    if (cell.length || row.length || afterQuote) { row.push(cell); rows.push(row); }
    return rows;
}

export function createGenericCsvTable(csvData, title = 'Model data', isDarkMode = false) {
    const rows = parseTableCsv(csvData);
    const heading = `<caption>${escapeTableText(title)}</caption>`;
    if (!rows) return `<h3>${escapeTableText(title)}</h3><pre style="white-space:pre-wrap">${escapeTableText(csvData)}</pre>`;
    if (rows.length === 0) return '';
    const columns = rows.reduce((width, row) => Math.max(width, row.length), 0);
    const cells = (row, tag) => Array.from({ length: columns }, (_, index) => `<${tag}>${escapeTableText(row[index])}</${tag}>`).join('');
    return `<style>
        .csv-data-table { width:100%; border-collapse:collapse; margin:16px 0; color:${isDarkMode ? '#eee' : '#222'}; }
        .csv-data-table caption { font-weight:bold; text-align:left; padding:8px 0; }
        .csv-data-table th,.csv-data-table td { border:1px solid ${isDarkMode ? '#555' : '#ddd'}; padding:8px; text-align:left; white-space:pre-wrap; overflow-wrap:anywhere; }
    </style><table class="csv-data-table">${heading}<thead><tr>${cells(rows[0], 'th')}</tr></thead><tbody>${rows.slice(1).map(row => `<tr>${cells(row, 'td')}</tr>`).join('')}</tbody></table>`;
}
