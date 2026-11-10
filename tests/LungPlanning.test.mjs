import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { compareLungMeshes, getLungCategory, getLungMeshCategory, isGgoMeshName, isLungModel } from '../src/utils/lungStructures.js';
import { applyGgoStyle, GgoMaterial } from '../src/materials/GgoMaterial.js';
import LungVesselROI from '../src/functions/LungVesselROI.js';
import MaterialManager from '../src/materials/MaterialManager.js';

const mesh = (name, material = new THREE.MeshStandardMaterial()) => {
    const result = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material);
    result.name = name;
    return result;
};

test('lung ordering follows anatomy before opacity and naturally orders numbered branches', () => {
    const meshes = ['Cancer', 'bronchus', 'Pul_veins', 'S8_arteries', 'A10', 'A2', 'RUL', 'GGO_1', 'Unknown', 'RUL_vol'].map(name => mesh(name));
    assert.deepEqual(meshes.sort(compareLungMeshes).map(m => m.name),
        ['RUL', 'A2', 'A10', 'S8_arteries', 'Pul_veins', 'bronchus', 'Cancer', 'GGO_1', 'Unknown', 'RUL_vol']);
    assert.equal(getLungMeshCategory('RUL_S8_veins'), 'veins');
    assert.equal(getLungMeshCategory('LUL_bronchi'), 'bronchus');
    assert.equal(getLungMeshCategory('mass1'), 'other');
    assert.equal(getLungCategory({ name: 'branch', parent: { name: 'Pul_arteries' } }), 'arteries');
    assert.equal(getLungCategory({ name: 'lymph_node', parent: { name: 'ROI_LUNG' } }), 'other');
    for (const name of ['Seg', 'Seg8', 'seg10a', 'RULseg1', 'LUL_segment_3', 'Remnant', 'RULremnant', 'seg8_remnant']) {
        assert.equal(getLungMeshCategory(name), 'lobes', name);
    }
    assert.equal(getLungMeshCategory('Seg8_arteries'), 'arteries');
    assert.equal(getLungMeshCategory('Remnant_veins'), 'veins');
    assert.equal(getLungMeshCategory('Seg8_bronchus'), 'bronchus');
    assert.equal(getLungMeshCategory('Seg8_GGO'), 'cancer');
});

test('lung detection accepts local filenames and anatomy without changing liver/kidney lists', () => {
    for (const name of ['ROI_LUNG.glb', 'R_ROI_LUNG', 'patient-LUNG-2.gltf']) assert.equal(isLungModel(name), true);
    assert.equal(isLungModel('case.glb', [{ name: 'RUL_preserved' }]), true);
    assert.equal(isLungModel('case.glb', [{ name: 'T_GGO_1' }]), true);
    for (const name of ['Liver', 'kidney', 'Right_lobe', 'S1', 'arteries']) assert.equal(isLungModel('', [{ name }]), false);
});

test('only explicitly named GGO regions receive cloud styling, including multi-material meshes', () => {
    for (const name of ['GGO', 'ggo1', 'T_GGO_2', 'GGO.001']) assert.equal(isGgoMeshName(name), true);
    for (const name of ['cancer', 'infiltration', 'nodule', 'eggocyte', 'ground glass', 'ground-glass opacity', 'ground_glass']) assert.equal(isGgoMeshName(name), false);
    const shared = new THREE.MeshStandardMaterial({ color: 'red' });
    const solid = mesh('Cancer', shared);
    const ggo = mesh('GGO', [shared, shared]);
    const positions = ggo.geometry.attributes.position.array.slice();
    assert.equal(applyGgoStyle(solid), false);
    assert.equal(applyGgoStyle(ggo), true);
    assert.equal(solid.material, shared);
    assert.deepEqual(ggo.geometry.attributes.position.array, positions);
    for (const material of ggo.material) {
        assert.ok(material instanceof GgoMaterial);
        const clone = material.clone();
        const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
        clone.onBeforeCompile(shader);
        assert.match(shader.fragmentShader, /diffuseColor.a \*=/);
        assert.equal(clone.customProgramCacheKey(), material.customProgramCacheKey());
        assert.ok(Number.isFinite(shader.uniforms.ggoScale.value));
    }
});

test('ROI repeats, opacity edits, disposal and GGO shader restoration stay synchronized', t => {
    for (const method of ['log', 'warn', 'debug', 'groupCollapsed', 'groupEnd', 'table']) t.mock.method(console, method, () => {});
    const scene = new THREE.Scene();
    const ggo = mesh('GGO');
    applyGgoStyle(ggo);
    const other = mesh('RUL', [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()]);
    const cancer = mesh('Cancer');
    const artery = mesh('A2');
    scene.add(ggo, other, cancer, mesh('bronchus'), artery);
    const original = ggo.material;
    const states = [];
    const roi = new LungVesselROI(scene, new THREE.PerspectiveCamera(), { sortObjects: true }, { onStateChange: active => states.push(active) });
    for (let i = 0; i < 2; i++) {
        roi.enableLungVesselROI();
        roi.enableLungVesselROI();
        assert.equal(roi.originalMaterials.get(ggo), original);
        assert.ok(roi.nodulesExceptionMeshes.includes(cancer));
        assert.ok(roi.lungVesselMeshes.includes(artery));
        assert.ok(ggo.material instanceof GgoMaterial);
        assert.equal(ggo.material.depthTest, true);
        let disposed = false;
        ggo.material.addEventListener('dispose', () => { disposed = true; });
        ggo.material.opacity = 0.4;
        roi.disableLungVesselROI();
        roi.disableLungVesselROI();
        assert.equal(ggo.material, original);
        assert.equal(original.opacity, 0.4);
        assert.equal(disposed, true);
        assert.equal(roi.originalMaterials.size, 0);
    }
    assert.deepEqual(states, [true, false, true, false]);
});

test('per-frame transparency management preserves GGO even at full and zero slider opacity', () => {
    const manager = Object.create(MaterialManager.prototype);
    const ggo = mesh('GGO');
    applyGgoStyle(ggo);
    for (const pcd of [false, true]) {
        manager.isPCDModel = pcd;
        for (const opacity of [0, 0.3, 1]) {
            ggo.material.opacity = opacity;
            manager.updateTransparentMeshRenderOrder(new THREE.PerspectiveCamera(), [ggo]);
            assert.equal(ggo.material.transparent, true);
            assert.equal(ggo.material.depthWrite, false);
            assert.equal(ggo.material.depthTest, true);
            assert.equal(ggo.material.opacity, opacity);
        }
    }
});
