
// ui/ObjectListPanel.js
import * as THREE from "three";
import {
    LIVER_KEYWORDS,
    VESSEL_KEYWORDS,
    PRIMARY_EXCLUDE_KEYWORDS,
    EXCLUDE_KEYWORDS,
    OPACITY_CONTROLLABLE_KEYWORDS,
    Constants,
} from "../utils/Constants";

export class ObjectListPanel {
    constructor({ liverViewer, panelManager, isDarkMode, labelManager = null }) {
        // 전체 토글 시 직전 상태 저장용 Map
        // key: meshId + '_' + materialIndex, value: { opacity, transparent, side, visible }
        this._meshMaterialPrevStateMap = new Map();
        // 개별 메쉬 opacity 저장용 Map (개별 토글에서 사용)
        this._meshOpacityMap = new Map();
        // 모든 mesh에 대해 material clone 및 opacity/visible 상태 저장
        if (liverViewer && liverViewer.scene) {
            liverViewer.scene.traverse(obj => {
                if (obj.isMesh) {
                    // Material 복제
                    if (Array.isArray(obj.material)) {
                        obj.material = obj.material.map(mat => mat.clone());
                    } else {
                        obj.material = obj.material.clone();
                    }
                    
                    // 렌더링 관련 원본 속성 저장 (transparency 토글 시 복원용)
                    const saveMaterialRenderState = (material) => {
                        material._originalSide = material.side;
                        material._originalDepthTest = material.depthTest;
                        material._originalDepthWrite = material.depthWrite;
                        material._originalOpacity = material.opacity;
                        material._originalTransparent = material.transparent;
                    };
                    
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(mat => saveMaterialRenderState(mat));
                    } else {
                        saveMaterialRenderState(obj.material);
                    }
                    
                    obj.material.transparent = true;
                    obj.userData.originalOpacity = obj.material.opacity;
                    obj.userData.wasVisible = obj.visible;
                }
            });
        }
        // 기존 패널 제거
        const existingPanels = document.querySelectorAll(".object-list-panel");
        existingPanels.forEach((panel) => panel.remove());

        const existingToggles = document.querySelectorAll(
            ".object-list-toggle"
        );
        existingToggles.forEach((toggle) => toggle.remove());

        this.liverViewer = liverViewer;
        this.panelManager = panelManager;
        this.isDarkMode = isDarkMode;
        this.labelManager = labelManager; // 메시 라벨 매니저
        this.isOpen = false;
        this.position = "left";
        this.objects = new Map();

        // 패널 생성 시 클래스 추가
        this.panel = this.createPanel();
        this.panel.classList.add("object-list-panel");
        this.contentContainer = null;

        // 토글 버튼 생성 시 클래스 추가
        this.toggleContainer = this.createToggleContainer();
        this.toggleContainer.classList.add("object-list-toggle");

        this.setupPanel();
        this.setupToggleEvents();

        // DOM에 추가
        document.body.appendChild(this.panel);
        document.body.appendChild(this.toggleContainer);

        // panelManager 등록
        if (this.panelManager) {
            this.panelManager.registerPanel(this, "left");
        }

        this.onToggleObject = null;
        this.allObjectsVisible = true; // 모든 메쉬의 현재 상태를 저장하는 변수

        // 계층 구조 정보를 저장할 Map 추가
        this.meshHierarchyMap = new Map();

        this.meshTooltip = null; // MeshTooltip 참조 추가

        // 드래그 스크롤 이벤트 리스너 참조 저장
        this.dragScrollHandlers = null;

        // mesh별 material별 초기 렌더링 상태 저장용 Map
        // key: meshId + '_' + materialIndex, value: { opacity, transparent, side, visible }
        this._meshMaterialInitialStateMap = new Map();
    }

    initialize() {
        console.log("Initializing ObjectListPanel");
        this.clearObjectList();
    }

    clearObjectList() {
        console.log("Clearing object list");
        if (this.contentContainer) {
            while (this.contentContainer.firstChild) {
                this.contentContainer.removeChild(
                    this.contentContainer.firstChild
                );
            }
        }
        this.objects.clear(); // objects Map도 초기화
    }

    /**
     * 메시의 visibility를 설정하고 라벨을 동기화
     * @param {THREE.Mesh} mesh - 대상 메시
     * @param {boolean} visible - 표시 여부
     */
    _setMeshVisibility(mesh, visible) {
        mesh.visible = visible;
        // 라벨 매니저에 동기화
        if (this.labelManager && mesh.uuid) {
            this.labelManager.setLabelVisibility(mesh.uuid, visible);
        }
    }

    // 오브젝트 정렬 순서 정의
    getObjectSortOrder(name) {
                // 그룹들을 맨 위에 배치
                if (name === "Right Group") return -3;
                if (name === "Left Group") return -2;
                if (name === "Superior Rectal") return -1;
                
                // colectomy 수술 케이스 우선순위
                const colectomyOrder = [
                    "colon",
                    "Mesorectum",
                    "TME plane_L",
                    "TME plane_R",
                    "Urinary_Bladder",
                    "Ureter",
                    "Prostate",
                    "Vas_Deferens",
                    "Common_Iliiac_Artery",
                    "Common_Illiac_Vein",
                    "Superior Rectal",
                    "Levator_ani",
                    "Obturator_Internus Muscle"
                ];
                // 언더바 제거 후 비교
                const normalized = name.replace(/_/g, " ");
                const idx = colectomyOrder.findIndex(
                    (item) => normalized.toLowerCase() === item.replace(/_/g, " ").toLowerCase()
                );
                if (idx !== -1) return idx;
        const lowerName = name.toLowerCase();

        // vol이 포함된 메시는 가장 마지막으로
        if (lowerName.includes("vol")) return 1000;

        // 간 관련 키워드 체크
        if (
            LIVER_KEYWORDS.some((keyword) =>
                lowerName.includes(keyword.toLowerCase())
            )
        )
            return 0;

        // 혈관 순서 체크
        if (VESSEL_KEYWORDS.some((keyword) => lowerName.includes(keyword))) {
            if (lowerName.includes("hv")) return 1;
            if (lowerName.includes("pv")) return 2;
            if (lowerName.includes("ha")) return 3;
            if (lowerName.includes("bd")) return 4;
        }

        // 기타 구조물 체크
        if (lowerName.includes("cancer")) return 5;
        if (lowerName.includes("cyst")) return 6;

        return 7;
    }

    updateObjectList(meshes) {
        console.log("Updating object list with", meshes.length, "items");
        this.clearObjectList();

        // 필터링할 키워드 목록
        const excludeKeywords = [
            "XY",
            "YZ",
            "XZ",
            "START",
            "END",
            "EMPTY",
            "Camera",
            "Light",
            "Empty",
            "Cube",
        ];

        // 메쉬들을 필터링하고 계층 구조 맵 생성
        const hierarchyMap = new Map();
        const volMeshes = [];
        const rightMeshes = [];
        const leftMeshes = [];
        const superiorRectalMeshes = [];
        const otherMeshes = [];

        meshes
            .filter(
                (mesh) =>
                    mesh.name &&
                    mesh.name.trim() !== "" &&
                    !excludeKeywords.some((keyword) =>
                        mesh.name.toUpperCase().includes(keyword.toUpperCase())
                    )
            )
            .forEach((mesh) => {
                const lowerName = mesh.name.toLowerCase();
                
                // Group 객체 처리
                if (mesh.isGroup) {
                    console.log(`[Group] ${mesh.name}`);
                    otherMeshes.push(mesh);
                    return;
                }
                
                // 초기 렌더링 상태 저장 (최초 1회만)
                const id = mesh.name;
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                if (mesh.material) { // material이 있는 경우만 저장
                    materials.forEach((mat, idx) => {
                        if (mat) {
                            const key = id + '_' + idx;
                            if (!this._meshMaterialInitialStateMap.has(key)) {
                                this._meshMaterialInitialStateMap.set(key, {
                                    opacity: mat.opacity,
                                    transparent: mat.transparent,
                                    side: mat.side,
                                    visible: mesh.visible
                                });
                            }
                        }
                    });
                }
                
                // vol이 포함된 메시는 별도로 저장
                if (lowerName.includes("vol")) {
                    volMeshes.push(mesh);
                    console.log(`[Vol] ${mesh.name}`);
                } else if (mesh.name === "TME_plane_L" || mesh.name === "TME_plane_R") {
                    // TME plane_L과 TME plane_R은 그룹 분류에서 제외
                    otherMeshes.push(mesh);
                    console.log(`[TME Plane] ${mesh.name}`);
                } else if (lowerName.replace(/_/g, " ").includes("superior rectal")) {
                    // Superior Rectal Artery와 Superior Rectal Vein을 그룹으로
                    superiorRectalMeshes.push(mesh);
                    console.log(`[Superior Rectal] ${mesh.name}`);
                } else if (/_r\b/i.test(mesh.name)) {
                    rightMeshes.push(mesh);
                    console.log(`[Right Group] ${mesh.name}`);
                } else if (/_l\b/i.test(mesh.name)) {
                    leftMeshes.push(mesh);
                    console.log(`[Left Group] ${mesh.name}`);
                } else {
                    otherMeshes.push(mesh);
                    console.log(`[Other] ${mesh.name}`);
                }
            });

        // _R 그룹 추가
        if (rightMeshes.length > 0) {
            hierarchyMap.set("Right Group", {
                mesh: null,
                parent: null,
                children: [],
                level: 0,
                isCustomGroup: true,
                groupMeshes: rightMeshes,
                groupType: "right",
            });
            rightMeshes.forEach((mesh) => {
                this.objects.set(mesh.name, mesh);
            });
        }
        // _L 그룹 추가
        if (leftMeshes.length > 0) {
            hierarchyMap.set("Left Group", {
                mesh: null,
                parent: null,
                children: [],
                level: 0,
                isCustomGroup: true,
                groupMeshes: leftMeshes,
                groupType: "left",
            });
            leftMeshes.forEach((mesh) => {
                this.objects.set(mesh.name, mesh);
            });
        }
        // Superior Rectal 그룹 추가
        if (superiorRectalMeshes.length > 0) {
            hierarchyMap.set("Superior Rectal", {
                mesh: null,
                parent: null,
                children: [],
                level: 0,
                isCustomGroup: true,
                groupMeshes: superiorRectalMeshes,
                groupType: "superiorRectal",
            });
            superiorRectalMeshes.forEach((mesh) => {
                this.objects.set(mesh.name, mesh);
            });
        }
        // 기타 메쉬들 추가
        otherMeshes.forEach((mesh) => {
            // Group 객체의 경우 parent name 추출 처리
            let parentName = null;
            if (mesh.isGroup && mesh.parent) {
                // Group 객체는 Three.js 객체를 참조하므로 parent?.name으로 접근
                parentName = mesh.parent?.name || null;
            } else if (mesh.parent) {
                // 일반 메시의 경우
                parentName = mesh.parent?.name || null;
            }
            
            console.log(`[ObjectListPanel] Adding ${mesh.isGroup ? 'group' : 'mesh'} "${mesh.name}" to hierarchy, parent: ${parentName}`);
            
            hierarchyMap.set(mesh.name, {
                mesh: mesh,
                parent: parentName,
                children: [],
                level: 0,
            });
            this.objects.set(mesh.name, mesh);
        });

        // vol 메시들이 있으면 "Volumes" 그룹 생성 (하위 볼륨들은 리스트에 표시하지 않음)
        if (volMeshes.length > 0) {
            // Volumes 그룹을 가상 부모로 생성 (실제 메시는 없지만 UI에서 그룹으로 표시)
            hierarchyMap.set("Volumes", {
                mesh: null, // 가상 그룹이므로 실제 메시는 없음
                parent: null,
                children: [], // 하위 볼륨들은 표시하지 않으므로 children 비움
                level: 0,
                isVolumeGroup: true, // Volumes 그룹임을 표시
                volumeMeshes: volMeshes, // vol 메시들 저장 (제어용)
            });

            // vol 메시들은 hierarchyMap에 추가하지 않음 (리스트에 표시하지 않음)
            // 하지만 objects Map에는 추가하여 제어 가능하도록 함
            volMeshes.forEach((mesh) => {
                this.objects.set(mesh.name, mesh);
            });
        }

        // 부모-자식 관계 설정
        hierarchyMap.forEach((info, name) => {
            if (info.parent && hierarchyMap.has(info.parent)) {
                console.log(`[ObjectListPanel] Establishing parent-child relationship: "${info.parent}" -> "${name}"`);
                hierarchyMap.get(info.parent).children.push(name);
            } else if (info.parent) {
                console.log(`[ObjectListPanel] Parent "${info.parent}" not found in hierarchyMap for child "${name}"`);
            }
        });

        // 별도의 깊이 계산 함수 추가
        const calculateDepth = (nodeName, visited = new Set()) => {
            if (visited.has(nodeName)) return 0;
            visited.add(nodeName);

            const info = hierarchyMap.get(nodeName);
            if (!info.parent || !hierarchyMap.has(info.parent)) return 0;

            return 1 + calculateDepth(info.parent, visited);
        };

        // 각 노드의 level을 올바르게 계산
        hierarchyMap.forEach((info, name) => {
            info.level = calculateDepth(name);
        });

        // 전체 토글 버튼 추가
        this.addToggleAllButton();

        // 최상위 메쉬들을 정렬 순서에 따라 정렬
        const sortedRootMeshes = Array.from(hierarchyMap.values())
            .filter((info) => !info.parent || !hierarchyMap.has(info.parent))
            .sort((a, b) => {
                // Volumes 그룹은 항상 마지막에 배치
                if (a.isVolumeGroup) return 1;
                if (b.isVolumeGroup) return -1;
                
                // 커스텀 그룹들의 이름 결정
                const getDisplayName = (info) => {
                    if (info.groupType === "right") return "Right Group";
                    if (info.groupType === "left") return "Left Group";
                    if (info.groupType === "superiorRectal") return "Superior Rectal";
                    if (info.mesh) return info.mesh.name;
                    if (info.isVolumeGroup) return "Volumes";
                    return "";
                };
                
                const nameA = getDisplayName(a);
                const nameB = getDisplayName(b);
                const orderA = this.getObjectSortOrder(nameA);
                const orderB = this.getObjectSortOrder(nameB);
                
                // 우선순위가 같으면 알파벳순으로 정렬
                if (orderA === orderB) {
                    return nameA.localeCompare(nameB, 'en', { numeric: true, sensitivity: 'base' });
                }
                return orderA - orderB;
            });

        // 계층 구조에 따라 렌더링
        const renderHierarchy = (info, level = 0) => {
            // Volumes 그룹인 경우 특별 처리
            if (info.isVolumeGroup) {
                const volumeMeshes = info.volumeMeshes || [];
                if (volumeMeshes.length === 0) return;
                const allVisible = volumeMeshes.every(m => m.visible);
                const allHidden = volumeMeshes.every(m => !m.visible);
                const groupVisible = !allHidden;
                const avgOpacity = volumeMeshes.reduce((sum, m) => {
                    return sum + (m.material ? m.material.opacity : 1.0);
                }, 0) / volumeMeshes.length;
                const groupRow = this.createControlRow({
                    name: "Volumes",
                    id: "Volumes",
                    color: "#888888",
                    visible: groupVisible,
                    opacity: avgOpacity,
                    material: null,
                    level: level,
                    parent: null,
                    isVolumeGroup: true,
                    volumeMeshes: volumeMeshes,
                });
                this.contentContainer.appendChild(groupRow);
                return;
            }
            // _R/_L 그룹인 경우 특별 처리
            if (info.isCustomGroup) {
                const groupMeshes = info.groupMeshes || [];
                if (groupMeshes.length === 0) return;
                const allVisible = groupMeshes.every(m => m.visible);
                const allHidden = groupMeshes.every(m => !m.visible);
                const groupVisible = !allHidden;
                const avgOpacity = groupMeshes.reduce((sum, m) => {
                    return sum + (m.material ? m.material.opacity : 1.0);
                }, 0) / groupMeshes.length;
                // 그룹 이름과 색상 결정
                let groupName = "Custom Group";
                let groupColor = "#FFFFFF";
                if (info.groupType === "right") {
                    groupName = "Right Group";
                    groupColor = "#6682ffff";
                } else if (info.groupType === "left") {
                    groupName = "Left Group";
                    groupColor = "#ff6b66ff";
                } else if (info.groupType === "superiorRectal") {
                    groupName = "Superior Rectal";
                    groupColor = "#c766ffff";
                }
                
                const groupRow = this.createControlRow({
                    name: groupName,
                    id: groupName,
                    color: groupColor,
                    visible: groupVisible,
                    opacity: avgOpacity,
                    material: null,
                    level: level,
                    parent: null,
                    isCustomGroup: true,
                    groupMeshes: groupMeshes,
                });
                this.contentContainer.appendChild(groupRow);
                return;
            }
            
            // Group 객체 처리
            if (info.mesh && info.mesh.isGroup) {
                const groupObject = info.mesh;
                const children = groupObject.children || [];
                const childMeshes = children.filter(c => c.isMesh);
                
                if (childMeshes.length === 0) {
                    console.log(`[ObjectListPanel] Group "${groupObject.name}" has no child meshes, skipping`);
                    return;
                }
                
                // 그룹의 모든 하위 메시가 보이는지 확인
                const allVisible = childMeshes.every(m => m.visible);
                const allHidden = childMeshes.every(m => !m.visible);
                const groupVisible = !allHidden;
                
                // 평균 투명도 계산
                const avgOpacity = childMeshes.reduce((sum, m) => {
                    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
                    return sum + (mat ? mat.opacity : 1.0);
                }, 0) / Math.max(1, childMeshes.length);
                
                // 자식이 있는 parent group이므로 isParentGroupFlag 설정
                const isParentGroupFlag = info.children && info.children.length > 0;
                
                console.log(`[ObjectListPanel] Rendering group "${groupObject.name}" with ${info.children.length} children, visible: ${groupVisible}`);
                
                const groupRow = this.createControlRow({
                    name: groupObject.name,
                    id: groupObject.name,
                    color: "#999999",
                    visible: groupVisible,
                    opacity: avgOpacity,
                    material: null,
                    level: level,
                    parent: info.parent,
                    isParentGroupFlag: isParentGroupFlag,
                    isGroup: true,
                    groupObject: groupObject,
                });
                this.contentContainer.appendChild(groupRow);
                
                // 자식 메시들 렌더링
                info.children
                    .map((childName) => hierarchyMap.get(childName))
                    .filter(childInfo => childInfo) // null 체크
                    .sort((a, b) => {
                        const orderA = this.getObjectSortOrder(a.mesh?.name || '');
                        const orderB = this.getObjectSortOrder(b.mesh?.name || '');
                        if (orderA === orderB) {
                            const nameA = a.mesh?.name || '';
                            const nameB = b.mesh?.name || '';
                            return nameA.localeCompare(nameB, 'en', { numeric: true, sensitivity: 'base' });
                        }
                        return orderA - orderB;
                    })
                    .forEach((childInfo) => {
                        renderHierarchy(childInfo, level + 1);
                    });
                return;
            }
            
            // 일반 메시 처리
            const mesh = info.mesh;
            if (!mesh) return;
            let color = "#FFFFFF";
            let firstMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            if (firstMaterial && firstMaterial.color) {
                color = "#" + firstMaterial.color.getHexString();
            }
            let opacity = 1.0;
            if (Array.isArray(mesh.material)) {
                opacity = mesh.material[0]?.opacity ?? 1.0;
            } else if (mesh.material) {
                opacity = mesh.material.opacity;
            }
            // 자식이 있는 parent group인지 판단
            const isParentGroupFlag = info.children && info.children.length > 0;
            
            const controlRow = this.createControlRow({
                name: mesh.name,
                id: mesh.name,
                color: color,
                visible: mesh.visible,
                opacity: opacity,
                material: mesh.material,
                level: level,
                parent: info.parent,
                isParentGroupFlag: isParentGroupFlag,
            });
            this.contentContainer.appendChild(controlRow);
            info.children
                .map((childName) => hierarchyMap.get(childName))
                .sort((a, b) => {
                    const orderA = this.getObjectSortOrder(a.mesh.name);
                    const orderB = this.getObjectSortOrder(b.mesh.name);
                    if (orderA === orderB) {
                        return a.mesh.name.localeCompare(b.mesh.name, 'en', { numeric: true, sensitivity: 'base' });
                    }
                    return orderA - orderB;
                })
                .forEach((childInfo) => {
                    renderHierarchy(childInfo, level + 1);
                });
        };

        // 최상위 메쉬들부터 시작하여 렌더링
        sortedRootMeshes.forEach((info) => renderHierarchy(info));
    }

    // hasObject 메서드 추가
    hasObject(objectId) {
        return this.objects.has(objectId);
    }

    // getObject 메서드 추가
    getObject(objectId) {
        return this.objects.get(objectId);
    }

    isLiverRelatedObject(name) {
        const liverKeywords = [
            "liver",
            "lobe",
            "LLS",
            "LMS",
            "Spigelian",
            "RAS",
            "RPS",
            "RHVt",
        ];
        return liverKeywords.some((keyword) =>
            name.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    setupPanel() {
        const topBarHeight = "60px"; // TopBar 높이와 동일하게 설정

        // 패널을 flexbox로 설정하여 하단 고정 토글 버튼을 위한 구조 생성
        Object.assign(this.panel.style, {
            display: "flex",
            flexDirection: "column",
        });

        this.contentContainer = document.createElement("div");
        Object.assign(this.contentContainer.style, {
            flex: "1 1 auto",
            boxSizing: "border-box",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            padding: "20px 20px 50px 20px", // 🔴 bottom padding 줄임 (60px -> 50px, 토글버튼 32px + 여유 18px)
            minHeight: "0", // flex item이 overflow를 처리할 수 있도록
            maxHeight: "100%", // 부모 높이를 넘지 않도록
            // 스크롤바 숨기기
            scrollbarWidth: "none",
            msOverflowStyle: "none",
        });

        this.panel.appendChild(this.contentContainer);

        // 측정값 섹션 추가
        const measurementTitle = document.createElement("h3");
        measurementTitle.textContent = "Measurements";
        Object.assign(measurementTitle.style, {
            margin: "20px 0 10px 0",
            fontSize: "18px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.3)",
            paddingBottom: "10px",
        });

        this.measurementContainer = document.createElement("div");
        Object.assign(this.measurementContainer.style, {
            display: "flex",
            flexDirection: "column",
            gap: "10px",
        });

        this.contentContainer.appendChild(measurementTitle);
        this.contentContainer.appendChild(this.measurementContainer);

        // 메시 이름 표시 토글 버튼 추가 (하단 고정)
        this.createMeshTooltipToggle();
        const styleSheet = document.createElement("style");
        styleSheet.textContent = `
            .object-list-panel div::-webkit-scrollbar {
                display: none;
            }
        `;
        document.head.appendChild(styleSheet);

        // 드래그 스크롤 기능 추가
        this.setupDragScroll();
    }

    createPanel() {
        const panel = document.createElement("div");
        panel.className = "object-list-panel";
        const topBarHeight = Constants.UI.PANEL.TOP_BAR_HEIGHT;

        Object.assign(panel.style, {
            position: "fixed",
            left: `-${Constants.UI.PANEL.WIDTH}px`,
            top: "0",
            width: `${Constants.UI.PANEL.WIDTH}px`,
            height: `calc(100vh - ${topBarHeight})`,
            marginTop: topBarHeight,
            backgroundColor: this.isDarkMode
                ? "rgba(0, 0, 0, 0.4)"
                : "rgba(255, 255, 255, 0.4)",
            backdropFilter: "blur(20px) saturate(120%)",
            color: this.isDarkMode
                ? Constants.UI.PANEL.DARK.TEXT
                : Constants.UI.PANEL.LIGHT.TEXT,
            fontFamily: "Arial, sans-serif",
            zIndex: "950",
            transition: "left 0.3s ease-in-out",
            overflowY: "hidden", // 패널 자체는 스크롤 없음 (contentContainer가 스크롤)
            overflowX: "hidden",
            border: this.isDarkMode
                ? "1px solid rgba(255, 255, 255, 0.08)"
                : "1px solid rgba(255, 255, 255, 0.15)",
            boxShadow: this.isDarkMode
                ? "2px 0 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
                : "2px 0 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
            display: "none",
            boxSizing: "border-box",
            // 스크롤바 숨기기
            scrollbarWidth: "none", // Firefox
            msOverflowStyle: "none", // IE and Edge
        });

        // Webkit 브라우저용 스크롤바 숨기기
        const styleSheet = document.createElement("style");
        styleSheet.textContent = `
            .object-list-panel {
                -ms-overflow-style: none !important;  /* IE and Edge */
                scrollbar-width: none !important;     /* Firefox */
            }
            .object-list-panel::-webkit-scrollbar {
                display: none !important;             /* Chrome, Safari, Opera */
            }
        `;
        document.head.appendChild(styleSheet);

        return panel;
    }

    createToggleContainer() {
        const container = document.createElement("div");
        const topBarHeight = this.isMobile ? "50px" : "60px";

        Object.assign(container.style, {
            position: "fixed",
            left: "0",
            top: `calc(50% + ${topBarHeight}/2)`,
            transform: "translateY(-50%)",
            zIndex: "951",
            cursor: "pointer",
            padding: "8px",
            backgroundColor: this.isDarkMode
                ? "rgba(0, 0, 0, 0.1)"
                : "rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(15px) saturate(120%)",
            borderRadius: "0 5px 5px 0",
            transition: "left 0.3s ease-in-out",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: this.isDarkMode
                ? "1px solid rgba(255, 255, 255, 0.05)"
                : "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: this.isDarkMode
                ? "2px 0 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
                : "2px 0 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
        });

        // R.svg 아이콘 생성
        const toggleIcon = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        );
        toggleIcon.setAttribute("width", "24");
        toggleIcon.setAttribute("height", "24");
        toggleIcon.setAttribute("viewBox", "0 0 24 24");
        toggleIcon.setAttribute("fill", this.isDarkMode ? "white" : "black");

        const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
        );
        path.setAttribute(
            "d",
            "M6.31,22.62c-.14,0-.28-.06-.38-.17-.18-.21-.16-.52.05-.71l11.19-9.69L5.99,2.26c-.21-.18-.23-.5-.05-.71.18-.21.5-.23.71-.05l11.18,9.7c.23.2.37.49.37.8s-.13.6-.37.8l-11.19,9.69c-.09.08-.21.12-.33.12Z"
        );

        toggleIcon.appendChild(path);
        Object.assign(toggleIcon.style, {
            transition: "transform 0.3s",
            transform: "rotate(0deg)",
        });

        container.appendChild(toggleIcon);
        return container;
    }

    createControlRow({
        name,
        id,
        color,
        visible,
        opacity = 0.6,
        material,
        level = 0,
        parent = null,
        isVolumeGroup = false,
        volumeMeshes = null,
        isParentGroupFlag = false,
        isGroup = false,
        groupObject = null,
    }) {
        const row = document.createElement("div");
        row.classList.add("control-row");
        
        // 불투명도 버튼에서 사용할 값들
        const opacityValues = [1.0, 0.6, 0.3, 0]; // 4단계 투명도 값
        // 초기 opacityState 설정 (material의 opacity 값으로부터)
        row.opacityState = 1; // 기본값: medium (0.6)
        if (material) {
            const materialArray = Array.isArray(material) ? material : [material];
            const materialOpacity = materialArray[0]?.opacity ?? 1.0;
            // opacity 값에 가까운 opacityState 찾기
            const stateIndex = opacityValues.findIndex((val, idx, arr) => {
                if (idx === arr.length - 1) return materialOpacity <= val;
                return materialOpacity >= val && materialOpacity > arr[idx + 1];
            });
            row.opacityState = stateIndex >= 0 ? stateIndex : 1;
        }

        // Add hierarchy-specific class
        if (level > 0) {
            row.classList.add("child-row");
            row.style.setProperty("--level", level);
        }

        // Base styles
        Object.assign(row.style, {
            display: "flex",
            alignItems: "center",
            padding: "8px",
            backgroundColor: this.isDarkMode
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(230, 230, 230, 0.95)",
            borderRadius: "5px",
            marginBottom: "15px",
            position: "relative",
            // Add indentation for child items with consistent sizing
            marginLeft: level > 0 ? `${level * 16}px` : "0",
            width: "calc(100% - 8px)",
            boxSizing: "border-box",
            minWidth: "0", // 추가: flex item이 너무 작아지는 것 방지
        });

        // Add visual hierarchy indicators for child items
        if (level > 0) {
            // Vertical line
            const verticalLine = document.createElement("div");
            verticalLine.classList.add("hierarchy-line");
            Object.assign(verticalLine.style, {
                position: "absolute",
                left: "-17px",
                top: "-8px",
                width: "2px",
                height: "calc(50% + 8px)",
                backgroundColor: this.isDarkMode
                    ? "rgba(255,255,255,0.4)"
                    : "rgba(70,70,70,0.4)",
                transition: "background-color 0.3s ease",
            });
            row.appendChild(verticalLine);

            // Horizontal line
            const horizontalLine = document.createElement("div");
            horizontalLine.classList.add("hierarchy-line");
            Object.assign(horizontalLine.style, {
                position: "absolute",
                left: "-17px",
                top: "50%",
                width: "12px",
                height: "2px",
                backgroundColor: this.isDarkMode
                    ? "rgba(255,255,255,0.4)"
                    : "rgba(70,70,70,0.4)",
                transition: "background-color 0.3s ease",
            });
            row.appendChild(horizontalLine);
        }

        // Color indicator
        const colorIndicator = document.createElement("div");
        Object.assign(colorIndicator.style, {
            width: "12px",
            height: "12px",
            backgroundColor: color,
            borderRadius: "50%",
            marginRight: "10px",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            flexShrink: "0", // 추가: 크기 고정
        });
        row.appendChild(colorIndicator);

        // Label container 추가 (새로운 요소)
        const labelContainer = document.createElement("div");
        Object.assign(labelContainer.style, {
            flexGrow: "1",
            minWidth: "0", // 추가: 텍스트 오버플로우 처리를 위해 필요
            marginRight: "10px", // 버튼과의 간격
        });

        // Label 스타일 수정
        const label = document.createElement("span");
        // Superior → Sup 약어 처리
        let displayName = name.replace(/_/g, " ");
        displayName = displayName.replace(/Superior/gi, "Sup");
        label.textContent = displayName;
        // 툴팁 추가 - 전체 이름 표시
        // 툴팁도 동일하게 약어 처리
        let displayTitle = name.replace(/_/g, " ");
        displayTitle = displayTitle.replace(/Superior/gi, "Sup");
        label.title = displayTitle;
        Object.assign(label.style, {
            fontSize: "13px",
            whiteSpace: "nowrap", // 한 줄로 표시
            overflow: "hidden", // 넘치는 텍스트 숨김
            textOverflow: "ellipsis", // 말줄임표 표시
            display: "block", // 블록 레벨 요소로 변경
            paddingLeft: level > 0 ? "8px" : "0",
        });
        row.appendChild(label);

        // 버튼 컨테이너 스타일 수정
        const buttonContainer = document.createElement("div");
        Object.assign(buttonContainer.style, {
            display: "flex",
            gap: "5px",
            flexShrink: "0", // 추가: 버튼 영역 크기 고정
            alignItems: "center",
        });

        // 버튼들의 기본 스타일 수정
        const buttonStyle = {
            padding: "4px",
            backgroundColor: "transparent",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            minWidth: "28px", // 추가: 최소 너비 설정
            flexShrink: "0", // 추가: 크기 고정
        };

        // Toggle visibility 버튼
        const toggleButton = document.createElement("button");
        Object.assign(toggleButton.style, buttonStyle);
        toggleButton.innerHTML = this.getVisibilityIcon(visible);

        toggleButton.addEventListener("click", (e) => {
            e.stopPropagation();
            // 그룹 컨트롤: Volumes, Right Group, Left Group, Superior Rectal
            let currentVisibility = visible;
            let isGroup = false;
            let groupMeshes = null;
            if (isVolumeGroup && volumeMeshes) {
                isGroup = true;
                groupMeshes = volumeMeshes;
            } else if (arguments[0]?.isCustomGroup && Array.isArray(arguments[0]?.groupMeshes)) {
                isGroup = true;
                groupMeshes = arguments[0].groupMeshes;
            }
            if (isGroup && Array.isArray(groupMeshes)) {
                // 실제 메시들의 visible 상태를 확인하여 현재 상태 결정
                const allVisible = groupMeshes.every(m => m.visible);
                const allHidden = groupMeshes.every(m => !m.visible);
                currentVisibility = !allHidden;
                const newVisibility = !currentVisibility;
                groupMeshes.forEach((mesh) => {
                    this._setMeshVisibility(mesh, newVisibility);
                    if (mesh.material) {
                        if (!mesh.material._originalOpacitySaved) {
                            mesh.material._originalOpacity = mesh.material.opacity;
                            mesh.material._originalOpacitySaved = true;
                        }
                        if (!newVisibility) {
                            mesh.material.opacity = 0;
                            mesh.material.transparent = true;
                            // Material 렌더링 상태 업데이트
                            if (Array.isArray(mesh.material)) {
                                mesh.material.forEach((mat) => this.restoreMaterialRenderState(mat, true));
                            } else {
                                this.restoreMaterialRenderState(mesh.material, true);
                            }
                        } else {
                            mesh.material.opacity = mesh.material._originalOpacity !== undefined ? mesh.material._originalOpacity : 1.0;
                            mesh.material.transparent = mesh.material.opacity < 1;
                            // Material 렌더링 상태 복원
                            if (Array.isArray(mesh.material)) {
                                mesh.material.forEach((mat) => this.restoreMaterialRenderState(mat, mesh.material.opacity < 1));
                            } else {
                                this.restoreMaterialRenderState(mesh.material, mesh.material.opacity < 1);
                            }
                        }
                        mesh.material.needsUpdate = true;
                    }
                    if (this.onToggleObject) {
                        const restoreOpacity = (mesh.material && mesh.material._originalOpacity !== undefined) ? mesh.material._originalOpacity : 1.0;
                        this.onToggleObject(mesh.name, newVisibility, newVisibility ? restoreOpacity : 0);
                    }
                    this.updateObjectVisibility(mesh.name, newVisibility);
                });
                // 그룹의 visibility 아이콘 업데이트
                toggleButton.innerHTML = this.getVisibilityIcon(newVisibility);
                toggleButton.style.opacity = newVisibility ? "1" : "0.5";
                // opacity 버튼 업데이트
                const opacityButton = Array.from(buttonContainer.children).find(
                    (button) => button.querySelector(".opacity-control-icon")
                );
                if (opacityButton) {
                    if (!newVisibility) {
                        // Visibility 끌 때 현재 opacity state 저장
                        if (!row._previousOpacityState) {
                            row._previousOpacityState = row.opacityState;
                        }
                        row.opacityState = 3;
                        opacityButton.innerHTML = this.getOpacityIcon(this.isDarkMode).none;
                    } else {
                        // Visibility 킬 때 이전 opacity state 복원
                        if (row._previousOpacityState !== undefined) {
                            row.opacityState = row._previousOpacityState;
                            delete row._previousOpacityState;
                        } else {
                            row.opacityState = 1;
                        }
                        const stateKey = ["full", "medium", "low", "none"][row.opacityState];
                        opacityButton.innerHTML = this.getOpacityIcon(this.isDarkMode)[stateKey];
                    }
                }
                // label opacity 업데이트
                const label = row.querySelector("span");
                if (label) {
                    label.style.opacity = newVisibility ? "1" : "0.5";
                }
                visible = newVisibility;
                return;
            }
            
            // Generic Group 객체 처리
            if (isGroup && groupObject) {
                const childMeshes = groupObject.children || [];
                if (childMeshes.length > 0) {
                    const allVisible = childMeshes.every(m => m.visible);
                    const allHidden = childMeshes.every(m => !m.visible);
                    currentVisibility = !allHidden;
                    const newVisibility = !currentVisibility;
                    
                    console.log(`[ObjectListPanel] Toggling group "${name}" visibility to ${newVisibility}`);
                    
                    // 그룹의 모든 자식 메시 토글
                    childMeshes.forEach((mesh) => {
                        if (mesh.isMesh) {
                            this._setMeshVisibility(mesh, newVisibility);
                            if (mesh.material) {
                                if (!mesh.material._originalOpacitySaved) {
                                    mesh.material._originalOpacity = mesh.material.opacity;
                                    mesh.material._originalOpacitySaved = true;
                                }
                                if (!newVisibility) {
                                    mesh.material.opacity = 0;
                                    mesh.material.transparent = true;
                                    if (Array.isArray(mesh.material)) {
                                        mesh.material.forEach((mat) => this.restoreMaterialRenderState(mat, true));
                                    } else {
                                        this.restoreMaterialRenderState(mesh.material, true);
                                    }
                                } else {
                                    mesh.material.opacity = mesh.material._originalOpacity !== undefined ? mesh.material._originalOpacity : 1.0;
                                    mesh.material.transparent = mesh.material.opacity < 1;
                                    if (Array.isArray(mesh.material)) {
                                        mesh.material.forEach((mat) => this.restoreMaterialRenderState(mat, mesh.material.opacity < 1));
                                    } else {
                                        this.restoreMaterialRenderState(mesh.material, mesh.material.opacity < 1);
                                    }
                                }
                                mesh.material.needsUpdate = true;
                            }
                            if (this.onToggleObject) {
                                const restoreOpacity = (mesh.material && mesh.material._originalOpacity !== undefined) ? mesh.material._originalOpacity : 1.0;
                                this.onToggleObject(mesh.name, newVisibility, newVisibility ? restoreOpacity : 0);
                            }
                            this.updateObjectVisibility(mesh.name, newVisibility);
                        }
                    });
                    
                    // 그룹 객체 자신도 visible 업데이트
                    if (groupObject._threeObject) {
                        this._setMeshVisibility(groupObject._threeObject, newVisibility);
                    }
                    if (groupObject.isMesh) {
                        this._setMeshVisibility(groupObject, newVisibility);
                    }
                    
                    // 그룹의 visibility 아이콘 업데이트
                    toggleButton.innerHTML = this.getVisibilityIcon(newVisibility);
                    toggleButton.style.opacity = newVisibility ? "1" : "0.5";
                    
                    // label opacity 업데이트
                    const label2 = row.querySelector("span");
                    if (label2) {
                        label2.style.opacity = newVisibility ? "1" : "0.5";
                    }
                    
                    visible = newVisibility;
                    return;
                }
            }
            
            // 일반 메시 처리
            // Parent가 꺼져있으면 child 제어 불가
            if (parent) {
                const parentMesh = this.liverViewer?.scene?.getObjectByName(parent);
                if (parentMesh && !parentMesh.visible) {
                    console.warn(`Parent "${parent}" is hidden. Cannot toggle visibility of child "${name}".`);
                    return; // Parent가 off면 동작 중지
                }
            }
            
            visible = !visible;

            // Material의 현재 opacity 값 저장/복원 (opacity 버튼 존재 여부와 관계없이)
            const mesh = this.liverViewer?.scene?.getObjectByName(name);
            if (mesh && mesh.material) {
                if (!visible) {
                    // Visibility 끌 때: 현재 material opacity 저장
                    const materialArray = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                    row._savedMaterialOpacity = materialArray[0]?.opacity ?? 1.0;
                } else {
                    // Visibility 킬 때: 저장된 material opacity 복원
                    const restoredOpacity = row._savedMaterialOpacity ?? 1.0;
                    const opacityValues = [1.0, 0.6, 0.3, 0];
                    
                    // 복원된 opacity에 맞는 opacityState 계산
                    const closestIndex = opacityValues.reduce((closest, val, idx) => {
                        return Math.abs(val - restoredOpacity) < Math.abs(opacityValues[closest] - restoredOpacity) ? idx : closest;
                    }, 0);
                    row.opacityState = closestIndex;
                    
                    // Material opacity 복원
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach((mat) => {
                            mat.opacity = restoredOpacity;
                            mat.transparent = restoredOpacity < 1;
                            this.restoreMaterialRenderState(mat, restoredOpacity < 1);
                            mat.needsUpdate = true;
                        });
                    } else {
                        mesh.material.opacity = restoredOpacity;
                        mesh.material.transparent = restoredOpacity < 1;
                        this.restoreMaterialRenderState(mesh.material, restoredOpacity < 1);
                        mesh.material.needsUpdate = true;
                    }
                }
            }

            // 버튼 아이콘 업데이트
            toggleButton.innerHTML = this.getVisibilityIcon(visible);
            toggleButton.style.opacity = visible ? "1" : "0.5";

            // opacity 버튼 업데이트 (있을 경우)
            const opacityButton = Array.from(buttonContainer.children).find(
                (button) => button.querySelector(".opacity-control-icon")
            );
            if (opacityButton) {
                if (!visible) {
                    row.opacityState = 3;
                    opacityButton.innerHTML = this.getOpacityIcon(this.isDarkMode).none;
                } else {
                    const stateKey = ["full", "medium", "low", "none"][row.opacityState];
                    opacityButton.innerHTML = this.getOpacityIcon(this.isDarkMode)[stateKey];
                }
            }

            // label opacity 업데이트
            const labelEl = row.querySelector("span");
            if (labelEl) {
                labelEl.style.opacity = visible ? "1" : "0.5";
            }

            // 콜백 호출 (실제 메시 visibility는 콜백에서 처리)
            if (this.onToggleObject) {
                this.onToggleObject(name, visible);
            }

            this.updateObjectVisibility(name, visible);
            // Parent의 visibility가 변경되면 하위 mesh들의 UI도 업데이트
            this.updateChildVisibilityUI(name, visible);
        });

        // visibility 버튼에 클래스 추가
        toggleButton
            .querySelector("svg")
            .classList.add("visibility-toggle-icon");

        // 우선 제외 키워드 먼저 체크
        const isPrimaryExcluded = PRIMARY_EXCLUDE_KEYWORDS.some((keyword) =>
            name.toLowerCase().includes(keyword.toLowerCase())
        );

        // 우선 제외되지 않은 경우에만 나머지 체크
        const isExcluded =
            isPrimaryExcluded ||
            EXCLUDE_KEYWORDS.some((keyword) =>
                name.toLowerCase().includes(keyword.toLowerCase())
            );

        // 투명도 조절 가능한 객체인지 확인
        const isOpacityControllable = OPACITY_CONTROLLABLE_KEYWORDS.some((keyword) =>
            name.toLowerCase().includes(keyword.toLowerCase())
        );

        // Right/Left 그룹은 제외 (isCustomGroup이고 groupMeshes가 있는 경우)
        const isRightLeftGroup = arguments[0]?.isCustomGroup && Array.isArray(arguments[0]?.groupMeshes);

        // Parent Group 판단: 자식이 있고, OPACITY_CONTROLLABLE_KEYWORDS에 포함되며, 제외되지 않은 경우
        const isParentGroup = isParentGroupFlag && isOpacityControllable && !isExcluded && !isRightLeftGroup;

        // Volumes 그룹이거나 투명도 조절 가능한 객체이면서 제외되지 않은 경우, 또는 Group인 경우 투명도 버튼 추가
        if ((isVolumeGroup && volumeMeshes) || isParentGroup || (isOpacityControllable && material && !isExcluded && !isRightLeftGroup)) {
            // 투명도 버튼 생성
            const opacityButton = document.createElement("button");
            Object.assign(opacityButton.style, buttonStyle);
            opacityButton.innerHTML = this.getOpacityIcon(this.isDarkMode)[["full", "medium", "low", "none"][row.opacityState]];
            
            opacityButton.addEventListener("click", (e) => {
                e.stopPropagation();
                row.opacityState = (row.opacityState + 1) % opacityValues.length;
                const newOpacity = opacityValues[row.opacityState];

                // 그룹 컨트롤
                if (isVolumeGroup && volumeMeshes) {
                    volumeMeshes.forEach((mesh) => {
                        if (mesh.material) {
                            mesh.material.opacity = newOpacity;
                            mesh.material.transparent = newOpacity < 1;
                            // Material 렌더링 상태 업데이트
                            if (Array.isArray(mesh.material)) {
                                mesh.material.forEach((mat) => this.restoreMaterialRenderState(mat, newOpacity < 1));
                            } else {
                                this.restoreMaterialRenderState(mesh.material, newOpacity < 1);
                            }
                        }
                        if (this.onToggleObject) {
                            this.onToggleObject(mesh.name, mesh.visible, newOpacity);
                        }
                    });
                } else if (isParentGroup) {
                    // Parent Group 처리 (하위의 모든 메시에 불투명도 적용)
                    const parentMesh = this.liverViewer?.scene?.getObjectByName(name);
                    if (parentMesh && parentMesh.children) {
                        parentMesh.children.forEach((child) => {
                            if (child.isMesh && child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach((mat) => {
                                        mat.opacity = newOpacity;
                                        mat.transparent = newOpacity < 1;
                                        this.restoreMaterialRenderState(mat, newOpacity < 1);
                                        mat.needsUpdate = true;
                                    });
                                } else {
                                    child.material.opacity = newOpacity;
                                    child.material.transparent = newOpacity < 1;
                                    this.restoreMaterialRenderState(child.material, newOpacity < 1);
                                    child.material.needsUpdate = true;
                                }
                            }
                            if (this.onToggleObject) {
                                this.onToggleObject(child.name, child.visible, newOpacity);
                            }
                        });
                    }
                } else {
                    // 단일 메시 처리
                    if (material) {
                        if (Array.isArray(material)) {
                            material.forEach((mat) => {
                                mat.opacity = newOpacity;
                                mat.transparent = newOpacity < 1;
                                this.restoreMaterialRenderState(mat, newOpacity < 1);
                                mat.needsUpdate = true;
                            });
                        } else {
                            material.opacity = newOpacity;
                            material.transparent = newOpacity < 1;
                            this.restoreMaterialRenderState(material, newOpacity < 1);
                            material.needsUpdate = true;
                        }
                    }
                    if (this.onToggleObject) {
                        this.onToggleObject(name, visible, newOpacity);
                    }
                }

                // 불투명도가 0이면 자동으로 visibility를 false로 변경
                if (newOpacity === 0) {
                    visible = false;
                    const targetMesh = this.liverViewer?.scene?.getObjectByName(name);
                    if (targetMesh) {
                        targetMesh.visible = false;
                    }
                    // toggleButton 아이콘 업데이트
                    toggleButton.innerHTML = this.getVisibilityIcon(false);
                    toggleButton.style.opacity = "0.5";
                    // label opacity 업데이트
                    const labelEl = row.querySelector("span");
                    if (labelEl) {
                        labelEl.style.opacity = "0.5";
                    }
                } else if (newOpacity > 0 && !visible) {
                    // 불투명도가 0이 아니면서 hidden 상태면 다시 visible로
                    visible = true;
                    const targetMesh = this.liverViewer?.scene?.getObjectByName(name);
                    if (targetMesh) {
                        targetMesh.visible = true;
                    }
                    // toggleButton 아이콘 업데이트
                    toggleButton.innerHTML = this.getVisibilityIcon(true);
                    toggleButton.style.opacity = "1";
                    // label opacity 업데이트
                    const labelEl = row.querySelector("span");
                    if (labelEl) {
                        labelEl.style.opacity = "1";
                    }
                }

                // 투명도 아이콘 업데이트
                opacityButton.innerHTML = this.getOpacityIcon(this.isDarkMode)[
                    ["full", "medium", "low", "none"][row.opacityState]
                ];
            });

            buttonContainer.appendChild(toggleButton);
            buttonContainer.appendChild(opacityButton);
        } else {
            buttonContainer.appendChild(toggleButton);
        }

        // 요소들을 순서대로 추가
        labelContainer.appendChild(label);
        row.appendChild(colorIndicator);
        row.appendChild(labelContainer);
        row.appendChild(buttonContainer);
        buttonContainer.appendChild(toggleButton);

        // hover 효과 추가
        this.addRowHoverEffects(row);

        // 각 row에 mesh id 데이터 속성 추가
        row.setAttribute("data-mesh-id", name);

        return row;
    }

    /**
     * 부모 메쉬의 visibility 변경으로 인해 영향을 받는 자식 메쉬들의 UI를 업데이트합니다
     * @param {string} parentName - 부모 메쉬 이름
     * @param {boolean} parentVisibility - 부모 메쉬의 새로운 visibility 상태
     */
    updateChildVisibilityUI(parentName, parentVisibility) {
        // 모든 컨트롤 로우를 순회하며 자식 메쉬들을 찾아 UI 업데이트
        const controlRows = this.contentContainer.querySelectorAll('.control-row');
        
        controlRows.forEach(row => {
            const meshId = row.getAttribute('data-mesh-id');
            if (!meshId) return;
            
            const mesh = this.objects.get(meshId);
            if (!mesh) return;
            
            // 해당 메쉬가 부모의 자식인지 확인
            let isChild = false;
            let currentParent = mesh.parent;
            while (currentParent && currentParent !== this.scene) {
                if (currentParent.name === parentName) {
                    isChild = true;
                    break;
                }
                currentParent = currentParent.parent;
            }
            
            if (isChild) {
                // Child의 visibility는 부모에 완전히 종속됨
                // 부모가 꺼지면 자식도 꺼지고, 부모가 켜지면 자식의 원래 상태로 복구
                mesh.visible = parentVisibility;
                
                // UI 요소들 업데이트
                const label = row.querySelector('span');
                if (label) {
                    label.style.opacity = parentVisibility ? "1" : "0.5";
                }
                
                // visibility 버튼 업데이트
                const visibilityButtons = row.querySelectorAll('button');
                const visibilityButton = Array.from(visibilityButtons).find(button => 
                    button.querySelector('.visibility-toggle-icon')
                );
                
                if (visibilityButton) {
                    visibilityButton.innerHTML = this.getVisibilityIcon(parentVisibility);
                    visibilityButton.style.opacity = parentVisibility ? "1" : "0.5";
                    // Parent가 꺼져있으면 child의 visibility 버튼 disabled
                    visibilityButton.disabled = !parentVisibility;
                    visibilityButton.style.cursor = parentVisibility ? "pointer" : "not-allowed";
                    visibilityButton.style.opacity = parentVisibility ? "1" : "0.5";
                }
                
                // opacity 버튼도 disabled 처리
                const opacityButton = Array.from(visibilityButtons).find(button => 
                    button.querySelector('.opacity-control-icon')
                );
                
                if (opacityButton) {
                    opacityButton.disabled = !parentVisibility;
                    opacityButton.style.cursor = parentVisibility ? "pointer" : "not-allowed";
                    opacityButton.style.opacity = parentVisibility ? "1" : "0.3";
                }
                
                // Material opacity 업데이트
                if (mesh.material) {
                    if (!parentVisibility) {
                        // 부모가 꺼지면 자식도 opacity 0으로
                        const materialArray = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                        materialArray.forEach((mat) => {
                            mat.opacity = 0;
                            mat.transparent = true;
                            mat.needsUpdate = true;
                        });
                    } else {
                        // 부모가 켜지면 자식의 이전 저장된 opacity로 복구
                        const materialArray = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                        const savedOpacity = row._savedMaterialOpacity ?? 0.6;
                        materialArray.forEach((mat) => {
                            mat.opacity = savedOpacity;
                            mat.transparent = savedOpacity < 1;
                            mat.needsUpdate = true;
                        });
                    }
                }
            }
        });
    }

    /**
     * 부모 메쉬의 투명도 변경으로 인해 영향을 받는 자식 메쉬들의 투명도와 visibility를 업데이트합니다
     * @param {string} parentName - 부모 메쉬 이름
     * @param {number} parentOpacity - 부모 메쉬의 새로운 투명도
     */
    updateChildOpacityAndVisibility(parentName, parentOpacity) {
        // 모든 컨트롤 로우를 순회하며 자식 메쉬들을 찾아 UI 업데이트
        const controlRows = this.contentContainer.querySelectorAll('.control-row');
        
        controlRows.forEach(row => {
            const meshId = row.getAttribute('data-mesh-id');
            if (!meshId) return;
            
            const mesh = this.objects.get(meshId);
            
            if (!mesh) return;
            
            // 해당 메쉬가 부모의 자식인지 확인
            let isChild = false;
            let currentParent = mesh.parent;
            while (currentParent && currentParent !== this.scene) {
                if (currentParent.name === parentName) {

                    isChild = true;
                    break;
                }
                currentParent = currentParent.parent;
            }
            
            if (isChild) {
                // 자식 메쉬의 실제 투명도는 부모 투명도와 곱하여 계산
                const originalOpacity = mesh.material.userData.originalOpacity || 0.6;
                const effectiveOpacity = originalOpacity * parentOpacity;
                const isEffectivelyHidden = effectiveOpacity === 0;
                
                // UI 요소들 업데이트
                const label = row.querySelector('span');
                if (label) {
                    label.style.opacity = isEffectivelyHidden ? "0.5" : "1";
                }
                
                // visibility 버튼 업데이트
                const visibilityButton = Array.from(row.children)
                    .find(button => button.querySelector('.visibility-toggle-icon'));
                
                if (visibilityButton) {
                    visibilityButton.innerHTML = this.getVisibilityIcon(!isEffectivelyHidden);
                    visibilityButton.style.opacity = isEffectivelyHidden ? "0.5" : "1";
                }
                
                // opacity 버튼 업데이트
                const opacityButton = Array.from(row.children)
                    .find(button => button.querySelector('.opacity-control-icon'));
                
                if (opacityButton) {
                    if (isEffectivelyHidden) {
                        // 부모가 완전히 투명하면 자식도 투명도 0으로 설정
                        row.opacityState = 3; // none 상태
                        opacityButton.innerHTML = this.getOpacityIcon(this.isDarkMode).none;
                    } else {
                        // 부모가 보이면 자식의 원래 투명도 상태로 복원
                        if (effectiveOpacity >= 0.9) {
                            row.opacityState = 0; // full 상태
                            opacityButton.innerHTML = this.getOpacityIcon(this.isDarkMode).full;
                        } else if (effectiveOpacity >= 0.5) {
                            row.opacityState = 1; // medium 상태
                            opacityButton.innerHTML = this.getOpacityIcon(this.isDarkMode).medium;
                        } else if (effectiveOpacity > 0) {
                            row.opacityState = 2; // low 상태
                            opacityButton.innerHTML = this.getOpacityIcon(this.isDarkMode).low;
                        } else {
                            row.opacityState = 3; // none 상태 (완전히 숨김)
                            opacityButton.innerHTML = this.getOpacityIcon(this.isDarkMode).none;
                        }
                    }
                }
                
                // 실제 메쉬 visibility와 opacity 업데이트
                if (mesh.material) {
                    mesh.visible = !isEffectivelyHidden;
                    mesh.material.opacity = effectiveOpacity;
                    mesh.material.transparent = effectiveOpacity < 1;
                    mesh.material.needsUpdate = true;
                }

                // onToggleObject 콜백 호출 (자식 메쉬도 함께 처리)
                if (this.onToggleObject) {
                    this.onToggleObject(meshId, !isEffectivelyHidden, effectiveOpacity);
                }
                
                console.log(`[Parenting Opacity] ${meshId}: parent=${parentName}, parentOpacity=${parentOpacity}, originalOpacity=${originalOpacity}, effectiveOpacity=${effectiveOpacity}, hidden=${isEffectivelyHidden}`);
            }
        });
    }

    // 전체 메쉬 토글 버튼 추가 메서드
    addToggleAllButton() {
        const toggleAllContainer = document.createElement("div");
        Object.assign(toggleAllContainer.style, {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 8px",
            backgroundColor: this.isDarkMode
                ? "rgba(255, 255, 255, 0.15)"
                : "rgba(70, 70, 70, 0.15)",
            borderRadius: "5px",
            marginBottom: "20px",
            position: "relative",
        });

        // 라벨 생성
        const label = document.createElement("span");
        label.textContent = "All Meshes";
        Object.assign(label.style, {
            fontSize: "14px",
            fontWeight: "bold",
            color: this.isDarkMode ? "white" : "black",
        });

        // 토글 버튼 생성
        const toggleButton = document.createElement("button");
        toggleButton.innerHTML = this.getVisibilityIcon(this.allObjectsVisible);
        Object.assign(toggleButton.style, {
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        });

        // 토글 버튼 클릭 이벤트
        toggleButton.addEventListener("click", () => {
            console.log("[ObjectListPanel] 전체 메쉬 토글 버튼 클릭됨");
            this.toggleAllObjects();
            toggleButton.innerHTML = this.getVisibilityIcon(
                this.allObjectsVisible
            );
        });

        toggleAllContainer.appendChild(label);
        toggleAllContainer.appendChild(toggleButton);

        // 컨테이너의 첫 번째 자식으로 추가
        if (this.contentContainer && this.contentContainer.firstChild) {
            this.contentContainer.insertBefore(
                toggleAllContainer,
                this.contentContainer.firstChild
            );
        } else if (this.contentContainer) {
            this.contentContainer.appendChild(toggleAllContainer);
        }
    }

    // 모든 메쉬 토글 기능 구현
    toggleAllObjects() {
        // 계층 구조 전체에서 mesh 수집
        const meshes = [];
        if (this.liverViewer && this.liverViewer.scene) {
            this.liverViewer.scene.traverse(obj => {
                if (obj.isMesh) meshes.push(obj);
            });
        }
        console.log(`[ObjectListPanel] toggleAllObjects 호출: scene 내 mesh 개수 = ${meshes.length}, objects Map 개수 = ${this.objects.size}`);
        const toHide = this.allObjectsVisible;
        // objects Map을 최신 mesh 참조로 갱신
        this.objects.clear();
        meshes.forEach(mesh => {
            this.objects.set(mesh.name, mesh);
            if (toHide) {
                mesh.userData.originalOpacity = mesh.material.opacity;
                mesh.material.opacity = 0;
                mesh.visible = false;
                mesh.userData.wasVisible = false;
            } else {
                const prevOpacity = mesh.userData.originalOpacity ?? 1;
                mesh.material.opacity = prevOpacity;
                mesh.visible = true;
                mesh.userData.wasVisible = true;
                mesh.material.transparent = prevOpacity < 1;
            }
        });
        this.allObjectsVisible = !toHide;
        // UI 갱신: 실제 mesh 리스트 기준으로
        meshes.forEach(mesh => {
            const id = mesh.name;
            if (this.onToggleObject) {
                this.onToggleObject(
                    id,
                    !toHide,
                    !toHide ? (mesh.userData.originalOpacity ?? 1) : 0
                );
            }
            this.updateObjectVisibility(id, !toHide);
            const row = this.contentContainer.querySelector(
                `[data-mesh-id="${id}"]`
            );
            if (row) {
                const buttons = row.querySelectorAll("button");
                const visibilityButton = Array.from(buttons).find((button) =>
                    button.querySelector(".visibility-toggle-icon")
                );
                if (visibilityButton) {
                    visibilityButton.innerHTML = this.getVisibilityIcon(!toHide);
                    visibilityButton.style.opacity = !toHide ? "1" : "0.5";
                }
                const label = row.querySelector("span");
                if (label) {
                    label.style.opacity = !toHide ? "1" : "0.5";
                }
                const opacityButton = Array.from(buttons).find((button) =>
                    button.querySelector(".opacity-control-icon")
                );
                if (opacityButton) {
                    if (toHide) {
                        row.opacityState = 3;
                        opacityButton.innerHTML = this.getOpacityIcon(this.isDarkMode).none;
                    } else {
                        row.opacityState = 1;
                        opacityButton.innerHTML = this.getOpacityIcon(this.isDarkMode).medium;
                    }
                }
            }
        });
    }

    // 전체 메쉬 표시 상태 설정 메서드 추가 (외부에서 호출할 수 있는 API)
    setAllMeshesVisibility(visible) {
        this.allObjectsVisible = visible;

        // 전체 표시 버튼 업데이트 (있을 경우)
        const toggleAllButton = this.contentContainer?.querySelector(
            "div:first-child button"
        );
        if (toggleAllButton) {
            toggleAllButton.innerHTML = this.getVisibilityIcon(visible);
        }

        // 각 메쉬 상태 업데이트
        this.objects.forEach((mesh, id) => {
            this.updateObjectVisibility(id, visible);

            if (this.onToggleObject) {
                this.onToggleObject(id, visible, visible ? 1.0 : 0);
            }
        });
    }

    setupToggleEvents() {
        let isTransitioning = false; // 트랜지션 상태 추적

        const togglePanel = (e) => {
            if (e) e.stopPropagation();

            // 트랜지션 중이면 무시
            if (isTransitioning) return;

            isTransitioning = true;
            this.isOpen = !this.isOpen;

            // PanelManager에 상태 업데이트
            if (this.panelManager) {
                this.panelManager.updatePanelState(this, this.isOpen);
            }

            // 모바일에서 다른 패널이 닫힐 때 시각적 피드백 (실시간 상태 확인)
            const currentIsMobile = window.innerWidth < 768;
            if (this.panelManager && currentIsMobile && this.isOpen) {
                console.log("모바일: Mesh Panel 열림 - Volume Panel이 자동으로 닫힙니다.");
            }

            const panelWidth = `${Constants.UI.PANEL.WIDTH}px`; // 🔴 Constants에서 가져오도록 수정

            if (this.isOpen) {
                this.panel.style.display = "block";
                this.panel.style.transition = "left 0.3s ease-in-out";
                this.toggleContainer.style.transition = "left 0.3s ease-in-out";
                if (this.meshTooltipToggleContainer) {
                    this.meshTooltipToggleContainer.style.transition = "left 0.3s ease-in-out";
                }

                // 약간의 지연 후 위치 변경
                setTimeout(() => {
                    this.panel.style.left = "0";
                    this.toggleContainer.style.left = panelWidth;
                    if (this.meshTooltipToggleContainer) {
                        this.meshTooltipToggleContainer.style.left = "0"; // 🔴 패널과 동일한 위치 (padding 없음)
                    }
                }, 0);
            } else {
                this.panel.style.left = `-${panelWidth}`;
                this.toggleContainer.style.left = "0";
                if (this.meshTooltipToggleContainer) {
                    this.meshTooltipToggleContainer.style.left = `-${Constants.UI.PANEL.WIDTH}px`; // 🔴 패널과 함께 왼쪽으로 이동
                }

                // 트랜지션이 끝난 후 display none
                setTimeout(() => {
                    this.panel.style.display = "none";
                }, 300);
            }

            this.toggleContainer.firstChild.style.transform = this.isOpen
                ? "rotate(180deg)"
                : "rotate(0deg)";

            // 트랜지션 완료 후 상태 초기화
            setTimeout(() => {
                isTransitioning = false;
            }, 300);
        };

        this.toggleContainer.addEventListener("click", togglePanel);

        // 토글 메서드 저장
        this.togglePanel = togglePanel;
        
        // close 메서드 추가
        this.close = () => {
            if (this.isOpen) {
                this.isOpen = false;
                
                if (this.panelManager) {
                    this.panelManager.updatePanelState(this, false);
                }
                
                const panelWidth = "250px";
                this.panel.style.left = `-${panelWidth}`;
                this.toggleContainer.style.left = "0";
                this.toggleContainer.firstChild.style.transform = "rotate(0deg)";
                
                setTimeout(() => {
                    this.panel.style.display = "none";
                }, 300);
            }
        };
    }

    setupMobileEvents(togglePanel) {
        let touchStartX = 0;
        let touchMoveX = 0;
        let isPanelOpen = false;

        this.panel.addEventListener(
            "touchstart",
            (e) => {
                touchStartX = e.touches[0].clientX;
            },
            { passive: true }
        );

        this.panel.addEventListener(
            "touchmove",
            (e) => {
                touchMoveX = e.touches[0].clientX;
                const diff = touchMoveX - touchStartX;

                if (diff < -50 && isPanelOpen) {
                    togglePanel();
                }
            },
            { passive: true }
        );

        this.toggleContainer.addEventListener("touchstart", (e) => {
            e.preventDefault();
            togglePanel();
        });
    }

    adjustForMobile(contentContainer) {
        const topBarHeight = "50px";
        Object.assign(this.panel.style, {
            top: topBarHeight,
            height: `calc(100% - ${topBarHeight})`,
        });

        const safeAreaInsets = {
            top: "env(safe-area-inset-top, 0px)",
            bottom: "env(safe-area-inset-bottom, 0px)",
        };

        contentContainer.style.paddingTop = `20px`; // TopBar 아래 여백
        contentContainer.style.paddingBottom = `calc(20px + ${safeAreaInsets.bottom})`;
    }

    addRowHoverEffects(row) {
        const backgroundColor = this.isDarkMode
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(230, 230, 230, 0.95)";

        const hoverColor = this.isDarkMode
            ? "rgba(255, 255, 255, 0.2)"
            : "rgba(220, 220, 220, 0.95)";

        row.onmouseenter = () => {
            row.style.backgroundColor = hoverColor;
        };

        row.onmouseleave = () => {
            row.style.backgroundColor = backgroundColor;
        };
    }

    clearList() {
        console.log("Clearing object list");
        // 패널 의 모든 객체 목록을 제거
        const panel = document.getElementById("objectListPanel");
        if (panel) {
            while (panel.firstChild) {
                panel.removeChild(panel.firstChild);
            }
        }

        // 선택된 객체 초기화
        this.selectedObject = null;
        this.selectedMeshName = null;
    }

    // close 메서드 추가
    close() {
        if (this.isOpen) {
            // 패널 UI 업데이트
            const panelWidth = "250px";
            this.panel.style.left = `-${panelWidth}`;
            this.toggleContainer.style.left = "0";
            this.toggleContainer.firstChild.style.transform = "rotate(0)";

            setTimeout(() => {
                this.panel.style.display = "none";
            }, 300);

            this.isOpen = false;
        }

        // 드래그 스크롤 이벤트 리스너 정리
        if (this.dragScrollHandlers) {
            document.removeEventListener("mousemove", this.dragScrollHandlers.mouseMove);
            document.removeEventListener("mouseup", this.dragScrollHandlers.mouseUp);
            if (this.dragScrollHandlers.keyDown) {
                document.removeEventListener("keydown", this.dragScrollHandlers.keyDown);
            }
            if (this.dragScrollHandlers.container) {
                this.dragScrollHandlers.container.removeEventListener("touchstart", this.dragScrollHandlers.touchStart);
                this.dragScrollHandlers.container.removeEventListener("touchmove", this.dragScrollHandlers.touchMove);
                this.dragScrollHandlers.container.removeEventListener("touchend", this.dragScrollHandlers.touchEnd);
            }
            this.dragScrollHandlers = null;
        }
    }

    // meshes를 설정하는 새로운 메서드
    setMeshes(meshes) {
        console.log("Setting meshes:", meshes);
        this.meshes = meshes;
    }

    setToggleCallback(callback) {
        this.onToggleObject = callback;
    }

    updateTheme(isDarkMode) {
        console.log("ObjectListPanel updateTheme called with isDarkMode:", isDarkMode);
        this.isDarkMode = isDarkMode;
        console.log("ObjectListPanel isDarkMode updated to:", this.isDarkMode);

        // 모드 전환 시 transition 일시 제거
        const originalPanelTransition = this.panel.style.transition;
        const originalToggleTransition = this.toggleContainer.style.transition;
        
        this.panel.style.transition = "none";
        this.toggleContainer.style.transition = "none";

        // 토널 배경색 업데이트
        this.panel.style.backgroundColor = isDarkMode
            ? Constants.UI.PANEL.DARK.BACKGROUND
            : Constants.UI.PANEL.LIGHT.BACKGROUND;

        this.panel.style.color = isDarkMode
            ? Constants.UI.PANEL.DARK.TEXT
            : Constants.UI.PANEL.LIGHT.TEXT;

        // 클래스로 지시선 요소들 선택
        const hierarchyLines = this.panel.querySelectorAll(".hierarchy-line");
        hierarchyLines.forEach((line) => {
            line.style.backgroundColor = isDarkMode
                ? "rgba(255,255,255,0.4)"
                : "rgba(70,70,70,0.4)";
        });

        // 전체 토글 버튼 업데이트
        const toggleAllContainer =
            this.contentContainer?.querySelector("div:first-child");
        if (toggleAllContainer) {
            toggleAllContainer.style.backgroundColor = isDarkMode
                ? "rgba(255, 255, 255, 0.15)"
                : "rgba(70, 70, 70, 0.15)";

            const label = toggleAllContainer.querySelector("span");
            if (label) {
                label.style.color = isDarkMode ? "white" : "black";
            }

            const toggleButton = toggleAllContainer.querySelector("button");
            if (toggleButton && toggleButton.querySelector("svg")) {
                toggleButton
                    .querySelector("svg")
                    .setAttribute("fill", isDarkMode ? "white" : "black");
            }
        }

        // 토널 스타일 업데이트 (Glassmorphism)
        Object.assign(this.panel.style, {
            backgroundColor: isDarkMode
                ? "rgba(0, 0, 0, 0.4)"
                : "rgba(255, 255, 255, 0.4)",
            backdropFilter: "blur(20px) saturate(120%)",
            color: isDarkMode ? "white" : "black",
            border: isDarkMode
                ? "1px solid rgba(255, 255, 255, 0.08)"
                : "1px solid rgba(255, 255, 255, 0.15)",
            boxShadow: isDarkMode
                ? "2px 0 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
                : "2px 0 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
        });

        // 토글 버튼 스타일 업데이트 (Glassmorphism)
        Object.assign(this.toggleContainer.style, {
            backgroundColor: isDarkMode
                ? "rgba(0, 0, 0, 0.1)"
                : "rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(15px) saturate(120%)",
            border: isDarkMode
                ? "1px solid rgba(255, 255, 255, 0.05)"
                : "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: isDarkMode
                ? "2px 0 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
                : "2px 0 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
        });

        // 토글 아이콘 색상 업데이트
        const toggleIcon = this.toggleContainer.querySelector("svg");
        if (toggleIcon) {
            toggleIcon.setAttribute("fill", isDarkMode ? "white" : "black");
        }

        // 모든 리스트 아이템 업데이트
        const listItems = this.panel.querySelectorAll(".control-row");
        listItems.forEach((item) => {
            // 배경색 업데이트
            item.style.backgroundColor = isDarkMode
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(230, 230, 230, 0.95)";

            // 텍스트 색상 업데이트
            const label = item.querySelector("span");
            if (label) {
                label.style.color = isDarkMode ? "white" : "black";
            }

            // visibility 아이콘 업데이트
            const visibilityIcon = item.querySelector(
                ".visibility-toggle-icon"
            );
            if (visibilityIcon) {
                visibilityIcon.setAttribute(
                    "fill",
                    isDarkMode ? "white" : "black"
                );
            }

            // opacity 아이콘 업데이트
            const opacityIcon = item.querySelector(".opacity-control-icon");
            if (opacityIcon) {
                opacityIcon.setAttribute(
                    "fill",
                    isDarkMode ? "white" : "black"
                );
            }

            // delete 아이콘 업데이트
            const deleteIcon = item.querySelector(".delete-icon");
            if (deleteIcon) {
                deleteIcon.setAttribute("fill", isDarkMode ? "white" : "black");
            }
        });

        // hover 효과 업데이트를 위해 모든 행에 대해 이벤트 리스너 재설정
        listItems.forEach((row) => {
            this.addRowHoverEffects(row);
        });

        // 계층 구조 아이콘 색상 업데이트
        const hierarchyIcons = this.panel.querySelectorAll(
            '.control-row svg[viewBox="0 0 24 24"]'
        );
        hierarchyIcons.forEach((icon) => {
            icon.style.fill = isDarkMode
                ? Constants.UI.PANEL.DARK.TEXT
                : Constants.UI.PANEL.LIGHT.TEXT;
        });

        // 모든 SVG 아이콘 색상 업데이트
        const allSvgIcons = this.panel.querySelectorAll("svg");
        allSvgIcons.forEach((svg) => {
            const iconColor = isDarkMode ? "white" : "black";

            // visibility, opacity, delete 아이콘 모두 포함
            if (
                svg.classList.contains("visibility-toggle-icon") ||
                svg.classList.contains("opacity-control-icon") ||
                svg.classList.contains("delete-icon")
            ) {
                // fill 속성이 있는 경우만 업데이트
                if (svg.getAttribute("fill")) {
                    svg.setAttribute("fill", iconColor);
                }

                // path 요소들의 fill과 stroke 업데이트
                svg.querySelectorAll("path").forEach((path) => {
                    if (
                        path.getAttribute("fill") &&
                        path.getAttribute("fill") !== "none"
                    ) {
                        path.setAttribute("fill", iconColor);
                    }
                    if (path.getAttribute("stroke")) {
                        path.setAttribute("stroke", iconColor);
                    }
                });
            }
        });

        // transition 복원
        requestAnimationFrame(() => {
            this.panel.style.transition = originalPanelTransition;
            this.toggleContainer.style.transition = originalToggleTransition;
        });

        // 메시 이름 표시 토글 버튼 테마 업데이트
        if (this.meshTooltipToggle) {
            this.updateMeshTooltipToggleState();
            // 토글 컨테이너 배경색 업데이트
            if (this.meshTooltipToggleContainer) {
                this.meshTooltipToggleContainer.style.backgroundColor = isDarkMode
                    ? "#404040"
                    : "#f5f5f5";
                this.meshTooltipToggleContainer.style.borderTop = isDarkMode
                    ? "1px solid #555"
                    : "1px solid #ddd";
                
                // 라벨 색상 업데이트
                const label = this.meshTooltipToggleContainer.querySelector("span");
                if (label) {
                    label.style.color = isDarkMode ? "white" : "black";
                }
            }
        }
    }

    // 삭제 아이콘 SVG 함수 추가
    getDeleteIcon() {
        const iconColor = this.isDarkMode ? "white" : "black";
        return `
            <svg class="delete-icon" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="${iconColor}">
                <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
            </svg>
        `;
    }

    addMeasurement(measurement) {
        console.log(
            "Adding measurement to panel, measurement data:",
            measurement
        );

        if (!measurement || !measurement.value) {
            console.error("Invalid measurement data:", measurement);
            return;
        }

        // 현재 테마에 맞는 색상 설정
        const textColor = this.isDarkMode ? "white" : "black";
        const bgColor = this.isDarkMode
            ? "rgba(255, 255, 255, 0.1)"
            : "rgb(240, 240, 240)";

        const itemDiv = document.createElement("div");
        itemDiv.className = "control-row";
        Object.assign(itemDiv.style, {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px", // control-row와 동일한 패딩
            margin: "0 0 15px", // control-row와 동일한 마진
            height: "48px",
            backgroundColor: bgColor, // 현재 테마에 맞는 배경색
            borderRadius: "4px",
            cursor: "pointer",
            boxSizing: "border-box",
            transition: "all 0.3s ease",
        });

        // 측정값 텍스트
        const nameSpan = document.createElement("span");
        nameSpan.textContent = `${
            measurement.type === "distance"
                ? `D : ${measurement.value} mm`
                : `A : ${measurement.value} °`
        }`;
        Object.assign(nameSpan.style, {
            opacity: "1",
            color: this.isDarkMode ? "white" : "black",
            transition: "all 0.3s ease",
            fontSize: "13px", // mesh 이름과 동일한 크기로 설정
        });

        // 컨트롤 버튼 컨테이너
        const buttonContainer = document.createElement("div");
        Object.assign(buttonContainer.style, {
            display: "flex",
            gap: "8px",
            alignItems: "center",
        });

        // Visibility 토글 버튼
        const visibilityBtn = document.createElement("button");
        visibilityBtn.innerHTML = this.getVisibilityIcon(true); // 이미 isDarkMode를 고려하는 함수
        Object.assign(visibilityBtn.style, {
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: textColor, // 현재 테마에 맞는 버튼 색상
        });

        // Delete 버튼
        const deleteBtn = document.createElement("button");
        deleteBtn.innerHTML = this.getDeleteIcon(); // 이미 isDarkMode를 고려하는 함수
        Object.assign(deleteBtn.style, {
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: textColor, // 현재 테마에 맞는 버튼 색상
        });

        // Visibility 토글 버튼 이벤트
        visibilityBtn.onclick = (e) => {
            e.stopPropagation();
            const isVisible = measurement.markers[0]?.visible ?? true;
            const newVisibility = !isVisible;

            // 마커, 라인, 라벨 visibility 토글
            measurement.markers?.forEach(
                (marker) => (marker.visible = newVisibility)
            );
            measurement.lines?.forEach(
                (line) => (line.visible = newVisibility)
            );
            if (measurement.label) {
                measurement.label.visible = newVisibility;
            }

            // 버튼 아이콘과 텍스트 투명도 업데이트
            visibilityBtn.innerHTML = this.getVisibilityIcon(newVisibility);
            nameSpan.style.opacity = newVisibility ? "1" : "0.5";
            visibilityBtn.style.opacity = newVisibility ? "1" : "0.5";

            // 씬 업데이트 요청
            if (this.liverViewer) {
                this.liverViewer.requestRender();
            }
        };

        // Delete 버튼 이벤트
        deleteBtn.onclick = (e) => {
            e.stopPropagation();

            // 마커 제거
            measurement.markers?.forEach((marker) => {
                if (marker) {
                    marker.removeFromParent();
                    marker.geometry?.dispose();
                    marker.material?.dispose();
                }
            });

            // 라인 제거
            measurement.lines?.forEach((line) => {
                if (line) {
                    line.removeFromParent();
                    line.geometry?.dispose();
                    line.material?.dispose();
                }
            });

            // 라벨 제거
            if (measurement.label) {
                measurement.label.removeFromParent();
                measurement.label.element?.remove();
            }

            // UI에서 항목 제거
            itemDiv.remove();

            // 씬 업데이트 요청
            if (this.liverViewer) {
                this.liverViewer.requestRender();
            }
        };

        buttonContainer.appendChild(visibilityBtn);
        buttonContainer.appendChild(deleteBtn);
        itemDiv.appendChild(nameSpan);
        itemDiv.appendChild(buttonContainer);

        if (this.contentContainer) {
            this.contentContainer.appendChild(itemDiv);
        } else {
            console.error("Content container not found");
        }

        // 패널이 닫혀있으면 열기
        if (!this.isOpen) {
            this.togglePanel();
        }
    }

    // visibility 아이콘 SVG 함수도 클래스 내부에 있어야 함
    getVisibilityIcon(isVisible) {
        const iconColor = this.isDarkMode ? "white" : "black";
        return isVisible
            ? `<svg class="visibility-toggle-icon" viewBox="0 0 24 24" width="20" height="20" fill="${iconColor}">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-3-3-3-3z"/>
            </svg>`
            : `<svg class="visibility-toggle-icon" viewBox="0 0 24 24" width="20" height="20" fill="${iconColor}">
                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
            </svg>`;
    }

    // 투명도 아이콘 SVG 함수 추가
    getOpacityIcon(isDarkMode) {
        const iconColor = isDarkMode ? "white" : "black";
        return {
            full: `<svg class="opacity-control-icon" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="${iconColor}">
                <path d="M480-144q-125 0-212.5-86.5T180-440q0-60 22.5-112.5T264-645l216-219 217 220q38 40 60.5 92T780-440q0 123-87.5 209.5T480-144Z"/>
            </svg>`,
            medium: `<svg class="opacity-control-icon" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
                <path d="M480-144q-125 0-212.5-86.5T180-440q0-60 22.5-112.5T264-645l216-219 217 220q38 40 60.5 92T780-440q0 123-87.5 209.5T480-144Z" fill="none" stroke="${iconColor}" stroke-width="50"/>
                <path d="M480-144q-125 0-212.5-86.5T180-440q0-60 22.5-112.5T264-645l216-219 217 220q38 40 60.5 92T780-440q0 123-87.5 209.5T480-144Z" fill="${iconColor}" clip-path="url(#clip60)"/>
                <defs>
                    <clipPath id="clip60">
                        <rect x="0" y="-640" width="960" height="576" />
                    </clipPath>
                </defs>
            </svg>`,
            low: `<svg class="opacity-control-icon" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
                <path d="M480-144q-125 0-212.5-86.5T180-440q0-60 22.5-112.5T264-645l216-219 217 220q38 40 60.5 92T780-440q0 123-87.5 209.5T480-144Z" fill="none" stroke="${iconColor}" stroke-width="50"/>
                <path d="M480-144q-125 0-212.5-86.5T180-440q0-60 22.5-112.5T264-645l216-219 217 220q38 40 60.5 92T780-440q0 123-87.5 209.5T480-144Z" fill="${iconColor}" clip-path="url(#clip30)"/>
                <defs>
                    <clipPath id="clip30">
                        <rect x="0" y="-320" width="960" height="228" />
                    </clipPath>
                </defs>
            </svg>`,
            none: `<svg class="opacity-control-icon" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
                <path d="M480-144q-125 0-212.5-86.5T180-440q0-60 22.5-112.5T264-645l216-219 217 220q38 40 60.5 92T780-440q0 123-87.5 209.5T480-144Z" fill="none" stroke="${iconColor}" stroke-width="50"/>
                <path d="M480-144q-125 0-212.5-86.5T180-440q0-60 22.5-112.5T264-645l216-219 217 220q38 40 60.5 92T780-440q0 123-87.5 209.5T480-144Z" fill="${iconColor}" clip-path="url(#clip0)"/>
                <defs>
                    <clipPath id="clip0">
                        <rect x="0" y="0" width="0" height="0" />
                    </clipPath>
                </defs>
            </svg>`,
        };
    }

    updateObjectVisibility(meshId, visible) {
        const row = this.contentContainer.querySelector(
            `[data-mesh-id="${meshId}"]`
        );
        if (row) {
            // visibility 버튼 찾기
            const buttons = row.querySelectorAll("button");
            const visibilityButton = Array.from(buttons).find((button) =>
                button.querySelector(".visibility-toggle-icon")
            );

            if (visibilityButton) {
                // visibility 아이콘 업데이트
                visibilityButton.innerHTML = this.getVisibilityIcon(visible);
            }

            // 이름 레이블 찾기
            const label = row.querySelector("span");
            if (label) {
                // 기존 이름 유지하면서 visible 상태만 업데이트
                label.style.opacity = visible ? "1" : "0.5";
            }
        }
    }

    /**
     * 투명도 변경 시 material의 렌더링 상태를 복원하는 헬퍼 메서드
     * @param {THREE.Material} material - Material 객체
     * @param {boolean} makeTransparent - transparent 상태로 변경할지 여부
     */
    restoreMaterialRenderState(material, makeTransparent = false) {
        if (!material) return;
        
        if (makeTransparent) {
            // 투명 상태로 변경: DoubleSide 유지, depthWrite 비활성화
            material.side = material._originalSide || THREE.DoubleSide;
            material.depthTest = material._originalDepthTest !== undefined ? material._originalDepthTest : true;
            material.depthWrite = false; // 투명한 메시는 depthWrite 비활성화
            material.transparent = true;
        } else {
            // 원본 상태로 복원
            material.side = material._originalSide !== undefined ? material._originalSide : THREE.FrontSide;
            material.depthTest = material._originalDepthTest !== undefined ? material._originalDepthTest : true;
            material.depthWrite = material._originalDepthWrite !== undefined ? material._originalDepthWrite : true;
            material.transparent = material._originalTransparent !== undefined ? material._originalTransparent : false;
        }
        
        material.needsUpdate = true;
    }

    // MeshTooltip 설정 메서드 추가
    setMeshTooltip(meshTooltip) {
        // 이전 MeshTooltip의 userDisabled 상태 저장
        const wasUserDisabled = this.meshTooltip ? this.meshTooltip.userDisabled : false;
        
        this.meshTooltip = meshTooltip;
        
        // 이전에 사용자가 비활성화한 상태였다면 새 인스턴스에도 적용
        if (wasUserDisabled && this.meshTooltip) {
            this.meshTooltip.userDisabled = true;
            this.meshTooltip.isEnabled = false;
        }
        
        // 토글이 이미 생성되어 있다면 상태 업데이트
        if (this.meshTooltipToggle) {
            this.updateMeshTooltipToggleState();
        }
    }

    /**
     * 메시 이름 표시 토글 버튼 생성
     */
    createMeshTooltipToggle() {
        const toggleContainer = document.createElement("div");
        const panelWidth = Constants.UI.PANEL.WIDTH; // 250px
        
        Object.assign(toggleContainer.style, {
            position: "fixed", // 🔴 항상 하단 고정
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 0", // 🔴 좌우 padding 제거 (panel과 정확히 정렬)
            backgroundColor: this.isDarkMode ? "#404040" : "#f5f5f5", // 🔴 Solid color (투명도 0%)
            borderRadius: "0",
            borderTop: this.isDarkMode ? "1px solid #555" : "1px solid #ddd", // 🔴 경계선 (solid)
            flexShrink: "0",
            width: `${panelWidth}px`, // 🔴 패널 너비와 동일
            height: "32px", // 🔴 고정 높이
            left: this.isOpen ? "0" : `-${panelWidth}px`, // 🔴 정확한 위치 (padding 없음)
            bottom: "0", // 🔴 하단에 고정
            zIndex: "949", // 🔴 패널 바로 아래에 배치
            transition: "left 0.3s ease-in-out",
            gap: "12px", // 🔴 요소 간 간격
            paddingLeft: "15px", // 🔴 왼쪽 padding 명시적 설정
            paddingRight: "15px", // 🔴 오른쪽 padding 명시적 설정
            boxSizing: "border-box", // 🔴 padding 포함해서 계산
        });

        // 라벨 생성
        const label = document.createElement("span");
        label.textContent = "Mesh Name Display";
        Object.assign(label.style, {
            fontSize: "13px", // 🔴 폰트 크기 키움 (11px -> 13px)
            fontWeight: "500",
            color: this.isDarkMode ? "white" : "black",
            whiteSpace: "nowrap", // 🔴 텍스트 줄바꿈 방지
            flex: "1",
            minWidth: "0",
            overflow: "hidden",
            textOverflow: "ellipsis",
        });

        // 토글 버튼 생성
        const toggleButton = document.createElement("button");
        this.meshTooltipToggle = toggleButton;
        Object.assign(toggleButton.style, {
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px", // 🔴 padding 줄임 (4px -> 2px)
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "3px",
            transition: "background-color 0.2s",
            flexShrink: "0",
            minWidth: "20px", // 🔴 최소 너비 줄임 (24px -> 20px)
            height: "20px", // 🔴 높이 줄임 (24px -> 20px)
        });

        // 초기 상태 설정 (기본값: 비활성화)
        const isEnabled = this.meshTooltip ? this.meshTooltip.isEnabled : false;
        this.updateMeshTooltipToggleState();

        // 토글 버튼 클릭 이벤트
        toggleButton.addEventListener("click", () => {
            if (this.meshTooltip) {
                // 현재 실제 활성화 상태 확인 (userDisabled 고려)
                const currentState = this.meshTooltip.isEnabled && !this.meshTooltip.userDisabled;
                const newState = !currentState;
                // 사용자 액션임을 명시하여 설정, scene 전달하여 기존 메시들에 tooltip 생성
                const scene = this.liverViewer ? this.liverViewer.scene : null;
                this.meshTooltip.setEnabled(newState, true, scene);
                this.updateMeshTooltipToggleState();
                console.log(`[ObjectListPanel] 메시 이름 표시 ${newState ? '활성화' : '비활성화'}`);
            } else {
                console.warn("[ObjectListPanel] MeshTooltip이 설정되지 않았습니다");
            }
        });

        toggleContainer.appendChild(label);
        toggleContainer.appendChild(toggleButton);
        // 패널의 직접 자식으로 추가 (contentContainer가 아닌)
        this.panel.appendChild(toggleContainer);
        this.meshTooltipToggleContainer = toggleContainer;
    }

    /**
     * 메시 이름 표시 토글 버튼 상태 업데이트
     */
    updateMeshTooltipToggleState() {
        if (!this.meshTooltipToggle) return;

        // userDisabled 상태를 확인하여 실제 활성화 상태 결정
        const isEnabled = this.meshTooltip ? 
            (this.meshTooltip.isEnabled && !this.meshTooltip.userDisabled) : false;
        const iconColor = this.isDarkMode ? "white" : "black";

        // 체크박스 스타일 토글 아이콘
        if (isEnabled) {
            // 체크된 상태
            this.meshTooltipToggle.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${iconColor}">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z"/>
                </svg>
            `;
            this.meshTooltipToggle.style.backgroundColor = this.isDarkMode
                ? "rgba(100, 150, 255, 0.3)" // 🔴 활성화 시 파란색 배경
                : "rgba(100, 150, 255, 0.2)"; // 🔴 활성화 시 파란색 배경
        } else {
            // 체크 해제된 상태
            this.meshTooltipToggle.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${iconColor}">
                    <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                </svg>
            `;
            this.meshTooltipToggle.style.backgroundColor = "transparent";
        }
    }

    /**
     * 드래그 스크롤 기능 설정
     * 마우스 클릭 후 드래그하여 패널을 스크롤할 수 있게 함
     */
    setupDragScroll() {
        if (!this.contentContainer) {
            return;
        }

        let isDragging = false;
        let startY = 0;
        let startScrollTop = 0;

        // 마우스 다운 이벤트
        this.contentContainer.addEventListener("mousedown", (e) => {
            // 버튼이나 링크 등 인터랙티브 요소는 제외
            if (e.target.tagName === "BUTTON" || 
                e.target.tagName === "INPUT" || 
                e.target.closest("button") ||
                e.target.closest("input")) {
                return;
            }

            isDragging = true;
            startY = e.clientY;
            startScrollTop = this.contentContainer.scrollTop;
            
            // 드래그 중 커서 변경
            this.contentContainer.style.cursor = "grabbing";
            this.contentContainer.style.userSelect = "none";
            
            e.preventDefault();
        });

        // 마우스 이동 이벤트
        const handleMouseMove = (e) => {
            if (!isDragging) {
                return;
            }

            const deltaY = e.clientY - startY;
            const newScrollTop = startScrollTop - deltaY;
            
            // 스크롤 범위 체크
            const maxScroll = this.contentContainer.scrollHeight - this.contentContainer.clientHeight;
            const clampedScrollTop = Math.max(0, Math.min(maxScroll, newScrollTop));
            
            this.contentContainer.scrollTop = clampedScrollTop;
            
            e.preventDefault();
        };

        // 마우스 업 이벤트
        const handleMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                this.contentContainer.style.cursor = "";
                this.contentContainer.style.userSelect = "";
            }
        };

        // 전역 이벤트 리스너 (드래그가 패널 밖으로 나가도 계속 추적)
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        // 터치 이벤트 지원 (모바일/리모컨 터치패드)
        let touchStartY = 0;
        let touchStartScrollTop = 0;
        let isTouchDragging = false;

        const handleTouchStart = (e) => {
            if (e.target.tagName === "BUTTON" || 
                e.target.tagName === "INPUT" || 
                e.target.closest("button") ||
                e.target.closest("input")) {
                return;
            }

            if (e.touches.length === 1) {
                isTouchDragging = true;
                touchStartY = e.touches[0].clientY;
                touchStartScrollTop = this.contentContainer.scrollTop;
                e.preventDefault();
            }
        };

        const handleTouchMove = (e) => {
            if (!isTouchDragging || e.touches.length !== 1) {
                return;
            }

            const deltaY = e.touches[0].clientY - touchStartY;
            const newScrollTop = touchStartScrollTop - deltaY;
            
            // 스크롤 범위 체크
            const maxScroll = this.contentContainer.scrollHeight - this.contentContainer.clientHeight;
            const clampedScrollTop = Math.max(0, Math.min(maxScroll, newScrollTop));
            
            this.contentContainer.scrollTop = clampedScrollTop;
            e.preventDefault();
        };

        const handleTouchEnd = () => {
            isTouchDragging = false;
        };

        this.contentContainer.addEventListener("touchstart", handleTouchStart, { passive: false });
        this.contentContainer.addEventListener("touchmove", handleTouchMove, { passive: false });
        this.contentContainer.addEventListener("touchend", handleTouchEnd);

        // 리모컨 방향키로 스크롤 기능 추가
        const handleKeyDown = (e) => {
            // 패널이 열려있지 않으면 무시
            if (!this.isOpen) {
                return;
            }

            // 입력 필드에 포커스가 있으면 무시
            const target = e.target;
            if (target.tagName === "INPUT" || 
                target.tagName === "TEXTAREA" || 
                target.isContentEditable ||
                target.closest("input") ||
                target.closest("textarea")) {
                return;
            }

            const key = e.key || e.code || "";
            const keyCode = e.keyCode;
            let scrollAmount = 0;
            let isScrollKey = false;

            // 상하 방향키 감지
            if (key === "ArrowUp" || keyCode === 38 || 
                key.toUpperCase() === "UP" || 
                key.toUpperCase() === "VK_UP" ||
                key.toUpperCase() === "NAV_UP") {
                scrollAmount = -80; // 위로 스크롤
                isScrollKey = true;
            } else if (key === "ArrowDown" || keyCode === 40 || 
                       key.toUpperCase() === "DOWN" || 
                       key.toUpperCase() === "VK_DOWN" ||
                       key.toUpperCase() === "NAV_DOWN") {
                scrollAmount = 80; // 아래로 스크롤
                isScrollKey = true;
            } else {
                return; // 다른 키는 무시
            }

            if (!isScrollKey) {
                return;
            }

            // 스크롤 실행
            const currentScroll = this.contentContainer.scrollTop;
            const newScrollTop = currentScroll + scrollAmount;
            const maxScroll = this.contentContainer.scrollHeight - this.contentContainer.clientHeight;
            const clampedScrollTop = Math.max(0, Math.min(maxScroll, newScrollTop));
            
            // 개발 모드에서 디버깅 로그 (선택적)
            if (process.env.NODE_ENV === "development") {
                console.log("[ObjectListPanel] 방향키 스크롤:", {
                    key,
                    keyCode,
                    currentScroll,
                    newScrollTop,
                    clampedScrollTop,
                    maxScroll,
                    scrollHeight: this.contentContainer.scrollHeight,
                    clientHeight: this.contentContainer.clientHeight
                });
            }
            
            this.contentContainer.scrollTop = clampedScrollTop;
            
            e.preventDefault();
        };

        document.addEventListener("keydown", handleKeyDown, { passive: false });

        // 이벤트 핸들러 참조 저장 (나중에 정리하기 위해)
        this.dragScrollHandlers = {
            mouseMove: handleMouseMove,
            mouseUp: handleMouseUp,
            touchStart: handleTouchStart,
            touchMove: handleTouchMove,
            touchEnd: handleTouchEnd,
            keyDown: handleKeyDown,
            container: this.contentContainer
        };
    }
}

