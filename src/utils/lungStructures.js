export const LUNG_CATEGORY_ORDER = ['lobes', 'arteries', 'veins', 'bronchus', 'cancer'];

export function isGgoMeshName(name = '') {
    return /(?:^|[^a-z0-9])ggo\d*(?=$|[^a-z0-9])/i.test(name)
        || /ground[\s_-]*glass(?:[\s_-]*opacity)?/i.test(name);
}

export function getLungMeshCategory(name = '') {
    const text = String(name).toLowerCase().replace(/[_-]+/g, ' ');
    if (isGgoMeshName(name) || /cancer|tumou?r|nodule|margin|label|\bline\b/.test(text)) return 'cancer';
    // Vessel/airway names take precedence over the segment/lobe prefix.
    if (/bronch|airway|trachea|\bb\d+[a-c]?\b/.test(text)) return 'bronchus';
    if (/arter(?:y|ies)|\ba\d+[a-c]?\b/.test(text)) return 'arteries';
    if (/veins?|\bv\d+[a-c]?\b/.test(text)) return 'veins';
    if (/\b(?:rul|rml|rll|lul|lll|s(?:10|[1-9])[a-c]?)\b|lobes?|seg|remnant|preserved|target|^(?:t )?(?:(?:left|right|whole) )?lungs?$/.test(text)) return 'lobes';
    return 'other';
}

export function isLungVesselMeshName(name) {
    return ['arteries', 'veins', 'bronchus'].includes(getLungMeshCategory(name)) || /vessel|capillary/i.test(name);
}

export function isLungModel(modelName = '', meshes = []) {
    if (/(?:^|[^a-z])lung(?:$|[^a-z])/i.test(modelName)) return true;
    return meshes.some(mesh => /(?:^|[^a-z])(?:rul|rml|rll|lul|lll|bronchus|bronchi|airways?)(?:$|[^a-z])/i.test(mesh.name)
        || isGgoMeshName(mesh.name));
}

export function getLungCategory(mesh) {
    // An explicitly named child wins; unnamed branches inherit their nearest anatomical parent.
    for (let object = mesh; object; object = object.parent) {
        const category = getLungMeshCategory(object.name);
        if (category !== 'other') return category;
    }
    return 'other';
}

export function compareLungMeshes(a, b) {
    const rank = mesh => {
        if (/vol/i.test(mesh.name)) return LUNG_CATEGORY_ORDER.length + 1;
        const index = LUNG_CATEGORY_ORDER.indexOf(getLungCategory(mesh));
        return index < 0 ? LUNG_CATEGORY_ORDER.length : index;
    };
    return rank(a) - rank(b) || a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' });
}
