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

    /**
     * Blender shader node를 기반으로 한 fibrosis 셰이더 재질 생성
     * @returns {THREE.MeshStandardMaterial} fibrosis 셰이더가 적용된 재질
     */
    createFibrosisShader() {
        const material = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            transparent: false,
            metalness: 0.141,
            roughness: 0.35,
            ior: 1.5,
            //envMapIntensity: 0.3, // 환경 반사 강도 감소
        });

        // 셰이더 커스터마이징
        material.onBeforeCompile = (shader) => {
            // Uniforms 추가
            shader.uniforms.fibrosisScale = { value: 0.1 };
            shader.uniforms.noiseScale = { value: 0.9 };
            shader.uniforms.noiseDetail = { value: 0.15 }; // 노이즈 세부사항 감소 (0.4 -> 0.15)
            shader.uniforms.noiseRoughness = { value: 0.5 }; // 노이즈 거칠기 감소 (1.0 -> 0.5)
            shader.uniforms.noiseLacunarity = { value: 40.1 };
            shader.uniforms.noiseDistortion = { value: 0.3 }; // 노이즈 왜곡 감소 (0.9 -> 0.3)
            shader.uniforms.noiseIntensity = { value: 0.5 }; // 노이즈 강도 조절 (0~1)
            shader.uniforms.colorStop1 = { value: new THREE.Vector3(0.9, 0.6, 0.7) }; // 밝은 분홍색
            shader.uniforms.colorStop2 = { value: new THREE.Vector3(0.6, 0.2, 0.3) }; // 어두운 갈색
            shader.uniforms.colorStopPosition = { value: 0.65 };

            // Noise 함수들 (fBM - Fractal Brownian Motion)
            const noiseFunctions = `
                // Simplex noise 기반 fBM 구현
                vec3 mod289(vec3 x) {
                    return x - floor(x * (1.0 / 289.0)) * 289.0;
                }

                vec4 mod289(vec4 x) {
                    return x - floor(x * (1.0 / 289.0)) * 289.0;
                }

                vec4 permute(vec4 x) {
                    return mod289(((x*34.0)+1.0)*x);
                }

                vec4 taylorInvSqrt(vec4 r) {
                    return 1.79284291400159 - 0.85373472095314 * r;
                }

                float snoise(vec3 v) {
                    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

                    vec3 i = floor(v + dot(v, C.yyy));
                    vec3 x0 = v - i + dot(i, C.xxx);

                    vec3 g = step(x0.yzx, x0.xyz);
                    vec3 l = 1.0 - g;
                    vec3 i1 = min(g.xyz, l.zxy);
                    vec3 i2 = max(g.xyz, l.zxy);

                    vec3 x1 = x0 - i1 + C.xxx;
                    vec3 x2 = x0 - i2 + C.yyy;
                    vec3 x3 = x0 - D.yyy;

                    i = mod289(i);
                    vec4 p = permute(permute(permute(
                        i.z + vec4(0.0, i1.z, i2.z, 1.0))
                        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

                    float n_ = 0.142857142857;
                    vec3 ns = n_ * D.wyz - D.xzx;

                    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

                    vec4 x_ = floor(j * ns.z);
                    vec4 y_ = floor(j - 7.0 * x_);

                    vec4 x = x_ *ns.x + ns.yyyy;
                    vec4 y = y_ *ns.x + ns.yyyy;
                    vec4 h = 1.0 - abs(x) - abs(y);

                    vec4 b0 = vec4(x.xy, y.xy);
                    vec4 b1 = vec4(x.zw, y.zw);

                    vec4 s0 = floor(b0)*2.0 + 1.0;
                    vec4 s1 = floor(b1)*2.0 + 1.0;
                    vec4 sh = -step(h, vec4(0.0));

                    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
                    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

                    vec3 p0 = vec3(a0.xy,h.x);
                    vec3 p1 = vec3(a0.zw,h.y);
                    vec3 p2 = vec3(a1.xy,h.z);
                    vec3 p3 = vec3(a1.zw,h.w);

                    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
                    p0 *= norm.x;
                    p1 *= norm.y;
                    p2 *= norm.z;
                    p3 *= norm.w;

                    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                    m = m * m;
                    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
                }

                // fBM (Fractal Brownian Motion) 구현
                float fbm(vec3 p, float scale, float detail, float roughness, float lacunarity, float distortion) {
                    float value = 0.0;
                    float amplitude = 1.0;
                    float frequency = scale;
                    float maxValue = 0.0;

                    for (int i = 0; i < 4; i++) {
                        if (float(i) >= detail * 4.0) break;
                        
                        // Distortion 적용
                        vec3 distortedP = p + distortion * snoise(p * frequency) * 0.5;
                        
                        float noiseValue = snoise(distortedP * frequency);
                        value += noiseValue * amplitude;
                        maxValue += amplitude;
                        
                        amplitude *= roughness;
                        frequency *= lacunarity;
                    }
                    
                    return value / maxValue;
                }

                // Ease interpolation (smoothstep 사용)
                float ease(float t) {
                    return t * t * (3.0 - 2.0 * t);
                }
            `;

            // Vertex shader 수정 - object space coordinates 전달
            shader.vertexShader = `
                varying vec3 vObjectPosition;
                ${shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    `
                    #include <begin_vertex>
                    vObjectPosition = position;
                    `
                )}
            `;

            // Fragment shader 수정
            shader.fragmentShader = `
                uniform float fibrosisScale;
                uniform float noiseScale;
                uniform float noiseDetail;
                uniform float noiseRoughness;
                uniform float noiseLacunarity;
                uniform float noiseDistortion;
                uniform float noiseIntensity;
                uniform vec3 colorStop1;
                uniform vec3 colorStop2;
                uniform float colorStopPosition;
                
                varying vec3 vObjectPosition;
                
                ${noiseFunctions}
                
                ${shader.fragmentShader.replace(
                    '#include <color_fragment>',
                    `
                    #include <color_fragment>
                    
                    // Mapping: Object coordinates에 scale 적용 (0.1)
                    vec3 mappedCoords = vObjectPosition * fibrosisScale;
                    
                    // Noise Texture: fBM noise 생성
                    float noiseValue = fbm(
                        mappedCoords,
                        noiseScale,
                        noiseDetail,
                        noiseRoughness,
                        noiseLacunarity,
                        noiseDistortion
                    );
                    
                    // Normalize (0~1 범위로)
                    noiseValue = noiseValue * 0.5 + 0.5;
                    
                    // 노이즈 강도 적용: 기본 색상과 노이즈를 혼합
                    float baseNoise = 0.5; // 중간값 (기본 색상)
                    noiseValue = mix(baseNoise, noiseValue, noiseIntensity);
                    
                    // Color Ramp: Ease interpolation으로 색상 보간
                    float t = ease(clamp(noiseValue / colorStopPosition, 0.0, 1.0));
                    vec3 rampColor = mix(colorStop1, colorStop2, t);
                    
                    // Base color에 적용
                    diffuseColor.rgb = rampColor;
                    `
                )}
            `;
        };

        return material;
    }

    /**
     * fibroid 메시에 셰이더 재질 적용
     * @param {THREE.Mesh} mesh - 적용할 메시
     */
    applyFibrosisShader(mesh) {
        if (!mesh || !mesh.isMesh) {
            console.warn('[MaterialManager] Invalid mesh for fibroid shader');
            return;
        }

        const fibrosisMaterial = this.createFibrosisShader();
        
        // 기존 재질 정리
        if (mesh.material) {
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose());
            } else {
                mesh.material.dispose();
            }
        }

        mesh.material = fibrosisMaterial;
        mesh.material.needsUpdate = true;

        console.log(`[MaterialManager] Fibroid shader applied to mesh: ${mesh.name}`);
    }
}
