// functions/StereoscopicRenderer.js
import * as THREE from 'three';
import { Constants } from '../utils/Constants';

export default class StereoscopicRenderer {
    constructor(renderer, camera, scene) {
        this.renderer = renderer;
        this.camera = camera;
        this.scene = scene;

        this.isStereoscopic = false;
        this.eyeSeparation = Constants.STEREOSCOPIC.EYE_SEPARATION;
        this.convergenceDistance = Constants.STEREOSCOPIC.CONVERGENCE_DISTANCE;

        this.canvasWidth = 0;
        this.canvasHeight = 0;
        this.originalViewport = null;

        // SBS: 카메라 종횡비를 압축하지 않고 half viewport에 렌더링
        this.stereoCamera = new THREE.StereoCamera();
        this.stereoCamera.aspect = 1;
        this.leftCamera = this.stereoCamera.cameraL;
        this.rightCamera = this.stereoCamera.cameraR;

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

        // 원본 카메라의 aspect ratio 유지 (SBS에서 이미지 압축 방지)
        // 절반 viewport에서도 원래 aspect를 유지해야 화면이 정상 비율로 보임
        if (this.camera) {
            this.stereoCamera.aspect = this.camera.aspect;
        } else {
            this.stereoCamera.aspect = window.innerWidth / window.innerHeight;
        }
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
        this.renderSideBySide(width, height, renderCallback);
    }

    renderSideBySide(width, height, renderCallback) {

        const halfWidth = Math.floor(width / 2);
        const rightWidth = width - halfWidth;
        const prevScissorTest = this.renderer.getScissorTest();
        const prevAutoClear = this.renderer.autoClear;

        this.renderer.setScissorTest(true);
        this.renderer.autoClear = false;
        this.renderer.clear(true, true, true);

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
    }

    destroy() {
        this.disableStereoscopic();
    }
}
