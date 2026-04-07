// ui/MeshLabelManager.js
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { MASS_KEYWORDS } from '../utils/Constants';

/**
 * 메시 라벨 매니저
 * mass_1, tumor_2 등 mass 관련 메시에만 2D 숫자 라벨을 표시하고 관리
 */
export class MeshLabelManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.labels = new Map(); // meshId -> CSS2DObject
        this.labelData = new Map(); // meshId -> { label, textureName, number }
        this.updateNeeded = true;
    }

    /**
     * 메시에 숫자 라벨 추가
     * mass_1, tumor_2 패턴을 찾아서 라벨 생성 (mass 관련 메시만)
     * @param {THREE.Mesh} mesh - 대상 메시
     * @returns {CSS2DObject|null} - 생성된 라벨 객체
     */
    addLabelToMesh(mesh) {
        // mass 관련 키워드 체크
        const isMassRelated = MASS_KEYWORDS.some((keyword) =>
            mesh.name.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (!isMassRelated) return null;

        // mass_1, tumor_2 패턴 체크 (숫자로 끝나는 메시)
        const numberMatch = mesh.name.match(/.+_(\d+)$/);
        if (!numberMatch) return null;

        // hat 메시는 라벨 표시 제외
        if (mesh.name.toLowerCase().includes('hat')) {
            return null;
        }

        const number = numberMatch[1];
        const labelDiv = this.createLabelDiv(number, mesh.name);
        const css2dObject = new CSS2DObject(labelDiv);

        // 메시의 바운딩박스 기준으로 카메라 쪽에 배치
        this.updateLabelPosition(mesh, css2dObject);

        css2dObject.userData.meshId = mesh.uuid;
        css2dObject.userData.meshName = mesh.name;
        css2dObject.userData.number = number;
        mesh.userData.labelObject = css2dObject; // 역참조

        this.scene.add(css2dObject);
        this.labels.set(mesh.uuid, css2dObject);
        this.labelData.set(mesh.uuid, { label: labelDiv, number, meshName: mesh.name });

        return css2dObject;
    }

    /**
     * 모든 라벨의 위치를 업데이트 (매 프레임 called)
     */
    updateAllLabelsPosition() {
        for (const [meshId, labelObj] of this.labels) {
            // scene에서 메시 찾기
            const mesh = this.findMeshByUUID(meshId);
            if (mesh && mesh.visible) {
                this.updateLabelPosition(mesh, labelObj);
                labelObj.visible = true;
            } else if (labelObj) {
                labelObj.visible = false;
            }
        }
    }

    /**
     * UUID로 메시 찾기
     * @param {string} uuid - 메시의 UUID
     * @returns {THREE.Mesh|null}
     */
    findMeshByUUID(uuid) {
        let foundMesh = null;
        this.scene.traverse((obj) => {
            if (obj.uuid === uuid) {
                foundMesh = obj;
            }
        });
        return foundMesh;
    }

    /**
     * 개별 메시의 라벨 위치 업데이트
     * @param {THREE.Mesh} mesh - 대상 메시
     * @param {CSS2DObject} labelObj - 라벨 객체
     */
    updateLabelPosition(mesh, labelObj) {
        const bbox = new THREE.Box3().setFromObject(mesh);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());

        // 카메라에서 메시 중심으로의 벡터
        const dirToCamera = this.camera.position.clone().sub(center).normalize();

        // 바운딩박스의 카메라 쪽 면 중심에 라벨 배치
        const offset = size.length() * 0.3; // 오프셋 거리 (메시 크기의 30%)
        const labelPos = center.clone().add(dirToCamera.multiplyScalar(offset));

        labelObj.position.copy(labelPos);
    }

    /**
     * 라벨 DOM 생성
     * @param {string} number - 표시할 숫자
     * @param {string} meshName - 메시 이름
     * @returns {HTMLElement}
     */
    createLabelDiv(number, meshName) {
        const div = document.createElement('div');
        div.className = 'mesh-label';
        div.textContent = number;
        div.style.cssText = `
            background: rgba(0, 0, 0, 0.85);
            color: #fff;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 16px;
            font-weight: bold;
            white-space: nowrap;
            pointer-events: none;
            user-select: none;
            border: 2px solid #4a90e2;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            font-family: 'Courier New', monospace;
            letter-spacing: 1px;
        `;
        div.title = meshName;
        return div;
    }

    /**
     * 메시 visibility 변경 시 라벨도 동기화
     * @param {string} meshId - 메시의 UUID
     * @param {boolean} visible - 표시 여부
     */
    setLabelVisibility(meshId, visible) {
        const labelObj = this.labels.get(meshId);
        if (labelObj) {
            labelObj.visible = visible;
        }
    }

    /**
     * 메시 ID에서 모든 라벨의 visibility 업데이트
     * @param {THREE.Object3D} mesh - 메시 객체
     */
    updateLabelVisibilityForMesh(mesh) {
        const labelObj = this.labels.get(mesh.uuid);
        if (labelObj) {
            labelObj.visible = mesh.visible;
        }
    }

    /**
     * 라벨 제거
     * @param {string} meshId - 메시의 UUID
     */
    removeLabelFromMesh(meshId) {
        const labelObj = this.labels.get(meshId);
        if (labelObj) {
            this.scene.remove(labelObj);
            this.labels.delete(meshId);
            this.labelData.delete(meshId);
        }
    }

    /**
     * 모든 라벨 제거
     */
    clearAllLabels() {
        for (const [meshId, labelObj] of this.labels) {
            this.scene.remove(labelObj);
        }
        this.labels.clear();
        this.labelData.clear();
    }

    /**
     * 씬의 모든 메시를 스캔하여 라벨 초기화
     */
    initializeLabelsFromScene() {
        this.clearAllLabels();
        this.scene.traverse((obj) => {
            if (obj.isMesh && obj.name.match(/.+_\d+$/)) {
                // mass 관련 메시인지 체크
                const isMassRelated = MASS_KEYWORDS.some((keyword) =>
                    obj.name.toLowerCase().includes(keyword.toLowerCase())
                );
                if (isMassRelated) {
                    this.addLabelToMesh(obj);
                }
            }
        });
    }

    /**
     * 라벨 정보 조회
     * @param {string} meshId - 메시의 UUID
     * @returns {Object|null}
     */
    getLabelData(meshId) {
        return this.labelData.get(meshId) || null;
    }

    /**
     * 모든 라벨 정보 조회
     * @returns {Map}
     */
    getAllLabels() {
        return new Map(this.labels);
    }

    /**
     * 라벨 총 개수
     * @returns {number}
     */
    getLabelCount() {
        return this.labels.size;
    }
}
