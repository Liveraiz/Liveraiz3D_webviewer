// ./controls/meshTransform.js
import * as THREE from "three";
import { DeviceDetector } from "../utils/DeviceDetector";
import TransformControlManager from "./TransformControlManager";

export default class MeshTransform {
    /**
     * 메시 변환 클래스 생성자
     * 3D 객체의 변환(이동, 회전, 크기 조절)을 관리
     * @param {THREE.WebGLRenderer} renderer - Three.js 렌더러
     * @param {THREE.Scene} scene - Three.js 씬
     * @param {THREE.Camera} camera - Three.js 카메라
     * @param {OrbitControls} orbitControls - 궤도 컨트롤
     * @param {Array} meshes - 변환 대상 메시 배열
     * @param {Map} initialTransforms - 초기 변환 상태 저장 맵
     * @param {ControlManager} controlManager - 컨트롤 관리자
     */
    constructor(
        renderer,
        scene,
        camera,
        orbitControls,
        meshes = [],
        initialTransforms = new Map(),
        controlManager = null
    ) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.orbitControls = orbitControls;
        this.deviceDetector = new DeviceDetector();
        this.initialTransforms = initialTransforms;
        this.controlManager = controlManager; // ControlManager 저장

        this.meshes = meshes;

        this.transformControlManager = new TransformControlManager(
            camera,
            renderer,
            scene,
            meshes,
            {
                controls: orbitControls,
                controlManager: controlManager // 여기서 ControlManager 전달
            }
        );

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedMesh = null;
        this.currentMode = "viewer";

        this.animationMixer = null;
        this.animatedMeshes = new Set();

        this.hoveredMesh = null;
        this.originalEmissiveIntensity = new Map();
        this.originalEmissiveColor = new Map();
        this.pulseStartTime = new Map();
        this.currentMode = "viewer"; // 기본 모드는 viewer

        this.onSelect = null;

        this.setupHoverEffect();

        this.setupClickListener();
    }

    /**
     * 초기 변환 상태 저장
     * 모든 메시의 위치, 회전, 크기를 초기 상태로 저장
     */
    saveInitTransform() {
        if (!this.meshes || !Array.isArray(this.meshes)) {
            // 첫 번째 발생 시에만 로그를 남김
            if (!this._hasLoggedMeshesUnavailableMessage) {
                console.debug("Meshes array is not properly initialized - waiting for meshes to be loaded");
                this._hasLoggedMeshesUnavailableMessage = true;
            }
            return;
        }
        
        if (this.meshes.length === 0) {
            // 첫 번째 발생 시에만 로그를 남김
            if (!this._hasLoggedEmptyMeshesMessage) {
                console.debug("No meshes available yet - waiting for meshes to be loaded");
                this._hasLoggedEmptyMeshesMessage = true;
            }
            return;
        }
        
        this.meshes.forEach((mesh) => {
            if (mesh) {
                // 초기 변환 상태 저장 전 로그 추가
                console.log(`Saving initial transform for mesh ID: ${mesh.id}`);
                
                this.initialTransforms.set(mesh.id, {
                    position: mesh.position.clone(),
                    rotation: mesh.rotation.clone(),
                    scale: mesh.scale.clone(),
                });
            } else {
                console.warn("Encountered null or undefined mesh in meshes array");
            }
        });
        
        if (this.initialTransforms.size > 0) {
            console.log(`Successfully saved initial transforms for ${this.initialTransforms.size} meshes`);
        }
    }

    /**
     * 호버 효과 설정
     * 마우스가 메시 위에 있을 때 시각적 피드백 제공
     */
    setupHoverEffect() {
        this.renderer.domElement.addEventListener(
            "mousemove" || "mousemove",
            (event) => {
                // viewer 모드일 때는 hover 효과 무시
                // if (this.currentMode === "viewer") {
                //     this.resetHoveredMesh();
                //     return;
                // }

                const rect = this.renderer.domElement.getBoundingClientRect();
                this.mouse.x =
                    ((event.clientX - rect.left) / rect.width) * 2 - 1;
                this.mouse.y =
                    -((event.clientY - rect.top) / rect.height) * 2 + 1;

                this.raycaster.setFromCamera(this.mouse, this.camera);
                const intersects = this.raycaster.intersectObjects(
                    this.meshes,
                    true
                );

                // 이전 hover mesh 복구
                this.resetHoveredMesh();

                if (intersects.length > 0) {
                    const mesh = intersects[0].object;
                    // movable이 있는 mesh만 처리
                    if (mesh.material && mesh.name.includes("mov")) {
                        // 현재 상태 저장
                        if (!this.originalEmissiveIntensity.has(mesh.id)) {
                            this.originalEmissiveIntensity.set(
                                mesh.id,
                                mesh.material.emissiveIntensity || 0
                            );
                            this.originalEmissiveColor.set(
                                mesh.id,
                                mesh.material.emissive
                                    ? mesh.material.emissive.clone()
                                    : new THREE.Color(0x000000)
                            );
                        }

                        // pulse 시작 시간 기록
                        if (!this.pulseStartTime.has(mesh.id)) {
                            this.pulseStartTime.set(mesh.id, performance.now());
                        }

                        // hover 효과 기본 설정
                        mesh.material.emissive = new THREE.Color(0xffffff);
                        this.hoveredMesh = mesh;
                    }
                } else {
                    this.hoveredMesh = null;
                }
            }
        );

        this.renderer.domElement.addEventListener("mouseout", () => {
            this.resetHoveredMesh();
        });
    }

    /**
     * 호버된 메시 초기화
     * 호버 효과가 적용된 메시를 원래 상태로 복원
     */
    resetHoveredMesh() {
        if (this.hoveredMesh && this.hoveredMesh.material) {
            const originalIntensity = this.originalEmissiveIntensity.get(
                this.hoveredMesh.id
            );
            const originalColor = this.originalEmissiveColor.get(
                this.hoveredMesh.id
            );

            if (
                originalIntensity !== undefined &&
                originalColor !== undefined
            ) {
                this.hoveredMesh.material.emissiveIntensity = originalIntensity;
                this.hoveredMesh.material.emissive = originalColor;
            }
            this.pulseStartTime.delete(this.hoveredMesh.id);
        }
        this.hoveredMesh = null;
    }

    /**
     * 클릭 이벤트 리스너 설정
     * 메시 선택 및 변환 컨트롤 연결 처리
     */
    setupClickListener() {
        this.renderer.domElement.addEventListener("click", (event) => {
            // if (this.currentMode === "viewer") {
            //     return; // 뷰어 모드에서는 메시를 선택하지 않음
            // }

            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(
                this.meshes,
                true
            );

            if (intersects.length > 0) {
                const clickedMesh = intersects[0].object;
                
                // opacity가 0.01 이하인 메시는 선택하지 않음
                if (clickedMesh.material && clickedMesh.material.opacity !== undefined && clickedMesh.material.opacity <= 0.01) {
                    console.log(`[meshTransform] ${clickedMesh.name}은(는) 투명도가 0.01 이하로 선택할 수 없습니다.`);
                    this.selectedMesh = null;
                    this.transformControlManager.detach();
                    
                    // 빈 공간 클릭 시에도 onSelect 콜백 호출 (null을 전달)
                    if (this.onSelect && typeof this.onSelect === "function") {
                        this.onSelect(null);
                    }
                    return;
                }
                
                this.selectedMesh = clickedMesh;
                // this.highlightSelectedMesh();
                this.transformControlManager.registerModel(clickedMesh);

                // onSelect 콜백 호출
                if (this.onSelect && typeof this.onSelect === "function") {
                    this.onSelect(clickedMesh);
                }
            } else {
                this.selectedMesh = null;
                this.transformControlManager.detach();

                // 빈 공간 클릭 시에도 onSelect 콜백 호출 (null을 전달)
                if (this.onSelect && typeof this.onSelect === "function") {
                    this.onSelect(null);
                }
            }
        });
    }

    /**
     * 선택 콜백 설정
     * 메시 선택 시 실행될 외부 콜백 함수 설정
     * @param {Function} callback - 선택 이벤트 콜백 함수
     */
    setOnSelectCallback(callback) {
        if (typeof callback === "function") {
            this.onSelect = callback;
        } else {
            console.warn("Invalid callback provided to setOnSelectCallback");
        }
    }

    /**
     * 선택된 메시 강조 표시
     * 선택된 메시에 시각적 강조 효과 적용
     */
    highlightSelectedMesh() {
        this.meshes.forEach((mesh) => {
            if (mesh.material) {
                mesh.material.emissive = new THREE.Color(0x000000);
                mesh.material.emissiveIntensity = 0;
            }
        });

        if (this.selectedMesh && this.selectedMesh.material) {
            this.selectedMesh.material.emissive = new THREE.Color(0x999999);
            this.selectedMesh.material.emissiveIntensity = 0.2;
        }
    }

    /**
     * 모든 메시 강조 해제
     * 모든 메시의 강조 효과 제거
     */
    unhighlightAllMeshes() {
        this.meshes.forEach((mesh) => {
            if (mesh.material) {
                mesh.material.emissive = new THREE.Color(0x000000);
                mesh.material.emissiveIntensity = 0;
            }
        });
    }

    /**
     * 포인터 다운 이벤트 처리
     * 메시 선택 및 변환 컨트롤 처리
     * @param {PointerEvent} event - 포인터 이벤트
     */
    onPointerDown(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // TransformControls Gizmo와 교차 여부 확인
        const gizmoIntersects = this.transformControlManager.raycast(
            this.raycaster
        );
        if (gizmoIntersects.length > 0) {
            // console.log('Gizmo 클릭됨', gizmoIntersects);
            return; // Gizmo 클릭 시 메시 Raycast 무시
        }

        // 메시와 교차 여부 확인
        const meshIntersects = this.raycaster.intersectObjects(
            this.meshes,
            true
        );
        if (meshIntersects.length > 0) {
            const clickedMesh = meshIntersects[0].object;
            
            // opacity가 0.01 이하인 메시는 선택하지 않음
            if (clickedMesh.material && clickedMesh.material.opacity !== undefined && clickedMesh.material.opacity <= 0.01) {
                console.log(`[meshTransform] ${clickedMesh.name}은(는) 투명도가 0.01 이하로 선택할 수 없습니다.`);
                this.detach();
                return;
            }
            
            this.attach(clickedMesh); // TransformControls에 메시 연결
        } else {
            this.detach();
        }
    }

    /**
     * 객체 연결
     * 변환 컨트롤을 선택된 객체에 연결
     * @param {THREE.Object3D} object - 대상 3D 객체
     */
    attach(object) {
        this.selectedMesh = object;

        if (this.currentMode === "rotate") {
            // 바운딩 박스 계산
            const bbox = new THREE.Box3().setFromObject(object);
            const center = bbox.getCenter(new THREE.Vector3());

            // Transform Controls의 위치를 객체의 중심으로 설정
            if (this.transformControlManager.transformControls) {
                this.transformControlManager.transformControls.position.copy(
                    center
                );
            }
        }

        this.transformControlManager.attach(object);
        
        // ControlManager에 Transform 상태 알림 추가
        if (this.controlManager) {
            console.log('[MeshTransform] Transform 모드 활성화로 인한 상태 변경');
            this.controlManager.setTransformState(true);
        }
    }

    /**
     * 객체 연결 해제
     * 변환 컨트롤에서 객체 연결 해제
     */
    detach() {
        this.selectedMesh = null;
        this.transformControlManager.detach();
        
        // ControlManager에 Transform 상태 해제 알림 추가
        if (this.controlManager) {
            console.log('[MeshTransform] Transform 모드 비활성화로 인한 상태 변경');
            this.controlManager.setTransformState(false);
        }
    }

    /**
     * 초기화
     * 변환 컨트롤 초기 상태 설정
     */
    init() {
        this.transformControlManager.setMode("viewer");
        this.transformControlManager.setSize(0);
    }

    /**
     * 리소스 정리
     * 이벤트 리스너 제거 및 메모리 정리
     */
    dispose() {
        if (this.toolbar && this.toolbar.parentNode) {
            this.toolbar.parentNode.removeChild(this.toolbar);
        }
        if (this.transformControlManager) {
            this.transformControlManager.dispose();
        }
        this.renderer.domElement.removeEventListener(
            "click",
            this.setupClickListener
        );

        this.originalEmissiveIntensity.clear();
        this.originalEmissiveColor.clear();
        this.pulseStartTime.clear();
    }

    /**
     * 뷰어 모드 설정
     * 기본 뷰어 모드로 전환
     */
    setViewMode() {
        this.currentMode = "viewer";
        this.transformControlManager.setMode("viewer");
        this.resetHoveredMesh(); // viewer 모드로 전환 시 hover 효과 제거
    }

    /**
     * 이동 모드 설정
     * 객체 이동 모드로 전환
     */
    setTranslateMode() {
        this.currentMode = "transform";
        this.transformControlManager.setMode("transform");
    }

    /**
     * 회전 모드 설정
     * 객체 회전 모드로 전환
     */
    setRotateMode() {
        this.currentMode = "rotate";

        // TransformControlManager에 모드 설정
        this.transformControlManager.setMode("rotate");
    }

    /**
     * 초기 상태로 리셋
     * 모든 메시를 초기 변환 상태로 복원
     */
    resetToOrigin() {
        // 초기 변환 상태 맵이 비어있으면 저장 시도
        if (this.initialTransforms.size === 0) {
            console.warn("Initial transforms map is empty, attempting to save transforms first");
            this.saveInitTransform();
        }
        
        this.meshes.forEach((mesh) => {
            if (!mesh) {
                console.warn("Encountered null or undefined mesh during reset");
                return;
            }
            
            const initialTransform = this.initialTransforms.get(mesh.id);
            if (initialTransform) {
                mesh.position.copy(initialTransform.position);
                mesh.rotation.copy(initialTransform.rotation);
                mesh.scale.copy(initialTransform.scale);
            } else {
                console.warn(
                    `No initial transform found for Mesh ID: ${mesh.id}. Current position: ${JSON.stringify({
                        x: mesh.position.x,
                        y: mesh.position.y,
                        z: mesh.position.z
                    })}`
                );
                
                // 대체 방안으로 현재 위치를 초기 위치로 저장
                this.initialTransforms.set(mesh.id, {
                    position: mesh.position.clone(),
                    rotation: mesh.rotation.clone(),
                    scale: mesh.scale.clone(),
                });
                console.log(`Created fallback initial transform for Mesh ID: ${mesh.id}`);
            }
        });
    
        this.setViewMode();
    }

    /**
     * 상태 업데이트
     * 애니메이션, 회전, 호버 효과 등 상태 업데이트
     * @param {number} delta - 프레임 간 경과 시간
     */
    update(delta) {
        // 메시가 있고 초기 변환값이 없을 때만 저장 시도
        if (this.meshes && this.meshes.length > 0 && this.initialTransforms.size === 0) {
            // 첫 번째 로드 시에만 메시지 로깅
            if (!this._hasLoggedInitialTransformMessage) {
                console.log("Attempting to save initial transforms for meshes:", this.meshes.length);
                this._hasLoggedInitialTransformMessage = true;
            }
            this.saveInitTransform();
        }

        // 애니메이션 업데이트 - 실제로 애니메이션이 있는 경우에만
        if (this.animationMixer && this.animationMixer._actions.length > 0) {
            this.animationMixer.update(delta);
        }

        // 회전 상태 업데이트 - 실제로 회전 모드이고 선택된 메시가 있는 경우에만
        if (this.currentMode === "rotate" && this.selectedMesh) {
            const rotation = this.selectedMesh.rotation;

            // 비정상적인 회전 감지 및 수정 (매 프레임이 아닌 필요할 때만)
            if (
                Math.abs(rotation.x) > Math.PI * 2 ||
                Math.abs(rotation.y) > Math.PI * 2 ||
                Math.abs(rotation.z) > Math.PI * 2
            ) {
                // 회전을 -π ~ π 범위로 정규화
                rotation.x = rotation.x % (Math.PI * 2);
                rotation.y = rotation.y % (Math.PI * 2);
                rotation.z = rotation.z % (Math.PI * 2);

                // 회전값이 π를 초과하면 -π 방향으로 조정
                if (rotation.x > Math.PI) rotation.x -= Math.PI * 2;
                if (rotation.y > Math.PI) rotation.y -= Math.PI * 2;
                if (rotation.z > Math.PI) rotation.z -= Math.PI * 2;
            }
        }

        // 호버 효과 업데이트 - 실제로 호버된 메시가 있는 경우에만
        if (this.hoveredMesh && this.hoveredMesh.material && this.hoveredMesh.material.emissiveIntensity !== undefined) {
            const startTime = this.pulseStartTime.get(this.hoveredMesh.id);
            if (startTime) {
                const elapsedTime = (performance.now() - startTime) / 1000;
                const intensity = 0.3 + Math.sin(elapsedTime * 5) * 0.2;
                this.hoveredMesh.material.emissiveIntensity = intensity;
            }
        }

        // TransformControlManager 업데이트 - 실제로 변환 모드인 경우에만
        if (this.transformControlManager && this.isTransformMode()) {
            this.transformControlManager.update();
        }
    }

    /**
     * 현재 변환 모드인지 확인
     * @returns {boolean} - 변환 모드 여부
     */
    isTransformMode() {
        return this.currentMode === "transform" || this.currentMode === "rotate";
    }
}
