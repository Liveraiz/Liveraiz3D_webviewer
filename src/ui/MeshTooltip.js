import * as THREE from "three";
// CSS2DObject는 더 이상 사용하지 않음 (화면 상단 고정 위치로 변경)

class MeshTooltip {
    constructor() {
        console.log("[MeshTooltip] 초기화 시작");
        this.tooltips = new Map(); // 각 메쉬별 툴팁 저장 (참조용)
        this.activeTooltip = null; // 현재 활성화된 툴팁
        this.camera = null;
        this.isMobile = false;
            this.isEnabled = false; // 활성화 상태 관리 (기본값: 비활성화)
            this.userDisabled = true; // 사용자가 명시적으로 비활성화한 상태 (디폴트: 비활성화)
        
        // Tooltip 표시 지연 시간 (깜빡임 방지)
        this.showDelay = 200; // 200ms 지연
        this.hideDelay = 100; // 100ms 지연
        this.showTimeout = null;
        this.hideTimeout = null;
        this.pendingMesh = null; // 표시 대기 중인 메시
        
        // 화면 상단 중간에 고정된 tooltip DOM 요소 생성
        this.tooltipElement = this.createFixedTooltip();
        document.body.appendChild(this.tooltipElement);
        
        console.log("[MeshTooltip] 초기화 완료, 활성화 상태:", this.isEnabled);
    }
    
    // 화면 상단 중간에 고정된 tooltip 요소 생성
    createFixedTooltip() {
        const tooltipDiv = document.createElement("div");
        tooltipDiv.className = "mesh-tooltip-fixed";
        
        const isDarkMode = document.body.style.backgroundColor?.includes('26, 26, 26') || 
                          document.body.classList.contains('dark-mode') ||
                          getComputedStyle(document.body).backgroundColor.includes('26, 26, 26');
        
        Object.assign(tooltipDiv.style, {
            position: "fixed",
            top: "80px", // TopBar 아래
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: isDarkMode 
                ? "rgba(0, 0, 0, 0.85)" 
                : "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px) saturate(180%)",
            WebkitBackdropFilter: "blur(10px) saturate(180%)",
            color: isDarkMode ? "#ffffff" : "#000000",
            padding: "10px 18px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: "500",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: "1000",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            transition: "opacity 0.2s ease, transform 0.2s ease",
            opacity: "0",
            transform: "translateX(-50%) translateY(-10px) scale(0.95)",
            letterSpacing: "0.3px",
            display: "none",
        });
        
        return tooltipDiv;
    }

    setCamera(camera) {
        if (!camera) {
            console.error("Invalid camera provided to MeshTooltip");
            return;
        }
        this.camera = camera;
    }

    getMeshColor(mesh) {
        if (!mesh.material) return "#ffffff";

        let color;
        if (
            mesh.material.type === "MeshStandardMaterial" ||
            mesh.material.type === "MeshPhongMaterial"
        ) {
            // 기본 색상
            color = mesh.material.color;

            // emissive 색상이 있다면 고려
            if (mesh.material.emissive && mesh.material.emissiveIntensity > 0) {
                const emissiveColor = mesh.material.emissive;
                color = new THREE.Color(
                    color.r + emissiveColor.r * mesh.material.emissiveIntensity,
                    color.g + emissiveColor.g * mesh.material.emissiveIntensity,
                    color.b + emissiveColor.b * mesh.material.emissiveIntensity
                );
            }

            // metalness와 roughness를 고려하여 색상 조정
            if (mesh.material.metalness !== undefined) {
                const metalFactor = 1 - mesh.material.metalness * 0.5;
                color.multiplyScalar(metalFactor);
            }
        } else {
            color = mesh.material.color;
        }

        // THREE.Color를 CSS 색상 문자열로 변환
        const r = Math.floor(color.r * 255);
        const g = Math.floor(color.g * 255);
        const b = Math.floor(color.b * 255);

        return `rgb(${r}, ${g}, ${b})`;
    }

    createTooltip(mesh) {
        // 더 이상 CSS2DObject를 사용하지 않으므로 메시 정보만 저장
        // 실제 tooltip은 고정된 DOM 요소를 사용
        return {
            mesh: mesh,
            name: mesh.name
        };
    }

    // 배경색에 따라 텍스트 색상을 자동으로 조정하는 함수
    getContrastColor(bgColor) {
        // RGB 문자열을 파싱
        const rgb = bgColor.match(/\d+/g);
        if (!rgb) return "#000000";

        // 밝기 계산 (YIQ 공식)
        const brightness =
            (parseInt(rgb[0]) * 299 +
                parseInt(rgb[1]) * 587 +
                parseInt(rgb[2]) * 114) /
            1000;

        // 밝기에 따라 검은색 또는 흰색 반환
        return brightness > 128 ? "#000000" : "#ffffff";
    }

    hideAllTooltips() {
        // timeout 취소
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
            this.showTimeout = null;
        }
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        
        // 고정된 tooltip 요소 숨김
        if (this.tooltipElement) {
            this.tooltipElement.style.opacity = "0";
            this.tooltipElement.style.transform = "translateX(-50%) translateY(-10px) scale(0.95)";
            setTimeout(() => {
                if (this.tooltipElement) {
                    this.tooltipElement.style.display = "none";
                }
            }, 200);
        }
        
        this.activeTooltip = null;
        this.pendingMesh = null;
    }

    // 활성화/비활성화 설정 메서드
    setEnabled(enabled, isUserAction = false, scene = null) {
        // 사용자가 명시적으로 비활성화한 경우 userDisabled 플래그 설정
        if (isUserAction) {
            this.userDisabled = !enabled;
        }
        
        // 사용자가 비활성화한 상태이고 자동 활성화 요청인 경우 무시
        if (this.userDisabled && enabled && !isUserAction) {
            return;
        }
        
        const wasEnabled = this.isEnabled;
        // console.log(`[MeshTooltip] 활성화 상태 변경: ${enabled}, 사용자 액션: ${isUserAction}`);
        this.isEnabled = enabled && !this.userDisabled;
        
        if (!this.isEnabled) {
            // console.log('[MeshTooltip] 모든 툴팁 숨김 처리');
            this.hideAllTooltips();
        } else if (!wasEnabled && this.isEnabled && scene) {
            // 활성화될 때 기존 메시들에 대해 tooltip 생성
            console.log('[MeshTooltip] 활성화됨 - 기존 메시들에 tooltip 생성 시작');
            this.createTooltipsForExistingMeshes(scene);
        }
    }
    
    // 기존 메시들에 대해 tooltip 생성하는 메서드 추가
    createTooltipsForExistingMeshes(scene) {
        if (!scene || !this.camera || this.isMobile) {
            return;
        }
        
        // 씬의 모든 메시를 순회하며 tooltip 생성
        scene.traverse((object) => {
            if (object instanceof THREE.Mesh && object.name && object.name.trim() !== '') {
                // 이미 tooltip이 있는지 확인
                if (this.tooltips.has(object.name)) {
                    return;
                }
                
                // opacity가 0.01 이하인 메시는 제외
                if (object.material && object.material.opacity !== undefined && object.material.opacity <= 0.01) {
                    return;
                }
                
                // tooltip 생성
                this.setupHoverEvents(object, scene);
            }
        });
        
        console.log(`[MeshTooltip] 기존 메시 tooltip 생성 완료, 총 ${this.tooltips.size}개`);
    }

    setupHoverEvents(mesh, scene) {
        console.log(
            `[MeshTooltip] setupHoverEvents 호출됨 - mesh: ${mesh.name}`
        );
        
        // 이미 tooltip이 있으면 중복 생성 방지
        if (this.tooltips.has(mesh.name)) {
            console.log(`[MeshTooltip] 이미 tooltip이 존재함 - mesh: ${mesh.name}`);
            return;
        }
        
        if (!this.camera) {
            console.error("[MeshTooltip] Camera not set in MeshTooltip");
            return;
        }

        // opacity가 0.01 이하인 메시는 툴팁을 생성하지 않음
        if (mesh.material && mesh.material.opacity !== undefined && mesh.material.opacity <= 0.01) {
            console.log(`[MeshTooltip] opacity 0.01 이하인 메시 ${mesh.name}는 툴팁 생성 건너뜀`);
            return;
        }

        // 메시 정보만 저장 (더 이상 3D 객체로 추가하지 않음)
        if (!this.isMobile && this.camera) {
            const tooltip = this.createTooltip(mesh);
            console.log(`[MeshTooltip] 툴팁 정보 저장됨 - mesh: ${mesh.name}`);
            this.tooltips.set(mesh.name, tooltip);
            console.log(
                `[MeshTooltip] 툴팁 추가됨 - mesh: ${mesh.name}, tooltips size: ${this.tooltips.size}`
            );
        }
    }

    // 새로운 메서드: 마우스 위치 업데이트 및 툴팁 표시 처리
    updateMousePosition(x, y) {
        if (!this.isEnabled) {
            this.hideTooltip();
            return;
        }
        if (!this.camera) {
            return;
        }

        const mouse = new THREE.Vector2(x, y);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        // 마우스 위치 저장 (tooltip 위치 계산용)
        this.currentMouse = { x, y };

        // 모든 메시들을 배열로 수집 (보이고 투명도가 0보다 큰 메시만 포함)
        const visibleMeshes = Array.from(this.tooltips.values())
            .map((tooltipInfo) => tooltipInfo.mesh)
            .filter((mesh) => {
                // 메시가 존재하고 보이는지 확인
                if (!mesh || !mesh.visible) return false;

                // 메시의 material이 있고 투명도가 0보다 큰지 확인 (더 엄격한 체크)
                if (mesh.material && mesh.material.opacity !== undefined) {
                    // opacity가 0.01 이하인 경우는 완전히 투명한 것으로 간주
                    return mesh.material.opacity > 0.01;
                }

                return true; // material이 없거나 opacity가 정의되지 않은 경우 포함
            });

        // 가시적인 메시가 없으면 툴팁 숨김
        if (visibleMeshes.length === 0) {
            this.hideTooltip();
            return;
        }

        // 광선 교차 검사
        const intersects = raycaster
            .intersectObjects(visibleMeshes)
            .filter((intersect) => {
                const mesh = intersect.object;
                const material = mesh.material;

                // 메시의 알파값 확인 (더 엄격한 안전 검사)
                if (!material || material.opacity <= 0.01) return false;

                // 알파값이 0.05 이상인 경우에만 처리 (더 엄격한 기준)
                if (material.opacity >= 0.05) {
                    // 앞에 있는 다른 객체들 확인
                    const allIntersects =
                        raycaster.intersectObjects(visibleMeshes);
                    const earlierIntersects = allIntersects.filter(
                        (int) =>
                            int.distance < intersect.distance &&
                            int.object.material.opacity >= 0.05
                    );

                    // 앞에 불투명한(alpha >= 0.05) 메시가 없는 경우에만 true 반환
                    return earlierIntersects.length === 0;
                }

                return false; // 알파값이 0.05 미만인 경우는 무시
            });

        // 필터링된 교차점 중 가장 앞쪽의 것만 처리
        if (intersects.length > 0) {
            const closestIntersect = intersects[0];
            const mesh = closestIntersect.object;
            const tooltipInfo = this.tooltips.get(mesh.name);

            if (tooltipInfo && tooltipInfo.mesh !== this.pendingMesh) {
                // 새로운 메시에 대한 tooltip 표시 (지연 적용)
                this.showTooltip(mesh);
            }
        } else {
            // 교차점이 없으면 툴팁 숨김
            this.hideTooltip();
        }
    }
    
    // Tooltip 표시 (지연 적용) - 화면 상단 중간에 고정 표시
    showTooltip(mesh) {
        // 기존 timeout 취소
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
        }
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        
        this.pendingMesh = mesh;
        
        this.showTimeout = setTimeout(() => {
            // 고정된 tooltip 요소에 메시 이름 표시
            if (this.tooltipElement && mesh) {
                const meshColor = this.getMeshColor(mesh);
                this.tooltipElement.textContent = mesh.name;
                
                // 메시 색상으로 테두리 설정
                this.tooltipElement.style.border = `2px solid ${meshColor}`;
                this.tooltipElement.style.boxShadow = `0 4px 12px rgba(0, 0, 0, 0.3), 0 0 8px ${meshColor}40, inset 0 1px 0 rgba(255, 255, 255, 0.1)`;
                
                // 표시 및 애니메이션
                this.tooltipElement.style.display = "block";
                requestAnimationFrame(() => {
                    this.tooltipElement.style.opacity = "1";
                    this.tooltipElement.style.transform = "translateX(-50%) translateY(0) scale(1)";
                });
                
                this.activeTooltip = { mesh: mesh, name: mesh.name };
            }
            
            this.pendingMesh = null;
        }, this.showDelay);
    }
    
    // Tooltip 숨김 (지연 적용)
    hideTooltip() {
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
            this.showTimeout = null;
        }
        
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        
        this.hideTimeout = setTimeout(() => {
            if (this.tooltipElement) {
                // 페이드 아웃 애니메이션
                this.tooltipElement.style.opacity = "0";
                this.tooltipElement.style.transform = "translateX(-50%) translateY(-10px) scale(0.95)";
                
                setTimeout(() => {
                    if (this.tooltipElement) {
                        this.tooltipElement.style.display = "none";
                    }
                    this.activeTooltip = null;
                }, 200);
            }
            
            this.pendingMesh = null;
        }, this.hideDelay);
    }

    updateTheme(isDarkMode) {
        // 고정된 tooltip 요소의 테마 업데이트
        if (this.tooltipElement) {
            const currentMeshColor = this.activeTooltip?.mesh 
                ? this.getMeshColor(this.activeTooltip.mesh) 
                : "#ffffff";
            
            Object.assign(this.tooltipElement.style, {
                backgroundColor: isDarkMode
                    ? "rgba(0, 0, 0, 0.85)"
                    : "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(10px) saturate(180%)",
                WebkitBackdropFilter: "blur(10px) saturate(180%)",
                color: isDarkMode ? "#ffffff" : "#000000",
                border: `2px solid ${currentMeshColor}`,
                boxShadow: `0 4px 12px rgba(0, 0, 0, 0.3), 0 0 8px ${currentMeshColor}40, inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
            });
        }
    }

    // 메모리 정리를 위한 메서드 추가
    dispose() {
        console.log("이전 툴팁들 정리");
        
        // timeout 취소
        if (this.showTimeout) {
            clearTimeout(this.showTimeout);
            this.showTimeout = null;
        }
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        
        // 고정된 tooltip 요소 제거
        if (this.tooltipElement && this.tooltipElement.parentNode) {
            this.tooltipElement.parentNode.removeChild(this.tooltipElement);
            this.tooltipElement = null;
        }
        
        this.tooltips.clear();
        this.activeTooltip = null;
        this.pendingMesh = null;
    }

    setupTouchEvents(mesh, scene) {
        console.log(
            `setupTouchEvents 호출됨 - mesh: ${mesh.name}, isMobile: ${this.isMobile}`
        );

        if (this.isMobile && this.camera) {
            const raycaster = new THREE.Raycaster();
            let touchStartTime = 0;
            let touchStartPosition = new THREE.Vector2();

            window.addEventListener("touchstart", (event) => {
                console.log("터치 시작 감지");
                touchStartTime = Date.now();
                touchStartPosition.x = event.touches[0].clientX;
                touchStartPosition.y = event.touches[0].clientY;
            });

            window.addEventListener("touchend", (event) => {
                const touchEndTime = Date.now();
                const touchEndPosition = new THREE.Vector2(
                    event.changedTouches[0].clientX,
                    event.changedTouches[0].clientY
                );

                if (
                    touchEndTime - touchStartTime < 200 &&
                    touchEndPosition.distanceTo(touchStartPosition) < 10
                ) {
                    console.log("유효한 탭 동작 감지");
                    const touch = event.changedTouches[0];
                    const x = (touch.clientX / window.innerWidth) * 2 - 1;
                    const y = -(touch.clientY / window.innerHeight) * 2 + 1;

                    raycaster.setFromCamera(
                        new THREE.Vector2(x, y),
                        this.camera
                    );
                    const intersects = raycaster.intersectObject(mesh);

                    if (intersects.length > 0) {
                        console.log(`메쉬 터치 감지: ${mesh.name}`);
                        this.tooltipDiv.textContent = mesh.name;
                        this.tooltipLabel.position.copy(intersects[0].point);
                        this.tooltipLabel.visible = true;
                        this.tooltipLabel.quaternion.copy(
                            this.camera.quaternion
                        );

                        setTimeout(() => {
                            console.log(`툴팁 자동 숨김: ${mesh.name}`);
                            this.tooltipLabel.visible = false;
                        }, 3000);
                    }
                }
            });

            if (!scene.getObjectById(this.tooltipLabel.id)) {
                console.log(`툴팁 라벨을 씬에 추가: ${mesh.name}`);
                scene.add(this.tooltipLabel);
            }
        } else {
            console.log(
                `터치 이벤트 설정 건너뜀 - isMobile: ${
                    this.isMobile
                }, camera exists: ${!!this.camera}`
            );
        }
    }

    // 메시의 표시 상태 업데이트 메서드
    updateMeshVisibility(meshName, isVisible, opacity) {
        const tooltipInfo = this.tooltips.get(meshName);
        if (tooltipInfo) {
            // 메시가 숨겨지거나 투명도가 0.01 이하인 경우 해당 툴팁 비활성화
            if (!isVisible || (opacity !== undefined && opacity <= 0.01)) {
                if (this.activeTooltip && this.activeTooltip.name === meshName) {
                    this.hideTooltip();
                }
            }
        }
    }

    // 메시의 opacity 변경 시 툴팁 상태 업데이트
    updateMeshOpacity(meshName, opacity) {
        const tooltipInfo = this.tooltips.get(meshName);
        if (tooltipInfo) {
            // opacity가 0.01 이하인 경우 툴팁 비활성화
            if (opacity <= 0.01) {
                if (this.activeTooltip && this.activeTooltip.name === meshName) {
                    this.hideTooltip();
                }
            }
        }
    }
}

export default MeshTooltip;
