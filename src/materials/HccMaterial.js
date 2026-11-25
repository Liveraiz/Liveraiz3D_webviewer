const HCC_PREPROCESSING_VERSION = 1;
// Draw translucent internal structures before the liver surface. Three.js
// still depth-tests against opaque geometry and sorts within each layer.
const HCC_RENDER_ORDER = new Map([
    ['vessel', 1],
    ['device', 2],
    ['lesion', 3],
    ['parenchyma', 4],
]);

function hasHccMetadata(object) {
    return object?.userData?.hccPreprocessingVersion === HCC_PREPROCESSING_VERSION &&
        HCC_RENDER_ORDER.has(object.userData.hccRole);
}

export function isHccMaterialMesh(mesh) {
    return mesh?.isMesh && hasHccMetadata(mesh);
}

export function prepareHccMaterials({ scene, parser }) {
    scene.traverse(mesh => {
        if (!mesh.isMesh || !mesh.material) return;

        // GLTFLoader places a multi-primitive node's extras on its parent group.
        if (!hasHccMetadata(mesh) && hasHccMetadata(mesh.parent)) {
            const primitive = parser?.associations?.get(mesh);
            const parent = parser?.associations?.get(mesh.parent);
            if (parent?.nodes !== undefined && primitive?.primitives !== undefined && primitive.meshes === parent.meshes) {
                mesh.userData.hccPreprocessingVersion = HCC_PREPROCESSING_VERSION;
                mesh.userData.hccRole = mesh.parent.userData.hccRole;
            }
        }
        if (!hasHccMetadata(mesh)) return;

        const clone = material => material.clone();
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
        mesh.renderOrder = HCC_RENDER_ORDER.get(mesh.userData.hccRole);
    });
}
