import * as THREE from 'three';

/**
 * FOV 슬라이더 컨트롤러 클래스
 * 카메라의 Field of View를 사용자가 조정할 수 있는 UI를 제공
 */
export default class FOVController {
    constructor({
        isDarkMode = true,
        viewerState = null,
        initialFOV = 70,
        minFOV = 26.5,
        maxFOV = 90,
        remoteControl = {}
    }) {
        this.isDarkMode = isDarkMode;
        this.viewerState = viewerState;
        this.currentFOV = initialFOV;
        this.minFOV = minFOV;
        this.maxFOV = maxFOV;
        this.isUpdatingFromSlider = false;
        this.controls = null;
        this.controlChangeHandler = null;
        this.remoteKeyHandler = null;
        this.remoteKeyUpHandler = null;
        this.remoteKeyState = new Map();

        const {
            fovStep = 10,
            zoomStepFactor = 0.06,
            zoomStepMinDistance = 0.015,
            acceleration = {}
        } = remoteControl;

        const {
            enabled: accelerationEnabled = true,
            repeatWindowMs = 300,
            multiplierStep = 0.5,
            maxMultiplier = 4
        } = acceleration;

        this.remoteControlOptions = {
            fovStep,
            zoomStepFactor,
            zoomStepMinDistance,
            acceleration: {
                enabled: accelerationEnabled,
                repeatWindowMs,
                multiplierStep,
                maxMultiplier
            }
        };
        
        // DOM 요소 참조
        this.sliderContainer = null;
        this.slider = null;
        this.fillBackground = null;
        this.valueDisplay = null;
        this.label = null;
    }

    /**
     * FOV 슬라이더를 생성하는 메서드
     * @returns {HTMLElement} FOV 슬라이더 컨테이너 요소
     */
    createFOVSlider() {
        const sliderContainer = document.createElement("div");
        sliderContainer.className = "fov-slider-container";
        this.sliderContainer = sliderContainer;
        
        this.applyContainerStyles(sliderContainer);

        // 라벨 생성
        this.label = this.createLabel();
        sliderContainer.appendChild(this.label);

        // 슬라이더 래퍼 생성
        const sliderWrapper = this.createSliderWrapper();
        sliderContainer.appendChild(sliderWrapper);

        // 값 표시 생성
        this.valueDisplay = this.createValueDisplay();
        sliderContainer.appendChild(this.valueDisplay);

        // 이벤트 리스너 설정
        this.setupEventListeners();
        this.attachControlListener();
        this.setupRemoteControlHandlers();

        return sliderContainer;
    }

    /**
     * 컨테이너 스타일 적용
     * @param {HTMLElement} container - 슬라이더 컨테이너
     */
    applyContainerStyles(container) {
        container.style.cssText = `
            position: absolute;
            right: 200px;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            gap: 8px;
            background: ${this.isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.8)'};
            padding: 4px 12px;
            border-radius: 20px;
            backdrop-filter: blur(15px);
            border: 1px solid ${this.isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
            box-shadow: ${this.isDarkMode ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.1)'};
            opacity: 0.9;
            transition: all 0.3s ease;
        `;
    }

    /**
     * 라벨 생성
     * @returns {HTMLElement} 라벨 요소
     */
    createLabel() {
        const label = document.createElement("span");
        label.textContent = "FOV:";
        label.title = "렌즈 시야각 조정 (카메라 거리 유지)";
        label.style.cssText = `
            color: ${this.isDarkMode ? '#ffffff' : '#000000'};
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
        `;
        return label;
    }

    /**
     * 슬라이더 래퍼 생성
     * @returns {HTMLElement} 슬라이더 래퍼 요소
     */
    createSliderWrapper() {
        const sliderWrapper = document.createElement("div");
        sliderWrapper.style.cssText = `
            position: relative;
            width: 80px;
            height: 24px;
            background: transparent;
            border-radius: 2px;
            overflow: visible;
            display: flex;
            align-items: center;
        `;

        // 그라데이션 fill 배경
        this.fillBackground = document.createElement("div");
        this.fillBackground.className = "fov-fill-bg";
        this.fillBackground.style.cssText = `
            position: absolute;
            top: 50%;
            left: 0;
            height: 4px;
            width: ${((this.currentFOV - this.minFOV) / (this.maxFOV - this.minFOV)) * 100}%;
            background: linear-gradient(90deg, #3b82f6 0%, #9333ea 100%);
            border-radius: 2px;
            transform: translateY(-50%);
            transition: width 0.1s ease;
            z-index: 1;
        `;

        // 슬라이더
        this.slider = document.createElement("input");
        this.slider.type = "range";
        this.slider.min = this.minFOV.toString();
        this.slider.max = this.maxFOV.toString();
        this.slider.value = this.currentFOV.toFixed(1);
        this.slider.step = "0.1";
        this.slider.className = "fov-slider";
        this.slider.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            outline: none;
            border: none;
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            z-index: 10;
        `;

        // 커스텀 슬라이더 스타일 적용
        this.applySliderStyles();

        sliderWrapper.appendChild(this.fillBackground);
        sliderWrapper.appendChild(this.slider);

        return sliderWrapper;
    }

    /**
     * 슬라이더 스타일 적용
     */
    applySliderStyles() {
        const style = document.createElement("style");
        style.setAttribute('data-fov-slider', 'true');
        style.textContent = `
            .fov-slider::-webkit-slider-thumb {
                appearance: none;
                -webkit-appearance: none;
                width: 18px;
                height: 18px;
                background: #9333ea;
                border-radius: 50%;
                cursor: pointer;
                border: 3px solid ${this.isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)'};
                box-shadow: 0 3px 10px rgba(147, 51, 234, 0.4);
                transition: all 0.2s ease;
                position: relative;
                z-index: 20;
            }
            .fov-slider::-webkit-slider-thumb:hover {
                transform: scale(1.15);
                box-shadow: 0 5px 15px rgba(147, 51, 234, 0.5);
            }
            .fov-slider::-webkit-slider-thumb:active {
                transform: scale(1.1);
                box-shadow: 0 2px 8px rgba(147, 51, 234, 0.6);
            }
            .fov-slider::-webkit-slider-track {
                background: transparent;
                height: 4px;
                border-radius: 2px;
            }
            .fov-slider::-moz-range-thumb {
                width: 18px;
                height: 18px;
                background: #9333ea;
                border-radius: 50%;
                cursor: pointer;
                border: 3px solid ${this.isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)'};
                box-shadow: 0 3px 10px rgba(147, 51, 234, 0.4);
                transition: all 0.2s ease;
            }
            .fov-slider::-moz-range-track {
                background: transparent;
                height: 4px;
                border-radius: 2px;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 값 표시 생성
     * @returns {HTMLElement} 값 표시 요소
     */
    createValueDisplay() {
        const valueDisplay = document.createElement("span");
        valueDisplay.className = "fov-value";
        const displayValue = Number(this.currentFOV.toFixed(1));
        valueDisplay.textContent = `${displayValue}°`;
        valueDisplay.style.cssText = `
            color: ${this.isDarkMode ? '#ffffff' : '#000000'};
            font-size: 12px;
            font-weight: 500;
            min-width: 35px;
            text-align: center;
        `;
        return valueDisplay;
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 슬라이더 입력 이벤트
        this.slider.addEventListener("input", (e) => {
            const newFOV = parseFloat(e.target.value);
            if (Number.isNaN(newFOV)) {
                return;
            }

            const clampedFOV = Math.min(this.maxFOV, Math.max(this.minFOV, newFOV));
            this.currentFOV = clampedFOV;
            const displayValue = Number(clampedFOV.toFixed(1));
            this.valueDisplay.textContent = `${displayValue}°`;
            
            // fill 배경 업데이트
            const fillPercentage = ((clampedFOV - this.minFOV) / (this.maxFOV - this.minFOV)) * 100;
            this.fillBackground.style.width = `${fillPercentage}%`;
            
            this.isUpdatingFromSlider = true;
            this.updateCameraFOV(clampedFOV);
            this.isUpdatingFromSlider = false;
        });

        // 호버 효과
        this.sliderContainer.addEventListener("mouseover", () => {
            this.sliderContainer.style.opacity = "1";
        });

        this.sliderContainer.addEventListener("mouseout", () => {
            this.sliderContainer.style.opacity = "0.8";
        });

        // FOV 슬라이더 위에서만 wheel 이벤트로 FOV 조절
        // 그 외 영역에서는 ArcballControls의 기본 줌 동작 사용
        this.sliderContainer.addEventListener("wheel", (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const delta = e.deltaY > 0 ? -this.remoteControlOptions.fovStep : this.remoteControlOptions.fovStep;
            this.adjustFOVBy(delta);
        }, { passive: false });
    }

    attachControlListener() {
        if (!this.viewerState || !this.viewerState.state || !this.viewerState.state.liverViewer) {
            return;
        }

        const liverViewer = this.viewerState.state.liverViewer;
        const controls = liverViewer?.camera?.controls;

        if (!controls) {
            return;
        }

        if (this.controlChangeHandler && controls === this.controls) {
            return;
        }

        this.detachControlListener();

        this.controls = controls;
        this.controlChangeHandler = () => {
            if (!liverViewer?.camera || this.isUpdatingFromSlider) {
                return;
            }

            const cameraFOV = liverViewer.camera.fov;
            if (Math.abs(cameraFOV - this.currentFOV) < 0.05) {
                return;
            }

            this.syncSliderWithFOV(cameraFOV);
        };

        this.controls.addEventListener("change", this.controlChangeHandler);

        if (liverViewer.camera) {
            this.syncSliderWithFOV(liverViewer.camera.fov);
        }

        this.setupRemoteControlHandlers();
    }

    detachControlListener() {
        if (this.controls && this.controlChangeHandler) {
            this.controls.removeEventListener("change", this.controlChangeHandler);
        }
        this.controls = null;
        this.controlChangeHandler = null;
    }

    syncSliderWithFOV(fov) {
        const clampedFOV = Math.min(this.maxFOV, Math.max(this.minFOV, fov));
        this.currentFOV = clampedFOV;

        const displayValue = Number(clampedFOV.toFixed(1));
        if (this.slider) {
            this.slider.value = clampedFOV.toFixed(1);
        }
        if (this.valueDisplay) {
            this.valueDisplay.textContent = `${displayValue}°`;
        }
        if (this.fillBackground) {
            const fillPercentage = ((clampedFOV - this.minFOV) / (this.maxFOV - this.minFOV)) * 100;
            this.fillBackground.style.width = `${fillPercentage}%`;
        }
    }

    adjustFOVBy(delta) {
        if (typeof delta !== "number" || Number.isNaN(delta)) {
            return;
        }

        const nextFov = THREE.MathUtils.clamp(this.currentFOV + delta, this.minFOV, this.maxFOV);
        this.setFOV(nextFov);
    }

    adjustZoom(direction = 1, multiplier = 1) {
        if (!this.viewerState?.state?.liverViewer?.camera) {
            return;
        }

        const liverViewer = this.viewerState.state.liverViewer;
        const camera = liverViewer.camera;
        const controls = camera.controls || this.controls;

        const target = controls?.target?.clone?.() ?? new THREE.Vector3(0, 0, 0);
        const offset = camera.position.clone().sub(target);
        const distance = offset.length();

        if (!Number.isFinite(distance) || distance <= 1e-6) {
            return;
        }

        const minDistance = typeof controls?.minDistance === "number" ? controls.minDistance : 0.05;
        const maxDistance = typeof controls?.maxDistance === "number" && controls.maxDistance > 0
            ? controls.maxDistance
            : Infinity;

        const distanceStep = Math.max(
            distance * this.remoteControlOptions.zoomStepFactor * multiplier,
            this.remoteControlOptions.zoomStepMinDistance * multiplier
        );
        const targetDistance = THREE.MathUtils.clamp(
            distance + direction * distanceStep,
            minDistance,
            maxDistance
        );

        if (Math.abs(targetDistance - distance) < 1e-4) {
            return;
        }

        const newPosition = offset.normalize().multiplyScalar(targetDistance).add(target);

        camera.position.copy(newPosition);
        if (controls?.target && typeof controls.target.copy === "function") {
            controls.target.copy(target);
        }

        camera.updateProjectionMatrix();

        if (typeof controls?.updateMatrixState === "function") {
            controls.updateMatrixState();
        }
        if (typeof controls?.dispatchEvent === "function") {
            controls.dispatchEvent({ type: "change" });
        }
        if (typeof controls?.update === "function") {
            controls.update();
        }
    }

    setupRemoteControlHandlers() {
        if (this.remoteKeyHandler) {
            return;
        }

        if (typeof document === "undefined") {
            return;
        }

        this.remoteKeyHandler = (event) => {
            if (event?.defaultPrevented) {
                return;
            }

            const action = this.resolveRemoteDirection(event);
            if (!action) {
                return;
            }

            if (this.shouldIgnoreRemoteEvent(event)) {
                return;
            }

            event.preventDefault();

            // FOV 조정은 repeat 이벤트 무시 (한 번만 실행)
            if (action === "left" || action === "right") {
                // repeat 이벤트이거나 짧은 시간 내 반복 입력이면 무시
                if (event?.repeat) {
                    return;
                }
                
                const now = typeof performance !== "undefined" && typeof performance.now === "function"
                    ? performance.now()
                    : Date.now();
                const state = this.remoteKeyState.get(action);
                const minInterval = 200; // 최소 200ms 간격
                
                if (state && (now - state.lastTime) < minInterval) {
                    return; // 너무 빠른 연속 입력 무시
                }
                
                // 상태 업데이트
                if (!state) {
                    this.remoteKeyState.set(action, { lastTime: now });
                } else {
                    state.lastTime = now;
                }
                
                // FOV 조정 (가속 없이 한 번만)
                if (action === "left") {
                    this.adjustFOVBy(-this.remoteControlOptions.fovStep);
                } else {
                    this.adjustFOVBy(this.remoteControlOptions.fovStep);
                }
                return;
            }

            // 줌 조정은 기존대로 가속 적용
            const now = typeof performance !== "undefined" && typeof performance.now === "function"
                ? performance.now()
                : Date.now();
            const state = this.remoteKeyState.get(action);
            const isHolding = state && (now - state.lastTime) < this.remoteControlOptions.acceleration.repeatWindowMs * 2;
            const multiplier = this.getRemoteAccelerationMultiplier(action, isHolding);

            switch (action) {
                case "up":
                    this.adjustZoom(-1, multiplier);
                    break;
                case "down":
                    this.adjustZoom(1, multiplier);
                    break;
                default:
                    break;
            }
        };

        this.remoteKeyUpHandler = (event) => {
            const action = this.resolveRemoteDirection(event);
            if (!action) {
                return;
            }

            this.remoteKeyState.delete(action);
        };

        document.addEventListener("keydown", this.remoteKeyHandler, { passive: false });
        document.addEventListener("keyup", this.remoteKeyUpHandler, { passive: true });
    }

    /**
     * 테마를 업데이트하는 메서드
     * @param {boolean} isDarkMode - 다크모드 여부
     */
    updateTheme(isDarkMode) {
        this.isDarkMode = isDarkMode;
        
        if (!this.sliderContainer) return;

        // 컨테이너 스타일 업데이트
        this.sliderContainer.style.background = isDarkMode 
            ? 'rgba(0,0,0,0.4)' 
            : 'rgba(255,255,255,0.8)';
        this.sliderContainer.style.border = `1px solid ${isDarkMode 
            ? 'rgba(255,255,255,0.1)' 
            : 'rgba(0,0,0,0.1)'}`;
        this.sliderContainer.style.boxShadow = isDarkMode 
            ? '0 4px 20px rgba(0,0,0,0.3)' 
            : '0 4px 20px rgba(0,0,0,0.1)';

        // 텍스트 색상 업데이트
        if (this.label) {
            this.label.style.color = isDarkMode ? '#ffffff' : '#000000';
        }
        if (this.valueDisplay) {
            this.valueDisplay.style.color = isDarkMode ? '#ffffff' : '#000000';
        }

        // 슬라이더 썸 스타일 업데이트
        this.updateSliderStyles();
    }

    /**
     * 슬라이더 스타일 업데이트
     */
    updateSliderStyles() {
        // 기존 스타일 제거
        const existingStyle = document.querySelector('style[data-fov-slider]');
        if (existingStyle) {
            existingStyle.remove();
        }

        // 새로운 스타일 추가
        this.applySliderStyles();
    }

    /**
     * 카메라 FOV를 업데이트하는 메서드 (렌즈 distortion 조정)
     * 카메라와 물체의 거리는 유지하고 시야각만 변경
     * @param {number} fov - 새로운 FOV 값 (렌즈 시야각)
     */
    updateCameraFOV(fov) {
        if (!this.viewerState || !this.viewerState.state || !this.viewerState.state.liverViewer) {
            return;
        }

        const liverViewer = this.viewerState.state.liverViewer;
        const camera = liverViewer?.camera;

        if (!camera) {
            return;
        }

        const controls = camera.controls || this.controls;
        const minFov = typeof controls?.minFov === "number" ? controls.minFov : this.minFOV;
        const maxFov = typeof controls?.maxFov === "number" ? controls.maxFov : this.maxFOV;
        const targetFov = Math.min(maxFov, Math.max(minFov, fov));
        const currentFov = camera.fov;

        if (Math.abs(targetFov - currentFov) < 1e-4) {
            return;
        }

        const target = controls?.target?.clone?.() ?? new THREE.Vector3(0, 0, 0);
        const cameraPos = camera.position.clone();
        const offset = cameraPos.sub(target);
        const distance = offset.length();

        if (distance > 1e-6) {
            const direction = offset.normalize();
            const currentFovRad = THREE.MathUtils.degToRad(currentFov * 0.5);
            const targetFovRad = THREE.MathUtils.degToRad(targetFov * 0.5);
            const viewHeight = distance * Math.tan(currentFovRad);
            let newDistance = viewHeight / Math.tan(targetFovRad);

            if (typeof controls?.minDistance === "number") {
                newDistance = Math.max(controls.minDistance, newDistance);
            }
            if (typeof controls?.maxDistance === "number" && controls.maxDistance > 0) {
                newDistance = Math.min(controls.maxDistance, newDistance);
            }

            const newPosition = direction.multiplyScalar(newDistance).add(target);
            camera.position.copy(newPosition);
            if (controls?.target) {
                controls.target.copy(target);
            }
        }

        camera.fov = targetFov;
        camera.updateProjectionMatrix();

        if (typeof controls?.updateMatrixState === "function") {
            controls.updateMatrixState();
        }
        if (typeof controls?.dispatchEvent === "function") {
            controls.dispatchEvent({ type: "change" });
        }
        if (typeof controls?.update === "function") {
            controls.update();
        }
    }

    /**
     * FOV 값을 설정하는 메서드
     * @param {number} fov - 설정할 FOV 값
     */
    setFOV(fov) {
        if (fov >= this.minFOV && fov <= this.maxFOV) {
            this.currentFOV = fov;
            if (this.slider) {
                this.slider.value = fov.toFixed(1);
            }
            if (this.valueDisplay) {
                const displayValue = Number(fov.toFixed(1));
                this.valueDisplay.textContent = `${displayValue}°`;
            }
            if (this.fillBackground) {
                const fillPercentage = ((fov - this.minFOV) / (this.maxFOV - this.minFOV)) * 100;
                this.fillBackground.style.width = `${fillPercentage}%`;
            }
            this.updateCameraFOV(fov);
        }
    }

    /**
     * 현재 FOV 값을 반환하는 메서드
     * @returns {number} 현재 FOV 값
     */
    getFOV() {
        return this.currentFOV;
    }

    /**
     * 슬라이더를 제거하는 메서드
     */
    destroy() {
        if (this.sliderContainer) {
            this.sliderContainer.remove();
        }
        
        // 스타일 태그 제거
        const existingStyle = document.querySelector('style[data-fov-slider]');
        if (existingStyle) {
            existingStyle.remove();
        }

        if (this.remoteKeyHandler && typeof document !== "undefined") {
            document.removeEventListener("keydown", this.remoteKeyHandler);
            this.remoteKeyHandler = null;
        }
        if (this.remoteKeyUpHandler && typeof document !== "undefined") {
            document.removeEventListener("keyup", this.remoteKeyUpHandler);
            this.remoteKeyUpHandler = null;
        }
        this.remoteKeyState.clear();
    }

    updateRemoteControlOptions(options = {}) {
        if (!options || typeof options !== "object") {
            return;
        }

        const { acceleration, ...rest } = options;
        Object.assign(this.remoteControlOptions, rest);

        if (acceleration && typeof acceleration === "object") {
            Object.assign(this.remoteControlOptions.acceleration, acceleration);
        }
    }

    resolveRemoteDirection(event) {
        if (!event) {
            return null;
        }

        const keyCode = event.keyCode;
        const rawKey = (event.key || event.code || "").toString().trim();
        const normalizedKey = rawKey.toUpperCase();

        const aliasMap = {
            ARROWLEFT: "left",
            LEFT: "left",
            VK_LEFT: "left",
            KEYLEFT: "left",
            NAV_LEFT: "left",
            ARROWRIGHT: "right",
            RIGHT: "right",
            VK_RIGHT: "right",
            KEYRIGHT: "right",
            NAV_RIGHT: "right",
            ARROWUP: "up",
            UP: "up",
            VK_UP: "up",
            KEYUP: "up",
            NAV_UP: "up",
            ARROWDOWN: "down",
            DOWN: "down",
            VK_DOWN: "down",
            KEYDOWN: "down",
            NAV_DOWN: "down"
        };

        if (aliasMap[normalizedKey]) {
            return aliasMap[normalizedKey];
        }

        switch (keyCode) {
            case 37:
                return "left";
            case 38:
                return "up";
            case 39:
                return "right";
            case 40:
                return "down";
            default:
                return null;
        }
    }

    shouldIgnoreRemoteEvent(event) {
        const target = event?.target;
        if (!target) {
            return false;
        }

        const tagName = target.tagName;
        if (tagName === "INPUT" || tagName === "TEXTAREA" || target.isContentEditable) {
            return true;
        }

        const liverViewer = this.viewerState?.state?.liverViewer;
        if (liverViewer?.modelSelector?.dialog) {
            return true;
        }

        // ObjectListPanel이 열려있을 때 상하 방향키는 패널 스크롤에 위임
        const action = this.resolveRemoteDirection(event);
        if ((action === "up" || action === "down") && liverViewer?.objectListPanel?.isOpen) {
            return true;
        }

        return false;
    }

    getRemoteAccelerationMultiplier(action, isHolding) {
        const acceleration = this.remoteControlOptions.acceleration;
        if (!acceleration.enabled) {
            return 1;
        }

        const now = typeof performance !== "undefined" && typeof performance.now === "function"
            ? performance.now()
            : Date.now();

        const state = this.remoteKeyState.get(action) || {
            lastTime: 0,
            multiplier: 1
        };

        const elapsed = now - state.lastTime;

        // 누르고 있는 상태이거나 짧은 시간 내에 반복 입력이 있으면 가속
        if (isHolding || elapsed <= acceleration.repeatWindowMs) {
            if (elapsed <= acceleration.repeatWindowMs) {
                // 빠르게 반복되면 가속 증가
                state.multiplier = Math.min(
                    acceleration.maxMultiplier,
                    state.multiplier + acceleration.multiplierStep
                );
            } else if (elapsed > acceleration.repeatWindowMs * 3) {
                // 너무 오래 지나면 리셋
                state.multiplier = 1;
            }
            // 그 외에는 현재 가속 유지
        } else {
            // 처음 입력이거나 오래 지났으면 기본값
            state.multiplier = 1;
        }

        state.lastTime = now;
        this.remoteKeyState.set(action, state);
        return state.multiplier;
    }
}

