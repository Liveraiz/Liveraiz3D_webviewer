// functions/StereoscopicRenderer.js
import * as THREE from 'three';
import { Constants } from '../utils/Constants';

export default class StereoscopicRenderer {
    constructor(renderer, camera, scene) {
        this.renderer = renderer;
        this.camera = camera;
        this.scene = scene;

        this.isStereoscopic = false;
        this.mode = Constants.STEREOSCOPIC.DEFAULT_MODE || 'side-by-side';
        this.eyeSeparation = Constants.STEREOSCOPIC.EYE_SEPARATION;
        this.convergenceDistance = Constants.STEREOSCOPIC.CONVERGENCE_DISTANCE;

        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.originalViewport = null;

        // anamorphic SBS: 카메라 종횡비를 압축하지 않고 half viewport에 렌더링
        this.stereoCamera = new THREE.StereoCamera();
        this.stereoCamera.aspect = 1;
        this.leftCamera = this.stereoCamera.cameraL;
        this.rightCamera = this.stereoCamera.cameraR;

        // Interlaced(Line-by-Line) 합성용 리소스
        this.interlacedLeftTarget = null;
        this.interlacedRightTarget = null;
        this.interlacedScene = null;
        this.interlacedCamera = null;
        this.interlacedMaterial = null;
        this.interlacedLeftEyeOnOdd = Constants.STEREOSCOPIC.INTERLACED_LEFT_EYE_ON_ODD !== false;

        this.initialize();
    }

    initialize() {
        this.canvasWidth = this.renderer.domElement.clientWidth || this.renderer.domElement.width || window.innerWidth;
        this.canvasHeight = this.renderer.domElement.clientHeight || this.renderer.domElement.height || window.innerHeight;
        this.syncStereoParameters();
    }

    enableStereoscopic() {
        if (this.isStereoscopic) return;

        this.isStereoscopic = true;

        // 원본 카메라 정보 저장
        this.originalCamera = this.camera;
        this.originalFOV = this.camera.fov;
        this.originalZoom = this.camera.zoom;

        this.syncStereoParameters();

        console.log('Stereoscopic rendering enabled');
        console.log('Stereoscopic mode:', this.mode);
        console.log('Eye separation:', this.eyeSeparation, 'mm');
        console.log('Convergence distance:', this.convergenceDistance, 'mm');
    }

    disableStereoscopic() {
        if (!this.isStereoscopic) return;

        this.isStereoscopic = false;

        // 렌더러를 일반 모드로 복구
        if (this.originalViewport) {
            this.renderer.setViewport(...this.originalViewport);
        }

        // 카메라 복구
        if (this.originalCamera) {
            this.originalCamera.fov = this.originalFOV;
            this.originalCamera.zoom = this.originalZoom;
        }

        console.log('Stereoscopic rendering disabled');
    }

    syncStereoParameters() {
        // THREE.StereoCamera 단위는 world unit 기준으로 meters를 가정
        this.stereoCamera.eyeSep = this.eyeSeparation / 1000;
        this.stereoCamera.focus = Math.max(this.convergenceDistance / 1000, 0.1);

        // anamorphic SBS 유지
        this.stereoCamera.aspect = 1;
    }

    setMode(mode) {
        const modes = Constants.STEREOSCOPIC.MODES || {};
        const supportedModes = Object.values(modes);
        const fallbackMode = Constants.STEREOSCOPIC.DEFAULT_MODE || 'side-by-side';

        if (!supportedModes.includes(mode)) {
            console.warn(`[StereoscopicRenderer] Unsupported mode: ${mode}. Fallback to ${fallbackMode}`);
            this.mode = fallbackMode;
            return;
        }

        this.mode = mode;
        console.log(`[StereoscopicRenderer] Mode set to: ${this.mode}`);
    }

    getMode() {
        return this.mode;
    }

    initializeInterlacedResources(width, height) {
        if (!this.interlacedLeftTarget) {
            this.interlacedLeftTarget = new THREE.WebGLRenderTarget(width, height, {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                depthBuffer: true,
                stencilBuffer: false
            });
        }

        if (!this.interlacedRightTarget) {
            this.interlacedRightTarget = new THREE.WebGLRenderTarget(width, height, {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                depthBuffer: true,
                stencilBuffer: false
            });
        }

        this.interlacedLeftTarget.setSize(width, height);
        this.interlacedRightTarget.setSize(width, height);

        if (!this.interlacedScene) {
            this.interlacedScene = new THREE.Scene();
            this.interlacedCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        }

        if (!this.interlacedMaterial) {
            this.interlacedMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    leftTex: { value: null },
                    rightTex: { value: null },
                    leftEyeOnOdd: { value: this.interlacedLeftEyeOnOdd ? 1 : 0 }
                },
                vertexShader: `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = vec4(position.xy, 0.0, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform sampler2D leftTex;
                    uniform sampler2D rightTex;
                    uniform int leftEyeOnOdd;
                    varying vec2 vUv;

                    void main() {
                        float row = floor(gl_FragCoord.y);
                        bool isOddRow = mod(row, 2.0) > 0.5;
                        bool useLeft = leftEyeOnOdd == 1 ? isOddRow : !isOddRow;

                        vec4 leftColor = texture2D(leftTex, vUv);
                        vec4 rightColor = texture2D(rightTex, vUv);
                        gl_FragColor = useLeft ? leftColor : rightColor;
                    }
                `,
                depthTest: false,
                depthWrite: false
            });

            const fullscreenQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.interlacedMaterial);
            this.interlacedScene.add(fullscreenQuad);
        }
    }

    renderInterlaced(renderCallback, width, height) {
        this.initializeInterlacedResources(width, height);

        this.renderer.setScissor(0, 0, width, height);
        this.renderer.setViewport(0, 0, width, height);

        // 좌안 전체 프레임 렌더링
        this.renderer.setRenderTarget(this.interlacedLeftTarget);
        this.renderer.clear(true, true, true);
        if (renderCallback) {
            renderCallback(this.leftCamera, 'left');
        } else {
            this.renderer.render(this.scene, this.leftCamera);
        }

        // 우안 전체 프레임 렌더링
        this.renderer.setRenderTarget(this.interlacedRightTarget);
        this.renderer.clear(true, true, true);
        if (renderCallback) {
            renderCallback(this.rightCamera, 'right');
        } else {
            this.renderer.render(this.scene, this.rightCamera);
        }

        // 홀/짝 라인 합성 후 최종 출력
        this.renderer.setRenderTarget(null);
        this.interlacedMaterial.uniforms.leftTex.value = this.interlacedLeftTarget.texture;
        this.interlacedMaterial.uniforms.rightTex.value = this.interlacedRightTarget.texture;
        this.interlacedMaterial.uniforms.leftEyeOnOdd.value = this.interlacedLeftEyeOnOdd ? 1 : 0;

        this.renderer.setScissor(0, 0, width, height);
        this.renderer.setViewport(0, 0, width, height);
        this.renderer.render(this.interlacedScene, this.interlacedCamera);
    }

    /**
     * Stereoscopic 렌더링 수행
     * @param {function} renderCallback - 각 안마다 호출될 렌더 콜백
     */
    render(renderCallback) {
        if (!this.isStereoscopic || !this.camera) {
            return;
        }

        const width = this.renderer.domElement.clientWidth;
        const height = this.renderer.domElement.clientHeight;
        if (width <= 0 || height <= 0) return;

        if (width !== this.canvasWidth || height !== this.canvasHeight) {
            this.updateCanvasSize(width, height);
        }

        this.syncStereoParameters();

        this.scene.updateMatrixWorld();
        if (this.camera.parent === null) {
            this.camera.updateMatrixWorld();
        }

        this.stereoCamera.update(this.camera);

        const prevScissorTest = this.renderer.getScissorTest();
        const prevAutoClear = this.renderer.autoClear;
        const gl = this.renderer.getContext();

        this.renderer.setScissorTest(true);
        this.renderer.autoClear = false;
        this.renderer.clear(true, true, true);

        if (this.mode === (Constants.STEREOSCOPIC.MODES && Constants.STEREOSCOPIC.MODES.INTERLACED)) {
            this.renderInterlaced(renderCallback, width, height);
        } else if (this.mode === (Constants.STEREOSCOPIC.MODES && Constants.STEREOSCOPIC.MODES.TOP_BOTTOM)) {
            const halfHeight = Math.floor(height / 2);
            const topHeight = height - halfHeight;

            // 좌안(상단) 렌더링
            this.renderer.setViewport(0, halfHeight, width, topHeight);
            this.renderer.setScissor(0, halfHeight, width, topHeight);
            if (renderCallback) {
                renderCallback(this.leftCamera, 'left');
            } else {
                this.renderer.render(this.scene, this.leftCamera);
            }

            this.renderer.clearDepth();

            // 우안(하단) 렌더링
            this.renderer.setViewport(0, 0, width, halfHeight);
            this.renderer.setScissor(0, 0, width, halfHeight);
            if (renderCallback) {
                renderCallback(this.rightCamera, 'right');
            } else {
                this.renderer.render(this.scene, this.rightCamera);
            }
        } else if (this.mode === (Constants.STEREOSCOPIC.MODES && Constants.STEREOSCOPIC.MODES.ANAGLYPH)) {
            // 좌안은 빨강 채널, 우안은 청록 채널로 합성
            this.renderer.setViewport(0, 0, width, height);
            this.renderer.setScissor(0, 0, width, height);

            gl.colorMask(true, false, false, true);
            if (renderCallback) {
                renderCallback(this.leftCamera, 'left');
            } else {
                this.renderer.render(this.scene, this.leftCamera);
            }

            this.renderer.clearDepth();

            gl.colorMask(false, true, true, true);
            if (renderCallback) {
                renderCallback(this.rightCamera, 'right');
            } else {
                this.renderer.render(this.scene, this.rightCamera);
            }

            gl.colorMask(true, true, true, true);
        } else {
            const halfWidth = Math.floor(width / 2);
            const rightWidth = width - halfWidth;

            // 좌안 렌더링
            this.renderer.setViewport(0, 0, halfWidth, height);
            this.renderer.setScissor(0, 0, halfWidth, height);
            if (renderCallback) {
                renderCallback(this.leftCamera, 'left');
            } else {
                this.renderer.render(this.scene, this.leftCamera);
            }

            this.renderer.clearDepth();

            // 우안 렌더링
            this.renderer.setViewport(halfWidth, 0, rightWidth, height);
            this.renderer.setScissor(halfWidth, 0, rightWidth, height);
            if (renderCallback) {
                renderCallback(this.rightCamera, 'right');
            } else {
                this.renderer.render(this.scene, this.rightCamera);
            }
        }

        // 상태 복구
        this.renderer.setScissorTest(prevScissorTest);
        this.renderer.autoClear = prevAutoClear;
        this.renderer.setViewport(0, 0, width, height);
    }

    /**
     * Eye separation 설정
     * @param {number} distance - mm 단위의 거리
     */
    setEyeSeparation(distance) {
        const min = Constants.STEREOSCOPIC.IOD_ADJUSTMENT_RANGE[0];
        const max = Constants.STEREOSCOPIC.IOD_ADJUSTMENT_RANGE[1];

        this.eyeSeparation = Math.max(min, Math.min(max, distance));
        console.log('Eye separation updated:', this.eyeSeparation, 'mm');

        if (this.isStereoscopic) {
            this.syncStereoParameters();
        }
    }

    /**
     * Convergence distance 설정
     * @param {number} distance - mm 단위의 거리
     */
    setConvergenceDistance(distance) {
        this.convergenceDistance = Math.max(100, distance); // 최소 100mm
        console.log('Convergence distance updated:', this.convergenceDistance, 'mm');

        if (this.isStereoscopic) {
            this.syncStereoParameters();
        }
    }

    /**
     * 현재 Eye separation 반환
     */
    getEyeSeparation() {
        return this.eyeSeparation;
    }

    /**
     * 현재 Convergence distance 반환
     */
    getConvergenceDistance() {
        return this.convergenceDistance;
    }

    /**
     * 캔버스 크기 업데이트
     */
    updateCanvasSize(width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;

        if (this.interlacedLeftTarget && this.interlacedRightTarget) {
            this.interlacedLeftTarget.setSize(width, height);
            this.interlacedRightTarget.setSize(width, height);
        }
    }

    destroy() {
        this.disableStereoscopic();

        if (this.interlacedLeftTarget) {
            this.interlacedLeftTarget.dispose();
            this.interlacedLeftTarget = null;
        }

        if (this.interlacedRightTarget) {
            this.interlacedRightTarget.dispose();
            this.interlacedRightTarget = null;
        }

        if (this.interlacedMaterial) {
            this.interlacedMaterial.dispose();
            this.interlacedMaterial = null;
        }
    }
}
