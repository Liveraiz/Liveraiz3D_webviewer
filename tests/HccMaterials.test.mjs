import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WebGLRenderLists } from 'three/src/renderers/webgl/WebGLRenderLists.js';
import LungVesselROI from '../src/functions/LungVesselROI.js';
import ModelLoader from '../src/loaders/ModelLoader.js';
import MaterialManager from '../src/materials/MaterialManager.js';
import MeshTooltip from '../src/ui/MeshTooltip.js';
import { ObjectListPanel } from '../src/ui/ObjectListPanel.js';

const metadata = hccRole => ({ hccPreprocessingVersion: 1, hccRole });
const primitive = material => ({ attributes: { POSITION: 0 }, material });

function createGlbFixture() {
    const definition = {
        asset: { version: '2.0' },
        scene: 0,
        scenes: [{ nodes: [0, 1, 2, 3, 4, 6], extras: { hccPreprocessingVersion: 1 } }],
        nodes: [
            { name: 'liver', mesh: 0, extras: metadata('parenchyma') },
            { name: 'legacy_surface', mesh: 0 },
            { name: 'pulmonary_vein', mesh: 0, extras: metadata('vessel') },
            { name: 'nodule_margin', mesh: 1, extras: metadata('lesion') },
            { name: 'device', mesh: 2, extras: metadata('device'), children: [5] },
            { name: 'legacy_child', mesh: 0 },
            { name: 'future_version', mesh: 0, extras: { ...metadata('vessel'), hccPreprocessingVersion: 2 } },
        ],
        meshes: [
            { primitives: [primitive(0)] },
            { primitives: [primitive(1)] },
            { primitives: [primitive(1), primitive(2)] },
        ],
        accessors: [{
            componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [0, 0, 0],
        }],
        extensionsUsed: ['KHR_materials_ior', 'KHR_materials_specular'],
        materials: [
            {
                alphaMode: 'BLEND',
                pbrMetallicRoughness: { baseColorFactor: [0.8, 0.2, 0.3, 0.17], metallicFactor: 0.03, roughnessFactor: 0.42 },
                extensions: {
                    KHR_materials_ior: { ior: 1.35 },
                    KHR_materials_specular: { specularFactor: 0.25, specularColorFactor: [0.8, 0.9, 1] },
                },
            },
            { alphaMode: 'BLEND', doubleSided: true },
            { alphaMode: 'MASK', alphaCutoff: 0.24, pbrMetallicRoughness: { baseColorFactor: [0.7, 0.6, 0.2, 0.82] } },
        ],
    };
    const json = new TextEncoder().encode(JSON.stringify(definition));
    const paddedLength = Math.ceil(json.byteLength / 4) * 4;
    const glb = new ArrayBuffer(20 + paddedLength);
    const header = new DataView(glb);
    header.setUint32(0, 0x46546c67, true);
    header.setUint32(4, 2, true);
    header.setUint32(8, glb.byteLength, true);
    header.setUint32(12, paddedLength, true);
    header.setUint32(16, 0x4e4f534a, true);
    const chunk = new Uint8Array(glb, 20);
    chunk.fill(0x20);
    chunk.set(json);
    return glb;
}

test('the Viewer keeps imported HCC GLB materials in both render paths and isolates shared materials', async t => {
    for (const method of ['log', 'warn', 'groupCollapsed', 'groupEnd', 'table']) {
        t.mock.method(console, method, () => {});
    }
    const gltf = await new GLTFLoader().parseAsync(createGlbFixture(), '');
    const findMesh = originalName => gltf.scene.children.find(child => child.userData.name === originalName);
    const liver = findMesh('liver');
    const vessel = findMesh('pulmonary_vein');
    const lesion = findMesh('nodule_margin');
    const device = findMesh('device');
    const legacy = findMesh('legacy_surface');
    const future = findMesh('future_version');
    const [deviceBlend, deviceMask, legacyChild] = device.children;
    const sharedMaterial = legacy.material;
    assert.equal(liver.material, sharedMaterial);
    assert.equal(vessel.material, sharedMaterial);

    const viewerScene = new THREE.Scene();
    const materialManager = new MaterialManager({ compile() {} });
    const loader = Object.assign(Object.create(ModelLoader.prototype), {
        scene: viewerScene,
        materialManager,
        meshes: new Map(),
        modelPath: 'ROI_RCC.glb',
        ensureModelShaderCompilation() {},
        fitCameraToObject() {},
        handleLoadError(error) { throw error; },
    });
    await loader.handleLoadSuccess(gltf);
    assert.equal(viewerScene.children[0], gltf.scene);
    assert.notEqual(liver.material, sharedMaterial);
    assert.notEqual(vessel.material, liver.material);
    assert.equal(legacy.material, sharedMaterial);
    assert.equal(legacyChild.material, sharedMaterial);
    assert.equal(legacyChild.renderOrder, 0);
    assert.equal(future.material, sharedMaterial);
    assert.equal(legacy.material.opacity, 0.6);
    assert.equal(legacy.material.alphaTest, 0.3);
    assert.equal(legacy.material.side, THREE.DoubleSide);

    const camera = new THREE.PerspectiveCamera();
    const meshes = [liver, vessel, lesion, deviceBlend, deviceMask, legacy, legacyChild, future];
    for (const pcd of [true, false]) {
        materialManager.setPCDModel(pcd);
        materialManager.updateTransparentMeshRenderOrder(camera, meshes);
        assert.equal(legacy.material.depthWrite, !pcd);
        for (const part of [liver, vessel]) {
            const material = part.material;
            assert.equal(material.type, 'MeshPhysicalMaterial');
            assert.equal(material.opacity, 0.17);
            assert.equal(material.alphaTest, 0);
            assert.equal(material.transparent, true);
            assert.equal(material.depthWrite, false);
            assert.equal(material.depthTest, true);
            assert.equal(material.side, THREE.FrontSide);
            assert.equal(material.ior, 1.35);
            assert.equal(material.specularIntensity, 0.25);
            assert.deepEqual(material.specularColor.toArray(), [0.8, 0.9, 1]);
            assert.equal(material.metalness, 0.03);
            assert.equal(material.roughness, 0.42);
            assert.deepEqual(material.color.toArray(), [0.8, 0.2, 0.3]);
        }
        assert.equal(lesion.material.transparent, true);
        assert.equal(lesion.material.depthWrite, false);
        assert.equal(lesion.material.opacity, 1);
        assert.equal(lesion.material.side, THREE.DoubleSide);
        assert.equal(deviceMask.material.alphaTest, 0.24);
        assert.equal(deviceMask.material.opacity, 0.82);
        assert.equal(deviceMask.material.transparent, false);
        assert.equal(deviceMask.material.depthWrite, true);
    }

    const renderList = new WebGLRenderLists().get(viewerScene, 0);
    for (const [z, mesh] of [liver, lesion, vessel, deviceBlend, deviceMask].entries()) {
        renderList.push(mesh, mesh.geometry, mesh.material, 0, z, null);
    }
    renderList.sort();
    assert.deepEqual(renderList.opaque.map(item => item.object), [deviceMask]);
    assert.deepEqual(renderList.transparent.map(item => item.object), [vessel, deviceBlend, lesion, liver]);

    const roi = new LungVesselROI(viewerScene, camera, { sortObjects: true });
    roi.enableLungVesselROI();
    assert.ok(roi.originalMaterials.has(legacy));
    assert.ok(!roi.originalMaterials.has(vessel));
    assert.equal(vessel.material.opacity, 0.17);
    roi.disableLungVesselROI();

    const maskedColor = deviceMask.material.color.toArray();
    assert.equal(typeof MeshTooltip.prototype.getMeshColor(deviceMask), 'string');
    assert.deepEqual(deviceMask.material.color.toArray(), maskedColor);
});

test('HCC visibility controls preserve the material alpha of every slot', () => {
    const materials = [
        new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.17, depthWrite: false }),
        new THREE.MeshStandardMaterial({ alphaTest: 0.24, opacity: 0.82 }),
    ];
    const liver = new THREE.Mesh(new THREE.BufferGeometry(), materials);
    liver.name = 'liver';
    liver.userData = metadata('parenchyma');
    const scene = new THREE.Scene().add(liver);
    const callbacks = [];
    const panel = Object.assign(Object.create(ObjectListPanel.prototype), {
        liverViewer: { scene },
        objects: new Map(),
        allObjectsVisible: true,
        contentContainer: { querySelector() { return null; } },
        getCategoryMeshes() { return [liver]; },
        onToggleObject(...args) { callbacks.push(args); },
        updateObjectList() {},
    });

    for (const toggle of [() => panel.toggleCategoryVisibility('other'), () => panel.toggleAllObjects()]) {
        toggle();
        assert.equal(liver.visible, false);
        toggle();
        assert.equal(liver.visible, true);
        assert.deepEqual(materials.map(material => material.opacity), [0.17, 0.82]);
        assert.deepEqual(materials.map(material => material.transparent), [true, false]);
        assert.deepEqual(materials.map(material => material.depthWrite), [false, true]);
    }
    assert.ok(callbacks.every(([, , opacity]) => opacity === undefined));
});
