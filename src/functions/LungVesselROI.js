import * as THREE from "three";

/**
 * LungVesselROI - Region of Interest 시각화
 * See Through와 동일한 방식으로 마우스 포인터 영역을 컬러/흑백으로 처리
 */
export default class LungVesselROI {
    constructor(
        scene,
        camera,
        renderer,
        {
            roiRadius = 20,
            isMobile = false,
            nonDesaturatedMeshNames = [],
            targetRegionMeshNames = ["target a", "target_a", "target-a"],
        } = {}
    ) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.roiRadius = isMobile ? roiRadius * 1.5 : roiRadius;
        this.isMobile = isMobile;
        this.nonDesaturatedMeshNames = nonDesaturatedMeshNames.map((name) =>
            name.toLowerCase()
        );
        this.targetRegionMeshNames = targetRegionMeshNames.map((name) =>
            name.toLowerCase().replace(/[\s_-]+/g, " ").trim()
        );

        // 폐혈관 메시 저장 (타겟)
        this.lungVesselMeshes = [];
        // Nodules 예외 메시 저장 (컬러 유지)
        this.nodulesExceptionMeshes = [];
        // 그 외 모든 메시 저장 (비타겟 - 흑백 처리)
        this.otherMeshes = [];
        this.originalMaterials = new Map(); // 모든 Mesh와 원본 material을 매핑

        // Renderer 설정 저장 (복원용)
        this.originalRendererSettings = {
            sortObjects: renderer.sortObjects,
        };

        // 메시별 원본 속성 저장 (복원용)
        this.originalMeshSettings = new Map();

        // 상태 플래그
        this.isActive = false;
    }

    normalizeMeshName(meshName) {
        return meshName.toLowerCase().replace(/[\s_-]+/g, " ").trim();
    }

    isTargetRegionMesh(meshName) {
        const normalizedName = this.normalizeMeshName(meshName);
        return this.targetRegionMeshNames.some((targetName) =>
            normalizedName.includes(targetName)
        );
    }

    /**
     * 폐혈관 ROI 모드 활성화 (See Through와 동일한 방식)
     */
    enableLungVesselROI() {
        // === Renderer 레벨 설정: Z-fighting 방지 ===
        // sortObjects를 활성화해서 깊이 순서대로 렌더링
        this.renderer.sortObjects = true;

        // ROI를 적용할 메시 이름들
        const lungVesselNames = [
            "pulmonary_artery",
            "pulmonary_vein",
            "bronchus",
            "airway",
            "airways",
            "airways wall",
            "vessel",
            "artery",
            "arteries",
            "vein",
            "veins",
            "capillary",
        ];

        // Nodule 예외 메시 이름들 (항상 컬러 유지)
        const nodulesExceptionNames = [
            "nodules",
            "nodule",
            "nodules margin",
            "nodule margin",
        ];

        // desaturated 예외 메시 이름들 (항상 컬러 유지)
        const nonDesaturatedNames = [
            ...nodulesExceptionNames,
            ...this.nonDesaturatedMeshNames,
        ];

        // Step 1: Target A가 붙은 메시들만 찾아 bounding box 계산
        const combinedTargetBox = new THREE.Box3();
        let hasTargetRegionMesh = false;

        this.scene.traverse((object) => {
            if (object.isMesh) {
                const objectName = object.name.toLowerCase();
                
                // Target A 영역 메시만 타겟으로 사용
                if (this.isTargetRegionMesh(objectName)) {
                    const box = new THREE.Box3().setFromObject(object);
                    combinedTargetBox.union(box);
                    hasTargetRegionMesh = true;
                }
            }
        });

        // Step 2: 모든 메시를 분류: 타겟 vs 예외 vs 비타겟
        this.scene.traverse((object) => {
            if (object.isMesh) {
                const objectName = object.name.toLowerCase();

                // 모든 메시의 원본 material 저장
                this.originalMaterials.set(object, object.material);

                // 메시의 원본 속성 저장 (폴리곤 오프셋 등)
                this.originalMeshSettings.set(object, {
                    renderOrder: object.renderOrder,
                    polygonOffset: object.material.polygonOffset,
                    polygonOffsetFactor: object.material.polygonOffsetFactor,
                    polygonOffsetUnits: object.material.polygonOffsetUnits,
                });

                // desaturated 예외 확인 (항상 컬러 유지)
                const isLineMesh = objectName.includes("line");
                const isLabelMesh = objectName.includes("label");
                const isNonDesaturatedException =
                    isLineMesh ||
                    isLabelMesh ||
                    nonDesaturatedNames.some((name) =>
                        objectName.includes(name.toLowerCase())
                    );
                const isTargetRegionMesh = this.isTargetRegionMesh(objectName);

                if (isNonDesaturatedException || isTargetRegionMesh) {
                    // 예외: Nodule/Target A 메시 (항상 컬러 유지)
                    this.nodulesExceptionMeshes.push(object);
                } else {
                    // 폐혈관 여부 확인
                    const isMatchingMesh = lungVesselNames.some((name) =>
                        objectName.includes(name.toLowerCase())
                    );

                    if (isMatchingMesh) {
                        // Lung vessel 메시가 target과 교차하는지 확인
                        const meshBox = new THREE.Box3().setFromObject(object);
                        const intersectsTarget = meshBox.intersectsBox(combinedTargetBox);

                        if (intersectsTarget) {
                            // Target과 교차: 타겟 메시로 추가 (컬러)
                            this.lungVesselMeshes.push(object);
                        } else {
                            // Target과 교차하지 않음: 비타겟 메시로 추가 (흑백)
                            this.otherMeshes.push(object);
                        }
                    } else {
                        // 폐혈관이 아님: 비타겟 메시 (흑백 처리할 대상)
                        this.otherMeshes.push(object);
                    }
                }
            }
        });

        // 타겟 메시가 없으면 모든 메시 사용
        if (!hasTargetRegionMesh && this.lungVesselMeshes.length === 0) {
            console.warn(
                "No Target A meshes found. Using all lung vessel meshes for ROI effect."
            );
            this.scene.traverse((object) => {
                if (object.isMesh) {
                    const objectName = object.name.toLowerCase();
                    
                    // desaturated 예외 메시는 항상 컬러 유지
                    const isLineMesh = objectName.includes("line");
                    const isLabelMesh = objectName.includes("label");
                    const isNonDesaturatedException =
                        isLineMesh ||
                        isLabelMesh ||
                        nonDesaturatedNames.some((name) =>
                            objectName.includes(name.toLowerCase())
                        );
                    const isTargetRegionMesh = this.isTargetRegionMesh(objectName);
                    
                    if (isNonDesaturatedException || isTargetRegionMesh) {
                        if (!this.nodulesExceptionMeshes.includes(object)) {
                            this.nodulesExceptionMeshes.push(object);
                        }
                    } else {
                        const isMatchingMesh = lungVesselNames.some((name) =>
                            objectName.includes(name.toLowerCase())
                        );

                        if (isMatchingMesh && !this.lungVesselMeshes.includes(object)) {
                            this.lungVesselMeshes.push(object);
                            const index = this.otherMeshes.indexOf(object);
                            if (index > -1) {
                                this.otherMeshes.splice(index, 1);
                            }
                        }
                    }
                }
            });
        }

        // === 메시 레벨 설정: 각 메시에 Z-fighting 방지 적용 ===
        // 1. 비타겟 메시들을 즉시 흑백 처리 + 폴리곤 오프셋
        this.otherMeshes.forEach((mesh, index) => {
            this.applyDesaturatedMaterial(mesh);
            // renderOrder로 명시적 렌더링 순서 지정
            mesh.renderOrder = 100 + index; // 뒤쪽 메시들
        });

        // 2. Nodule 메시들도 renderOrder 설정 (앞쪽)
        this.nodulesExceptionMeshes.forEach((mesh, index) => {
            mesh.renderOrder = 200 + index; // 앞쪽 메시들
        });

        // 3. Target 교차 폐혈관도 renderOrder 설정
        this.lungVesselMeshes.forEach((mesh, index) => {
            mesh.renderOrder = 150 + index; // 중간
        });

        this.isActive = true;

        console.log(
            `LungVesselROI enabled with ${this.lungVesselMeshes.length} target meshes (intersecting target regions, colored), ${this.nodulesExceptionMeshes.length} nodules (always colored), and ${this.otherMeshes.length} other meshes (desaturated)`
        );
    }

    /**
     * 폐혈관 ROI 모드 비활성화
     */
    disableLungVesselROI() {
        // === Renderer 설정 복원 ===
        this.renderer.sortObjects = this.originalRendererSettings.sortObjects;

        // === 모든 메시의 원본 상태 복원 ===
        this.lungVesselMeshes.forEach((mesh) => {
            const originalMaterial = this.originalMaterials.get(mesh);
            if (originalMaterial) {
                mesh.material = originalMaterial;
            }
            // 메시 속성 복원
            const originalSettings = this.originalMeshSettings.get(mesh);
            if (originalSettings) {
                mesh.renderOrder = originalSettings.renderOrder;
            }
        });

        this.nodulesExceptionMeshes.forEach((mesh) => {
            const originalMaterial = this.originalMaterials.get(mesh);
            if (originalMaterial) {
                mesh.material = originalMaterial;
            }
            // 메시 속성 복원
            const originalSettings = this.originalMeshSettings.get(mesh);
            if (originalSettings) {
                mesh.renderOrder = originalSettings.renderOrder;
            }
        });

        this.otherMeshes.forEach((mesh) => {
            const originalMaterial = this.originalMaterials.get(mesh);
            if (originalMaterial) {
                mesh.material = originalMaterial;
            }
            // 메시 속성 복원
            const originalSettings = this.originalMeshSettings.get(mesh);
            if (originalSettings) {
                mesh.renderOrder = originalSettings.renderOrder;
            }
        });

        // 배열 초기화
        this.lungVesselMeshes = [];
        this.nodulesExceptionMeshes = [];
        this.otherMeshes = [];
        this.originalMaterials.clear();
        this.originalMeshSettings.clear();

        this.isActive = false;

        console.log("LungVesselROI disabled - all meshes and renderer settings restored");
    }

    /**
     * 메시를 완전히 흑백으로 처리 (비타겟 메시용)
     */
    applyDesaturatedMaterial(mesh) {
        const originalMaterial = this.originalMaterials.get(mesh);
        if (!originalMaterial) return;

        const newMaterial = originalMaterial.clone();
        newMaterial.transparent = true;
        
        // Z-fighting 방지: 깊이 쓰기 비활성화 및 폴리곤 오프셋 적용
        newMaterial.depthWrite = false;
        newMaterial.polygonOffset = true;
        newMaterial.polygonOffsetFactor = -1;
        newMaterial.polygonOffsetUnits = -1;

        newMaterial.onBeforeCompile = (shader) => {
            shader.fragmentShader = `
                ${shader.fragmentShader.replace(
                    "#include <dithering_fragment>",
                    `
                    float gray = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
                    gl_FragColor.rgb = vec3(gray);
                    #include <dithering_fragment>
                    `
                )}
            `;
        };

        mesh.material = newMaterial;
    }

    /**
     * 모든 메시의 원본 material 복원
     */
    restoreOriginalMaterials() {
        this.lungVesselMeshes.forEach((mesh) => {
            const originalMaterial = this.originalMaterials.get(mesh);
            if (originalMaterial) {
                mesh.material = originalMaterial;
            }
        });

        this.nodulesExceptionMeshes.forEach((mesh) => {
            const originalMaterial = this.originalMaterials.get(mesh);
            if (originalMaterial) {
                mesh.material = originalMaterial;
            }
        });

        this.otherMeshes.forEach((mesh) => {
            const originalMaterial = this.originalMaterials.get(mesh);
            if (originalMaterial) {
                mesh.material = originalMaterial;
            }
        });
    }

    /**
     * ROI 반경 업데이트 (브러시 크기 변경) - 더 이상 사용되지 않음
     */
    updateROIRadius(newRadius) {
        this.roiRadius = newRadius;
    }

    /**
     * 리소스 정리
     */
    dispose() {
        this.disableLungVesselROI();
    }
}
