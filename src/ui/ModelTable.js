import { createGenericCsvTable, escapeTableText, parseTableCsv, readVolumeTableCsv } from './CsvTable.js';

const PROJECT_LAYOUTS = {
    LIVER_RESECTION: { method: 'createHCCTable', title: 'Liver Resection' },
    BILIARY_RESECTION: { method: 'createCCCTable', title: 'Bile Duct Resection' },
    NEPHRECTOMY: { method: 'createKTTable', title: 'Nephrectomy' },
};
const HCC_SEGMENTS = ['Whole Liver', 'Rt.lobe', 'Lt.lobe', 'RAS', 'RPS', 'LLS', 'LMS', 'Spigelian', 'Cancer'];
const CCC_SEGMENTS = ['Whole Liver', 'Rt.lobe', 'Lt.lobe', 'Spleen', 'cyst'];
const KIDNEY_SEGMENTS = ['Rt.Cortex', 'Lt.Cortex', 'Rt.Column', 'Lt.Column', 'Rt.Medulla', 'Lt.Medulla', 'Rt.Kidney', 'Lt.Kidney', 'Rt.func.V', 'Lt.func.V'];
const numeric = value => /^\s*(?:\d+(?:\.\d*)?|\.\d+)\s*(?:%|cm³|mL|ml)?\s*$/.test(value || '') && Number.isFinite(parseFloat(value));

function horizontalMeasurements(rows, required, allowed = null) {
    const headers = rows[0];
    if (rows.length !== 3 || headers[0]?.toLowerCase() !== 'measure'
        || !rows[1][0]?.toLowerCase().includes('volume') || !/percent|%/i.test(rows[2][0])) return false;
    if (!required.every(name => headers.includes(name)) || new Set(headers).size !== headers.length) return false;
    if (allowed && headers.slice(1).some(name => !allowed.includes(name))) return false;
    return rows.slice(1).every(row => row.length === headers.length && row.slice(1).every(numeric));
}

function verticalMeasurements(rows) {
    const headers = rows[0];
    const names = rows.slice(1).map(row => row[0]);
    return rows.length > 1 && headers.length === 3 && /segment/i.test(headers[0]) && /volume/i.test(headers[1])
        && /percent|%/i.test(headers[2]) && new Set(names).size === names.length
        && rows.slice(1).every(row => row.length === 3 && row[0] && row.slice(1).every(numeric));
}

/** Only opt into fixed clinical layouts when they can actually consume every provided value. */
function supportsProjectLayout(type, rows) {
    if (type === 'LIVER_RESECTION') return horizontalMeasurements(rows, HCC_SEGMENTS);
    if (type === 'BILIARY_RESECTION') {
        const allowed = [...CCC_SEGMENTS, 'Cancer'];
        if (horizontalMeasurements(rows, CCC_SEGMENTS, allowed)) return true;
        const headers = rows[0];
        if (headers.length !== 3 || !/segment/i.test(headers[0]) || !/volume/i.test(headers[1]) || !/percent|%/i.test(headers[2])) return false;
        const names = rows.slice(1).map(row => row[0]);
        return CCC_SEGMENTS.every(name => names.includes(name)) && new Set(names).size === names.length
            && rows.slice(1).every(row => row.length === 3 && allowed.includes(row[0]) && row.slice(1).every(numeric));
    }
    if (type === 'NEPHRECTOMY' || type === 'RCC') {
        const hasTumorPair = type === 'RCC' && rows.length === 13;
        if ((rows.length !== 11 && !hasTumorPair) || rows.some(row => row.length !== 2)) return false;
        const [procedure, patient] = rows[0];
        // The legacy parser indexes an object by these headers and prefers KT/LDKT/RCC keys.
        if (!['KT', 'LDKT', 'RCC', 'NEPHRECTOMY', 'Nephrectomy'].includes(procedure) || !patient
            || procedure === patient || ['KT', 'LDKT', 'RCC'].includes(patient)) return false;
        const names = rows.slice(1).filter((_, index) => index % 2 === 0).flat();
        const allowedSegments = hasTumorPair ? [...KIDNEY_SEGMENTS, 'Rt.Tumor', 'Lt.Tumor'] : KIDNEY_SEGMENTS;
        return KIDNEY_SEGMENTS.every(name => names.includes(name)) && names.every(name => allowedSegments.includes(name))
            && new Set(names).size === names.length
            && rows.slice(2).filter((_, index) => index % 2 === 0).every(row => row.every(numeric));
    }
    return false;
}

function legacyRoute(type, name) {
    if (type === 'HCC') return 'createHCCTable';
    if (type.includes('CCC')) return 'createCCCTable';
    if (type === 'LUNG') return 'createLungTable';
    if (name.includes('OTHER') && (type.includes('LDLT') || ['KT', 'LDKT', 'HVT', 'LEFT', 'OTHER', 'LT_OTHER'].includes(type))) return 'createOtherTable';
    if (type === 'KT' || type === 'LDKT' || type === 'RCC') return 'createKTTable';
    if (type.includes('LDLT')) {
        if (name.includes('SECTION')) return 'createLiver5SectionTable';
        if (name.includes('RL')) return 'createLDLTTable';
        if (name.includes('LEFT')) return 'createLeftTable';
        if (name.includes('HVT') || type.includes('HVT')) return 'createHVTTable';
        return 'createLDLTTable';
    }
    if (type === 'HVT') return 'createHVTTable';
    if (type === 'LEFT') return 'createLeftTable';
    if (type === 'OTHER' || type === 'LT_OTHER') return 'createOtherTable';
    return null;
}

/** Shared by S3/Dropbox manifests and local files; model metadata wins over broad folder hints. */
export function createModelTable(generator, csvData, model = {}, folderPath = '') {
    const source = readVolumeTableCsv(csvData);
    const generic = title => ({ html: createGenericCsvTable(source.text, title, generator.isDarkMode), surgeryType: type || null, method: 'generic' });
    let type = typeof model.case === 'string' ? model.case.trim().toUpperCase() : '';
    if (source.isVolumeTable) return { ...generic('Segment volumes'), surgeryType: 'SEGMENT_VOLUMES' };

    const name = String(model.fileName || model.name || '');
    const normalizedName = name.trim().toUpperCase();
    let inferredSection = false;
    if (!type) {
        type = generator.detectSurgeryType(name, folderPath) || '';
        if (!type && generator.inferSurgeryTypeFromCsv(source.text) === 'LDLT_SECTION') {
            type = 'LDLT';
            inferredSection = true;
        }
    }
    // RCC(신장암 절제술)는 Nephrectomy와 동일한 고정 레이아웃으로 인식/처리한다.
    const projectLayout = PROJECT_LAYOUTS[type] || (type === 'RCC' ? PROJECT_LAYOUTS.NEPHRECTOMY : undefined);
    const title = projectLayout?.title || (type === 'DDLT' ? 'Deceased Donor Liver Transplantation' : type || 'Model data');
    const rows = parseTableCsv(source.text);
    // Existing parsers split cells naively. Preserve quoted delimiters/newlines and arbitrary names in a safe generic table.
    if (!rows?.length || rows.some(row => row.some(cell => /[,\t\r\n"]/.test(cell)))) return generic(title);
    const trimmedRows = rows.filter(row => row.some(cell => cell.trim())).map(row => row.map(cell => cell.trim()));
    if (!trimmedRows.length) return generic(title);
    let method;
    if (projectLayout) {
        if (type === 'LIVER_RESECTION' && normalizedName.includes('CUSTOM') && verticalMeasurements(trimmedRows)) {
            method = 'createLungTable';
        } else if (normalizedName.includes('OTHER') && verticalMeasurements(trimmedRows)) {
            method = 'createOtherTable';
        } else {
            if (!supportsProjectLayout(type, trimmedRows)) return generic(title);
            method = projectLayout.method;
        }
    } else {
        method = inferredSection ? 'createLiver5SectionTable' : legacyRoute(type, normalizedName);
        if ((method || !type) && normalizedName.includes('CUSTOM') && verticalMeasurements(trimmedRows)) method = 'createLungTable';
        if (!method) return generic(title);
        // A plain segment-volume list cannot supply the percentages/GRWR used by these layouts.
        if (trimmedRows[0].length === 2 && /segment/i.test(trimmedRows[0][0]) && /volume/i.test(trimmedRows[0][1])
            && !['createLungTable', 'createOtherTable'].includes(method)) return generic(title);
    }
    const legacyCsv = trimmedRows.map((row, rowIndex) => row.map(cell => {
        // HCC's segment-detail renderer escapes header names itself. Values and every
        // other legacy renderer still need escaped text before their HTML interpolation.
        return method === 'createHCCTable' && rowIndex === 0 ? cell : escapeTableText(cell);
    }).join(',')).join('\r\n');
    const displayTitle = !projectLayout && (method === 'createHCCTable' || normalizedName.includes('CUSTOM')) ? name || title : title;
    return { html: generator[method](legacyCsv, escapeTableText(displayTitle)), surgeryType: type, method };
}
