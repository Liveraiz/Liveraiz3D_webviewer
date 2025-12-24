import * as THREE from "three";

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
        // Seethrough를 적용할 Mesh 이름들의 배열
        const liverNames = [
            "liver",
            "lhvt",
            "mhvt",
            "v58t",
            "v5t",
            "v8t",
            "rhvt",
            "v4t",
            "v4at",
            "v4bt",
            "rihvat",
            "rihvpt",
            "rihvt",
            "spigelian",
            "rshvt",
            "ltlobe",
            "rtlobe",
            "lls",
            "lms",
            "ras",
            "rps",
            "ctap_livera",
            "myometrium",
            "uterus"
        ];

        // 모든 매칭되는 Mesh를 배열에 저장
        this.scene.traverse((object) => {
            if (object.isMesh) {
                const objectName = object.name.toLowerCase();
                const isMatchingMesh = liverNames.some((name) =>
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
