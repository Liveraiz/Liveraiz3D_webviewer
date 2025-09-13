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
        minFOV = 10,
        maxFOV = 120
    }) {
        this.isDarkMode = isDarkMode;
        this.viewerState = viewerState;
        this.currentFOV = initialFOV;
        this.minFOV = minFOV;
        this.maxFOV = maxFOV;
        
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
        this.slider.value = this.currentFOV.toString();
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
        valueDisplay.textContent = `${this.currentFOV}°`;
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
            const newFOV = parseInt(e.target.value);
            this.currentFOV = newFOV;
            this.valueDisplay.textContent = `${newFOV}°`;
            
            // fill 배경 업데이트
            const fillPercentage = ((newFOV - this.minFOV) / (this.maxFOV - this.minFOV)) * 100;
            this.fillBackground.style.width = `${fillPercentage}%`;
            
            this.updateCameraFOV(newFOV);
        });

        // 호버 효과
        this.sliderContainer.addEventListener("mouseover", () => {
            this.sliderContainer.style.opacity = "1";
        });

        this.sliderContainer.addEventListener("mouseout", () => {
            this.sliderContainer.style.opacity = "0.8";
        });
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
        if (this.viewerState && this.viewerState.state && this.viewerState.state.liverViewer) {
            const liverViewer = this.viewerState.state.liverViewer;
            if (liverViewer.camera) {
                // 현재 카메라 위치 저장 (거리 유지)
                const currentPosition = liverViewer.camera.position.clone();
                const currentTarget = liverViewer.camera.controls ? liverViewer.camera.controls.target.clone() : new THREE.Vector3(0, 0, 0);
                
                // FOV만 변경 (렌즈 distortion 조정)
                liverViewer.camera.fov = fov;
                liverViewer.camera.updateProjectionMatrix();
                
                // 카메라 위치와 타겟 유지 (거리 보존)
                liverViewer.camera.position.copy(currentPosition);
                if (liverViewer.camera.controls) {
                    liverViewer.camera.controls.target.copy(currentTarget);
                    liverViewer.camera.controls.update();
                }
                
                console.log(`렌즈 시야각(FOV) 업데이트: ${fov}° (카메라 거리 유지)`);
            }
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
                this.slider.value = fov.toString();
            }
            if (this.valueDisplay) {
                this.valueDisplay.textContent = `${fov}°`;
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
    }
}
