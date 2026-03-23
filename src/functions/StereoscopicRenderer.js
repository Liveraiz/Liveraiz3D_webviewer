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

        this.leftCamera = null;
        this.rightCamera = null;

        this.initialize();
    }

    initialize() {
        this.canvasWidth = this.renderer.domElement.clientWidth;
        this.canvasHeight = this.renderer.domElement.clientHeight;
    }

    enableStereoscopic() {
        if (this.isStereoscopic) return;

        this.isStereoscopic = true;

        // 원본 카메라 정보 저장
        this.originalCamera = this.camera;
        this.originalFOV = this.camera.fov;
        this.originalZoom = this.camera.zoom;

        // 좌안/우안 카메라 생성
        this.createStereoscopicCameras();

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

        this.leftCamera = null;
        this.rightCamera = null;

        console.log('Stereoscopic rendering disabled');
    }

    createStereoscopicCameras() {
        const originalCam = this.camera;

        // 좌안 카메라
        this.leftCamera = new THREE.PerspectiveCamera(
            originalCam.fov,
            this.canvasWidth / this.canvasHeight,
            originalCam.near,
            originalCam.far
        );

        // 우안 카메라
        this.rightCamera = new THREE.PerspectiveCamera(
            originalCam.fov,
            this.canvasWidth / this.canvasHeight,
            originalCam.near,
            originalCam.far
        );

        // 원본 카메라의 위치와 방향 복사
        this.leftCamera.position.copy(originalCam.position);
        this.leftCamera.quaternion.copy(originalCam.quaternion);
        this.leftCamera.up.copy(originalCam.up);

        this.rightCamera.position.copy(originalCam.position);
        this.rightCamera.quaternion.copy(originalCam.quaternion);
        this.rightCamera.up.copy(originalCam.up);

        // 눈 분리 적용 (좌우 시프트)
        const eyeShift = this.getEyeShift();
        const rightVector = new THREE.Vector3();
        this.leftCamera.getWorldDirection(rightVector);
        // 올바른 오른쪽 벡터 계산
        const upVector = this.leftCamera.up;
        rightVector.crossVectors(upVector, rightVector).normalize();

        this.leftCamera.position.addScaledVector(rightVector, -eyeShift);
        this.rightCamera.position.addScaledVector(rightVector, eyeShift);

        // 수렴(convergence) 적용
        this.applyConvergence();
    }

    getEyeShift() {
        // eye_separation (mm) -> 카메라 좌표계 단위로 변환
        // 일반적으로 1 unit = 100mm로 가정
        return (this.eyeSeparation / 100) * 0.5;
    }

    applyConvergence() {
        // 수렴거리에 따른 카메라 회전
        const convergenceAngle = Math.atan(
            this.getEyeShift() / (this.convergenceDistance / 1000)
        );

        // 좌안: 오른쪽으로 회전
        this.leftCamera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), convergenceAngle);

        // 우안: 왼쪽으로 회전
        this.rightCamera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -convergenceAngle);
    }

    /**
     * Stereoscopic 렌더링 수행
     * @param {function} renderCallback - 각 안마다 호출될 렌더 콜백
     */
    render(renderCallback) {
        if (!this.isStereoscopic || !this.leftCamera || !this.rightCamera) {
            console.warn('Stereoscopic mode is not enabled');
            return;
        }

        const halfWidth = this.canvasWidth / 2;

        // 좌안 렌더링
        this.renderer.setViewport(0, 0, halfWidth, this.canvasHeight);
        if (renderCallback) {
            renderCallback(this.leftCamera);
        } else {
            this.renderer.render(this.scene, this.leftCamera);
        }

        // 우안 렌더링
        this.renderer.setViewport(halfWidth, 0, halfWidth, this.canvasHeight);
        if (renderCallback) {
            renderCallback(this.rightCamera);
        } else {
            this.renderer.render(this.scene, this.rightCamera);
        }

        // 뷰포트 복구
        this.renderer.setViewport(0, 0, this.canvasWidth, this.canvasHeight);
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
            this.createStereoscopicCameras();
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
            this.createStereoscopicCameras();
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

        if (this.isStereoscopic && this.leftCamera && this.rightCamera) {
            this.leftCamera.aspect = this.canvasWidth / this.canvasHeight;
            this.rightCamera.aspect = this.canvasWidth / this.canvasHeight;
            this.leftCamera.updateProjectionMatrix();
            this.rightCamera.updateProjectionMatrix();
        }
    }

    destroy() {
        this.disableStereoscopic();
    }
}
