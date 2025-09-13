import * as THREE from "three";
import { LIVER_KEYWORDS, MESH_CONSTANTS } from "../utils/Constants";

export default class MaterialManager {
    /**
     * MaterialManager 클래스 생성자
     * 재질 관리를 위한 기본 설정 초기화
     * @param {THREE.WebGLRenderer} renderer - Three.js 렌더러 인스턴스
     */
    constructor(renderer) {
        if (!renderer) {
            throw new Error("Renderer is required for MaterialManager");
        }

        this.renderer = renderer;
        this.materials = new Map();
        this.defaultMaterials = new Map();
        this.textureLoader = new THREE.TextureLoader();
        this.meshVisibility = new Map();
        this.meshOverlappings = {};
        this.meshTooltip = null; // MeshTooltip 참조 추가
        
        // 기본 머티리얼들 미리 생성 및 컴파일
        this.initializeMaterials();
        
        console.log("MaterialManager initialized");
    }

    /**
     * MeshTooltip 참조를 설정합니다.
     * @param {MeshTooltip} meshTooltip - MeshTooltip 인스턴스
     */
    setMeshTooltip(meshTooltip) {
        this.meshTooltip = meshTooltip;
        console.log("[MaterialManager] MeshTooltip 설정됨");
    }

    /**
     * 메시의 opacity를 변경하고 MeshTooltip에 알림을 보냅니다.
     * @param {THREE.Mesh} mesh - opacity를 변경할 메시
     * @param {number} opacity - 새로운 opacity 값
     */
    setMeshOpacity(mesh, opacity) {
        if (!mesh || !mesh.material) {
            console.warn("[MaterialManager] Invalid mesh or material for opacity change");
            return;
        }

        // opacity 변경
        mesh.material.opacity = Math.max(0, Math.min(1, opacity));
        mesh.material.needsUpdate = true;

        // MeshTooltip에 opacity 변경 알림
        if (this.meshTooltip) {
            this.meshTooltip.updateMeshOpacity(mesh.name, opacity);
        }

        console.log(`[MaterialManager] ${mesh.name} opacity changed to ${opacity}`);
    }

    /**
     * 기본 머티리얼들을 초기화하고 컴파일합니다.
     * 나중에 발생할 수 있는 셰이더 컴파일 지연을 방지
     */
    initializeMaterials() {
        if (!this.renderer) {
            console.warn("Renderer not available, skipping material initialization");
            return;
        }
        
        // 기본 재질들
        const defaultMaterials = {
            'standard': new THREE.MeshStandardMaterial({ 
                color: 0xffffff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
            }),
            'phong': new THREE.MeshPhongMaterial({ 
                color: 0xffffff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
            }),
            'basic': new THREE.MeshBasicMaterial({ 
                color: 0xffffff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
            })
        };
        
        // 머티리얼 등록 및 셰이더 컴파일 강제화
        Object.entries(defaultMaterials).forEach(([name, material]) => {
            // 머티리얼 등록
            this.registerMaterial(name, material);
            
            try {
                // 셰이더 컴파일 강제화 (더미 메시 생성 및 렌더링)
                const dummyGeometry = new THREE.BoxGeometry(1, 1, 1);
                const dummyMesh = new THREE.Mesh(dummyGeometry, material);
                
                // 임시 씬과 카메라 생성
                const tempScene = new THREE.Scene();
                const tempCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
                
                tempScene.add(dummyMesh);
                this.renderer.compile(tempScene, tempCamera);
                
                // 메모리 정리
                tempScene.remove(dummyMesh);
                dummyGeometry.dispose();
                
                console.log(`Material '${name}' precompiled successfully`);
            } catch (error) {
                console.warn(`Failed to precompile material '${name}':`, error);
            }
        });
    }

    /**
     * 메시 생성 함수
     * 지정된 geometry와 material을 사용하여 새로운 메시를 생성
     * @param {THREE.BufferGeometry} geometry - 메시의 형상
     * @param {THREE.Material} originalMaterial - 원본 재질
     * @param {string} name - 메시의 이름
     * @returns {THREE.Mesh} 생성된 메시
     */
    createMesh(geometry, originalMaterial, name) {
        // 로깅 추가
        console.log(`Creating mesh: ${name}`, {
            hasGeometry: !!geometry,
            hasMaterial: !!originalMaterial
        });
        
        // Cloning material to avoid sharing between meshes
        const material = originalMaterial.clone();
        
        // Always set double-sided rendering
        material.side = THREE.DoubleSide;
        
        // Ensure material parameters are properly set
        material.needsUpdate = true;
        
        // Force material to update its shader
        if (material.type === "MeshStandardMaterial" || material.type === "MeshPhysicalMaterial") {
            material.envMapIntensity = material.envMapIntensity || 1.0;
            material.roughness = Math.min(Math.max(material.roughness || 0.5, 0.2), 0.8); // 제한된 범위 내로 유지
            material.metalness = Math.min(Math.max(material.metalness || 0.3, 0.1), 0.7); // 제한된 범위 내로 유지
        }
        
        // 이름이 mask를 포함하면 투명하게 설정
        if (name && name.toLowerCase().includes("mask")) {
            material.transparent = true;
            material.opacity = 0.5;
        }
        
        // Create and return new mesh
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = name || "unnamed_mesh";
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // 메시가 생성된 직후 셰이더 컴파일 강제화 
        if (this.renderer) {
            try {
                const tempScene = new THREE.Scene();
                const tempCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
                tempScene.add(mesh);
                this.renderer.compile(tempScene, tempCamera);
                tempScene.remove(mesh);
            } catch (error) {
                console.warn(`Failed to precompile shader for mesh '${name}':`, error);
            }
        }
        
        return mesh;
    }

    /**
     * 겹치는 메시 처리 함수
     * 여러 메시들의 가시성을 관리하고 겹침 상태를 처리
     * @param {Array<THREE.Mesh>} meshes - 처리할 메시 배열
     * @returns {Map} 메시 가시성 업데이트 정보
     */
    handleOverlappingMeshes(meshes) {
        const { VESSEL_KEYWORDS, KIDNEY_HIERARCHY } = MESH_CONSTANTS;

        // 투명도가 적용된 메시들 중 vessel이 아닌 것만 필터링
        const transparentMeshes = meshes.filter(mesh => 
            mesh.material && 
            (mesh.material.transparent === true || mesh.material.opacity < 1) &&
            !VESSEL_KEYWORDS.some(keyword => mesh.name.toLowerCase().includes(keyword))
        );

        const meshInfo = new Map();
        const visibilityUpdates = new Map();
        
        // 메시들을 kidney 관련과 기타로 분류
        const kidneyMeshes = [];
        const otherMeshes = [];
        
        transparentMeshes.forEach(mesh => {
            if (KIDNEY_HIERARCHY.some(keyword => mesh.name.toLowerCase().includes(keyword))) {
                kidneyMeshes.push(mesh);
            } else {
                otherMeshes.push(mesh);
            }
        });

        // Kidney 메시 처리
        const leftKidneyMeshes = kidneyMeshes.filter(mesh => mesh.name.toLowerCase().includes('left'));
        const rightKidneyMeshes = kidneyMeshes.filter(mesh => mesh.name.toLowerCase().includes('right'));

        // 각 신장별로 가장 큰 메시만 보이게 설정
        [leftKidneyMeshes, rightKidneyMeshes].forEach(sideMeshes => {
            if (sideMeshes.length > 0) {
                // kidney > cortex > column > medulla 순으로 우선순위
                const mainMesh = sideMeshes.reduce((selected, current) => {
                    const selectedPriority = KIDNEY_HIERARCHY.findIndex(keyword => 
                        selected.name.toLowerCase().includes(keyword));
                    const currentPriority = KIDNEY_HIERARCHY.findIndex(keyword => 
                        current.name.toLowerCase().includes(keyword));
                    return selectedPriority < currentPriority ? selected : current;
                });

                // 해당 쪽의 모든 메시에 대한 가시성 설정
                sideMeshes.forEach(mesh => {
                    const isMainMesh = mesh.name === mainMesh.name;
                    visibilityUpdates.set(mesh.name, isMainMesh);
                    console.log(`Setting ${mesh.name} visibility to ${isMainMesh}`);
                });
            }
        });

        // vessel과 투명하지 않은 메시들만 보이게 설정
        meshes.forEach(mesh => {
            if (!visibilityUpdates.has(mesh.name)) {
                const isVessel = VESSEL_KEYWORDS.some(keyword => 
                    mesh.name.toLowerCase().includes(keyword)
                );
                if (isVessel) {
                    visibilityUpdates.set(mesh.name, true);
                    console.log(`Keeping vessel mesh visible: ${mesh.name}`);
                }
            }
        });

        console.log("\nFinal visibility updates:", 
            Array.from(visibilityUpdates.entries())
                .map(([name, visible]) => `${name}: ${visible}`));
                
        return visibilityUpdates;
    }

    /**
     * 메시의 중심점 계산
     * 메시의 바운딩 박스를 기준으로 중심 좌표를 계산
     * @param {THREE.Mesh} mesh - 대상 메시
     * @returns {THREE.Vector3} 중심점 좌표
     */
    calculateMeshCenter(mesh) {
        const box = mesh.geometry.boundingBox;
        return new THREE.Vector3(
            (box.max.x + box.min.x) / 2,
            (box.max.y + box.min.y) / 2,
            (box.max.z + box.min.z) / 2
        );
    }

    /**
     * 겹치는 메시 찾기
     * 주어진 메시와 겹치는 다른 메시들을 찾아냄
     * @param {Object} info - 현재 메시 정보
     * @param {Map} meshInfo - 전체 메시 정보
     * @returns {Array} 겹치는 메시들의 배열
     */
    findOverlappingMeshes(info, meshInfo) {
        const overlapping = [];

        meshInfo.forEach((otherInfo, otherUuid) => {
            if (otherUuid !== info.mesh.uuid) {
                console.log(`\nComparing transparent meshes: ${info.mesh.name} with ${otherInfo.mesh.name}`);
                
                // 바운딩 박스 겹침 체크
                if (this.checkBoxOverlap(info.boundingBox, otherInfo.boundingBox)) {
                    console.log(`Bounding boxes overlap`);
                    overlapping.push(otherInfo);
                } else {
                    console.log(`No bounding box overlap`);
                }
            }
        });

        return overlapping;
    }

    /**
     * 메시 부피 계산
     * 메시의 바운딩 박스를 기준으로 부피를 계산
     * @param {THREE.Mesh} mesh - 대상 메시
     * @returns {number} 계산된 부피
     */
    calculateMeshVolume(mesh) {
        const box = mesh.geometry.boundingBox;
        return (box.max.x - box.min.x) * 
               (box.max.y - box.min.y) * 
               (box.max.z - box.min.z);
    }

    /**
     * 바운딩 박스 겹침 확인
     * 두 바운딩 박스가 서로 겹치는지 검사
     * @param {THREE.Box3} box1 - 첫 번째 바운딩 박스
     * @param {THREE.Box3} box2 - 두 번째 바운딩 박스
     * @returns {boolean} 겹침 여부
     */
    checkBoxOverlap(box1, box2) {
        const tolerance = 0.001;
        return (box1.min.x <= box2.max.x + tolerance && box1.max.x >= box2.min.x - tolerance) &&
               (box1.min.y <= box2.max.y + tolerance && box1.max.y >= box2.min.y - tolerance) &&
               (box1.min.z <= box2.max.z + tolerance && box1.max.z >= box2.min.z - tolerance);
    }

    /**
     * 다크모드에 따라 재질을 업데이트하는 메서드
     * @param {boolean} isDarkMode - 다크모드 여부
     */
    updateMaterialsForDarkMode(isDarkMode) {
        this.materials.forEach((material) => {
            if (material.type === 'MeshStandardMaterial' || material.type === 'MeshPhongMaterial') {
                // 라이트모드일 때는 더 밝은 색상으로 조정
                if (!isDarkMode) {
                    material.emissive.setRGB(0.2, 0.2, 0.2);
                    material.emissiveIntensity = 0.2;
                    material.metalness = 0.3;
                    material.roughness = 0.7;
                } else {
                    // 다크모드일 때는 기본값으로 복원
                    material.emissive.setRGB(0, 0, 0);
                    material.emissiveIntensity = 0;
                    material.metalness = 0.5;
                    material.roughness = 0.5;
                }
            }

            // 재질 업데이트 필요 표시
            material.needsUpdate = true;
        });
    }

    /**
     * 재질을 등록하는 메서드
     * @param {string} name - 재질 이름
     * @param {THREE.Material} material - Three.js 재질 객체
     */
    registerMaterial(name, material) {
        this.materials.set(name, material);
        // 기본 상태 저장
        this.defaultMaterials.set(name, {
            emissive: material.emissive ? material.emissive.clone() : null,
            emissiveIntensity: material.emissiveIntensity,
            metalness: material.metalness,
            roughness: material.roughness
        });
    }

    /**
     * 재질을 가져오는 메서드
     * @param {string} name - 재질 이름
     * @returns {THREE.Material|null} - 해당 이름의 재질 또는 null
     */
    getMaterial(name) {
        return this.materials.get(name) || null;
    }

    /**
     * 모든 재질을 초기화하는 메서드
     */
    resetMaterials() {
        this.defaultMaterials.forEach((defaultState, name) => {
            const material = this.materials.get(name);
            if (material) {
                if (defaultState.emissive) {
                    material.emissive.copy(defaultState.emissive);
                }
                material.emissiveIntensity = defaultState.emissiveIntensity;
                material.metalness = defaultState.metalness;
                material.roughness = defaultState.roughness;
                material.needsUpdate = true;
            }
        });
    }
}
