import * as THREE from "three";
import { ArcballControls } from "three/examples/jsm/controls/ArcballControls";
import CameraStateManager from "../functions/CameraStateManager";
import CameraStateRecorder from "../functions/CameraStateRecorder";

export default class ControlManager {
    /**
     * 컨트롤 매니저 생성자
     * 카메라 컨트롤과 터치 이벤트를 초기화하고 관리
     * @param {THREE.Camera} camera - Three.js 카메라
     * @param {THREE.WebGLRenderer} renderer - Three.js 렌더러
     * @param {boolean} isMobile - 모바일 기기 여부
     */
    constructor(camera, renderer, isMobile) {
        this.camera = camera;
        this.renderer = renderer;
        this.isMobile = isMobile;

        this.defaultCameraPosition = null;
        this.defaultCameraQuaternion = null;
        this.defaultCameraRotation = null;
        this.defaultTarget = null;

        this.boundTouchHandler = this.handleTouch.bind(this);
        this.boundPreventMultiTouch = this.preventMultiTouch.bind(this);

        this.isControlActive = false;
        this.boundControlStartHandler = this.handleControlStart.bind(this);
        this.boundControlEndHandler = this.handleControlEnd.bind(this);

        this.controls = new ArcballControls(
            this.camera,
            this.renderer.domElement
        );
        
        // 기기별 최적화 설정
        if (isMobile) {
            // 모바일: 부드러운 움직임 (터치 제어에 적합)
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 50;    // 감쇠 계수 (높을수록 부드러움)
            this.controls.rotateSpeed = 0.6;       // 회전 속도 조정 (모바일 민감도 감소)(0.4>>0.6)
            this.controls.zoomSpeed = 0.6;         // 줌 속도 조정(0.4>>0.6)
            this.controls.panSpeed = 0.6;          // 팬 속도 조정(0.4>>0.6)
        } else {
            // PC: 즉각적인 반응성 (마우스 제어에 적합)
            this.controls.enableDamping = false;   // damping 비활성화로 즉각 반응
            this.controls.rotateSpeed = 1.0;       // 회전 속도 조정
            this.controls.zoomSpeed = 1.0;         // 줌 속도 조정
            this.controls.panSpeed = 1.0;          // 팬 속도 조정
        }
        this.controls.enablePan = true;            // 팬 활성화
        this.controls.enableZoom = true;           // 줌 활성화
        this.controls.enableRotate = true;         // 회전 활성화
        
        camera.setControls(this.controls);
        this.setupTouchEvents(isMobile, renderer);
        this.setupControlEvents();

        this.isTransforming = false;
        this.touchZoomDistance = 0;
        this.isZooming = false;

        // 추가: MeshTooltip과 MeshOutlineMarker 관리
        this.meshTooltip = null;
        this.meshOutlineMarker = null;

        // 마우스 이벤트 핸들러 바인딩
        this.boundMouseMoveHandler = this.handleMouseMove.bind(this);
        this.setupMouseEvents();

        // CameraStateManager 초기화 (선택사항)
        this.cameraStateManager = null;
        
        // CameraStateRecorder 초기화 (자동 기록)
        this.cameraStateRecorder = null;
    }

    /**
     * CameraStateManager 인스턴스 가져오기 (lazy initialization)
     * @returns {CameraStateManager} CameraStateManager 인스턴스
     */
    getCameraStateManager() {
        if (!this.cameraStateManager) {
            this.cameraStateManager = new CameraStateManager(this.camera, this.controls);
        }
        return this.cameraStateManager;
    }

    /**
     * CameraStateRecorder 초기화 및 시작
     * @param {ModelLoader} modelLoader - 모델 로더 (드롭박스 URL 추출용)
     * @param {ModelSelector} modelSelector - 모델 셀렉터 (드롭박스 JSON URL 추출용)
     */
    setupCameraStateRecorder(modelLoader = null, modelSelector = null) {
        if (!this.cameraStateRecorder) {
            this.cameraStateRecorder = new CameraStateRecorder(
                this.camera,
                this.controls,
                modelLoader,
                modelSelector
            );
            console.log('카메라 상태 자동 기록 시작');
        } else {
            if (modelLoader) {
                this.cameraStateRecorder.setModelLoader(modelLoader);
            }
            if (modelSelector) {
                this.cameraStateRecorder.setModelSelector(modelSelector);
            }
        }
    }

    /**
     * CameraStateRecorder 인스턴스 가져오기
     * @returns {CameraStateRecorder|null} CameraStateRecorder 인스턴스
     */
    getCameraStateRecorder() {
        return this.cameraStateRecorder;
    }

    /**
     * 터치 이벤트 핸들러
     * 두 손가락 터치를 감지하여 줌 동작 처리
     * @param {TouchEvent} e - 터치 이벤트 객체
     */
    handleTouch(e) {
        if (e.touches.length === 1) {
            return;
        } else if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].pageX - e.touches[1].pageX;
            const dy = e.touches[0].pageY - e.touches[1].pageY;
            this.touchZoomDistance = Math.sqrt(dx * dx + dy * dy);
            this.isZooming = true;
        }
    }

    /**
     * 멀티터치 방지
     * 세 손가락 이상의 터치를 방지
     * @param {TouchEvent} e - 터치 이벤트 객체
     */
    preventMultiTouch(e) {
        if (e.touches.length > 2) {
            e.preventDefault();
        }
    }

    /**
     * 변환 상태 설정
     * 객체 변환 중 카메라 컨트롤 비활성화
     * @param {boolean} isTransforming - 변환 진행 여부
     */
    setTransformState(isTransforming) {
        // console.log(`[ControlManager] Transform 상태 변경 시도: ${isTransforming}`);
        this.isTransforming = isTransforming;
        
        if (this.controls) {
            // console.log(`[ControlManager] Controls 활성화 상태: ${!isTransforming}`);
            this.controls.enabled = !isTransforming;
            this.controls.enableRotate = !isTransforming;
            this.controls.enableZoom = !isTransforming;
            this.controls.enablePan = !isTransforming;
        }

        if (this.meshTooltip) {
            // console.log(`[ControlManager] MeshTooltip 활성화 상태 설정: ${!isTransforming}`);
            this.meshTooltip.setEnabled(!isTransforming);
            
            // console.log('[ControlManager] MeshTooltip 상태 확인:', {
            //     isEnabled: this.meshTooltip.isEnabled,
            //     tooltipsCount: this.meshTooltip.tooltips.size,
            //     isTransforming: this.isTransforming
            // });
        } else {
            // console.warn('[ControlManager] MeshTooltip이 설정되지 않았습니다');
        }
    }

    /**
     * 모델에 맞춰 카메라 위치 설정
     * 모델의 크기와 위치에 따라 최적의 카메라 위치 계산
     * @param {THREE.Object3D} model - 대상 3D 모델
     */
    setCameraToFitModel(model) {
        if (!model) return;

        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        const distance = maxDim / 2 / Math.tan(fov / 2);
        const cameraZ = distance * 1.2;

        this.defaultCameraPosition = new THREE.Vector3(0, 0, cameraZ);
        this.defaultCameraQuaternion = new THREE.Quaternion();
        this.defaultCameraRotation = new THREE.Euler(0, 0, 0);
        this.defaultTarget = center.clone();
        this.defaultUp = new THREE.Vector3(0, 1, 0);

        this.resetCamera();
        
    }

    /**
     * 카메라 초기화
     * 카메라를 기본 위치와 방향으로 재설정
     */
    resetCamera() {
        this.controls.reset(); // added by dip2k 2025021

        if (!this.defaultCameraPosition) {
            console.warn("Default camera position not set yet");
            return;
        }

        this.camera.position.copy(this.defaultCameraPosition);
        this.camera.quaternion.copy(this.defaultCameraQuaternion);
        this.camera.rotation.copy(this.defaultCameraRotation);
        this.camera.up.copy(this.defaultUp);

        if (this.defaultTarget) {
            this.controls.target.copy(this.defaultTarget);
        }

        this.controls.update();

        requestAnimationFrame(() => {
            this.camera.up.copy(this.defaultUp);
            this.controls.update();
        });
    }

    /**
     * 터치 이벤트 설정
     * 모바일 환경에서의 터치 제스처 처리
     * @param {boolean} isMobile - 모바일 기기 여부
     * @param {THREE.WebGLRenderer} renderer - Three.js 렌더러
     */
    setupTouchEvents(isMobile, renderer) {
        if (!isMobile || !renderer) return;

        const options = { passive: false };
        const element = renderer.domElement;

        element.addEventListener("touchstart", this.boundTouchHandler, options);
        element.addEventListener(
            "touchmove",
            (e) => {
                if (e.touches.length === 2 && this.isZooming) {
                    e.preventDefault();
                    const dx = e.touches[0].pageX - e.touches[1].pageX;
                    const dy = e.touches[0].pageY - e.touches[1].pageY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (this.touchZoomDistance !== 0) {
                        const factor = distance / this.touchZoomDistance;
                        if (factor > 1.1) {
                            this.controls.dollyOut(1.1);
                        } else if (factor < 0.9) {
                            this.controls.dollyIn(1.1);
                        }
                    }
                    this.touchZoomDistance = distance;
                }
            },
            options
        );

        element.addEventListener(
            "touchend",
            () => {
                this.isZooming = false;
                this.touchZoomDistance = 0;
            },
            options
        );

        document.addEventListener(
            "touchstart",
            this.boundPreventMultiTouch,
            options
        );
        document.addEventListener(
            "touchmove",
            this.boundPreventMultiTouch,
            options
        );
    }

    /**
     * 터치 이벤트 제거
     * 등록된 터치 이벤트 리스너 제거
     * @param {THREE.WebGLRenderer} renderer - Three.js 렌더러
     */
    removeTouchEvents(renderer) {
        if (!renderer || !renderer.domElement) return;

        const options = { passive: false };
        renderer.domElement.removeEventListener(
            "touchstart",
            this.boundTouchHandler,
            options
        );
        document.removeEventListener(
            "touchstart",
            this.boundPreventMultiTouch,
            options
        );
        document.removeEventListener(
            "touchmove",
            this.boundPreventMultiTouch,
            options
        );
    }

    /**
     * 컨트롤 업데이트
     * damping이 활성화된 경우에만 매 프레임마다 컨트롤 상태 업데이트
     */
    update() {
        if (this.controls && this.controls.enableDamping) {
            this.controls.update(); // damping이 활성화된 경우에만 매 프레임 업데이트 필요
        }
    }

    /**
     * 카메라 거리 제한 업데이트
     * 카메라의 최소/최대 거리 설정
     * @param {number} distance - 기준 거리
     */
    updateDistance(distance) {
        if (this.controls) {
            this.controls.minDistance = 0.1;
            this.controls.maxDistance = distance * 2;
        }
    }

    // 새로운 메서드 추가: MeshTooltip 설정
    setMeshTooltip(meshTooltip) {
        console.log('[ControlManager] MeshTooltip 설정됨:', meshTooltip ? '성공' : '실패');
        this.meshTooltip = meshTooltip;
    }

    // 새로운 메서드 추가: MeshOutlineMarker 설정
    setMeshOutlineMarker(meshOutlineMarker) {
        this.meshOutlineMarker = meshOutlineMarker;
    }

    setupMouseEvents() {
        this.renderer.domElement.addEventListener('mousemove', this.boundMouseMoveHandler);
    }

    handleMouseMove(event) {
        if (!this.meshTooltip) {
            // console.warn('[ControlManager] MeshTooltip이 설정되지 않음');
            return;
        }

        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        if (this.meshOutlineMarker && !this.isTransforming) {
            this.meshOutlineMarker.updateMousePosition(x, y);
        }

        if (!this.isTransforming) {
            // console.log('[ControlManager] 마우스 이벤트 처리 - 좌표:', {x, y});
            // console.log('[ControlManager] MeshTooltip 상태:', {
            //     isEnabled: this.meshTooltip.isEnabled,
            //     tooltipsCount: this.meshTooltip.tooltips.size,
            //     activeTooltip: this.meshTooltip.activeTooltip ? this.meshTooltip.activeTooltip.parent?.name : 'none'
            // });
            this.meshTooltip.updateMousePosition(x, y);
        }
    }

    /**
     * 컨트롤 이벤트 설정
     * 마우스로 모델 조작 시 이벤트 처리
     */
    setupControlEvents() {
        if (!this.renderer || !this.renderer.domElement) return;
        
        this.renderer.domElement.addEventListener('mousedown', this.boundControlStartHandler);
        window.addEventListener('mouseup', this.boundControlEndHandler);
    }
    
    /**
     * 컨트롤 시작 핸들러
     * 마우스 왼쪽 버튼으로 회전 시작 시 호출
     * @param {MouseEvent} e - 마우스 이벤트
     */
    handleControlStart(e) {
        // 마우스 왼쪽 버튼으로 조작 시
        if (e.button === 0) {
            this.isControlActive = true;
            if (this.meshTooltip) {
                this.meshTooltip.setEnabled(false);
            }
        }
    }
    
    /**
     * 컨트롤 종료 핸들러
     * 마우스 버튼 해제 시 호출
     */
    handleControlEnd() {
        if (this.isControlActive) {
            this.isControlActive = false;
            if (this.meshTooltip && !this.isTransforming) {
                this.meshTooltip.setEnabled(true);
            }
        }
    }

    dispose() {
        // 마우스 이벤트 리스너 제거
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.removeEventListener('mousemove', this.boundMouseMoveHandler);
            this.renderer.domElement.removeEventListener('mousedown', this.boundControlStartHandler);
        }
        
        window.removeEventListener('mouseup', this.boundControlEndHandler);

        // 터치 이벤트 리스너 제거
        this.removeTouchEvents(this.renderer);

        // ArcballControls 정리
        if (this.controls) {
            this.controls.dispose();
        }

        // MeshTooltip 정리
        if (this.meshTooltip) {
            this.meshTooltip.dispose();
            this.meshTooltip = null;
        }

        // MeshOutlineMarker 정리
        if (this.meshOutlineMarker) {
            // meshOutlineMarker에 dispose 메서드가 있다면 호출
            if (typeof this.meshOutlineMarker.dispose === 'function') {
                this.meshOutlineMarker.dispose();
            }
            this.meshOutlineMarker = null;
        }

        // 참조 정리
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.defaultCameraPosition = null;
        this.defaultCameraQuaternion = null;
        this.defaultCameraRotation = null;
        this.defaultTarget = null;
        this.defaultUp = null;
    }
}
