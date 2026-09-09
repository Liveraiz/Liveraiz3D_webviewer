import * as THREE from "three";

/**
 * LungVesselROI - Region of Interest 시각화
 * See Through와 동일한 방식으로 마우스 포인터 영역을 컬러/흑백으로 처리
 */
export default class LungVesselROI {
    // 폐혈관/기관지로 인식되는 이름 키워드 (ROI 분류, 로드 시 opacity 강제 등에서 공용으로 사용)
    static VESSEL_BRONCHUS_KEYWORDS = [
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

        // nodule margin의 depth-aware 복제본 (혈관과의 앞/뒤 관계를 카메라 시점에서 드러내기 위함)
        this.marginCrossingOverlays = [];

        // 상태 플래그
        this.isActive = false;
        this.activationCount = 0;
    }

    /**
     * nodule margin depth-aware 복제본 제거 (geometry는 원본 메시가 사용 중이므로 dispose하지 않음)
     */
    clearMarginCrossingOverlays() {
        this.marginCrossingOverlays.forEach((overlay) => {
            if (overlay.parent) {
                overlay.parent.remove(overlay);
            }
            overlay.material?.dispose();
        });
        this.marginCrossingOverlays = [];
    }

    /**
     * ROI vessel 모드 활성화 여부와 무관하게 nodule margin 메시에 기본으로 적용할 스타일
     * (약한 반투명 + 얇은 fresnel 테두리). 모델 로드 직후 ModelLoader에서 호출됨.
     * @param {THREE.Mesh} mesh - nodule margin 메시
     */
    static applyDefaultNoduleMarginStyle(mesh) {
        if (!mesh || !mesh.material) return;

        const applyToMaterial = (material) => {
            const styledMaterial = material.clone();
            styledMaterial.opacity = 0.15;
            styledMaterial.transparent = true;
            styledMaterial.depthWrite = false;
            styledMaterial.depthTest = false;
            // ModelLoader가 로드 시 걸어둔 alphaTest를 물려받으면 낮은 opacity가 discard될 수 있어 초기화
            styledMaterial.alphaTest = 0;
            styledMaterial.userData.isLungVesselROIMaterial = true;
            styledMaterial.needsUpdate = true;

            const fresnelColor = styledMaterial.color.clone();
            styledMaterial.onBeforeCompile = (shader) => {
                shader.uniforms.fresnelColor = { value: fresnelColor };
                shader.uniforms.fresnelPower = { value: 3.5 };
                shader.uniforms.fresnelIntensity = { value: 1.4 };
                shader.uniforms.fresnelEdgeWidth = { value: 0.3 };

                shader.fragmentShader = shader.fragmentShader
                    .replace(
                        '#include <common>',
                        `
                        #include <common>
                        uniform vec3 fresnelColor;
                        uniform float fresnelPower;
                        uniform float fresnelIntensity;
                        uniform float fresnelEdgeWidth;
                        `
                    )
                    .replace(
                        '#include <dithering_fragment>',
                        `
                        float fresnelDot = clamp(dot(normalize(vViewPosition), normalize(normal)), 0.0, 1.0);
                        float fresnelBase = pow(1.0 - fresnelDot, fresnelPower);
                        float fresnelTerm = smoothstep(1.0 - fresnelEdgeWidth, 1.0, fresnelBase) * fresnelIntensity;
                        gl_FragColor.rgb += fresnelColor * fresnelTerm;
                        gl_FragColor.a = clamp(gl_FragColor.a + fresnelTerm, 0.0, 1.0);
                        #include <dithering_fragment>
                        `
                    );
            };

            return styledMaterial;
        };

        mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(applyToMaterial)
            : applyToMaterial(mesh.material);
        mesh.renderOrder = 150;
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

    isTransformControlMesh(object) {
        const controlMeshNames = new Set([
            "x",
            "y",
            "z",
            "e",
            "xy",
            "yz",
            "xz",
            "xyz",
            "xyze",
            "start",
            "end",
        ]);
        const normalizedName = this.normalizeMeshName(object.name || "");
        if (controlMeshNames.has(normalizedName)) return true;

        let parent = object.parent;
        while (parent) {
            if (parent.type === "TransformControls" || parent.name === "TransformControls") {
                return true;
            }
            parent = parent.parent;
        }

        return false;
    }

    getMaterialDebugInfo(material) {
        if (!material) return null;

        return {
            depthWrite: material.depthWrite,
        };
    }

    logMaterialSettings(stage) {
        const rows = [];
        this.scene.traverse((object) => {
            if (!object.isMesh || this.isTransformControlMesh(object)) return;

            const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];
            materials.forEach((material, materialIndex) => {
                rows.push({
                    stage,
                    mesh: object.name || "(unnamed)",
                    meshId: object.id,
                    materialIndex,
                    depthWrite: material?.depthWrite,
                    renderOrder: object.renderOrder,
                });
            });
        });

        console.groupCollapsed(`[LungVesselROI][debug] ${stage} (${rows.length} materials)`);
        console.table(rows);
        console.groupEnd();
        return rows;
    }

    /**
     * 폐혈관 ROI 모드 활성화 (See Through와 동일한 방식)
     */
    enableLungVesselROI() {
        this.activationCount += 1;
        const activationLabel = `activation-${this.activationCount}`;
        this.logMaterialSettings(`${activationLabel} before-enable`);

        // === Renderer 레벨 설정: Z-fighting 방지 ===
        // sortObjects를 활성화해서 깊이 순서대로 렌더링
        this.renderer.sortObjects = true;

        // ROI를 적용할 메시 이름들
        const lungVesselNames = LungVesselROI.VESSEL_BRONCHUS_KEYWORDS;

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
            if (object.isMesh && !this.isTransformControlMesh(object)) {
                const objectName = this.normalizeMeshName(object.name);
                
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
            if (object.isMesh && !this.isTransformControlMesh(object)) {
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
                const isLabelMesh = objectName.includes("label");
                // arteries가 포함된 메시(예: S5_acc_arteries)는 Target A 교차 여부와 무관하게 항상 컬러 유지
                const isArteriesMesh = objectName.includes("arteries");
                const isNonDesaturatedException =
                    isLabelMesh ||
                    isArteriesMesh ||
                    nonDesaturatedNames.some((name) =>
                        objectName.includes(this.normalizeMeshName(name))
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
                if (object.isMesh && !this.isTransformControlMesh(object)) {
                    const objectName = this.normalizeMeshName(object.name);
                    
                    // desaturated 예외 메시는 항상 컬러 유지
                    const isLabelMesh = objectName.includes("label");
                    const isNonDesaturatedException =
                        isLabelMesh ||
                        nonDesaturatedNames.some((name) =>
                            objectName.includes(this.normalizeMeshName(name))
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

        // 2. Nodule 메시들도 renderOrder 설정 (nodule margin은 혈관보다 먼저 그려지도록 낮게 배치)
        this.nodulesExceptionMeshes.forEach((mesh, index) => {
            const isNoduleMargin = this.normalizeMeshName(mesh.name).includes("nodule margin");
            mesh.renderOrder = (isNoduleMargin ? 150 : 200) + index;
            this.applyROIExceptionMaterial(mesh, isNoduleMargin ? 0.15 : undefined);
            if (isNoduleMargin) {
                this.applyFresnelEffect(mesh, { power: 3.5, intensity: 1.4, edgeWidth: 0.08 });
            }
        });

        // 3. Target 교차 폐혈관은 nodule margin 위로 그려지도록 가장 높은 renderOrder 부여
        // (margin과 교차하는 지점이 옅은 반투명 렌더링에 가려지지 않고 항상 선명하게 보이도록)
        this.lungVesselMeshes.forEach((mesh, index) => {
            mesh.renderOrder = 300 + index;
        });

        // 4. nodule margin의 depth-aware 복제본 생성 (레이어2) - 겹침 이슈로 비활성화
        // this.clearMarginCrossingOverlays();
        // this.nodulesExceptionMeshes.forEach((mesh, index) => {
        //     if (!this.normalizeMeshName(mesh.name).includes("nodule margin")) return;

        //     const baseColor = (mesh.material.color || new THREE.Color(0xffffff)).clone();
        //     const overlayMaterial = new THREE.MeshStandardMaterial({
        //         color: baseColor,
        //         transparent: true,
        //         opacity: 0.35,
        //         depthTest: true,
        //         depthWrite: false,
        //         side: THREE.DoubleSide,
        //         polygonOffset: true,
        //         polygonOffsetFactor: -1,
        //         polygonOffsetUnits: -1,
        //     });
        //     overlayMaterial.userData.isLungVesselROIMaterial = true;

        //     const overlay = new THREE.Mesh(mesh.geometry, overlayMaterial);
        //     overlay.name = `${mesh.name}__crossing_overlay`;
        //     overlay.position.copy(mesh.position);
        //     overlay.rotation.copy(mesh.rotation);
        //     overlay.scale.copy(mesh.scale);
        //     overlay.renderOrder = 350 + index; // 혈관(300+)이 먼저 그려진 뒤 depth test 되도록
        //     overlay.userData.isMarginCrossingOverlay = true;
        //     overlay.matrixAutoUpdate = mesh.matrixAutoUpdate;

        //     (mesh.parent || this.scene).add(overlay);
        //     this.marginCrossingOverlays.push(overlay);
        // });

        this.isActive = true;

        this.logMaterialSettings(`${activationLabel} after-enable`);

        console.log(
            `LungVesselROI ${activationLabel} enabled with ${this.lungVesselMeshes.length} target meshes (intersecting target regions, colored), ${this.nodulesExceptionMeshes.length} nodules (always colored), and ${this.otherMeshes.length} other meshes (desaturated)`
        );
    }

    /**
     * 폐혈관 ROI 모드 비활성화
     */
    disableLungVesselROI() {
        const activationLabel = `activation-${this.activationCount}`;
        this.logMaterialSettings(`${activationLabel} before-disable`);

        // === Renderer 설정 복원 ===
        this.renderer.sortObjects = this.originalRendererSettings.sortObjects;

        // === nodule margin depth-aware 복제본 제거 ===
        this.clearMarginCrossingOverlays();

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

        this.logMaterialSettings(`${activationLabel} after-disable`);
        console.log(`LungVesselROI ${activationLabel} disabled - all meshes and renderer settings restored`);
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
        // 매 프레임 실행되는 updateTransparentMeshRenderOrder의 강제 리셋에서 제외
        newMaterial.userData.isLungVesselROIMaterial = true;

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
     * 메쉬 가장자리(시선과 수직한 부분)가 밝게 빛나도록 Fresnel(rim light) 효과 적용
     * @param {THREE.Mesh} mesh - 적용할 메시
     * @param {Object} options - { color, power, intensity, edgeWidth } - color 미지정 시 재질 고유의 diffuse 색 사용, edgeWidth가 작을수록 테두리가 얇아짐(0~1)
     */
    applyFresnelEffect(mesh, options = {}) {
        if (!mesh || !mesh.material) return;
        const { color, power = 0.5, intensity = 0.5, edgeWidth = 0.15 } = options;

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
            // color가 지정되지 않으면 해당 재질의 원래 diffuse 색을 그대로 사용
            const fresnelColor = color !== undefined ? new THREE.Color(color) : material.color.clone();
            material.onBeforeCompile = (shader) => {
                shader.uniforms.fresnelColor = { value: fresnelColor };
                shader.uniforms.fresnelPower = { value: power };
                shader.uniforms.fresnelIntensity = { value: intensity };
                shader.uniforms.fresnelEdgeWidth = { value: edgeWidth };

                shader.fragmentShader = shader.fragmentShader
                    .replace(
                        '#include <common>',
                        `
                        #include <common>
                        uniform vec3 fresnelColor;
                        uniform float fresnelPower;
                        uniform float fresnelIntensity;
                        uniform float fresnelEdgeWidth;
                        `
                    )
                    .replace(
                        '#include <dithering_fragment>',
                        `
                        // 시선(vViewPosition)과 노멀을 이용해 실루엣에 가까운 아주 얇은 구간만 강조
                        float fresnelDot = clamp(dot(normalize(vViewPosition), normalize(normal)), 0.0, 1.0);
                        float fresnelBase = pow(1.0 - fresnelDot, fresnelPower);
                        float fresnelTerm = smoothstep(1.0 - fresnelEdgeWidth, 1.0, fresnelBase) * fresnelIntensity;
                        gl_FragColor.rgb += fresnelColor * fresnelTerm;
                        gl_FragColor.a = clamp(gl_FragColor.a + fresnelTerm, 0.0, 1.0);
                        #include <dithering_fragment>
                        `
                    );
            };
            material.needsUpdate = true;
        });
    }

    applyROIExceptionMaterial(mesh, forcedOpacity = undefined) {
        const originalMaterial = this.originalMaterials.get(mesh);
        if (!originalMaterial) return;

        const applyToMaterial = (material) => {
            const roiMaterial = material.clone();
            if (forcedOpacity !== undefined) {
                roiMaterial.opacity = forcedOpacity;
            }
            if (roiMaterial.opacity < 1) {
                roiMaterial.transparent = true;
                roiMaterial.depthWrite = false;
                roiMaterial.depthTest = false;
                // ModelLoader가 로드 시 걸어둔 alphaTest(0.30)를 그대로 물려받으면
                // opacity가 그 값보다 낮을 때 프래그먼트가 통째로 discard되어 안 보임
                roiMaterial.alphaTest = 0;
                roiMaterial.userData.isLungVesselROIMaterial = true;
            }
            roiMaterial.needsUpdate = true;
            return roiMaterial;
        };

        mesh.material = Array.isArray(originalMaterial)
            ? originalMaterial.map(applyToMaterial)
            : applyToMaterial(originalMaterial);

        console.debug("[LungVesselROI] ROI exception material applied", {
            meshName: mesh.name,
            opacity: Array.isArray(mesh.material)
                ? mesh.material.map((material) => material.opacity)
                : mesh.material.opacity,
            transparent: Array.isArray(mesh.material)
                ? mesh.material.map((material) => material.transparent)
                : mesh.material.transparent,
            depthWrite: Array.isArray(mesh.material)
                ? mesh.material.map((material) => material.depthWrite)
                : mesh.material.depthWrite,
            renderOrder: mesh.renderOrder,
        });
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
