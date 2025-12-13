// core/Camera.js
import * as THREE from 'three';

// WebViewer에서 사용되는 카메라 Class
export default class Camera extends THREE.PerspectiveCamera {
    /**
     * 카메라 클래스 생성자
     * 모바일/데스크톱에 따른 시야각(FOV) 설정 및 기본 카메라 초기화
     * @param {boolean} isMobile - 모바일 기기 여부
     */
    constructor(isMobile) {
        const fov = isMobile ? 60 : 45;
        super(fov, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.isMobile = isMobile;
        this.position.z = 5;
    }

    /**
     * 카메라 컨트롤 설정
     * 카메라 움직임 제어를 위한 컨트롤 설정 및 댐핑 비활성화
     * @param {THREE.OrbitControls} controls - 카메라 컨트롤러
     */
    setControls(controls) {
        this.controls = controls;
        if (this.controls) {
            // enableDamping은 ControlManager에서 기기별로 설정하므로 여기서 덮어쓰지 않음
            // this.controls.enableDamping = false; // 제거: ControlManager의 설정을 존중
            
            // 카메라 변화 감지 및 far 값 동적 조정 (throttling으로 성능 최적화)
            let lastFarCheck = 0;
            const farCheckInterval = 100; // 100ms마다 체크 (10fps)
            
            this.controls.addEventListener('change', () => {
                const now = performance.now();
                
                // throttling: 너무 자주 실행되지 않도록 제한
                if (now - lastFarCheck < farCheckInterval) {
                    return;
                }
                lastFarCheck = now;
                
                const distanceToOrigin = this.position.length();
                
                // 카메라가 far 평면에 가까워지면 far 값을 자동으로 조정
                // 조건을 더 엄격하게 하여 불필요한 업데이트 방지
                if (distanceToOrigin > this.far * 0.85) {  // 85% 지점에서 조정 (더 여유있게)
                    const newFar = distanceToOrigin * 2.5;  // 현재 거리의 2.5배로 설정
                    // far 값이 실제로 변경될 때만 업데이트
                    if (Math.abs(newFar - this.far) > this.far * 0.1) {  // 10% 이상 차이날 때만
                        this.far = newFar;
                        this.updateProjectionMatrix();
                    }
                }
            });
        }
    }

    /**
     * 화면 비율 업데이트
     * 화면 크기 변경 시 카메라 비율과 시야각 조정
     * @param {number} width - 화면 너비
     * @param {number} height - 화면 높이
     */
    updateAspect(width, height) {
        this.aspect = width / height;
        
        if (this.isMobile) {
            this.fov = Math.min(60, 45 * (1 + (1 - this.aspect)));
        }
        
        this.updateProjectionMatrix();
    }

    /**
     * 모델에 맞춰 카메라 조정
     * 3D 모델의 크기에 따라 카메라 위치와 설정 자동 조정
     * @param {THREE.Box3} boundingBox - 모델의 경계 상자
     * @returns {number} - 계산된 카메라 거리
     */
    adjustToModel(boundingBox) {
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // 모델 크기 정보 로깅
        console.log('Model Dimensions:', {
            width: size.x,
            height: size.y,
            depth: size.z,
            maxDimension: maxDim
        });

        const fov = this.fov * (Math.PI / 180);
        const aspectRatio = this.aspect;
        const screenHeight = 2 * Math.tan(fov / 2);
        
        let distance;
        if (aspectRatio < 1) {
            distance = (maxDim / screenHeight) * 1.2;
        } else {
            distance = (maxDim / (screenHeight * aspectRatio)) * 1.2;
        }
        
        // 카메라 설정 정보 로깅
        console.log('Camera Settings:', {
            position: this.position.z,
            calculatedDistance: distance,
            fov: this.fov,
            aspect: aspectRatio,
            near: this.near,
            far: this.far
        });

        this.position.z = distance;
        this.near = 0.01;
        this.far = distance * 1000;
        this.updateProjectionMatrix();
        
        return distance;
    }
}