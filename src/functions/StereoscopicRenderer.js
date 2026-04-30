// functions/StereoscopicRenderer.js
import * as THREE from 'three';
import { Constants } from '../utils/Constants';

class DuoFragStereoEffect {
    constructor(sr, fragMain) {
        this.sr = sr;

        this.mixScene = new THREE.Scene();
        this.mixCamera = sr.orthoCamera;

        const quad = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            new THREE.ShaderMaterial({
                uniforms: {
                    tl: { value: sr.bufferL.texture },
                    tr: { value: sr.bufferR.texture }
                },
                vertexShader: `
                    varying vec2 vUv;
                    void main() {
                        vUv = vec2(uv.x, uv.y);
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform sampler2D tl;
                    uniform sampler2D tr;
                    varying vec2 vUv;
                    vec4 c(sampler2D t, vec2 uv) { return texture2D(t, uv); }
                    vec4 c(sampler2D t) { return c(t, vUv); }
                    void main() { ${fragMain} }
                `,
                depthTest: false,
                depthWrite: false
            })
        );

        this.mixScene.add(quad);
    }

    render(scene) {
        const r = this.sr.r;
        const originalRenderTarget = r.getRenderTarget();

        r.setRenderTarget(this.sr.bufferL);
        r.clear(true, true, true);
        this.sr.render(scene, this.sr.stereoCamera.cameraL);

        r.setRenderTarget(this.sr.bufferR);
        r.clear(true, true, true);
        this.sr.render(scene, this.sr.stereoCamera.cameraR);

        r.setRenderTarget(null);
        this.sr.render(this.mixScene, this.mixCamera);

        r.setRenderTarget(originalRenderTarget);
    }

    dispose() {
        this.mixScene.children.forEach((child) => {
            child.geometry.dispose();
            child.material.dispose();
        });
    }
}

class SideBySideStereoEffect {
    constructor(sr, cross, squeeze, tab) {
        this.sr = sr;
        this.cross = Boolean(cross);
        this.squeeze = Boolean(squeeze);
        this.tab = Boolean(tab);
        this.size = new THREE.Vector2();

        // Match the reference behavior: anamorphic is represented by squeeze.
        this.sr.stereoCamera.aspect = this.squeeze ? 1 : (this.tab ? 2 : 0.5);
    }

    render(scene) {
        this.sr.r.getSize(this.size);
        let w = this.size.width;
        let h = this.size.height;

        if (this.tab) {
            h /= 2;
        } else {
            w /= 2;
        }

        const cl = this.sr.stereoCamera.cameraL;
        const cr = this.sr.stereoCamera.cameraR;
        const r = this.sr.r;
        const inv = this.cross ^ this.tab;
        const w2 = this.tab ? 0 : w;
        const h2 = this.tab ? h : 0;

        r.setScissorTest(true);

        r.setScissor(0, 0, w, h);
        r.setViewport(0, 0, w, h);
        this.sr.render(scene, inv ? cr : cl);

        r.setScissor(w2, h2, w, h);
        r.setViewport(w2, h2, w, h);
        this.sr.render(scene, inv ? cl : cr);

        r.setScissorTest(false);
    }

    dispose() {
        const r = this.sr.r;
        r.getSize(this.size);
        r.setScissor(0, 0, this.size.width, this.size.height);
        r.setViewport(0, 0, this.size.width, this.size.height);
        this.sr.stereoCamera.aspect = 1;
    }
}

const fragMainInterleaved = function (v) {
    const inv = !!(((v & 1) === 1) ^ ((v & 2) === 0));
    const dir = (v & 2) === 2;
    const checkerboard = v >= 4;

    return `
        float coord = gl_FragCoord.y;
        if (${dir}) coord = gl_FragCoord.x;
        if (${checkerboard}) coord = mod(gl_FragCoord.x, 2.0) + mod(gl_FragCoord.y, 2.0);
        if (${inv}) coord += 1.0;

        if (mod(coord, 2.0) >= 1.0) {
            gl_FragColor = c(tr);
        } else {
            gl_FragColor = c(tl);
        }
    `;
};

const fragMainMirrored = function (v) {
    const invl = (v & 1) === 1;
    const invr = (v & 2) === 2;

    return `
        vec2 uv = vec2(vUv.x, vUv.y);
        if (uv.x <= 0.5) {
            uv.x = uv.x + 0.25;
            if (${invl}) uv.x = 1.0 - uv.x;
            gl_FragColor = c(tl, uv);
        } else {
            uv.x = uv.x - 0.25;
            if (${invr}) uv.x = 1.0 - uv.x;
            gl_FragColor = c(tr, uv);
        }
    `;
};

const fragMainAnaglyph = function (v) {
    const M = function (arr) {
        return 'mat3(' + new THREE.Matrix3().fromArray(arr).transpose().elements.join(',') + ')';
    };

    const matrices = {
        0: [
            M([0.299, 0.587, 0.114, 0, 0, 0, 0, 0, 0]),
            M([0, 0, 0, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114])
        ],
        1: [
            M([0.299, 0.587, 0.114, 0, 0, 0, 0, 0, 0]),
            M([0, 0, 0, 0, 1, 0, 0, 0, 1])
        ],
        2: [
            M([1, 0, 0, 0, 0, 0, 0, 0, 0]),
            M([0, 0, 0, 0, 1, 0, 0, 0, 1])
        ],
        3: [
            M([+0.456, +0.500, +0.176, -0.040, -0.038, -0.016, -0.015, -0.021, -0.005]),
            M([-0.043, -0.088, -0.002, +0.378, +0.734, -0.018, -0.072, -0.113, +1.226])
        ],
        4: [
            M([0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0, 0, 0]),
            M([0, 0, 0, 0, 0, 0, 0.299, 0.587, 0.114])
        ],
        5: [
            M([1, 0, 0, 0, 1, 0, 0, 0, 0]),
            M([0, 0, 0, 0, 0, 0, 0.299, 0.587, 0.114])
        ],
        6: [
            M([1, 0, 0, 0, 1, 0, 0, 0, 0]),
            M([0, 0, 0, 0, 0, 0, 0, 0, 1])
        ],
        7: [
            M([+1.062, -0.205, +0.299, -0.026, +0.908, +0.068, -0.038, -0.173, +0.022]),
            M([-0.016, -0.123, -0.017, +0.006, +0.062, -0.017, +0.094, +0.185, +0.911])
        ],
        8: [
            M([0, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0]),
            M([0.299, 0.587, 0.114, 0, 0, 0, 0.299, 0.587, 0.114])
        ],
        9: [
            M([0, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0]),
            M([1, 0, 0, 0, 0, 0, 0, 0, 1])
        ],
        10: [
            M([0, 0, 0, 0, 1, 0, 0, 0, 0]),
            M([1, 0, 0, 0, 0, 0, 0, 0, 1])
        ],
        11: [
            M([-0.062, -0.158, -0.039, +0.284, +0.668, +0.143, -0.015, -0.027, +0.021]),
            M([+0.529, +0.705, +0.024, -0.016, -0.015, -0.065, +0.009, +0.075, +0.937])
        ]
    };

    let mode = Number(v);
    if (Number.isNaN(mode) || mode < 0 || mode >= 12) {
        mode = 1;
    }

    const [ml, mr] = matrices[mode];

    return `
        vec4 cl = c(tl);
        vec4 cr = c(tr);
        mat3 ml = ${ml};
        mat3 mr = ${mr};
        vec3 cc = ml * cl.rgb + mr * cr.rgb;
        gl_FragColor = vec4(cc.r, cc.g, cc.b, max(cl.a, cr.a));
    `;
};

class SingleViewStereoEffect {
    constructor(sr, rightEye) {
        this.sr = sr;
        this.rightEye = Boolean(rightEye);
    }

    render(scene) {
        this.sr.render(scene, this.rightEye ? this.sr.stereoCamera.cameraR : this.sr.stereoCamera.cameraL);
    }

    dispose() {}
}

class StereoscopicEffectsRenderer {
    constructor(renderer) {
        this.r = renderer;
        this.render = this.r.render.bind(this.r);

        this.stereoCamera = new THREE.StereoCamera();
        this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.bufferL = new THREE.WebGLRenderTarget(1, 1, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat
        });
        this.bufferR = this.bufferL.clone();
    }

    setSize(width, height) {
        const pixelRatio = this.r.getPixelRatio();
        this.bufferL.setSize(width * pixelRatio, height * pixelRatio);
        this.bufferR.setSize(width * pixelRatio, height * pixelRatio);
    }

    dispose() {
        this.bufferL.dispose();
        this.bufferR.dispose();
    }
}

class StereoscopicEffects {
    constructor(conf) {
        const { renderer, defaultEffect } = conf;

        this.sr = new StereoscopicEffectsRenderer(renderer);
        this.stfx = null;

        this.setEffect(defaultEffect ?? 0);
    }

    setEyeSeparation(sep) {
        this.sr.stereoCamera.eyeSep = sep;
    }

    setSize(width, height) {
        this.sr.setSize(width, height);
    }

    render(scene, camera) {
        if ('xr' in this.sr.r && this.sr.r.xr.isPresenting) {
            this.sr.render(scene, camera);
            return;
        }

        scene.updateMatrixWorld();
        if (camera.parent === null) {
            camera.updateMatrixWorld();
        }

        this.sr.stereoCamera.update(camera);
        if (this.sr.r.autoClear) {
            this.sr.r.clear();
        }

        this.stfx.render(scene);
    }

    dispose() {
        this.stfx?.dispose?.();
        this.sr.dispose();
    }

    setEffect(fx) {
        let effectId = Number(fx);
        if (Number.isNaN(effectId) || effectId < 0) {
            effectId = 0;
        }

        this.stfx?.dispose?.();

        if (effectId < 2) {
            this.stfx = new SingleViewStereoEffect(this.sr, effectId);
            return;
        }
        effectId -= 2;

        if (effectId < 8) {
            this.stfx = new SideBySideStereoEffect(this.sr, !!(effectId & 1), !!(effectId & 2), !!(effectId & 4));
            return;
        }
        effectId -= 8;

        if (effectId < 6) {
            this.stfx = new DuoFragStereoEffect(this.sr, fragMainInterleaved(effectId));
            return;
        }
        effectId -= 6;

        if (effectId < 3) {
            this.stfx = new DuoFragStereoEffect(this.sr, fragMainMirrored(effectId + 1));
            return;
        }
        effectId -= 3;

        if (effectId < 12) {
            this.stfx = new DuoFragStereoEffect(this.sr, fragMainAnaglyph(effectId));
            return;
        }

        this.stfx = new SideBySideStereoEffect(this.sr, false, false, false);
    }
}

const EFFECT_INDEX = {
    SINGLE_LEFT: 0,
    SINGLE_RIGHT: 1,
    SIDE_BY_SIDE: 2,
    SIDE_BY_SIDE_ANAMORPHIC: 4,
    TOP_BOTTOM: 6,
    TOP_BOTTOM_ANAMORPHIC: 8,
    INTERLACED_LINES_1: 10,
    ANAGLYPH_RED_CYAN_GRAY: 19
};

export default class StereoscopicRenderer {
    constructor(renderer, camera, scene) {
        this.renderer = renderer;
        this.camera = camera;
        this.scene = scene;

        this.isStereoscopic = false;
        this.eyeSeparation = Constants.STEREOSCOPIC.EYE_SEPARATION;
        this.convergenceDistance = Constants.STEREOSCOPIC.CONVERGENCE_DISTANCE;

        this.currentEffectType = Constants.STEREOSCOPIC.DEFAULT_MODE || 'side-by-side';
        this.currentEffectOptions = {
            anamorphic: true,
            cross: false
        };

        this.canvasWidth = this.renderer.domElement.clientWidth || this.renderer.domElement.width || window.innerWidth;
        this.canvasHeight = this.renderer.domElement.clientHeight || this.renderer.domElement.height || window.innerHeight;

        this.effects = new StereoscopicEffects({
            renderer: this.renderer,
            defaultEffect: EFFECT_INDEX.SIDE_BY_SIDE_ANAMORPHIC
        });

        this.effects.setSize(this.canvasWidth, this.canvasHeight);
        this.syncStereoParameters();
        this.applyCurrentEffect();
    }

    syncStereoParameters() {
        // StereoCamera uses world units, so mm -> m conversion is applied.
        this.effects.setEyeSeparation(this.eyeSeparation / 1000);
        this.effects.sr.stereoCamera.focus = Math.max(this.convergenceDistance / 1000, 0.1);
    }

    effectIndexFor(type, options = this.currentEffectOptions) {
        const anamorphic = Boolean(options.anamorphic);

        if (type === 'single-view-left' || type === 'single-view') {
            return EFFECT_INDEX.SINGLE_LEFT;
        }
        if (type === 'single-view-right') {
            return EFFECT_INDEX.SINGLE_RIGHT;
        }
        if (type === 'top-bottom') {
            return anamorphic ? EFFECT_INDEX.TOP_BOTTOM_ANAMORPHIC : EFFECT_INDEX.TOP_BOTTOM;
        }
        if (type === 'interlaced') {
            return EFFECT_INDEX.INTERLACED_LINES_1;
        }
        if (type === 'anaglyph') {
            return EFFECT_INDEX.ANAGLYPH_RED_CYAN_GRAY;
        }

        return anamorphic ? EFFECT_INDEX.SIDE_BY_SIDE_ANAMORPHIC : EFFECT_INDEX.SIDE_BY_SIDE;
    }

    applyCurrentEffect() {
        const fx = this.effectIndexFor(this.currentEffectType, this.currentEffectOptions);
        this.effects.setEffect(fx);
    }

    setEffect(effectType, options = {}) {
        this.currentEffectType = effectType;
        this.currentEffectOptions = {
            ...this.currentEffectOptions,
            ...options
        };
        this.applyCurrentEffect();
    }

    setMode(mode) {
        this.setEffect(mode, { anamorphic: this.currentEffectOptions.anamorphic });
    }

    getMode() {
        return this.currentEffectType;
    }

    setAnamorphic(anamorphic) {
        this.currentEffectOptions.anamorphic = Boolean(anamorphic);
        this.applyCurrentEffect();
    }

    getIsAnamorphic() {
        return Boolean(this.currentEffectOptions.anamorphic);
    }

    toggleAnamorphic() {
        this.setAnamorphic(!this.currentEffectOptions.anamorphic);
    }

    enableStereoscopic() {
        if (this.isStereoscopic) {
            return;
        }

        this.isStereoscopic = true;
        this.syncStereoParameters();
    }

    disableStereoscopic() {
        if (!this.isStereoscopic) {
            return;
        }

        this.isStereoscopic = false;
        this.renderer.setScissorTest(false);
        this.renderer.setViewport(0, 0, this.canvasWidth, this.canvasHeight);
        this.renderer.setScissor(0, 0, this.canvasWidth, this.canvasHeight);
        this.renderer.setRenderTarget(null);
    }

    setEyeSeparation(distance) {
        const min = Constants.STEREOSCOPIC.IOD_ADJUSTMENT_RANGE[0];
        const max = Constants.STEREOSCOPIC.IOD_ADJUSTMENT_RANGE[1];
        this.eyeSeparation = Math.max(min, Math.min(max, distance));
        this.syncStereoParameters();
    }

    setConvergenceDistance(distance) {
        this.convergenceDistance = Math.max(100, distance);
        this.syncStereoParameters();
    }

    getEyeSeparation() {
        return this.eyeSeparation;
    }

    getConvergenceDistance() {
        return this.convergenceDistance;
    }

    updateCanvasSize(width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;
        this.effects.setSize(width, height);
    }

    render(renderCallback) {
        if (!this.isStereoscopic || !this.camera || !this.scene) {
            return;
        }

        const width = this.renderer.domElement.clientWidth || this.canvasWidth;
        const height = this.renderer.domElement.clientHeight || this.canvasHeight;

        if (width > 0 && height > 0 && (width !== this.canvasWidth || height !== this.canvasHeight)) {
            this.updateCanvasSize(width, height);
        }

        this.syncStereoParameters();

        const originalRender = this.effects.sr.render;
        if (renderCallback) {
            this.effects.sr.render = (scene, eyeCamera) => renderCallback(eyeCamera);
        }

        try {
            this.effects.render(this.scene, this.camera);
        } finally {
            this.effects.sr.render = originalRender;
            this.renderer.setScissorTest(false);
            this.renderer.setViewport(0, 0, this.canvasWidth, this.canvasHeight);
        }
    }

    destroy() {
        this.disableStereoscopic();
        this.effects.dispose();
    }
}
