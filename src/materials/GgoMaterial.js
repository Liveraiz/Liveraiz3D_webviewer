import * as THREE from 'three';
import { isGgoMeshName } from '../utils/lungStructures.js';

// Stable object-space texture: no animation, UV dependency, or displacement of the segmentation.
const noiseGLSL = `
varying vec3 vGgoPosition;
uniform vec3 ggoCenter;
uniform float ggoScale;
float ggoHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float ggoNoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(ggoHash(i), ggoHash(i + vec3(1,0,0)), f.x),
                   mix(ggoHash(i + vec3(0,1,0)), ggoHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(ggoHash(i + vec3(0,0,1)), ggoHash(i + vec3(1,0,1)), f.x),
                   mix(ggoHash(i + vec3(0,1,1)), ggoHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

export class GgoMaterial extends THREE.MeshStandardMaterial {
    constructor(source = null, center = new THREE.Vector3(), scale = 1) {
        super();
        if (source?.isMeshStandardMaterial) this.copy(source);
        this.color.set('#e1ebed');
        this.emissive.set('#c0d4db');
        this.emissiveIntensity = 0.12;
        this.roughness = 0.95;
        this.metalness = 0;
        this.map = null;
        this.alphaMap = null;
        this.normalMap = null;
        this.bumpMap = null;
        this.displacementMap = null;
        this.transparent = true;
        this.opacity = 0.68;
        this.alphaTest = 0;
        this.depthWrite = false;
        this.depthTest = true;
        this.side = THREE.DoubleSide;
        this.forceSinglePass = true;
        this.userData.isGgoMaterial = true;
        this.userData.ggoCenter = center.toArray();
        this.userData.ggoScale = scale;
        this.userData._baseTransparent = true;
        this.userData._baseDepthWrite = false;
        this.userData.originalOpacity = this.opacity;
    }

    // Prototype hooks survive Three.js material.clone(), including ROI/see-through transitions.
    customProgramCacheKey() { return 'ggo-cloud-v1'; }

    onBeforeCompile(shader) {
        shader.uniforms.ggoCenter = { value: new THREE.Vector3().fromArray(this.userData.ggoCenter) };
        shader.uniforms.ggoScale = { value: this.userData.ggoScale };
        shader.vertexShader = `varying vec3 vGgoPosition;\n${shader.vertexShader}`.replace(
            '#include <begin_vertex>', '#include <begin_vertex>\nvGgoPosition = position;'
        );
        shader.fragmentShader = `${noiseGLSL}\n${shader.fragmentShader}`.replace(
            '#include <normal_fragment_maps>',
            `#include <normal_fragment_maps>
            vec3 ggoP = (vGgoPosition - ggoCenter) * ggoScale;
            float cloud = 0.65 * ggoNoise(ggoP * 4.0) + 0.35 * ggoNoise(ggoP * 11.0);
            float wisps = 1.0 - smoothstep(0.03, 0.17, abs(ggoNoise(ggoP * 17.0) - 0.5));
            float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
            float softEdge = mix(0.28, 1.0, smoothstep(0.0, 0.5, facing));
            diffuseColor.rgb *= mix(0.72, 1.12, cloud) + 0.08 * wisps;
            diffuseColor.a *= clamp((0.25 + 0.65 * cloud + 0.1 * wisps) * softEdge, 0.08, 0.9);`
        );
    }
}

export function applyGgoStyle(mesh) {
    if (!mesh?.isMesh || !mesh.material || !isGgoMeshName(mesh.name)) return false;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const scale = 1 / Math.max(size.x, size.y, size.z, 0.00001);
    const convert = material => material.userData?.isGgoMaterial ? material : new GgoMaterial(material, center, scale);
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
    return true;
}
