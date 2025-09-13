import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

export default class MeasurementTool {
    constructor(
        scene,
        camera,
        renderer,
        {
            onMeasurementComplete = null,
            objectListPanel = null,
            orbitControls = null,
        } = {},
        isMobile = false
    ) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.onMeasurementComplete = onMeasurementComplete;
        this.objectListPanel = objectListPanel;
        this.isMobile = isMobile;

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.measurementMode = false;
        this.mode = null;
        this.measurements = [];
        this.isTouch = false;
        
        // markerSize를 동적으로 계산
        this.updateMarkerSize();
        
        // Scene 구조 디버깅 (개발 중에만 사용)
        if (process.env.NODE_ENV === 'development') {
            this.debugSceneStructure();
        }

        // 모바일 환경일 때만 확인 버튼 초기화
        if (isMobile) {
            this.setupConfirmButton();
        }

        this.mouseTracker = this.createMouseTracker();
        this.scene.add(this.mouseTracker);

        this.resetMeasurementState();

        this.orbitControls = orbitControls;
        this.isMouseDown = false;
        this.isDragging = false;
        this.mouseDownStartTime = 0;
        this.lastMousePosition = new THREE.Vector2();

        // Indication line 관련 속성 추가
        this.indicationLine = null;
        this.indicationLineMaterial = new THREE.LineBasicMaterial({
            color: 0xFF8C00, // 기본값 (길이 측정용)
            transparent: true,
            opacity: 0.7,
            depthTest: false,
            linewidth: 4
        });

        // 측정 모드별 색상 정의
        this.measurementColors = {
            distance: {
                line: 0xFF6B35,      // 네온 주황색
                marker: 0xFF6B35,    // 네온 주황색
                opacity: 0.7
            },
            angle: {
                line: 0x00FFFF,      // 네온 파랑색
                marker: 0x00FFFF,    // 네온 파랑색
                opacity: 0.7
            }
        };

        // 이벤트 핸들러 바인딩
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);

        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
    }

    setupConfirmButton() {
        this.confirmButtonContainer = document.createElement("div");
        Object.assign(this.confirmButtonContainer.style, {
            position: "fixed",
            bottom: "100px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: "1000",
            display: "none",
            backgroundColor: "transparent", // 컨테이너 배경 제거
            padding: "0", // 패딩 제거
        });

        const confirmButton = this.createConfirmButton();
        this.confirmButtonContainer.appendChild(confirmButton);
        document.body.appendChild(this.confirmButtonContainer);
    }

    createConfirmButton() {
        const confirmButton = document.createElement("button");
        Object.assign(confirmButton.style, {
            width: "40px", // 크기 축소
            height: "40px", // 정사각형 형태
            padding: "8px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "50%", // 원형 버튼
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "transform 0.2s, background-color 0.2s", // 부드러운 효과
        });

        // 체크 아이콘만 사용 (텍스트 제거)
        confirmButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;

        // 호버 및 클릭 효과 추가
        confirmButton.addEventListener("mouseenter", () => {
            confirmButton.style.backgroundColor = "#45a049";
            confirmButton.style.transform = "scale(1.05)";
        });

        confirmButton.addEventListener("mouseleave", () => {
            confirmButton.style.backgroundColor = "#4CAF50";
            confirmButton.style.transform = "scale(1)";
        });

        confirmButton.addEventListener("mousedown", () => {
            confirmButton.style.transform = "scale(0.95)";
        });

        confirmButton.addEventListener("mouseup", () => {
            confirmButton.style.transform = "scale(1.05)";
        });

        confirmButton.addEventListener("click", () =>
            this.handleConfirmButtonClick()
        );

        return confirmButton;
    }

    handleConfirmButtonClick() {
        if (this.mouseTracker && this.mouseTracker.visible) {
            this.handleMeasurementPoint(this.mouseTracker.position.clone());
            this.confirmButtonContainer.style.display = "none";
        }
    }

    dispose() {
        // mouseTracker 제거 및 정리
        if (this.mouseTracker) {
            this.scene.remove(this.mouseTracker);
            if (this.mouseTracker.geometry) {
                this.mouseTracker.geometry.dispose();
            }
            if (this.mouseTracker.material) {
                this.mouseTracker.material.dispose();
            }
        }

        // Indication line 정리
        this.removeIndicationLine();
        if (this.indicationLineMaterial) {
            this.indicationLineMaterial.dispose();
        }

        // 이벤트 리스너 제거
        this.renderer.domElement.removeEventListener(
            "pointermove",
            this.onPointerMove
        );
        this.renderer.domElement.removeEventListener(
            "click",
            this.onPointerDown
        );
    }

    createMouseTracker() {
        const geometry = new THREE.SphereGeometry(0.4, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.7,
        });
        const sphere = new THREE.Mesh(geometry, material);

        const spriteMaterial = new THREE.SpriteMaterial({
            map: this.createGlowTexture(),
            color: 0xffff00,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
        });
        const glowSprite = new THREE.Sprite(spriteMaterial);
        glowSprite.scale.set(1.5, 1.5, 1);

        const trackerGroup = new THREE.Group();
        trackerGroup.add(sphere);
        trackerGroup.add(glowSprite);
        trackerGroup.visible = false;
        trackerGroup.name = "Tracker";

        return trackerGroup;
    }

    createGlowTexture() {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;

        const context = canvas.getContext("2d");
        if (!context) {
            console.error("Failed to get canvas context");
            return new THREE.Texture();
        }

        const gradient = context.createRadialGradient(
            size / 2,
            size / 2,
            0,
            size / 2,
            size / 2,
            size / 2
        );
        gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
        gradient.addColorStop(0.2, "rgba(255, 255, 0, 0.8)");
        gradient.addColorStop(1, "rgba(255, 255, 0, 0)");

        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    enableMeasurementMode(mode) {
        if (this.measurementMode) {
            this.disableMeasurementMode();
        }

        if (mode !== "distance" && mode !== "angle") {
            console.error("Invalid measurement mode");
            return;
        }

        // 기존 mouseTracker가 있다면 제거
        if (this.mouseTracker && this.mouseTracker.parent) {
            this.scene.remove(this.mouseTracker);
        }

        // 새로운 mouseTracker 생성 및 추가
        this.mouseTracker = this.createMouseTracker();
        this.scene.add(this.mouseTracker);
        this.mouseTracker.visible = false;

        this.measurementMode = true;
        this.mode = mode;
        this.resetMeasurementState();

        // 모바일과 데스크톱 이벤트 분리하여 처리
        if (this.isMobile) {
            this.renderer.domElement.addEventListener(
                "touchstart",
                this.onTouchStart,
                { passive: false }
            );
            this.renderer.domElement.addEventListener(
                "touchmove",
                this.onTouchMove,
                { passive: false }
            );
        } else {
            window.addEventListener("mousedown", this.onMouseDown, true);
            window.addEventListener("mouseup", this.onMouseUp, true);
            window.addEventListener("mousemove", this.onMouseMove, true);
            this.renderer.domElement.addEventListener(
                "pointermove",
                this.onPointerMove
            );
            this.renderer.domElement.addEventListener(
                "click",
                this.onPointerDown
            );
        }
    }

    disableMeasurementMode() {
        if (!this.measurementMode) return;

        this.measurementMode = false;
        this.mode = null;
        if (this.mouseTracker) {
            this.mouseTracker.visible = false;
        }

        // Indication line 제거
        this.removeIndicationLine();

        // 모든 이벤트 리스너 제거
        this.renderer.domElement.removeEventListener(
            "touchstart",
            this.onTouchStart
        );
        this.renderer.domElement.removeEventListener(
            "touchmove",
            this.onTouchMove
        );
        window.removeEventListener("mousedown", this.onMouseDown, true);
        window.removeEventListener("mouseup", this.onMouseUp, true);
        window.removeEventListener("mousemove", this.onMouseMove, true);
        this.renderer.domElement.removeEventListener(
            "pointermove",
            this.onPointerMove
        );
        this.renderer.domElement.removeEventListener(
            "click",
            this.onPointerDown
        );

        this.isMouseDown = false;
        this.isDragging = false;

        this.resetMeasurementState();
    }

    handlePointerEvent(event, isClick = false) {
        // 터치 이벤트와 마우스 이벤트 통합 처리
        const clientX = event.touches
            ? event.touches[0].clientX
            : event.clientX;
        const clientY = event.touches
            ? event.touches[0].clientY
            : event.clientY;

        const rect = this.renderer.domElement.getBoundingClientRect();

        // 화면 좌표를 정규화된 장치 좌표로 변환 (-1 to 1)
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((clientY - rect.top) / rect.height) * 2 + 1;

        this.pointer.set(x, y);
        this.raycaster.setFromCamera(this.pointer, this.camera);

        const meshes = this.getMeasurableMeshes();
        const intersects = this.raycaster.intersectObjects(meshes, true);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.mouseTracker.position.copy(point);
            this.mouseTracker.visible = true;

            if (isClick) {
                this.handleMeasurementPoint(point);
            }
        } else {
            this.mouseTracker.visible = false;
        }
    }

    resetMeasurementState() {
        this.points = [];
        this.markers = [];
        this.lines = [];
        this.label = null;
        
        // Indication line도 초기화
        this.removeIndicationLine();
    }

    clearAllMeasurements() {
        if (
            !Array.isArray(this.measurements) ||
            this.measurements.length === 0
        ) {
            console.warn("No measurements to clear.");
            return;
        }

        this.measurements.forEach((measurement) => {
            // Markers 제거
            if (Array.isArray(measurement.markers)) {
                measurement.markers.forEach((marker) => {
                    if (marker && marker.parent) {
                        marker.parent.remove(marker);
                        if (marker.geometry) marker.geometry.dispose();
                        if (marker.material) {
                            if (Array.isArray(marker.material)) {
                                marker.material.forEach((mat) => mat.dispose());
                            } else {
                                marker.material.dispose();
                            }
                        }
                    }
                });
            }

            // Lines 제거
            if (Array.isArray(measurement.lines)) {
                measurement.lines.forEach((line) => {
                    if (line && line.parent) {
                        line.parent.remove(line);
                        if (line.geometry) line.geometry.dispose();
                        if (line.material) {
                            if (Array.isArray(line.material)) {
                                line.material.forEach((mat) => mat.dispose());
                            } else {
                                line.material.dispose();
                            }
                        }
                    }
                });
            }

            // Label 제거
            if (measurement.label && measurement.label.parent) {
                measurement.label.parent.remove(measurement.label);
            }
        });

        // measurements 초기화
        this.measurements = [];
        this.resetMeasurementState();
    }

    onTouchMove(event) {
        if (
            !this.measurementMode ||
            !event.touches ||
            event.touches.length === 0
        ) {
            if (this.mouseTracker) {
                this.mouseTracker.visible = false;
            }
            this.removeIndicationLine();
            return;
        }

        event.preventDefault(); // 스크롤 방지
        this.handlePointerEvent(event);
        
        // Indication line 업데이트를 위해 현재 마우스 트래커 위치 사용
        if (this.mouseTracker && this.mouseTracker.visible) {
            this.updateIndicationLine(this.mouseTracker.position);
        }
    }

    onTouchStart(event) {
        if (
            !this.measurementMode ||
            !event.touches ||
            event.touches.length === 0
        )
            return;

        event.preventDefault();
        const touch = event.touches[0];
        const rect = this.renderer.domElement.getBoundingClientRect();

        this.pointer.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.pointer, this.camera);
        const meshes = this.getMeasurableMeshes();
        const intersects = this.raycaster.intersectObjects(meshes, true);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.mouseTracker.position.copy(point);
            this.mouseTracker.visible = true;

            // 확인 버튼 표시 및 위치 설정
            if (this.confirmButtonContainer) {
                Object.assign(this.confirmButtonContainer.style, {
                    position: "fixed",
                    left: `${touch.clientX + 50}px`, // 터치 포인트에서 오른쪽으로 50px
                    top: `${touch.clientY - 20}px`, // 터치 포인트에서 위로 20px
                    transform: "none", // 기존 transform 제거
                    display: "flex",
                });
            }
        } else {
            this.mouseTracker.visible = false;
            if (this.confirmButtonContainer) {
                this.confirmButtonContainer.style.display = "none";
            }
        }
    }

    onPointerMove(event) {
        if (!this.measurementMode) {
            if (this.mouseTracker) {
                this.mouseTracker.visible = false;
            }
            this.removeIndicationLine();
            return;
        }

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        this.raycaster.setFromCamera(this.pointer, this.camera);

        const meshes = this.getMeasurableMeshes();
        const intersects = this.raycaster.intersectObjects(meshes, true);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.mouseTracker.position.copy(point);
            this.mouseTracker.visible = !this.isDragging; // 드래그 중이 아닐 때만 보이도록
            
            // Indication line 업데이트
            this.updateIndicationLine(point);
        } else {
            this.mouseTracker.visible = false;
            this.removeIndicationLine();
        }
    }

    onPointerDown(event) {
        if (!this.measurementMode || this.isDragging) {
            return;
        }

        event.preventDefault();

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        this.raycaster.setFromCamera(this.pointer, this.camera);

        const meshes = this.getMeasurableMeshes();
        const intersects = this.raycaster.intersectObjects(meshes, true);

        if (intersects.length > 0) {
            const intersection = intersects[0];
            const point = intersection.point.clone();
            const object = intersection.object;

            if (object.isMesh) {
                this.handleMeasurementPoint(point, object);
            }
        }
    }

    onMouseDown(event) {
        if (!this.measurementMode) return;

        this.isMouseDown = true;
        this.isDragging = false;
        this.mouseDownStartTime = Date.now();
        this.lastMousePosition.set(event.clientX, event.clientY);
    }

    onMouseMove(event) {
        if (!this.measurementMode || !this.isMouseDown) return;

        const deltaX = Math.abs(event.clientX - this.lastMousePosition.x);
        const deltaY = Math.abs(event.clientY - this.lastMousePosition.y);

        // 드래그 감지를 위한 최소 이동 거리 (픽셀)
        const dragThreshold = 3;

        if (deltaX > dragThreshold || deltaY > dragThreshold) {
            this.isDragging = true;
        }
    }

    onMouseUp(event) {
        if (!this.measurementMode) return;

        const clickDuration = Date.now() - this.mouseDownStartTime;
        const isQuickClick = clickDuration < 200;

        if (this.isDragging || !isQuickClick) {
            event.preventDefault();
            event.stopPropagation();

            setTimeout(() => {
                this.isDragging = false;
                this.isMouseDown = false;
            }, 0);

            return;
        }

        this.isMouseDown = false;
        this.isDragging = false;
    }

    getMeasurableMeshes() {
        const meshes = [];
        this.scene.traverse((object) => {
            if (
                object.isMesh &&
                object.visible &&
                object.type !== "TransformControlsPlane" &&
                object.name !== ""
            ) {
                meshes.push(object);
            }
        });

        return meshes;
    }

    handleMeasurementPoint(point) {
        if (!this.mode) return;

        if (this.mode === "distance") {
            this.handleDistanceMeasurement(point);
        } else if (this.mode === "angle") {
            this.handleAngleMeasurement(point);
        }
    }

    handleDistanceMeasurement(point) {
        if (this.points.length === 0) {
            const newPoint = point.clone();
            this.points.push(newPoint);
            const marker = this.createMarker(newPoint);
            this.scene.add(marker);
            this.markers.push(marker);
        } else if (this.points.length === 1) {
            const newPoint = point.clone();
            this.points.push(newPoint);
            const marker = this.createMarker(newPoint);
            this.scene.add(marker);
            this.markers.push(marker);

            const geometry = new THREE.BufferGeometry();
            const pointsArray = this.points.map((p) => p.clone());
            geometry.setFromPoints(pointsArray);

            const material = new THREE.LineBasicMaterial({
                color: this.measurementColors.distance.line,
                depthTest: false,
                linewidth: 4
            });
            const line = new THREE.Line(geometry, material);
            line.renderOrder = 998;
            this.scene.add(line);
            this.lines.push(line);

            // 더 두꺼운 선을 위해 추가 선 생성
            const thickLineMaterial = new THREE.LineBasicMaterial({
                color: this.measurementColors.distance.line,
                depthTest: false,
                linewidth: 4
            });
            const thickLine = new THREE.Line(geometry, thickLineMaterial);
            thickLine.renderOrder = 997;
            this.scene.add(thickLine);
            this.lines.push(thickLine);

            const distance = this.points[0]
                .distanceTo(this.points[1])
                .toFixed(2);
            const midPoint = new THREE.Vector3()
                .addVectors(this.points[0], this.points[1])
                .multiplyScalar(0.5);

            this.label = this.createLabel(`${distance} mm`, midPoint);
            this.scene.add(this.label);

            // 측정 결과 저장 - 실제 객체 참조 저장
            this.measurements.push({
                type: "distance",
                points: [...this.points],
                markers: [...this.markers],
                lines: [...this.lines],
                label: this.label,
                value: distance,
            });

            this.completeMeasurement();
        }
    }

    handleAngleMeasurement(point) {
        const newPoint = point.clone();
        this.points.push(newPoint);
        const marker = this.createMarker(newPoint);
        this.scene.add(marker);
        this.markers.push(marker);

        if (this.points.length === 2) {
            // 두 번째 점을 찍은 후: 첫 번째-두 번째 점 사이의 확정된 선 표시
            const geometry = new THREE.BufferGeometry().setFromPoints([
                this.points[0].clone(),
                this.points[1].clone(),
            ]);
            const material = new THREE.LineBasicMaterial({
                color: this.measurementColors.angle.line,
                depthTest: false,
                linewidth: 4
            });

            const confirmedLine = new THREE.Line(geometry, material);
            confirmedLine.renderOrder = 998;
            confirmedLine.name = "ConfirmedAngleLine1"; // 이름 추가로 나중에 제거 가능하게

            this.scene.add(confirmedLine);
            this.lines.push(confirmedLine);

            // 더 두꺼운 선을 위해 추가 선 생성
            const thickLineMaterial = new THREE.LineBasicMaterial({
                color: this.measurementColors.angle.line,
                depthTest: false,
                linewidth: 4
            });
            const thickLine = new THREE.Line(geometry, thickLineMaterial);
            thickLine.renderOrder = 997;
            this.scene.add(thickLine);
            this.lines.push(thickLine);
        }

        if (this.points.length === 3) {
            const vector1 = new THREE.Vector3()
                .subVectors(this.points[0], this.points[1])
                .normalize();
            const vector2 = new THREE.Vector3()
                .subVectors(this.points[2], this.points[1])
                .normalize();

            const angleRadians = Math.acos(
                Math.min(Math.max(vector1.dot(vector2), -1), 1)
            );
            const angleDegrees =
                THREE.MathUtils.radToDeg(angleRadians).toFixed(2);

            // 두 번째-세 번째 점 사이의 선 추가
            const geometry2 = new THREE.BufferGeometry().setFromPoints([
                this.points[1].clone(),
                this.points[2].clone(),
            ]);
            const material = new THREE.LineBasicMaterial({
                color: this.measurementColors.angle.line,
                depthTest: false,
                linewidth: 4
            });

            const line2 = new THREE.Line(geometry2, material);
            line2.renderOrder = 998;

            this.scene.add(line2);
            this.lines.push(line2);

            // 더 두꺼운 선을 위해 추가 선 생성
            const thickLineMaterial = new THREE.LineBasicMaterial({
                color: this.measurementColors.angle.line,
                depthTest: false,
                linewidth: 4
            });
            const thickLine2 = new THREE.Line(geometry2, thickLineMaterial);
            thickLine2.renderOrder = 997;
            this.scene.add(thickLine2);
            this.lines.push(thickLine2);

            const midPoint = new THREE.Vector3()
                .addVectors(this.points[1], this.points[2])
                .multiplyScalar(0.5);

            this.label = this.createLabel(`${angleDegrees}°`, midPoint);
            this.scene.add(this.label);

            // 측정 결과 저장 - 실제 객체 참조 저장
            this.measurements.push({
                type: "angle",
                points: [...this.points],
                markers: [...this.markers],
                lines: [...this.lines],
                label: this.label,
                value: angleDegrees,
            });

            this.completeMeasurement();
        }
    }

    createMarker(point) {
        // 측정 모드에 따른 색상 설정
        const colors = this.measurementColors[this.mode] || this.measurementColors.distance;
        
        const marker = new THREE.Mesh(
            new THREE.SphereGeometry(this.markerSize, 16, 16),
            new THREE.MeshBasicMaterial({
                color: colors.marker,
                transparent: true,
                opacity: 0.8,
            })
        );
        marker.position.copy(point);
        marker.renderOrder = 999;
        return marker;
    }

    createLabel(text, position) {
        const div = document.createElement("div");
        div.className = "measurement-label";
        div.textContent = text;

        // 모바일에서 더 큰 폰트 크기와 패딩
        const fontSize = this.isMobile ? "16px" : "12px";
        const padding = this.isMobile ? "8px 12px" : "4px 8px";

        Object.assign(div.style, {
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            color: "white",
            padding: padding,
            borderRadius: "4px",
            fontSize: fontSize,
            fontWeight: this.isMobile ? "bold" : "normal",
            userSelect: "none",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            textAlign: "center",
        });

        const label = new CSS2DObject(div);
        label.position.copy(position);
        label.center.set(0.5, 0);
        return label;
    }

    /**
     * Scene 구조를 디버깅하기 위한 메서드
     */
    debugSceneStructure() {
        // 개발 환경에서만 사용하는 디버깅 메서드
        // 프로덕션에서는 불필요하므로 제거
    }

    /**
     * Indication line 생성 및 업데이트
     */
    updateIndicationLine(currentPoint) {
        if (!this.measurementMode || !this.points || this.points.length === 0) {
            this.removeIndicationLine();
            return;
        }

        // 기존 indication line 제거
        this.removeIndicationLine();

        // 측정 모드에 따른 색상 설정
        const colors = this.measurementColors[this.mode];
        if (colors) {
            this.indicationLineMaterial.color.setHex(colors.line);
            this.indicationLineMaterial.opacity = colors.opacity;
        }

        if (this.mode === "distance" && this.points.length === 1) {
            // 거리 측정: 첫 번째 점에서 현재 마우스 위치까지의 선
            this.createIndicationLine(this.points[0], currentPoint);
        } else if (this.mode === "angle" && this.points.length === 1) {
            // 각도 측정: 첫 번째 점에서 현재 마우스 위치까지의 선
            this.createIndicationLine(this.points[0], currentPoint);
        } else if (this.mode === "angle" && this.points.length === 2) {
            // 각도 측정: 두 번째 점에서 현재 마우스 위치까지의 선만 표시
            // 첫 번째-두 번째 점 사이의 선은 확정되어 표시됨
            this.createIndicationLine(this.points[1], currentPoint);
        }
    }

    /**
     * Indication line 생성
     */
    createIndicationLine(startPoint, endPoint) {
        if (!startPoint || !endPoint) return;

        const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
        this.indicationLine = new THREE.Line(geometry, this.indicationLineMaterial);
        this.indicationLine.renderOrder = 997; // 실제 측정선보다 뒤에 렌더링
        this.scene.add(this.indicationLine);
    }

    /**
     * Indication line 제거
     */
    removeIndicationLine() {
        if (this.indicationLine) {
            this.scene.remove(this.indicationLine);
            if (this.indicationLine.geometry) {
                this.indicationLine.geometry.dispose();
            }
            this.indicationLine = null;
        }
    }

    /**
     * 측정 완료 시 indication line 제거
     */
    completeMeasurement() {
        // Indication line 제거
        this.removeIndicationLine();
        
        const lastMeasurement = this.measurements[this.measurements.length - 1];

        if (!lastMeasurement) {
            console.error("No measurement data available");
            return;
        }

        const measurement = {
            type: this.mode,
            value: lastMeasurement.value,
            markers: lastMeasurement.markers,
            lines: lastMeasurement.lines,
            label: lastMeasurement.label,
        };

        if (this.objectListPanel) {
            this.objectListPanel.addMeasurement(measurement);
        } else {
            console.warn("ObjectListPanel not available in MeasurementTool");
        }

        if (typeof this.onMeasurementComplete === "function") {
            this.onMeasurementComplete(measurement);
        }

        this.disableMeasurementMode();
    }

    updateMarkerSize() {
        // 측정 도구가 포함된 모든 모델의 최대 바운딩 박스를 찾아서 가장 큰 것을 사용
        let maxBoundingBoxSize = 0;
        let meshCount = 0;
        let boundingBoxInfo = [];
        
        this.scene.traverse((object) => {
            // Transform controls, helper, measurement 관련 객체들 제외
            if (object.name && (
                object.name.includes('helper') ||
                object.name.includes('TransformControls') ||
                object.name.includes('START') ||
                object.name.includes('END') ||
                object.name.includes('DELTA') ||
                object.name.includes('AXIS') ||
                object.name.includes('X') ||
                object.name.includes('Y') ||
                object.name.includes('Z') ||
                object.name.includes('XY') ||
                object.name.includes('YZ') ||
                object.name.includes('XZ') ||
                object.name.includes('XYZ') ||
                object.name.includes('XYZE') ||
                object.name.includes('E')
            )) {
                return;
            }
            
            if (object.isMesh && object.geometry && object.name && !object.name.includes('helper')) {
                // 실제 로드된 모델인지 확인 (Transform controls나 measurement 도구가 아닌)
                const isActualModel = !(
                    object.name.includes('TransformControls') ||
                    object.name.includes('START') ||
                    object.name.includes('END') ||
                    object.name.includes('DELTA') ||
                    object.name.includes('AXIS') ||
                    object.name.includes('Plane') ||
                    object.name.includes('Gizmo')
                );
                
                // X, Y, Z, XY, YZ, XZ, XYZ, XYZE, E는 Transform controls의 일부이므로 제외
                const isTransformControl = /^[XYZ]$|^[XYZ]{2,4}$/.test(object.name);
                
                if (isActualModel && !isTransformControl) {
                    meshCount++;
                    const boundingBox = new THREE.Box3().setFromObject(object);
                    const size = boundingBox.getSize(new THREE.Vector3());
                    const maxDimension = Math.max(size.x, size.y, size.z);
                    
                    boundingBoxInfo.push({
                        name: object.name,
                        size: size,
                        maxDimension: maxDimension,
                        boundingBox: boundingBox
                    });
                    
                    if (maxDimension > maxBoundingBoxSize) {
                        maxBoundingBoxSize = maxDimension;
                    }
                }
            }
        });

        // 마커 크기를 바운딩 박스 크기에 비례하여 조정
        if (maxBoundingBoxSize > 0) {
            // 바운딩 박스 크기의 0.3%를 기본으로 하되, 모바일/데스크톱에 따라 조정
            const baseSize = maxBoundingBoxSize * 0.003;
            this.markerSize = this.isMobile ? baseSize * 1.5 : baseSize;
            
            // 최소/최대 크기 제한
            const minSize = this.isMobile ? 0.2 : 0.1;
            const maxSize = this.isMobile ? 1.5 : 0.8;
            
            this.markerSize = Math.max(minSize, Math.min(maxSize, this.markerSize));
        } else {
            // 모델이 없을 때 기본값 사용
            this.markerSize = this.isMobile ? 0.6 : 0.3;
        }
    }

    /**
     * 외부에서 모델 로드 후 marker size를 업데이트할 수 있는 public 메서드
     */
    refreshMarkerSize() {
        this.updateMarkerSize();
    }
}
