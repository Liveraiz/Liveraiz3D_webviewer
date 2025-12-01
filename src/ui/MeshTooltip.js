import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";

class MeshTooltip {
    constructor() {
        console.log("[MeshTooltip] 초기화 시작");
        this.tooltips = new Map(); // 각 메쉬별 툴팁 저장
        this.activeTooltip = null; // 현재 활성화된 툴팁
        this.camera = null;
        this.isMobile = false;
        this.isEnabled = true; // 활성화 상태 관리
        this.userDisabled = false; // 사용자가 명시적으로 비활성화한 상태
        console.log("[MeshTooltip] 초기화 완료, 활성화 상태:", this.isEnabled);
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
        const tooltipDiv = document.createElement("div");
        tooltipDiv.className = "mesh-tooltip";

        const meshColor = this.getMeshColor(mesh);

        // 테두리와 그림자로 메쉬 색상 표현
        Object.assign(tooltipDiv.style, {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            color: "#ffffff",
            padding: "5px 10px",
            borderRadius: "4px",
            fontSize: "14px",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: "1000",
            border: `4px solid ${meshColor}`,
            boxShadow: `0 0 4px ${meshColor}`,
            transition: "all 0.3s ease", // 부드러운 효과 추가
        });

        tooltipDiv.textContent = mesh.name;
        const tooltipLabel = new CSS2DObject(tooltipDiv);
        tooltipLabel.visible = false;

        return tooltipLabel;
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
        this.tooltips.forEach((tooltip) => {
            tooltip.visible = false;
        });
        this.activeTooltip = null;
    }

    // 활성화/비활성화 설정 메서드
    setEnabled(enabled, isUserAction = false) {
        // 사용자가 명시적으로 비활성화한 경우 userDisabled 플래그 설정
        if (isUserAction) {
            this.userDisabled = !enabled;
        }
        
        // 사용자가 비활성화한 상태이고 자동 활성화 요청인 경우 무시
        if (this.userDisabled && enabled && !isUserAction) {
            return;
        }
        
        // console.log(`[MeshTooltip] 활성화 상태 변경: ${enabled}, 사용자 액션: ${isUserAction}`);
        this.isEnabled = enabled && !this.userDisabled;
        if (!this.isEnabled) {
            // console.log('[MeshTooltip] 모든 툴팁 숨김 처리');
            this.hideAllTooltips();
        }
    }

    setupHoverEvents(mesh, scene) {
        console.log(
            `[MeshTooltip] setupHoverEvents 호출됨 - mesh: ${mesh.name}`
        );
        if (!this.camera) {
            console.error("[MeshTooltip] Camera not set in MeshTooltip");
            return;
        }

        // opacity가 0.01 이하인 메시는 툴팁을 생성하지 않음
        if (mesh.material && mesh.material.opacity !== undefined && mesh.material.opacity <= 0.01) {
            console.log(`[MeshTooltip] opacity 0.01 이하인 메시 ${mesh.name}는 툴팁 생성 건너뜀`);
            return;
        }

        if (!this.isMobile && this.camera) {
            const tooltip = this.createTooltip(mesh);
            console.log(`[MeshTooltip] 툴팁 생성됨 - mesh: ${mesh.name}`);
            this.tooltips.set(mesh.name, tooltip);

            const center = new THREE.Vector3();
            mesh.geometry.computeBoundingBox();
            mesh.geometry.boundingBox.getCenter(center);

            tooltip.position.copy(center);
            mesh.add(tooltip);
            console.log(
                `[MeshTooltip] 툴팁 추가됨 - mesh: ${mesh.name}, tooltips size: ${this.tooltips.size}`
            );
        }
    }

    // 새로운 메서드: 마우스 위치 업데이트 및 툴팁 표시 처리
    updateMousePosition(x, y) {
        if (!this.isEnabled) {
            return;
        }
        if (!this.camera) {
            return;
        }

        const mouse = new THREE.Vector2(x, y);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        // 모든 메시들을 배열로 수집 (보이고 투명도가 0보다 큰 메시만 포함)
        const visibleMeshes = Array.from(this.tooltips.values())
            .map((tooltip) => tooltip.parent)
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

        // 모든 툴팁을 우선 숨김
        this.tooltips.forEach((tooltip) => {
            tooltip.visible = false;
            if (this.activeTooltip === tooltip) {
                this.activeTooltip = null;
            }
        });

        // 가시적인 메시가 없으면 더 이상 진행하지 않음
        if (visibleMeshes.length === 0) return;

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
            const tooltip = this.tooltips.get(mesh.name);

            if (tooltip) {
                tooltip.visible = true;
                this.activeTooltip = tooltip;
            }
        }
    }

    updateTheme(isDarkMode) {
        this.tooltips.forEach((tooltip) => {
            const div = tooltip.element;
            Object.assign(div.style, {
                backgroundColor: isDarkMode
                    ? "rgba(255, 255, 255, 0.8)"
                    : "rgba(0, 0, 0, 0.8)",
                color: isDarkMode ? "#000000" : "#ffffff",
            });
        });
    }

    // 메모리 정리를 위한 메서드 추가
    dispose() {
        console.log("이전 툴팁들 정리");
        this.tooltips.forEach((tooltip, meshName) => {
            if (tooltip.parent) {
                tooltip.parent.remove(tooltip);
                console.log(`툴팁 제거: ${meshName}`);
            }
            // DOM 요소도 제거
            if (tooltip.element && tooltip.element.parentNode) {
                tooltip.element.parentNode.removeChild(tooltip.element);
            }
        });
        this.tooltips.clear();
        this.activeTooltip = null;
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
        const tooltip = this.tooltips.get(meshName);
        if (tooltip) {
            // 메시가 숨겨지거나 투명도가 0.01 이하인 경우 해당 툴팁 비활성화
            if (!isVisible || (opacity !== undefined && opacity <= 0.01)) {
                if (this.activeTooltip === tooltip) {
                    tooltip.visible = false;
                    this.activeTooltip = null;
                }
            }
        }
    }

    // 메시의 opacity 변경 시 툴팁 상태 업데이트
    updateMeshOpacity(meshName, opacity) {
        const tooltip = this.tooltips.get(meshName);
        if (tooltip) {
            // opacity가 0.01 이하인 경우 툴팁 비활성화
            if (opacity <= 0.01) {
                if (this.activeTooltip === tooltip) {
                    tooltip.visible = false;
                    this.activeTooltip = null;
                }
            }
        }
    }
}

export default MeshTooltip;
