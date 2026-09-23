import * as THREE from "three";
import {
    LIVER_KEYWORDS,
    LUNG_RESECTION_KEYWORDS,
    PCD_KEYWORDS,
} from "../utils/Constants";

export default class SeeThrough {
    constructor(
        scene,
        camera,
        renderer,
        { sphereRadius = 20, isMobile = false } = {}
    ) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.sphereRadius = isMobile ? sphereRadius * 1.5 : sphereRadius; // 모바일에서 더 큰 구체
        this.isMobile = isMobile;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Liver Mesh 저장 (초기화 시 찾지 않고, 이후 업데이트)
        this.liverMesh = null;
        this.originalMaterial = null;
        this.isActive = false;

        // 투명 구 생성 (모바일에서 더 선명한 색상)
        const sphereGeometry = new THREE.SphereGeometry(
            this.sphereRadius,
            32,
            32
        );
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: isMobile ? 0.4 : 0.3,
            depthWrite: false,
        });
        sphereMaterial.userData.isSeeThroughMaterial = true;

        this.sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.sphereMesh.visible = false;
        this.scene.add(this.sphereMesh);

        // 이벤트 핸들러 바인딩
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);

        // 단일 Mesh 대신 배열로 변경
        this.liverMeshes = [];
        this.originalMaterials = new Map(); // Mesh와 원본 material을 매핑
        this.effectMaterials = new Map();
        this.seeThroughUniforms = {
            seeThroughCenter: { value: new THREE.Vector3() },
            seeThroughRadius: { value: this.sphereRadius },
        };

        // 보조 레이캐스터 추가
        this.topRaycaster = new THREE.Raycaster();
        this.worldPosition = new THREE.Vector3();
    }

    enableSeeThroughMode() {
        if (this.isActive) return;
        this.liverMeshes = [];
        this.originalMaterials.clear();
        // ✅ 장기별로 분류된 See-through 대상 메시들
        const seeThroughTargetsByProcedure = {
            // LDLT (간이식 수술)
            LDLT: LIVER_KEYWORDS,
            // LUNG (폐암 절제술)
            LUNG: LUNG_RESECTION_KEYWORDS,
            // PCD (폐쇄성 담관 질환)
            PCD: PCD_KEYWORDS,
            // GYNECOLOGY (부인과 - 자궁 관련)
            GYNECOLOGY: [
                "myometrium",
                "uterus"
            ],
            PANCREAS: [
                "pancreas"
            ]
        };

        // 모든 키워드 통합 (중복 제거)
        const allSeeThroughNames = [
            ...new Set([
                ...seeThroughTargetsByProcedure.LDLT,
                ...seeThroughTargetsByProcedure.LUNG,
                ...seeThroughTargetsByProcedure.GYNECOLOGY,
                ...seeThroughTargetsByProcedure.PANCREAS
            ])
        ];

        console.log('[SeeThrough] See-through targets by procedure:', seeThroughTargetsByProcedure);
        console.log(`[SeeThrough] Total see-through target keywords: ${allSeeThroughNames.length}`);

        // 모든 매칭되는 Mesh를 배열에 저장
        this.scene.traverse((object) => {
            if (object.isMesh) {
                const objectName = object.name.toLowerCase();
                const isMatchingMesh = allSeeThroughNames.some((name) =>
                    objectName.includes(name.toLowerCase())
                );

                if (isMatchingMesh) {
                    this.liverMeshes.push(object);
                    this.originalMaterials.set(object, object.material);
                }
            }
        });

        if (this.liverMeshes.length === 0) {
            console.warn("No target meshes found in the scene!");
            return;
        }

        // 모델 교체 시 씬에서 제거되었을 수 있습니다. 첫 교차점에서만 표시합니다.
        if (!this.sphereMesh.parent) this.scene.add(this.sphereMesh);
        this.sphereMesh.visible = false;
        this.isActive = true;

        if (this.isMobile) {
            window.addEventListener("touchmove", this.onTouchMove, {
                passive: false,
            });
        } else {
            window.addEventListener("pointermove", this.onPointerMove);
        }
    }

    disableSeeThroughMode() {
        this.restoreOriginalMaterials();
        this.effectMaterials.forEach(({ outside, inside, innerMesh }, mesh) => {
            mesh.remove(innerMesh);
            [...outside, ...inside].forEach((material) => material.dispose());
        });
        this.effectMaterials.clear();
        this.originalMaterials.clear();
        this.liverMeshes = [];

        this.sphereMesh.visible = false;
        this.isActive = false;

        if (this.isMobile) {
            window.removeEventListener("touchmove", this.onTouchMove);
        } else {
            window.removeEventListener("pointermove", this.onPointerMove);
        }
    }

    onTouchMove(event) {
        event.preventDefault();
        if (!this.isActive) return;

        const touch = event.touches[0];
        this.handlePointerEvent(touch);
    }

    onPointerMove(event) {
        if (!this.isActive) return;
        this.handlePointerEvent(event);
    }

    handlePointerEvent(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // 모든 Mesh와의 교차 검사
        const intersects = this.raycaster.intersectObjects(this.liverMeshes, false);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.sphereMesh.position.copy(point);
            this.sphereMesh.visible = true;

            // [DEBUG] 레이 상에 실제로 몇 겹의 지오메트리가 있는지 확인 (겹치는 게 1개뿐이면 안쪽엔 볼 게 없다는 뜻)
            const now = performance.now();
            if (!this._lastDebugLogTime || now - this._lastDebugLogTime > 500) {
                this._lastDebugLogTime = now;
                console.log(
                    `[SeeThrough][debug] ray hit ${intersects.length}개 mesh:`,
                    intersects.map((i) => ({ name: i.object.name, dist: i.distance.toFixed(2) }))
                );
            }

            // 모든 Mesh에 SeeThrough 효과 적용
            this.liverMeshes.forEach((mesh) => {
                this.applySeeThroughMaterial(mesh, point);
            });
        } else {
            // 모든 Mesh 원래대로 복원
            this.restoreOriginalMaterials();
        }
    }

    applySeeThroughMaterial(mesh, center) {
        const originalMaterial = this.originalMaterials.get(mesh);
        if (!originalMaterial) return;

        this.seeThroughUniforms.seeThroughCenter.value.copy(center);
        let effect = this.effectMaterials.get(mesh);
        if (!effect) {
            const originals = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial];
            const outside = originals.map((material) => this.createRegionMaterial(material, false));
            const inside = originals.map((material) => this.createRegionMaterial(material, true));

            // 同一 geometry를 공유해 스킨/모프와 재질 그룹을 유지합니다.
            // 부모 메시의 변환과 visibility를 그대로 따라가는 내부 영역 전용 draw입니다.
            const innerMesh = mesh.clone(false);
            innerMesh.name = '__seeThroughInterior';
            innerMesh.userData = { isSeeThroughHelper: true };
            innerMesh.position.set(0, 0, 0);
            innerMesh.quaternion.identity();
            innerMesh.scale.set(1, 1, 1);
            innerMesh.matrix.identity();
            innerMesh.matrixAutoUpdate = false;
            innerMesh.material = Array.isArray(originalMaterial) ? inside : inside[0];
            innerMesh.morphTargetInfluences = mesh.morphTargetInfluences;
            innerMesh.castShadow = false;
            innerMesh.raycast = () => {};
            mesh.add(innerMesh);
            effect = { outside, inside, innerMesh };
            this.effectMaterials.set(mesh, effect);
        }

        mesh.material = Array.isArray(originalMaterial) ? effect.outside : effect.outside[0];
        effect.innerMesh.visible = true;
        effect.innerMesh.renderOrder = mesh.renderOrder;
    }

    createRegionMaterial(original, inside) {
        const material = original.clone();
        material.transparent = inside || original.transparent;
        material.depthWrite = inside ? false : original.depthWrite;
        material.userData.isSeeThroughMaterial = true;
        const originalCacheKey = original.customProgramCacheKey();
        material.customProgramCacheKey = () => `${originalCacheKey}:see-through-region-v1:${inside}`;

        material.onBeforeCompile = (shader, renderer) => {
            original.onBeforeCompile.call(material, shader, renderer);
            Object.assign(shader.uniforms, this.seeThroughUniforms);
            shader.vertexShader = `varying vec3 seeThroughWorldPosition;\n${shader.vertexShader}`;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <project_vertex>',
                `#include <project_vertex>
                vec4 seeThroughWorld = vec4(transformed, 1.0);
                #ifdef USE_BATCHING
                    seeThroughWorld = batchingMatrix * seeThroughWorld;
                #endif
                #ifdef USE_INSTANCING
                    seeThroughWorld = instanceMatrix * seeThroughWorld;
                #endif
                seeThroughWorldPosition = (modelMatrix * seeThroughWorld).xyz;`
            );

            shader.fragmentShader = `
                varying vec3 seeThroughWorldPosition;
                uniform vec3 seeThroughCenter;
                uniform float seeThroughRadius;
                ${shader.fragmentShader}
            `;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <clipping_planes_fragment>',
                `#include <clipping_planes_fragment>
                float seeThroughDistance = distance(seeThroughWorldPosition, seeThroughCenter);
                if (seeThroughDistance ${inside ? '>=' : '<'} seeThroughRadius) discard;`
            );
            if (inside) {
                // 원래 텍스처 alphaTest 이후 적용해 그라데이션이 잘리지 않게 합니다.
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <alphatest_fragment>',
                    `#include <alphatest_fragment>
                    diffuseColor.a *= smoothstep(0.0, seeThroughRadius, seeThroughDistance);`
                );
            }
        };
        return material;
    }

    updateSphereRadius(newRadius) {
        if (!Number.isFinite(newRadius) || newRadius <= 0) return;
        this.sphereRadius = newRadius;
        this.seeThroughUniforms.seeThroughRadius.value = newRadius;

        // 투명 구의 크기 업데이트
        const sphereGeometry = new THREE.SphereGeometry(
            this.sphereRadius,
            32,
            32
        );
        this.sphereMesh.geometry.dispose();
        this.sphereMesh.geometry = sphereGeometry;
    }

    restoreOriginalMaterials() {
        this.sphereMesh.visible = false;
        this.liverMeshes.forEach((mesh) => {
            const originalMaterial = this.originalMaterials.get(mesh);
            if (originalMaterial) {
                mesh.material = originalMaterial;
            }
            const effect = this.effectMaterials.get(mesh);
            if (effect) effect.innerMesh.visible = false;
        });
    }
}
