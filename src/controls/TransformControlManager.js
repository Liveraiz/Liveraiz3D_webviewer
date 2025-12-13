import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import * as THREE from "three";

export default class TransformControlManager {
    /**
     * 변환 컨트롤 매니저 생성자
     * 3D 객체의 변환(이동, 회전)을 관리하는 컨트롤러 초기화
     * @param {THREE.Camera} camera - Three.js 카메라
     * @param {THREE.WebGLRenderer} renderer - Three.js 렌더러
     * @param {THREE.Scene} scene - Three.js 씬
     * @param {Array} meshes - 변환 대상 메시 배열
     * @param {Object} options - 추가 설정 옵션
     */
    constructor(camera, renderer, scene, meshes = [], options = {}) {
        this.camera = camera;
        this.renderer = renderer;
        this.scene = scene;
        this.meshes = meshes;
        this.orbit = options.controls;
        this.controlManager = options.controlManager;
        this.isTransformMode = false;
        this.currentMode = "viewer";
        this.currentModel = null;
        this.transformableMeshes = new Set();

        this.setupTransformControls();
    }

    /**
     * 변환 컨트롤 초기 설정
     * TransformControls의 기본 속성 및 이벤트 설정
     */
    setupTransformControls() {
        this.control = new TransformControls(
            this.camera,
            this.renderer.domElement
        );

        // 회전 기준점 설정을 위한 새로운 설정 추가
        this.control.setSpace('local'); // local 좌표계 사용
        this.control.size = 1;

        // this.control.addEventListener("change", () => {
        //     if (this.renderer) {
        //         this.renderer.render(this.scene, this.camera);
        //     }
        // });

        this.control.addEventListener("dragging-changed", (event) => {
            if (this.orbit) {
                this.orbit.enabled = !event.value;
            }
            
            // Transform 상태 변경을 ControlManager에 알림
            if (this.controlManager) {
                console.log('[TransformControlManager] Transform dragging 상태 변경:', event.value);
                this.controlManager.setTransformState(event.value);
            }
        });

        this.scene.add(this.control);
        this.control.visible = false;
    }

    /**
     * 모델 등록
     * 변환 컨트롤에 새로운 모델을 등록하고 필요한 경우 attach
     * @param {THREE.Object3D} model - 등록할 3D 모델
     */
    registerModel(model) {
        if (!model) {
            console.warn(
                "TransformControls: Invalid or non-transformable model",
                model?.name
            );
            return;
        }

        // 이미 같은 모델이 등록되어 있으면 중복 등록 방지
        if (this.currentModel === model) {
            return;
        }

        // opacity가 0.01 이하인 메시는 transform control을 적용하지 않음
        if (model.material && model.material.opacity !== undefined && model.material.opacity <= 0.01) {
            // 로그 제거: 성능 최적화
            return;
        }

        this.currentModel = model;
        // 로그 제거: 성능 최적화 및 콘솔 스팸 방지
        // console.log("TransformControls: Model registered", model.name);

        if (this.currentMode !== "viewer") {
            this.attach(model);
        }
    }

    /**
     * 씬 내 모델 확인
     * 메시가 씬의 자식으로 존재하는지 확인
     * @param {THREE.Mesh} mesh - 확인할 메시
     * @returns {boolean} - 씬 내 존재 여부
     */
    isModelInScene(mesh) {
        // 자신이 씬의 자식인지 확인
        if (this.scene.children.includes(mesh)) {
            return true;
        }

        // 부모를 따라 올라가면서 씬의 자식인지 확인
        let parent = mesh.parent;
        while (parent) {
            if (this.scene.children.includes(parent)) {
                return true;
            }
            parent = parent.parent;
        }

        return false;
    }

    /**
     * 레이캐스트 처리
     * 변환 컨트롤과의 교차 검사 수행
     * @param {THREE.Raycaster} raycaster - 레이캐스터
     * @returns {Array} - 교차점 배열
     */
    raycast(raycaster) {
        if (!this.control || !this.control.children) return [];

        const intersects = [];

        this.control.children.forEach((child) => {
            if (child.isMesh || child.isLine) {
                const childIntersects = raycaster.intersectObject(child, true);
                intersects.push(...childIntersects);
            }
        });

        return intersects;
    }

    /**
     * 객체 연결
     * 변환 컨트롤을 특정 메시에 연결
     * @param {THREE.Mesh} mesh - 연결할 메시
     */
    attach(mesh) {
        if ((this.currentMode === "transform" || this.currentMode === "rotate") && !mesh.name.includes("mov")) {
            console.warn(`[${mesh.name}]은(는) 이동/회전이 불가능(unmovable)한 Mesh입니다.`);
            return;
        }

        // opacity가 0.01 이하인 메시는 transform control을 적용하지 않음
        if (mesh.material && mesh.material.opacity !== undefined && mesh.material.opacity <= 0.01) {
            console.warn(`[${mesh.name}]은(는) 투명도가 0.01 이하로 transform control을 적용할 수 없습니다.`);
            return;
        }

        try {
            if (this.controlManager) {
                // console.log('[TransformControlManager] Transform 모드 활성화 시도');
                this.controlManager.setTransformState(true);
            }

            this.control.attach(mesh);
            this.control.visible = true;
            // console.log("TransformControls: 메시 attach 성공");
            
        } catch (error) {
            console.error("TransformControls: attach 실패", error);
            if (this.controlManager) {
                this.controlManager.setTransformState(false);
            }
        }
    }

    /**
     * 객체 연결 해제
     * 변환 컨트롤에서 현재 연결된 객체 분리
     */
    detach() {
        if (this.control) {
            this.control.detach();
            this.control.visible = false;
            
            if (this.controlManager) {
                // console.log('[TransformControlManager] Transform 모드 비활성화');
                this.controlManager.setTransformState(false);
            }
        }
    }

    /**
     * 모드 설정
     * 변환 컨트롤의 동작 모드 변경 (뷰어/이동/회전)
     * @param {string} mode - 설정할 모드
     */
    setMode(mode) {
        this.currentMode = mode;
        switch (mode) {
            case "viewer":
                this.isTransformMode = false;
                this.detach();
                if (this.orbit) {
                    this.orbit.enabled = true;
                }
                // viewer 모드일 때 ControlManager에 알림
                if (this.controlManager) {
                    this.controlManager.setTransformState(false);
                }
                break;

            case "transform":
            case "rotate":
                this.isTransformMode = true;
                if (this.currentModel && this.currentModel.name.includes("mov")) {
                    // opacity가 0.01 이하인 메시는 transform control을 적용하지 않음
                    if (this.currentModel.material && this.currentModel.material.opacity !== undefined && this.currentModel.material.opacity <= 0.01) {
                        console.warn(`[${this.currentModel.name}]은(는) 투명도가 0.01 이하로 transform control을 적용할 수 없습니다.`);
                        break;
                    }
                    this.attach(this.currentModel);
                    this.control.setMode(mode === "transform" ? "translate" : "rotate");
                } else {
                    console.warn("현재 선택된 Mesh는 변형이 불가합니다.");
                }
                break;
        }
    }

    /**
     * 리소스 정리
     * 변환 컨트롤 제거 및 메모리 정리
     */
    dispose() {
        if (this.control) {
            this.detach();
            this.scene.remove(this.control);
            this.control.dispose();
        }
    }

    /**
     * 상태 업데이트
     * 변환 컨트롤의 상태 갱신
     */
    update() {
        if (this.control && typeof this.control.update === "function") {
            this.control.update();
        }
    }
}
