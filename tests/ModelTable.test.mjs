import test from 'node:test';
import assert from 'node:assert/strict';
import { TableGenerator } from '../src/ui/TableGenerator.js';
import { createModelTable } from '../src/ui/ModelTable.js';
import { MAKER_VOLUME_TABLE_MARKER, parseTableCsv, createGenericCsvTable } from '../src/ui/CsvTable.js';
import { normalizeViewerManifest, updateSignedViewerUrls } from '../src/services/ViewerModelManifestService.js';

const horizontalLiver = [
    'Measure,Whole Liver,Rt.lobe,Lt.lobe,RAS,RPS,LLS,LMS,Spigelian,Cancer',
    'Volume (cm³),1234.5,700,534.5,350,350,300,234.5,10,2.5',
    '% to WLV,100,56.7,43.3,28.35,28.35,24.3,19,0.81,0.2',
].join('\n');
const biliary = 'Segment,Volume (cm³),Percentage (%)\nWhole Liver,1000,100\nRt.lobe,600,60\nLt.lobe,400,40\nSpleen,120,12\ncyst,5,0.5\nCancer,3,0.3';
const kidney = ['KT,Patient', 'Rt.Cortex,Lt.Cortex', '110,120', 'Rt.Column,Lt.Column', '20,22',
    'Rt.Medulla,Lt.Medulla', '30,32', 'Rt.Kidney,Lt.Kidney', '160,174', 'Rt.func.V,Lt.func.V', '150,160'].join('\n');
const volumeList = 'Segment,Volume (cm³)\nCustom region,12.345\nAnother region,0';

function generator(t) {
    t.mock.method(console, 'log', () => {});
    return new TableGenerator();
}

test('Maker marker takes precedence over every case and filename, with no derived clinical metrics', t => {
    const tables = generator(t);
    const csv = `${MAKER_VOLUME_TABLE_MARKER}\n${volumeList}`;
    for (const caseType of ['HCC', 'CCC', 'LDLT', 'DDLT', 'KT', 'LDKT', 'LUNG', 'LIVER_RESECTION', 'BILIARY_RESECTION', 'NEPHRECTOMY', 'unknown']) {
        const result = createModelTable(tables, csv, { case: caseType, name: 'CUSTOM_HVT_SECTION' });
        assert.equal(result.surgeryType, 'SEGMENT_VOLUMES');
        assert.equal(result.method, 'generic');
        assert.match(result.html, /<td>Custom region<\/td><td>12\.345<\/td>/);
        assert.match(result.html, /<td>Another region<\/td><td>0<\/td>/);
        assert.doesNotMatch(result.html, /GRWR|Whole Liver|% to WLV|0\.00%/);
    }
    assert.match(tables.autoCreateTable(`\uFEFF${csv.replaceAll('\n', '\r\n')}`, 'LUNG_CUSTOM.csv').html, /Segment volumes/);
});

test('CSV parser preserves quoted delimiters, doubled quotes, newlines, empty and trailing cells', () => {
    assert.deepEqual(parseTableCsv('Segment,Value,Notes\r\n"Left, ""branch""\nline",12.3,\r\nOther,,end'), [
        ['Segment', 'Value', 'Notes'], ['Left, "branch"\nline', '12.3', ''], ['Other', '', 'end'],
    ]);
    assert.deepEqual(parseTableCsv('Segment\tVolume\nA\t1'), [['Segment', 'Volume'], ['A', '1']]);
    assert.deepEqual(parseTableCsv('""'), [['']]);
});

test('malformed CSV quotes keep the escaped original data instead of changing a value', () => {
    for (const csv of ['Segment,Value\nA,"1"2', 'Segment,Value\nA,1"2', 'Segment,Value\nA,"1" 2']) {
        assert.equal(parseTableCsv(csv), null);
        const html = createGenericCsvTable(csv);
        assert.match(html, /<pre /);
        assert.ok(html.includes(csv.replaceAll('"', '&quot;')));
        assert.doesNotMatch(html, /<td>12<\/td>/);
    }
});

test('generic Maker rows escape markup while preserving names and exact volume strings', t => {
    const csv = `${MAKER_VOLUME_TABLE_MARKER}\nSegment,Volume (cm³)\n"A, ""quoted""\n<img src=x onerror=alert(1)> & B",12.345`;
    const { html } = createModelTable(generator(t), csv, { case: 'LUNG' });
    assert.match(html, /A, &quot;quoted&quot;\n&lt;img src=x onerror=alert\(1\)&gt; &amp; B/);
    assert.match(html, /<td>12\.345<\/td>/);
    assert.doesNotMatch(html, /<img|<script/);
    const malformed = createGenericCsvTable('Name,Value\n"unclosed <script>,9', '<unsafe>');
    assert.match(malformed, /&lt;unsafe&gt;/);
    assert.match(malformed, /&quot;unclosed &lt;script&gt;,9/);
});

test('project procedure keys select compatible legacy layouts with full purpose titles', t => {
    const tables = generator(t);
    for (const [caseType, csv, title, css, value] of [
        ['LIVER_RESECTION', horizontalLiver, 'Liver Resection', 'hcc-table', '1234.5cm³'],
        ['BILIARY_RESECTION', biliary, 'Bile Duct Resection', 'ccc-table', '1000.0cm³'],
        ['NEPHRECTOMY', kidney, 'Neph', 'kt-table', '110.0cm³'],
    ]) {
        const { html, method } = createModelTable(tables, csv, { case: caseType, name: 'Model' });
        assert.notEqual(method, 'generic');
        assert.ok(html.includes(title));
        assert.ok(html.includes(css));
        assert.ok(html.includes(value));
    }
    const ccc = createModelTable(tables, biliary, { case: 'BILIARY_RESECTION', name: 'Model' });
    assert.match(ccc.html, /5\.0cm³/);
    assert.match(ccc.html, /0\.5%/);
});

test('CCC cyst values are shown when the CSV spells cyst with different capitalization', t => {
    const tables = generator(t);
    for (const spelling of ['cyst', 'Cyst', 'CYST']) {
        const vertical = biliary.replace('\ncyst,5,0.5', `\n${spelling},5,0.5`);
        const horizontal = [
            `Measure,Whole Liver,Rt.lobe,Lt.lobe,Spleen,${spelling}`,
            'Volume (cm³),1000,600,400,120,5',
            '% to WLV,100,60,40,12,0.5',
        ].join('\n');
        for (const csv of [vertical, horizontal]) {
            for (const caseType of ['BILIARY_RESECTION', 'CCC']) {
                const result = createModelTable(tables, csv, { case: caseType, name: 'Model' });
                assert.equal(result.method, 'createCCCTable', `${spelling} ${caseType}`);
                assert.match(result.html, /#B8E6B8;'>cyst<\/th>/);
                assert.match(result.html, /5\.0cm³/);
                assert.match(result.html, /0\.5%/);
                assert.doesNotMatch(result.html, />0cm³<\/td>|>0\.00%<\/td>/);
            }
        }
    }
});

test('CCC layout shows Lt.lobe-S1 and Spigelian rows', t => {
    const tables = generator(t);
    const vertical = 'Segment,Volume (cm³),Percentage (%)\nWhole Liver,1022.6,100\nRt.lobe,811.0,79.31\nLt.lobe-S1,190.0,18.58\nSpigelian,21.5,2.11\nSpleen,147.2,14.39\ncyst,0.4,0.04\nCancer,8.8,0.86';
    const horizontal = [
        'Measure,Whole Liver,Rt.lobe,Lt.lobe-S1,Spigelian,Spleen,cyst,Cancer',
        'Volume (cm³),1022.6,811.0,190.0,21.5,147.2,0.4,8.8',
        '% to WLV,100,79.31,18.58,2.11,14.39,0.04,0.86',
    ].join('\n');

    const lowercase = vertical.replace('Lt.lobe-S1', 'lt.lobe-s1').replace('Spigelian', 'spigelian');
    for (const caseType of ['CCC', 'BILIARY_RESECTION']) {
        for (const csv of [vertical, horizontal, lowercase]) {
            const { html, method } = createModelTable(tables, csv, { case: caseType, name: 'Model' });
            assert.equal(method, 'createCCCTable');
            const order = ['Whole Liver', 'Rt.lobe', 'Lt.lobe-S1', 'Spigelian', 'Cancer', 'Spleen', 'cyst']
                .map(name => html.indexOf(`>${name}</th>`));
            assert.ok(order.every((index, i) => index > 0 && (i === 0 || index > order[i - 1])), order.join());
            for (const value of ['1022.6cm³', '147.2cm³', '0.4cm³', '14.39%', '0.04%', '811.0cm³', '190.0cm³',
                '79.31%', '18.58%', '21.5cm³', '2.11%', '8.8cm³', '0.86%']) assert.ok(html.includes(value), value);
            assert.match(html, /#C8E6C9;'>Spigelian<\/th>/);
            assert.match(html, /#FFFFD5;'>Lt\.lobe-S1<\/th>/);
        }
    }
});

test('CCC cases split into sections use the HCC-style section layout', t => {
    const tables = generator(t);
    const withLobes = ['Segment,Volume (cm³),Percentage (%)', 'Whole Liver,1000,100', 'Rt.lobe,600,60', 'Lt.lobe,380,38',
        'RAS,250,25', 'RPS,350,35', 'LLS,200,20', 'LMS,180,18', 'Spigelian,20,2', 'Spleen,120,12', 'cyst,5,0.5', 'Cancer,3,0.3'].join('\n');
    const sectionsOnly = withLobes.replace('\nRt.lobe,600,60\nLt.lobe,380,38', '').replace('\nSpigelian,20,2', '').replace('RAS', 'ras');
    const horizontal = [
        'Measure,Whole Liver,Rt.lobe,Lt.lobe-S1,RAS,RPS,LLS,LMS,Spigelian,Spleen,cyst,Cancer',
        'Volume (cm³),1000,600,380,250,350,200,180,20,120,5,3',
        '% to WLV,100,60,38,25,35,20,18,2,12,0.5,0.3',
    ].join('\n');
    for (const caseType of ['CCC', 'BILIARY_RESECTION']) {
        for (const csv of [withLobes, horizontal, sectionsOnly]) {
            const { html, method } = createModelTable(tables, csv, { case: caseType, name: 'Model' });
            assert.equal(method, 'createCCCTable');
            const lobes = csv === sectionsOnly ? [] : ['Rt\.lobe', 'Lt\.lobe(-S1)?'];
            const expected = ['Whole Liver', ...lobes, 'RAS', 'LLS', 'RPS', 'LMS', ...(lobes.length ? ['Spigelian'] : []), 'Cancer', 'Spleen', 'cyst'];
            const order = expected.map(name => html.search(new RegExp(`>${name}</th>`)));
            assert.ok(order.every((index, i) => index > 0 && (i === 0 || index > order[i - 1])), order.join());
            assert.match(html, /#FFC1CC;'>RAS<\/th>/);
            for (const value of ['250.0cm³', '25%', '350.0cm³', '200.0cm³', '180.0cm³', '18%', '3.0cm³']) assert.ok(html.includes(value), value);
            assert.doesNotMatch(html, />0cm³<\/td>|>0\.00%<\/td>/);
        }
    }
    for (const csv of [
        withLobes.replace('\nLMS,180,18', ''),
        withLobes.replace('\nLt.lobe,380,38', ''),
        sectionsOnly.replace('\nSpleen,120,12', ''),
    ]) assert.equal(createModelTable(tables, csv, { case: 'CCC', name: 'Model' }).method, 'generic');
});

test('section-split CCC cases without a cyst use the Liver Resection table', t => {
    const tables = generator(t);
    // NSU_CCC: sections and lobes with Spleen last and no cyst column.
    const csv = [
        '﻿Measure,Whole Liver,Rt.lobe,Lt.lobe,RAS,RPS,LLS,LMS,Spigelian,Cancer,Spleen',
        'Volume (cm³),1456.3,925.3,527.0,565.4,359.9,279.3,215.7,32.0,7.5,150.4',
        '% to WLV,100.00,63.54,36.19,38.82,24.71,19.18,14.81,2.19,0.52,10.33',
    ].join('\r\n');
    for (const caseType of ['CCC', 'BILIARY_RESECTION']) {
        const { html, method } = createModelTable(tables, csv, { case: caseType, name: 'NSU_CCC' });
        assert.equal(method, 'createHCCTable');
        assert.match(html, /Liver Resection/);
        assert.match(html, /Spleen Volume/);
        assert.doesNotMatch(html, /seg-detail-table'/);
        for (const value of ['150.4cm³', '565.4cm³', '279.3cm³', '7.5cm³', '32.0cm³']) assert.ok(html.includes(value), value);
    }
    assert.equal(createModelTable(tables, biliary.replace('\ncyst,5,0.5', ''), { case: 'CCC', name: 'Model' }).method, 'createCCCTable');
});

test('CCC extended right lobe and remnant use the dedicated table without losing values', t => {
    const tables = generator(t);
    const horizontal = [
        'Measure,Whole Liver,Spigelian,Cancer,Spleen,ext_Rt.lobe,Remnant',
        'Volume (cm³),1676.5,39.9,3.3,148.7,1031.7,644.9',
        '% to WLV,100.00,2.38,0.20,8.87,61.54,38.46',
    ].join('\n');
    const rows = parseTableCsv(horizontal);
    const vertical = ['Segment,Volume (cm³),Percentage (%)', ...rows[0].slice(1)
        .map((name, index) => `${name},${rows[1][index + 1]},${rows[2][index + 1]}`)].join('\n');
    const sections = `${vertical}\nRAS,250,25\nRPS,350,35\nLLS,200,20\nLMS,180,18`;
    for (const caseType of ['CCC', 'BILIARY_RESECTION']) {
        for (const csv of [horizontal, vertical, sections, vertical.replace('ext_Rt.lobe', 'EXT_RT.LOBE').replace('Remnant', 'remnant')]) {
            const { html, method } = createModelTable(tables, csv, { case: caseType });
            assert.equal(method, 'createCCCTable');
            assert.match(html, />ext_Rt\.lobe<\/th>/);
            assert.match(html, />Remnant<\/th>/);
            assert.match(html, />Spigelian<\/th><th[^>]*>Cancer<\/th><\/tr>/);
            assert.match(html, /<tr><th[^>]*>Spleen<\/th><th[^>]*><\/th><\/tr><tr><td[^>]*>148\.7cm³<\/td><td[^>]*><\/td><\/tr><tr><td[^>]*>8\.87%<\/td><td[^>]*><\/td><\/tr><\/tbody>/);
            for (const value of ['1031.7cm³', '644.9cm³', '61.54%', '38.46%', '39.9cm³', '3.3cm³', '148.7cm³']) {
                assert.ok(html.includes(value), value);
            }
            assert.doesNotMatch(html, />Lt\.lobe<\/th>/);
        }
    }
    for (const csv of [vertical, sections]) {
        for (const extra of ['Rt.lobe,500,30', 'Lt.lobe,400,24']) {
            assert.equal(createModelTable(tables, `${csv}\n${extra}`, { case: 'CCC' }).method, 'generic');
        }
    }
    const zero = createModelTable(tables, vertical.replace('Remnant,644.9,38.46', 'Remnant,0,0'), { case: 'CCC' });
    assert.equal(zero.method, 'createCCCTable');
    assert.match(zero.html, />Remnant<\/th>/);
    assert.match(zero.html, />0\.0cm³<\/td>/);
});

test('CCC case falls back to the original CSV instead of showing missing, duplicate or unknown segments as 0', t => {
    const tables = generator(t);
    for (const csv of [
        biliary.replace('\nSpleen,120,12', ''),
        biliary.replace('Lt.lobe,400,40', 'Lt.lobe,400,40\nLt.lobe-S1,390,39'),
        `${biliary}\nExtra unknown segment,7,0.7`,
    ]) {
        for (const caseType of ['CCC', 'BILIARY_RESECTION']) {
            const { method, html } = createModelTable(tables, csv, { case: caseType, name: 'Model' });
            assert.equal(method, 'generic');
            assert.doesNotMatch(html, /0cm³|0\.00%/);
        }
    }
});

test('incompatible, incomplete, or additional unhandled project CSV fields are retained as a generic table', t => {
    const tables = generator(t);
    for (const caseType of ['LIVER_RESECTION', 'BILIARY_RESECTION', 'NEPHRECTOMY']) {
        const result = createModelTable(tables, volumeList, { case: caseType });
        assert.equal(result.method, 'generic');
        assert.match(result.html, /<td>Custom region<\/td><td>12\.345<\/td>/);
        assert.doesNotMatch(result.html, /0cm³|0\.00%/);
    }
    assert.equal(createModelTable(tables, biliary + '\nExtra unknown segment,7,0.7', { case: 'BILIARY_RESECTION' }).method, 'generic');
    assert.equal(createModelTable(tables, horizontalLiver.replace(',1234.5,', ',missing,'), { case: 'LIVER_RESECTION' }).method, 'generic');
    assert.equal(createModelTable(tables, kidney + '\nAdditional,segment\n1,2', { case: 'NEPHRECTOMY' }).method, 'generic');
    const scientificKidney = createModelTable(tables, kidney.replace('110,120', '1.1e2,120'), { case: 'NEPHRECTOMY' });
    assert.equal(scientificKidney.method, 'generic');
    assert.match(scientificKidney.html, /<td>1\.1e2<\/td>/);
});

test('Nephrectomy does not feed duplicate, empty or conflicting headers into the legacy object parser', t => {
    const tables = generator(t);
    for (const header of ['KT,KT', 'KT,', ',Patient', 'Other,Patient', 'KT,LDKT', 'Nephrectomy,KT']) {
        const { html, method } = createModelTable(tables, kidney.replace('KT,Patient', header), { case: 'NEPHRECTOMY' });
        assert.equal(method, 'generic');
        assert.match(html, /<td>110<\/td><td>120<\/td>/);
        assert.doesNotMatch(html, /0cm³/);
    }
    assert.equal(createModelTable(tables, kidney.replace('KT,Patient', 'Nephrectomy,Patient'), { case: 'NEPHRECTOMY' }).method, 'createKTTable');
});

test('RCC tables include and color paired tumor volumes', t => {
    const tables = generator(t);
    const rcc = `${kidney.replace('KT,Patient', 'RCC,KTS')}\nRt.Tumor,Lt.Tumor\n21.5,0`;
    const { html, method } = createModelTable(tables, rcc, { case: 'RCC' });
    assert.equal(method, 'createKTTable');
    assert.match(html, /Rt\.Tumor/);
    assert.match(html, /Lt\.Tumor/);
    assert.match(html, /background-color: #FFDFC1;'>Rt\.Tumor/);
    assert.match(html, /background-color: #FFFFD5;'>Lt\.Tumor/);
    assert.match(html, /21\.5cm³/);
    assert.match(html, /0\.0cm³/);

    assert.equal(createModelTable(tables, `${kidney}\nRt.Tumor,Lt.Tumor\n21.5,0`, { case: 'NEPHRECTOMY' }).method, 'generic');
});

test('HCC extra segment names are escaped once, including HTML and entity-looking text', t => {
    const tables = generator(t);
    const csv = horizontalLiver.split('\n').map((row, index) => `${row},${['A & B,<script>alert(1)</script>,A &amp; B', '1,2,3', '0.1,0.2,0.3'][index]}`).join('\n');
    for (const caseType of ['HCC', 'LIVER_RESECTION']) {
        const { html, method } = createModelTable(tables, csv, { case: caseType, name: '<unsafe title>' });
        assert.equal(method, 'createHCCTable');
        assert.match(html, />A &amp; B<\/th>/);
        assert.match(html, />&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/th>/);
        assert.match(html, />A &amp;amp; B<\/th>/);
        assert.doesNotMatch(html, /<script>|<unsafe title>|&amp;lt;script/);
    }
});

test('DDLT and unknown cases do not fall through to another clinical table', t => {
    const tables = generator(t);
    for (const caseType of ['DDLT', 'PANCREAS', '<script>bad</script>']) {
        const { method, html } = createModelTable(tables, 'Original,Value,Note\nLabel,17.8,keep me', { case: caseType, name: 'CUSTOM_HCC_SECTION' }, 'LDLT');
        assert.equal(method, 'generic');
        assert.match(html, /<td>Label<\/td><td>17\.8<\/td><td>keep me<\/td>/);
        assert.doesNotMatch(html, /<script>|0cm³/);
    }
});

test('legacy explicit cases and model-specific Section/RL/HVT/Left/CUSTOM/OTHER routing remain independent', t => {
    const tables = generator(t);
    const routes = [
        ['HCC', 'CUSTOM', 'createLungTable'], ['HCC', 'Section', 'createHCCTable'],
        ['CCC', 'CUSTOM', 'createLungTable'], ['', 'CUSTOM', 'createLungTable'],
        ['LUNG', 'Model', 'createLungTable'],
        ['KT', 'Model', 'createKTTable'], ['LDKT', 'Model', 'createKTTable'],
        ['LDLT', '5-Section', 'createLiver5SectionTable'], ['LDLT', 'RL', 'createLDLTTable'],
        ['LDLT', 'HVT', 'createHVTTable'], ['LDLT', 'Left', 'createLeftTable'],
        ['LDLT', 'OTHER', 'createOtherTable'], ['HVT', 'Model', 'createHVTTable'],
        ['LDLT RL', 'OTHER', 'createOtherTable'], ['LDLT HVT', 'OTHER', 'createOtherTable'],
    ];
    for (const method of new Set(routes.map(row => row[2]))) t.mock.method(tables, method, (_csv, title) => title);
    for (const [caseType, name, method] of routes) {
        assert.equal(createModelTable(tables, 'Segment,Volume,Percentage\nA,10,100', { case: caseType, name }, 'LDLT folder').method, method);
    }
    assert.equal(createModelTable(tables, biliary, { case: 'CCC', name: 'Model' }, 'LDLT folder').method, 'createCCCTable');
    assert.equal(createModelTable(tables, horizontalLiver, { case: 'HCC', name: 'Section' }, 'LDLT folder').surgeryType, 'HCC');
});

test('new liver CUSTOM and OTHER layouts require compatible vertical measurements', t => {
    const tables = generator(t);
    const csv = 'Segment,Volume (cm³),Percentage (%)\nROI,3.2,20\nRemaining,12.8,80';
    for (const [name, method] of [['CUSTOM', 'createLungTable'], ['OTHER', 'createOtherTable']]) {
        const result = createModelTable(tables, csv, { case: 'LIVER_RESECTION', name });
        assert.equal(result.method, method);
        assert.match(result.html, /Liver Resection/);
        assert.match(result.html, /3\.2cm³/);
        assert.equal(createModelTable(tables, volumeList, { case: 'LIVER_RESECTION', name }).method, 'generic');
    }
});

test('Liver Resection models named CCC use the CCC layout when the CSV fits it', t => {
    const tables = generator(t);
    for (const name of ['CCC', 'Patient_ccc_model']) {
        const result = createModelTable(tables, biliary, { case: 'LIVER_RESECTION', name });
        assert.equal(result.method, 'createCCCTable');
        assert.match(result.html, /ccc-table/);
        assert.match(result.html, /Liver Resection/);
        assert.match(result.html, /5\.0cm³/);
    }
    assert.equal(createModelTable(tables, horizontalLiver, { case: 'LIVER_RESECTION', name: 'CCC' }).method, 'createHCCTable');
    assert.equal(createModelTable(tables, biliary, { case: 'LIVER_RESECTION', name: 'Model' }).method, 'generic');
});

test('JSON CUSTOM case uses the custom table layout for compatible vertical measurements', t => {
    const tables = generator(t);
    const csv = 'Segment,Volume (cm³),Percentage (%)\nROI,3.2,20\nRemaining,12.8,80';

    const result = createModelTable(tables, csv, { case: 'custom', name: 'Model' });
    assert.equal(result.surgeryType, 'CUSTOM');
    assert.equal(result.method, 'createLungTable');
    assert.match(result.html, /<th colspan='2' class='surgery-header'>CUSTOM<\/th>/);
    assert.match(result.html, /3\.2cm³/);

    const incompatible = createModelTable(tables, volumeList, { case: 'CUSTOM', name: 'Model' });
    assert.equal(incompatible.method, 'generic');
    assert.match(incompatible.html, /<td>Custom region<\/td><td>12\.345<\/td>/);
});

test('multiple manifest models retain their case-specific tables after URL refresh', t => {
    const tables = generator(t);
    const { models } = normalizeViewerManifest({ models: [
        { modelId: 1, case: 'LIVER_RESECTION', name: 'Liver', glbUrl: 'old-1', tableUrl: 'old-csv-1' },
        { modelId: 2, case: 'NEPHRECTOMY', name: 'Kidney', glbUrl: 'old-2', tableUrl: 'old-csv-2' },
    ] });
    const references = [...models];
    updateSignedViewerUrls(models, { models: models.map(model => ({ ...model, glbUrl: `new-${model.modelId}`, tableUrl: `new-csv-${model.modelId}` })) });
    assert.equal(models[0], references[0]);
    assert.equal(models[1], references[1]);
    assert.equal(models[1].tableUrl, 'new-csv-2');
    assert.match(createModelTable(tables, horizontalLiver, models[0]).html, /Liver Resection/);
    assert.match(createModelTable(tables, kidney, models[1]).html, /Neph/);
});
