import { Constants } from "../utils/Constants";
import FOVController from "../functions/FOVController";

export default class TopBar {
    constructor({
        isMobile = false,
        isDarkMode = false,
        viewerState = null,
        textPanel = null,
        objectListPanel = null,
        controlManager = null,
        cameraPlayer = null,
        modelLoader = null,
    }) {
        // isMobile이 전달되지 않은 경우 자동 감지 (크롬 개발자 도구 모바일 시뮬레이션 포함)
        this.isMobile = isMobile !== undefined ? isMobile : this.detectMobile();
        
        this.isDarkMode = isDarkMode;
        this.viewerState = viewerState;
        this.textPanel = textPanel;
        this.objectListPanel = objectListPanel;
        this.controlManager = controlManager;
        this.modelSelector = null;
        this.isOrbitControls = true; // Track current control type
        this.cameraActive = false;
        this.cameraPlayer = cameraPlayer; // Store the cameraPlayer reference
        this.cameraButton = null; // Store reference to the camera button
        this.modelLoader = modelLoader; // ModelLoader 저장
        
        // FOV 컨트롤러 인스턴스
        this.fovController = null;
        
        // 카메라 상태 관리
        this.cameraStateManager = null;
        this.savedStates = new Map(); // 메모리에 저장된 상태들
        this.currentStateKey = null;

        if (!this.viewerState) {
            console.warn(
                "ViewerState가 TopBar에 제공되지 않았습니다. 기본값으로 진행합니다."
            );
            this.viewerState = {
                isDarkMode: isDarkMode,
            };
        }

        this.createTopBar();
    }

    // 모바일 감지 메서드 추가 (태블릿은 PC로 분류)
    detectMobile() {
        // 1. 화면 크기 기반 감지 (768px 미만만 모바일로 분류)
        const isSmallScreen = window.innerWidth < 768;
        
        // 2. User Agent 기반 감지 (태블릿 제외)
        const userAgent = navigator.userAgent.toLowerCase();
        // iPad는 태블릿이므로 모바일에서 제외, iPhone만 모바일로 분류
        const isMobileUA = /android.*mobile|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        
        // 3. 터치 지원 여부는 태블릿도 지원하므로 제외
        
        // 4. 크롬 개발자 도구 모바일 시뮬레이션 감지 (화면 크기만 고려)
        const isChromeDevTools = window.chrome && window.chrome.webstore === undefined;
        const isMobileSimulation = isChromeDevTools && isSmallScreen;
        
        // 5. 추가 모바일 감지 방법들 (화면 크기만 고려)
        const isMobileViewport = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
        
        // 6. 크롬 개발자 도구에서 모바일 시뮬레이션 중인지 확인 (화면 크기만 고려)
        const isChromeMobileSim = window.chrome && isSmallScreen;
        
        const result = isSmallScreen || isMobileUA || isMobileSimulation || isMobileViewport || isChromeMobileSim;
        
        console.log('Mobile Detection:', {
            isSmallScreen,
            isMobileUA,
            userAgent: userAgent.substring(0, 50),
            isMobileSimulation,
            isMobileViewport,
            isChromeMobileSim,
            result
        });
        
        return result;
    }

    /**
     * 모델 선택기를 설정하는 메서드
     * @param {Object} modelSelector - 모델 선택기 객체
     */
    setModelSelector(modelSelector) {
        this.modelSelector = modelSelector;
    }

    /**
     * CameraPlayer를 설정하는 메서드
     * @param {Object} cameraPlayer - 카메라 플레이어 객체
     */
    setCameraPlayer(cameraPlayer) {
        this.cameraPlayer = cameraPlayer;
        
        // CameraPlayer 상태 감시 - active 상태가 변경될 때 버튼 상태 업데이트
        if (cameraPlayer) {
            // 원래 toggleCamera 함수를 저장
            const originalToggleCamera = cameraPlayer.toggleCamera;
            
            // toggleCamera 함수를 재정의하여 상태 변경 후 버튼 업데이트
            cameraPlayer.toggleCamera = async () => {
                // 원래 함수 호출
                await originalToggleCamera.call(cameraPlayer);
                
                // CameraPlayer의 active 상태에 따라 버튼 상태 업데이트
                this.updateCameraButtonState(cameraPlayer.active);
            };
        }
    }

    /**
     * 상단 바를 생성하고 초기화하는 메서드
     * - 로고, 카메라 리셋 버튼, 테마 토글 버튼을 포함
     * - 각 버튼에 대한 이벤트 리스너 설정
     */
    createTopBar() {
        const topBar = document.createElement("div");
        topBar.className = "top-bar";

        const logoContainer = document.createElement("div");
        logoContainer.className = "logo-container";

        const logoImg = document.createElement("img");
        logoImg.src = this.isDarkMode
            ? "./img/logo-dark.png"
            : "./img/logo-light.png";
        logoImg.alt = "Logo";
        logoImg.className = "logo";

        logoContainer.style.cursor = "pointer";
        logoContainer.addEventListener("click", () => {
            window.location.reload();
        });

        logoContainer.appendChild(logoImg);
        topBar.appendChild(logoContainer);

        const cameraButton = document.createElement("button");
        cameraButton.className = "camera-device";
        cameraButton.innerHTML = this.getCameraIcon();
        cameraButton.title = "Connect Camera Device";
        cameraButton.style.cssText = `
            background: none;
            border: none;
            cursor: pointer;
            padding: ${this.isMobile ? "12px" : "6px"};
            position: absolute;
            right: ${this.isMobile ? "110px" : "110px"};
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
            transition: opacity 0.3s ease, background-color 0.3s ease, border-radius 0.3s ease;
        `;

        cameraButton.addEventListener("mouseover", () => {
            cameraButton.style.opacity = "1";
        });

        cameraButton.addEventListener("mouseout", () => {
            if (!this.cameraActive) {
                cameraButton.style.opacity = "0.7";
            }
        });

        cameraButton.addEventListener("click", () => {
            this.toggleCamera(cameraButton);
        });

        this.cameraButton = cameraButton; // Save reference to the camera button

        const resetButton = document.createElement("button");
        resetButton.className = "reset-camera";
        resetButton.innerHTML = this.getResetIcon();
        resetButton.title = "Reset View";
        resetButton.style.cssText = `
            background: none;
            border: none;
            cursor: pointer;
            padding: ${this.isMobile ? "12px" : "6px"};
            position: absolute;
            right: ${this.isMobile ? "60px" : "65px"};
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
            transition: opacity 0.3s ease;
        `;

        resetButton.addEventListener("mouseover", () => {
            resetButton.style.opacity = "1";
        });

        resetButton.addEventListener("mouseout", () => {
            resetButton.style.opacity = "0.7";
        });

        resetButton.addEventListener("click", () => {
            if (this.controlManager) {
                this.controlManager.resetCamera();
            }
        });

        // Theme toggle button
        const themeToggle = document.createElement("button");
        themeToggle.className = "theme-toggle";
        themeToggle.innerHTML = this.getThemeIcon(this.isDarkMode);
        themeToggle.title = "Toggle Theme";
        themeToggle.style.cssText = `
            background: none;
            border: none;
            cursor: pointer;
            padding: ${this.isMobile ? "12px" : "6px"};
            position: absolute;
            right: ${this.isMobile ? "10px" : "20px"};
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
            transition: opacity 0.3s ease;
        `;

        themeToggle.addEventListener("mouseover", () => {
            themeToggle.style.opacity = "1";
        });

        themeToggle.addEventListener("mouseout", () => {
            themeToggle.style.opacity = "0.7";
        });

        themeToggle.addEventListener("click", () => {
            this.isDarkMode = !this.isDarkMode;
            console.log(
                "테마 변경:",
                this.isDarkMode ? "다크모드" : "라이트모드"
            );

            const newLogoSrc = this.isDarkMode
                ? "./img/logo-dark.png"
                : "./img/logo-light.png";
            console.log("새로운 로고 경로:", newLogoSrc);
            logoImg.src = newLogoSrc;

            if (this.viewerState) {
                this.viewerState.setState({ isDarkMode: this.isDarkMode });
            }

            themeToggle.innerHTML = this.getThemeIcon(this.isDarkMode);

            this.updateTheme(this.isDarkMode);
        });

        // 파일 업로드 버튼 추가
        const uploadButton = document.createElement("button");
        uploadButton.className = "file-upload";
        uploadButton.innerHTML = this.getUploadIcon();
        uploadButton.title = "Upload Local File";
        uploadButton.style.cssText = `
            background: none;
            border: none;
            cursor: pointer;
            padding: ${this.isMobile ? "12px" : "6px"};
            position: absolute;
            right: ${this.isMobile ? "105px" : "155px"};
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
            transition: opacity 0.3s ease;
        `;

        uploadButton.addEventListener("mouseover", () => {
            uploadButton.style.opacity = "1";
        });

        uploadButton.addEventListener("mouseout", () => {
            uploadButton.style.opacity = "0.7";
        });

        uploadButton.addEventListener("click", () => {
            if (this.modelLoader) {
                this.modelLoader.openFileDialog();
            }
        });

        // 모바일이 아닐 때만 업로드 버튼 추가
        console.log('TopBar - Upload button condition check:', {
            isMobile: this.isMobile,
            windowWidth: window.innerWidth,
            userAgent: navigator.userAgent
        });
        
        if (!this.isMobile) {
            console.log('TopBar - Adding upload button (desktop mode)');
            topBar.appendChild(uploadButton);
        } else {
            console.log('TopBar - Skipping upload button (mobile mode)');
        }

        // FOV 슬라이더 추가 (PC 모드에서만)
        if (!this.isMobile) {
            this.fovController = new FOVController({
                isDarkMode: this.isDarkMode,
                viewerState: this.viewerState
            });
            
            const fovSlider = this.fovController.createFOVSlider();
            if (fovSlider) {
                topBar.appendChild(fovSlider);
            }
        }

        // 모바일 상태 변경 감지 및 업로드 버튼 동적 제거/추가
        this.setupMobileDetection();

        topBar.appendChild(cameraButton);
        topBar.appendChild(resetButton);
        topBar.appendChild(themeToggle);

        this.applyStyles(topBar);
        document.body.insertBefore(topBar, document.body.firstChild);

        this.updateTheme(this.isDarkMode);
        
        // 초기 상태 설정 - CameraPlayer가 있으면 상태를 확인하여 적용
        if (this.cameraPlayer) {
            this.updateCameraButtonState(this.cameraPlayer.active);
        }
    }

    /**
     * CameraPlayer의 active 상태에 따라 모든 버튼의 상태를 업데이트하는 메서드
     * @param {boolean} isActive - 카메라 활성화 상태
     */
    updateCameraButtonState(isActive) {
        if (!this.cameraButton) return;
        
        this.cameraActive = isActive;
        
        // 카메라 버튼 활성화 상태 스타일 적용
        if (isActive) {
            // 모든 버튼 요소 가져오기
            const cameraButton = document.querySelector(".camera-device");
            const resetButton = document.querySelector(".reset-camera");
            const themeToggle = document.querySelector(".theme-toggle");
            const uploadButton = this.isMobile ? null : document.querySelector(".file-upload");
            
            // 다크모드에 따라 다른 배경색과 그림자 효과 적용
            const bgColor = this.isDarkMode 
                ? "rgba(0, 0, 0, 0.1)" 
                : "rgba(255, 255, 255, 0.1)";
            // const shadowColor = this.isDarkMode 
            //     ? "0 0 8px rgba(255, 255, 255, 0.6)" 
            //     : "0 0 8px rgba(0, 0, 0, 0.6)";
            
            // 모든 버튼에 그림자 효과 적용
            const buttons = [cameraButton, resetButton, themeToggle, uploadButton];
            buttons.forEach(button => {
                if (button) {
                    // button.style.boxShadow = shadowColor;
                    
                    // 카메라 버튼만 배경색과 다른 스타일 적용
                    if (button === cameraButton) {
                        button.style.backgroundColor = bgColor;
                        button.style.borderRadius = "4px";
                        button.style.opacity = "1";
                    }
                    
                    // SVG 아이콘에 그림자 효과 적용
                    const svgIcon = button.querySelector("svg");
                    if (svgIcon) {
                        svgIcon.style.filter = this.isDarkMode 
                            ? "drop-shadow(0 0 3px rgba(0, 0, 0, 1)) drop-shadow(0 0 2px rgba(0, 0, 0, 1))" 
                            : "drop-shadow(0 0 3px rgba(255, 255, 255, 1)) drop-shadow(0 0 2px rgba(255, 255, 255, 1))";
                    }
                }
            });
        } else {
            // 모든 버튼 요소 가져오기
            const cameraButton = document.querySelector(".camera-device");
            const resetButton = document.querySelector(".reset-camera");
            const themeToggle = document.querySelector(".theme-toggle");
            const uploadButton = this.isMobile ? null : document.querySelector(".file-upload");
            
            // 모든 버튼에서 그림자 효과 제거
            const buttons = [cameraButton, resetButton, themeToggle, uploadButton];
            buttons.forEach(button => {
                if (button) {
                    button.style.boxShadow = "none";
                    
                    // 카메라 버튼만 다른 스타일 적용
                    if (button === cameraButton) {
                        button.style.backgroundColor = "transparent";
                        button.style.opacity = "0.7";
                    }
                    
                    // SVG 아이콘의 그림자 효과 제거
                    const svgIcon = button.querySelector("svg");
                    if (svgIcon) {
                        svgIcon.style.filter = "none";
                    }
                }
            });
        }
    }

    /**
     * 카메라를 토글하는 메서드
     * @param {HTMLElement} button - 카메라 버튼 요소
     */
    toggleCamera(button) {
        if (!this.cameraPlayer) {
            console.warn("CameraPlayer not initialized");
            return;
        }

        // cameraPlayer의 toggleCamera 호출 (상태 업데이트는 setCameraPlayer에서 재정의한 함수에서 처리)
        this.cameraPlayer.toggleCamera();
    }

    /**
     * 테마를 업데이트하고 관련 UI 요소들의 스타일을 변경하는 메서드
     * @param {boolean} isDarkMode - 다크모드 여부
     */
    updateTheme(isDarkMode) {
        console.log("TopBar updateTheme called:", isDarkMode);
        console.log("TextPanel reference:", this.textPanel);
        console.log("ObjectListPanel reference:", this.objectListPanel);
        console.log("ModelSelector reference:", this.modelSelector);

        this.isDarkMode = isDarkMode;
        console.log("TopBar isDarkMode updated to:", this.isDarkMode);

        // TopBar 스타일 업데이트
        const topBar = document.querySelector(".top-bar");
        if (topBar) {
            const bgColor = isDarkMode
                ? "rgba(0, 0, 0, 0)"
                : "rgba(255, 255, 255, 0)";

            topBar.style.backgroundColor = bgColor;
            topBar.style.color = isDarkMode ? "#ffffff" : "#000000";
        }

        // Controls 토글 버튼 업데이트
        const controlsToggle = document.querySelector(".controls-toggle");
        if (controlsToggle) {
            controlsToggle.innerHTML = this.getControlsIcon(
                this.isOrbitControls
            );
        }

        // Reset 버튼 업데이트
        const cameraButton = document.querySelector(".camera-device");
        if (cameraButton) {
            cameraButton.innerHTML = this.getCameraIcon();
        }

        // Reset 버튼 업데이트
        const resetButton = document.querySelector(".reset-camera");
        if (resetButton) {
            resetButton.innerHTML = this.getResetIcon();
        }

        // Upload 버튼 업데이트
        const uploadButton = document.querySelector(".file-upload");
        if (uploadButton) {
            uploadButton.innerHTML = this.getUploadIcon();
        }

        // 전체 배경색 업데이트 - Constants 대신 하드코딩된 값 사용
        try {
            const darkBackground =
                Constants?.COLORS?.DARK_BACKGROUND?.toString(16) || "1a1a1a";
            const lightBackground =
                Constants?.COLORS?.LIGHT_BACKGROUND?.toString(16) || "ffffff";

            document.body.style.backgroundColor = isDarkMode
                ? `#${darkBackground}`
                : `#${lightBackground}`;
        } catch (error) {
            console.warn("Constants not available, using fallback colors");
            document.body.style.backgroundColor = isDarkMode
                ? "#1a1a1a"
                : "#ffffff";
        }

        // 전체 텍스트 색상 업데이트
        document.body.style.color = isDarkMode ? "#ffffff" : "#000000";

        // UI 요소들 업데이트
        const toolbar = document.querySelector(".viewer-toolbar");
        if (toolbar) {
            toolbar.style.backgroundColor = isDarkMode
                ? "rgba(40, 40, 40, 0)"
                : "rgba(255, 255, 255, 0)";
        }

        // TextPanel과 ObjectListPanel 테마 업데이트
        if (this.textPanel) {
            console.log("Updating TextPanel theme");
            this.textPanel.updateTheme(isDarkMode);
        }
        if (this.objectListPanel) {
            console.log("Updating ObjectListPanel theme");
            this.objectListPanel.updateTheme(isDarkMode);
        }
        if (this.modelSelector) {
            console.log("Updating ModelSelector theme");
            this.modelSelector.updateTheme(isDarkMode);
        }

        // CameraPlayer 테마 업데이트 추가
        if (this.cameraPlayer) {
            console.log("Updating CameraPlayer theme");
            this.cameraPlayer.updateTheme(isDarkMode);
        }
        
        // Toolbar 테마 업데이트 추가
        if (this.viewerState && this.viewerState.state && this.viewerState.state.liverViewer && this.viewerState.state.liverViewer.toolbar) {
            this.viewerState.state.liverViewer.toolbar.updateTheme(isDarkMode);
        }
        
        // FOV 슬라이더 테마 업데이트
        if (this.fovController) {
            this.fovController.updateTheme(isDarkMode);
        }
        
        // 테마 변경 시 카메라 상태에 따라 버튼 스타일 업데이트
        if (this.cameraActive) {
            this.updateCameraButtonState(true);
        }
    }

    /**
     * 상단 바의 스타일을 적용하는 메서드
     * @param {HTMLElement} topBar - 상단 바 DOM 요소
     */
    applyStyles(topBar) {
        const styles = document.createElement("style");

        styles.textContent = `
            .top-bar {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: ${this.isMobile ? "60px" : "70px"};
                background: rgba(0, 0, 0, 0.3);
                color: ${this.isDarkMode ? "#ffffff" : "#000000"};
                display: flex;
                align-items: center;
                padding: 0 ${this.isMobile ? "10px" : "20px"};
                z-index: ${
                    this.isMobile ? "9999" : "1000"
                };  /* 모바일에서 로고와 같은 최상위 z-index */
                pointer-events: auto;
            }

            .logo {
                height: 60px !important;
                width: 120px !important;
                object-fit: contain;
                transition: opacity 0.3s ease;
            }

            .logo-container {
                height: 100%;
                display: flex;
                align-items: center;
                padding: ${this.isMobile ? "5px" : "5px"};
                min-width: 100px;
            }

            #container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 0;
            }
        `;

        document.head.appendChild(styles);
    }

    /**
     * 현재 테마에 맞는 테마 아이콘 SVG를 반환하는 메서드
     * @param {boolean} isDarkMode - 다크모드 여부
     * @returns {string} SVG 문자열
     */
    getThemeIcon(isDarkMode) {
        const color = isDarkMode ? "#ffffff" : "#1a1a1a";
        const iconSize = this.isMobile ? "28" : "24";
        return isDarkMode
            ? // 다크모드일 때는 Sun 아이콘 (ToggleTheme_L.svg)
              `<svg id="a" data-name="ICONS" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}">
  <path d="M12,17.82c-3.21,0-5.82-2.61-5.82-5.82s2.61-5.82,5.82-5.82,5.82,2.61,5.82,5.82-2.61,5.82-5.82,5.82ZM12,7.18c-2.66,0-4.82,2.16-4.82,4.82s2.16,4.82,4.82,4.82,4.82-2.16,4.82-4.82-2.16-4.82-4.82-4.82Z" fill="${color}"/>
  <g>
    <path d="M12,4.56c-.28,0-.5-.22-.5-.5V1.79c0-.28.22-.5.5-.5s.5.22.5.5v2.27c0,.28-.22.5-.5.5Z" fill="${color}"/>
    <path d="M12,22.71c-.28,0-.5-.22-.5-.5v-2.27c0-.28.22-.5.5-.5s.5.22.5.5v2.27c0,.28-.22.5-.5.5Z" fill="${color}"/>
  </g>
  <g>
    <path d="M22.21,12.5h-2.27c-.28,0-.5-.22-.5-.5s.22-.5.5-.5h2.27c.28,0,.5.22.5.5s-.22.5-.5.5Z" fill="${color}"/>
    <path d="M4.06,12.5H1.79c-.28,0-.5-.22-.5-.5s.22-.5.5-.5h2.27c.28,0,.5.22.5.5s-.22.5-.5.5Z" fill="${color}"/>
  </g>
  <g>
    <path d="M6.39,6.89c-.13,0-.26-.05-.35-.15l-1.6-1.6c-.2-.2-.2-.51,0-.71s.51-.2.71,0l1.6,1.6c.2.2.2.51,0,.71-.1.1-.23.15-.35.15Z" fill="${color}"/>
    <path d="M19.22,19.72c-.13,0-.26-.05-.35-.15l-1.6-1.6c-.2-.2-.2-.51,0-.71s.51-.2.71,0l1.6,1.6c.2.2.2.51,0,.71-.1.1-.23.15-.35.15Z" fill="${color}"/>
  </g>
  <g>
    <path d="M17.61,6.89c-.13,0-.26-.05-.35-.15-.2-.2-.2-.51,0-.71l1.6-1.6c.2-.2.51-.2.71,0s.2.51,0,.71l-1.6,1.6c-.1.1-.23.15-.35.15Z" fill="${color}"/>
    <path d="M4.78,19.72c-.13,0-.26-.05-.35-.15-.2-.2-.2-.51,0-.71l1.6-1.6c.2-.2.51-.2.71,0s.2.51,0,.71l-1.6,1.6c-.1.1-.23.15-.35.15Z" fill="${color}"/>
  </g>
</svg>`
            : // 라이트모드일 때는 Moon 아이콘 (ToggleTheme_D.svg)
              `<svg id="a" data-name="ICONS" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}">
  <path d="M12.32,22.92c-.05,0-.1,0-.15,0-3.31-.05-6.38-1.6-8.43-4.26C1.58,15.85.83,12.27,1.69,8.82,3.14,3,8.62,1.47,10.91,1.09c.43-.07.84.11,1.08.47.24.36.24.81,0,1.17-.88,1.35-1.31,2.93-1.26,4.56.13,4.08,3.56,7.51,7.65,7.63.99.04,1.94-.11,2.85-.43.4-.14.83-.04,1.12.27.3.31.39.76.23,1.16-1.64,4.21-5.75,7-10.26,7ZM11.07,2.08c-2.6.44-7.15,1.92-8.41,6.98-.79,3.15-.1,6.43,1.87,8.99,1.86,2.42,4.65,3.83,7.65,3.87,4.14.02,7.95-2.5,9.46-6.37h0s0-.08-.02-.1c-1.1.34-2.18.5-3.29.47-4.6-.14-8.46-4-8.61-8.6-.06-1.83.43-3.61,1.42-5.13l-.08-.12Z" fill="${color}"/>
</svg>`;
    }

    /**
     * 현재 테마에 맞는 리셋 아이콘 SVG를 반환하는 메서드
     * @returns {string} SVG 문자열
     */
    getResetIcon() {
        const color = this.isDarkMode ? "#ffffff" : "#1a1a1a";
        const iconSize = this.isMobile ? "28" : "24";
        return `<svg id="a" data-name="ICONS" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}">
  <g>
    <path d="M1.55,9.23c-.28,0-.5-.22-.5-.5V2.72c0-.92.75-1.67,1.67-1.67h6.19c.28,0,.5.22.5.5s-.22.5-.5.5H2.72c-.37,0-.67.3-.67.67v6.02c0,.28-.22.5-.5.5Z" fill="${color}"/>
    <path d="M21.28,22.95h-5.62c-.28,0-.5-.22-.5-.5s.22-.5.5-.5h5.62c.37,0,.67-.3.67-.67v-5.79c0-.28.22-.5.5-.5s.5.22.5.5v5.79c0,.92-.75,1.67-1.67,1.67Z" fill="${color}"/>
    <path d="M8.51,22.95H2.72c-.92,0-1.67-.75-1.67-1.67v-6.19c0-.28.22-.5.5-.5s.5.22.5.5v6.19c0,.37.3.67.67.67h5.79c.28,0,.5.22.5.5s-.22.5-.5.5Z" fill="${color}"/>
    <path d="M22.45,8.84c-.28,0-.5-.22-.5-.5V2.72c0-.37-.3-.67-.67-.67h-5.62c-.28,0-.5-.22-.5-.5s.22-.5.5-.5h5.62c.92,0,1.67.75,1.67,1.67v5.62c0,.28-.22.5-.5.5Z" fill="${color}"/>
  </g>
  <g>
    <path d="M12,19.32c-.07,0-.14-.02-.2-.05l-6.06-3.49c-.12-.07-.2-.2-.2-.35v-6.86h.8v6.62l5.66,3.26,5.66-3.26v-6.62h.8v6.86c0,.14-.08.28-.2.35l-6.06,3.49c-.06.04-.13.05-.2.05Z" fill="${color}"/>
    <rect x="11.72" y="12.06" width=".8" height="6.86" fill="${color}"/>
    <path d="M12,12.46c-.07,0-.14-.02-.2-.05l-6.06-3.49c-.12-.07-.2-.2-.2-.35s.08-.28.2-.35l6.06-3.49c.12-.07.28-.07.4,0l6.06,3.49c.12.07.2.2.2.35s-.08.28-.2.35l-6.06,3.49c-.06.04-.13.05-.2.05ZM6.74,8.57l5.26,3.03,5.26-3.03-5.26-3.03-5.26,3.03Z" fill="${color}"/>
  </g>
</svg>`;
    }

    /**
     * 카메라 아이콘 SVG를 반환하는 메서드
     * @returns {string} SVG 문자열
     */
    getCameraIcon() {
        const color = this.isDarkMode ? "#ffffff" : "#1a1a1a";
        const iconSize = this.isMobile ? "28" : "24";
        return `<svg id="a" data-name="ICONS" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}">
  <path d="M17.05,20.03H2.59c-.92,0-1.67-.75-1.67-1.67V5.64c0-.92.75-1.67,1.67-1.67h14.46c.92,0,1.67.75,1.67,1.67v12.72c0,.92-.75,1.67-1.67,1.67ZM2.59,4.97c-.37,0-.67.3-.67.67v12.72c0,.37.3.67.67.67h14.46c.37,0,.67-.3.67-.67V5.64c0-.37-.3-.67-.67-.67H2.59Z" fill="${color}"/>
  <path d="M21.99,17.68c-.18,0-.37-.05-.54-.14l-3.49-1.98c-.16-.09-.25-.25-.25-.43v-6.24c0-.18.1-.35.25-.43l3.49-1.98c.34-.19.74-.19,1.08,0,.34.2.54.55.54.94v9.19c0,.39-.2.74-.54.94-.17.1-.36.15-.54.15ZM18.72,14.83l3.23,1.84.12-.07V7.41s-.01-.06-.04-.07l-3.32,1.84v5.66Z" fill="${color}"/>
</svg>`;
    }

    // 파일 업로드 아이콘 SVG 반환 메서드 추가
    getUploadIcon() {
        const color = this.isDarkMode ? "#ffffff" : "#1a1a1a";
        const iconSize = this.isMobile ? "28" : "24";
        return `<svg id="a" data-name="ICONS" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}">
  <path d="M11.25,21.25c-.28,0-.5-.22-.5-.5V2.75c0-.28.22-.5.5-.5s.5.22.5.5v18c0,.28-.22.5-.5.5Z" fill="${color}"/>
  <path d="M20.25,12.25H2.25c-.28,0-.5-.22-.5-.5s.22-.5.5-.5h18c.28,0,.5.22.5.5s-.22.5-.5.5Z" fill="${color}"/>
</svg>`;
    }

    // 모바일 상태 변경 감지 및 업로드 버튼 동적 제거/추가
    setupMobileDetection() {
        let currentIsMobile = this.isMobile;
        let uploadButton = document.querySelector(".file-upload");

        const updateUploadButtonVisibility = () => {
            const newIsMobile = this.detectMobile();
            if (newIsMobile !== currentIsMobile) {
                currentIsMobile = newIsMobile;
                if (uploadButton) {
                    if (newIsMobile) {
                        uploadButton.remove();
                        console.log('TopBar - Removed upload button (mobile mode)');
                    } else {
                        document.body.insertBefore(uploadButton, document.body.firstChild);
                        console.log('TopBar - Added upload button (desktop mode)');
                    }
                }
            }
        };

        // 초기 실행
        updateUploadButtonVisibility();

        // 뷰포트 크기 변경 감지
        window.addEventListener("resize", updateUploadButtonVisibility);

        // 모바일 상태 변경 감지 (터치 지원 여부 변경)
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const touchMediaQuery = window.matchMedia('(hover: none)');

        const updateTouchSupport = () => {
            const newHasTouch = hasTouch || navigator.maxTouchPoints > 0;
            if (newHasTouch !== hasTouch) {
                hasTouch = newHasTouch;
                updateUploadButtonVisibility();
            }
        };

        updateTouchSupport(); // 초기 실행
        touchMediaQuery.addEventListener("change", updateTouchSupport);
    }

}
