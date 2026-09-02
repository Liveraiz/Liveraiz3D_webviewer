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
        });

        this.sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.sphereMesh.visible = false;
        this.scene.add(this.sphereMesh);

        // 이벤트 핸들러 바인딩
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);

        // 단일 Mesh 대신 배열로 변경
        this.liverMeshes = [];
        this.originalMaterials = new Map(); // Mesh와 원본 material을 매핑

        // 보조 레이캐스터 추가
        this.topRaycaster = new THREE.Raycaster();
        this.worldPosition = new THREE.Vector3();
    }

    enableSeeThroughMode() {
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
            ]
        };

        // 모든 키워드 통합 (중복 제거)
        const allSeeThroughNames = [
            ...new Set([
                ...seeThroughTargetsByProcedure.LDLT,
                ...seeThroughTargetsByProcedure.LUNG,
                ...seeThroughTargetsByProcedure.GYNECOLOGY
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

        this.sphereMesh.visible = true;
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
        // 모든 Mesh의 material 복원
        this.liverMeshes.forEach((mesh) => {
            const originalMaterial = this.originalMaterials.get(mesh);
            if (originalMaterial) {
                mesh.material = originalMaterial;
            }
            delete mesh.userData.__seeThroughLogged;
        });

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
        const intersects = this.raycaster.intersectObjects(this.liverMeshes);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.sphereMesh.position.copy(point);

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

        const newMaterial = originalMaterial.clone();
        newMaterial.transparent = true;
        newMaterial.depthWrite = false; // 투명해진 영역이 뒤쪽 지오메트리를 가리지 않도록 함
        newMaterial.userData.isSeeThroughMaterial = true; // MaterialManager 등 다른 곳에서 덮어쓰는지 추적하기 위한 마커

        if (!mesh.userData.__seeThroughLogged) {
            mesh.userData.__seeThroughLogged = true;
            console.log(`[SeeThrough][debug] "${mesh.name}" material 적용: opacity=${newMaterial.opacity}, transparent=${newMaterial.transparent}, depthWrite=${newMaterial.depthWrite}`);
        }

        newMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.seeThroughCenter = { value: center.clone() };
            shader.uniforms.seeThroughRadius = { value: this.sphereRadius };

            shader.vertexShader = `
                varying vec3 myWorldPosition;
                varying vec3 vPosition;
                ${shader.vertexShader.replace(
                    "#include <begin_vertex>",
                    `
                    #include <begin_vertex>
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    myWorldPosition = worldPos.xyz;
                    vPosition = position;
                    `
                )}
            `;

            shader.fragmentShader = `
                varying vec3 myWorldPosition;
                varying vec3 vPosition;
                uniform vec3 seeThroughCenter;
                uniform float seeThroughRadius;
                ${shader.fragmentShader.replace(
                    "#include <dithering_fragment>",
                    `
                    float dist = distance(myWorldPosition, seeThroughCenter);
                    float normalizedDist = dist / (seeThroughRadius * 1.15);
                    
                    // 내부에서 외부로 갈수록 불투명해지는 그라데이션
                    float alpha = smoothstep(0.0, 1.0, normalizedDist);
                    
                    if (dist < seeThroughRadius) {
                        gl_FragColor.a *= alpha;
                        //discard;
                    }
                    #include <dithering_fragment>
                    `
                )}
            `;
        };

        mesh.material = newMaterial;
    }

    updateSphereRadius(newRadius) {
        this.sphereRadius = newRadius;

        // 투명 구의 크기 업데이트
        const sphereGeometry = new THREE.SphereGeometry(
            this.sphereRadius,
            32,
            32
        );
        this.sphereMesh.geometry = sphereGeometry;
    }

    restoreOriginalMaterials() {
        this.liverMeshes.forEach((mesh) => {
            const originalMaterial = this.originalMaterials.get(mesh);
            if (originalMaterial) {
                mesh.material = originalMaterial;
            }
        });
    }
}
