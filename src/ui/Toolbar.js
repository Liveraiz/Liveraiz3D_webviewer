// ui/Toolbar.js
import SeeThrough from "../functions/seeThrough";
import * as THREE from "three";

export default class Toolbar {
    constructor(options) {
        this.materialManager = options.materialManager;
        this.scene = options.scene;
        this.camera = options.camera;
        this.renderer = options.renderer;
        this.toggleDarkMode = options.toggleDarkMode;
        this.isMobile = options.isMobile;
        this.modelLoader = options.modelLoader;
        this.modelSelector = options.modelSelector;
        this.meshTransform = options.meshTransform;
        this.liverViewer = options.liverViewer;
        this.meshes = options.meshes;
        this.measurementTool = options.measurementTool;

        this.isPlaying = true;
        this.animationButton = null;

        this.seeThrough = new SeeThrough(
            this.scene,
            this.camera,
            this.renderer.renderer
        );

        this.seeThroughSizeControls = null;
        this.currentSeeThroughSize = "medium"; // default size

        this.activeModeButton = null;
        this.activeMeasurementButton = null;
        this.transformControlsContainer = null;

        this.initialize();
    }

    initialize() {
        this.toolbar = this.createToolbarContainer();
        this.initializeButtons();
        document.body.appendChild(this.toolbar);
        this.setupTransformControls();
    }

    /**
     * 버튼에 기본 스타일을 적용하는 함수
     * @param {HTMLElement} button - 스타일을 적용할 버튼 요소
     * @param {boolean} isActive - 버튼의 활성화 상태
     */
    applyButtonStyle(button, isActive = false, isDarkMode = null) {
        // 다크모드 상태 확인 - 여러 방법으로 확인
        let currentIsDarkMode = false;
        
        // 1. 전달받은 isDarkMode 값 사용
        if (isDarkMode !== null) {
            currentIsDarkMode = isDarkMode;
        }
        // 2. liverViewer에서 확인
        else if (this.liverViewer && this.liverViewer.isDarkMode !== undefined) {
            currentIsDarkMode = this.liverViewer.isDarkMode;
        }
        // 2.5. liverViewer가 없으면 viewerState에서 확인
        else if (this.liverViewer && this.liverViewer.viewerState && this.liverViewer.viewerState.state) {
            currentIsDarkMode = this.liverViewer.viewerState.state.isDarkMode;
        }
        // 3. body 클래스에서 확인
        else if (document.body.classList.contains('dark-mode')) {
            currentIsDarkMode = true;
        }
        // 4. 배경색으로 확인
        else {
            // document.body는 투명할 수 있으므로 html 요소의 배경색도 확인
            const bodyColor = getComputedStyle(document.body).backgroundColor;
            const htmlColor = getComputedStyle(document.documentElement).backgroundColor;
            
            // 실제 배경색 결정 (투명하지 않은 색상 우선)
            let actualColor = bodyColor;
            if (bodyColor === 'rgba(0, 0, 0, 0)' || bodyColor === 'transparent') {
                actualColor = htmlColor;
            }
            
            // 라이트모드: rgb(255, 255, 255) 또는 #ffffff
            // 다크모드: rgb(26, 26, 26) 또는 #1a1a1a
            if (actualColor.includes('255, 255, 255') || actualColor.includes('#ffffff')) {
                currentIsDarkMode = false;
            } else if (actualColor.includes('26, 26, 26') || actualColor.includes('#1a1a1a')) {
                currentIsDarkMode = true;
            } else {
                // fallback: brightness 계산 (투명하지 않은 색상만)
                if (actualColor !== 'rgba(0, 0, 0, 0)' && actualColor !== 'transparent') {
                    const rgb = actualColor.match(/\d+/g);
                    if (rgb && rgb.length >= 3) {
                        const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
                        currentIsDarkMode = brightness < 128;
                    }
                } else {
                    // 투명한 경우 기본값 사용
                    currentIsDarkMode = false; // 기본적으로 라이트모드로 가정
                }
            }
        }
        
        const baseStyle = {
            padding: this.isMobile ? "0.4rem" : "0.3rem",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: this.isMobile ? "44px" : "34px",
            height: this.isMobile ? "44px" : "34px",
            transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
            margin: this.iMobile ? "2px" : "2px",
            flexShrink: 0,
            zIndex: "901",
            position: "relative",
            transform: "scale(1)",
        };

        // 다크모드에 따른 스타일 분기
        const inactiveStyle = {
            ...baseStyle,
            backgroundColor: currentIsDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.9)",
            color: currentIsDarkMode ? "#ffffff" : "#000000",
            boxShadow: currentIsDarkMode ? "0 2px 4px rgba(255,255,255,0.1)" : "0 2px 4px rgba(0,0,0,0.1)",
        };

        const activeStyle = {
            ...baseStyle,
            backgroundColor: currentIsDarkMode ? "rgba(147, 51, 234, 0.7)" : "rgba(147, 51, 234, 0.8)", // 로고와 어울리는 퍼플 색상
            color: "#ffffff",
            boxShadow: currentIsDarkMode ? "0 4px 8px rgba(147,51,234,0.3)" : "0 4px 8px rgba(147,51,234,0.4)",
        };



        // Transform control 버튼들에 대한 특별한 스타일 (다크모드일 때 진한 회색)
        const isTransformButton = button.id === "translation-mode" || 
                                 button.id === "rotation-mode" || 
                                 button.id === "origin-position";
        
        if (isTransformButton && currentIsDarkMode) {
            // 다크모드에서 transform control 버튼들은 진한 회색 배경
            const transformInactiveStyle = {
                ...baseStyle,
                backgroundColor: "#404040", // opacity 없는 진한 회색
                color: "#ffffff",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            };
            
            const transformActiveStyle = {
                ...baseStyle,
                backgroundColor: "#606060", // 활성화 시 더 밝은 회색
                color: "#ffffff",
                boxShadow: "0 4px 8px rgba(0,0,0,0.4)",
            };
            
            Object.assign(button.style, isActive ? transformActiveStyle : transformInactiveStyle);
        } else {
            // 일반 버튼들은 기존 스타일 적용
            Object.assign(button.style, isActive ? activeStyle : inactiveStyle);
        }

        // Hover 효과를 CSS로 처리 (SVG 원본 보호)
        if (!button.hasHoverEffect) {
            // CSS 스타일을 직접 추가
            const style = document.createElement('style');
            style.id = `hover-style-${button.id}`;
            style.textContent = `
                #${button.id}:hover {
                    background: rgba(147, 51, 234, 0.8) !important;
                    color: #ffffff !important;
                    box-shadow: 0 4px 8px rgba(147, 51, 234, 0.4) !important;
                    transform: scale(1.05) !important;
                }
                #${button.id}:hover svg {
                    filter: brightness(0) invert(1) !important;
                }
            `;
            document.head.appendChild(style);
            button.hasHoverEffect = true;
        }

        if (!button.hasClickAnimation) {
            if (this.isMobile) {
                // 터치 이벤트에 대한 애니메이션
                button.addEventListener("touchstart", () => {
                    button.style.transform = "scale(0.9)";
                });

                button.addEventListener("touchend", () => {
                    button.style.transform = "scale(1)";
                });

                button.addEventListener("touchcancel", () => {
                    button.style.transform = "scale(1)";
                });
            } else {
                // 마우스 이벤트에 대한 애니메이션
                button.addEventListener("mousedown", () => {
                    button.style.transform = "scale(0.9)";
                });

                button.addEventListener("mouseup", () => {
                    button.style.transform = "scale(1)";
                });

                button.addEventListener("mouseleave", () => {
                    button.style.transform = "scale(1)";
                });
            }

            button.hasClickAnimation = true;
        }
    }

    /**
     * 툴바 컨테이너를 생성하고 초기 설정하는 함수
     * @returns {HTMLElement} 생성된 툴바 컨테이너
     */
    createToolbarContainer() {
        const container = document.createElement("div");
        Object.assign(container.style, {
            position: "fixed",
            bottom: "2rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: "900",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            borderRadius: "0.5rem",
            padding: "0.5rem",
            boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
            transition: "all 0.3s ease",
        });

        // 반응형 레이아웃을 위한 스타일 적용 함수
        const applyResponsiveLayout = () => {
            const windowWidth = window.innerWidth;

            if (windowWidth <= 480) {
                Object.assign(container.style, {
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "6px",
                    maxWidth: "calc(100vw - 2rem)",
                });
            } else if (windowWidth <= 768) {
                Object.assign(container.style, {
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "10px",
                    maxWidth: "90vw",
                });
            } else {
                Object.assign(container.style, {
                    display: "flex",
                    flexDirection: "row",
                    gap: "20px",
                    maxWidth: "none",
                });
            }
        };

        applyResponsiveLayout();
        window.addEventListener("resize", applyResponsiveLayout);

        this.sliderContainer = document.createElement("div");
        Object.assign(this.sliderContainer.style, {
            width: "100%",
            marginTop: "0.5rem",
            marginBottom: "0.5rem",
            display: "none",
            position: "relative",
            gridColumn: "1 / -1",
        });

        this.timeSlider = document.createElement("input");
        this.timeSlider.type = "range";
        this.timeSlider.min = "0";
        this.timeSlider.max = "100";
        this.timeSlider.value = "0";
        Object.assign(this.timeSlider.style, {
            width: "100%",
            margin: "0",
            cursor: "pointer",
        });

        this.sliderContainer.appendChild(this.timeSlider);
        container.appendChild(this.sliderContainer);

        this.toolbar = container;
        return container;
    }

    /**
     * 툴바 버튼을 생성하는 함수
     * @param {string} icon - 버튼에 표시될 아이콘 SVG
     * @param {string} title - 버튼의 툴팁 텍스트
     * @param {string} id - 버튼의 고유 ID
     * @returns {HTMLElement} 생성된 버튼 요소
     */
    createToolbarButton(icon, title, id) {
        const button = document.createElement("button");
        button.id = id;
        button.title = title;
        button.innerHTML = icon;

        // 기본 스타일 적용
        this.applyButtonStyle(button);

        // 호버 효과
        button.addEventListener("mouseenter", () => {
            if (!button.classList.contains("active")) {
                this.applyButtonStyle(button, true);
            }
        });

        button.addEventListener("mouseleave", () => {
            if (!button.classList.contains("active")) {
                this.applyButtonStyle(button);
            }
        });

        return button;
    }

    /**
     * Transform 컨트롤 관련 UI를 설정하는 함수
     * 이동, 회전, 위치 초기화 버튼을 포함
     */
    setupTransformControls() {
        // Transform 컨트롤 컨테이너 생성
        this.transformControlsContainer = document.createElement("div");

        const baseStyles = {
            display: "none",
            position: "fixed",
            zIndex: "900",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            borderRadius: "0.5rem",
            padding: "0.5rem",
            boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
            gap: "5px",
            transition: "transform 0.1s ease",
            pointerEvents: "auto",
        };

        // 모바일 환경일 때 스타일 조정
        if (this.isMobile) {
            Object.assign(baseStyles, {
                bottom: "5rem", // 기존 툴바 위에 위치
                left: "50%",
                transform: "translateX(-50%)",
                display: "none",
                flexDirection: "row",
                justifyContent: "center",
                width: "auto",
                maxWidth: "calc(100% - 2rem)",
            });
        }

        Object.assign(this.transformControlsContainer.style, baseStyles);

        // Translation Mode Button with mobile optimization
        const translationModeButton = this.createButton(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${
                this.isMobile ? "30" : "28"
            }" height="${
                this.isMobile ? "30" : "28"
            }" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14.04,5.26c-.13,0-.26-.05-.35-.15l-1.69-1.69-1.69,1.69c-.2.2-.51.2-.71,0s-.2-.51,0-.71l2.04-2.04c.2-.2.51-.2.71,0l2.04,2.04c.2.2.2.51,0,.71-.1.1-.23.15-.35.15Z"/>
                <path d="M4.58,21.78s-.09,0-.13-.02l-2.79-.75c-.27-.07-.42-.35-.35-.61l.75-2.79c.07-.27.35-.42.61-.35.27.07.42.35.35.61l-.62,2.3,2.31.62c.27.07.42.35.35.61-.06.22-.26.37-.48.37Z"/>
                <path d="M19.42,21.78c-.22,0-.42-.15-.48-.37-.07-.27.09-.54.35-.61l2.31-.62-.62-2.3c-.07-.27.09-.54.35-.61.27-.07.54.09.61.35l.75,2.79c.07.27-.09.54-.35.61l-2.79.75s-.09.02-.13.02Z"/>
                <path d="M12,15.1c-.28,0-.5-.22-.5-.5V2.82c0-.28.22-.5.5-.5s.5.22.5.5v11.79c0,.28-.22.5-.5.5Z"/>
                <path d="M22.21,21c-.08,0-.17-.02-.25-.07l-9.96-5.75-9.96,5.75c-.24.14-.54.06-.68-.18-.14-.24-.06-.54.18-.68l10.21-5.9c.15-.09.35-.09.5,0l10.21,5.9c.24.14.32.44.18.68-.09.16-.26.25-.43.25Z"/>
            </svg>`,
            "Translation Mode",
            "translation-mode"
        );

        // Rotation Mode Button with mobile optimization
        const rotationModeButton = this.createButton(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${
                this.isMobile ? "30" : "24"
            }" height="${
                this.isMobile ? "30" : "24"
            }" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,22.66c-2.6,0-4.64-4.68-4.64-10.66S9.4,1.34,12,1.34s4.64,4.68,4.64,10.66-2.04,10.66-4.64,10.66ZM12,2.34c-1.72,0-3.64,3.96-3.64,9.66s1.92,9.66,3.64,9.66,3.64-3.96,3.64-9.66-1.92-9.66-3.64-9.66Z"/>
                <path d="M12,16.64c-5.98,0-10.66-2.04-10.66-4.64s4.68-4.64,10.66-4.64,10.66,2.04,10.66,4.64-4.68,4.64-10.66,4.64ZM12,8.36c-5.69,0-9.66,1.92-9.66,3.64s3.97,3.64,9.66,3.64,9.66-1.92,9.66-3.64-3.97-3.64-9.66-3.64Z"/>
            </svg>`,
            "Rotation Mode",
            "rotation-mode"
        );

        // Position Reset Button with mobile optimization
        const positionResetModeButton = this.createButton(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${
                this.isMobile ? "30" : "24"
            }" height="${
                this.isMobile ? "30" : "24"
            }" viewBox="0 0 24 24" fill="currentColor">
                <g>
                    <path d="M1.55,9.23c-.28,0-.5-.22-.5-.5V2.72c0-.92.75-1.67,1.67-1.67h6.19c.28,0,.5.22.5.5s-.22.5-.5.5H2.72c-.37,0-.67.3-.67.67v6.02c0,.28-.22.5-.5.5Z"/>
                    <path d="M21.28,22.95h-5.62c-.28,0-.5-.22-.5-.5s.22-.5.5-.5h5.62c.37,0,.67-.3.67-.67v-5.79c0-.28.22-.5.5-.5s.5.22.5.5v5.79c0,.92-.75,1.67-1.67,1.67Z"/>
                    <path d="M8.51,22.95H2.72c-.92,0-1.67-.75-1.67-1.67v-6.19c0-.28.22-.5.5-.5s.5.22.5.5v6.19c0,.37.3.67.67.67h5.79c.28,0,.5.22.5.5s-.22.5-.5.5Z"/>
                    <path d="M22.45,8.84c-.28,0-.5-.22-.5-.5V2.72c0-.37-.3-.67-.67-.67h-5.62c-.28,0-.5-.22-.5-.5s.22-.5.5-.5h5.62c.92,0,1.67.75,1.67,1.67v5.62c0,.28-.22.5-.5.5Z"/>
                </g>
                <g>
                    <path d="M12,19.32c-.07,0-.14-.02-.2-.05l-6.06-3.49c-.12-.07-.2-.2-.2-.35v-6.86h.8v6.62l5.66,3.26,5.66-3.26v-6.62h.8v6.86c0,.14-.08.28-.2.35l-6.06,3.49c-.06.04-.13.05-.2.05Z"/>
                    <rect x="11.72" y="12.06" width=".8" height="6.86"/>
                    <path d="M12,12.46c-.07,0-.14-.02-.2-.05l-6.06-3.49c-.12-.07-.2-.2-.2-.35s.08-.28.2-.35l6.06-3.49c.12-.07.28-.07.4,0l6.06,3.49c.12.07.2.2.2.35s-.08.28-.2.35l-6.06,3.49c-.06.04-.13.05-.2.05ZM6.74,8.57l5.26,3.03,5.26-3.03-5.26-3.03-5.26,3.03Z"/>
                </g>
            </svg>`,
            "Initial Position",
            "origin-position"
        );

        // ID 설정
        positionResetModeButton.id = "origin-position";

        // 터치 이벤트 처리 개선
        const addTouchSupport = (button) => {
            button.addEventListener(
                "touchstart",
                (e) => {
                    e.preventDefault();
                    button.style.transform = "scale(0.9)";
                },
                { passive: false }
            );

            button.addEventListener(
                "touchend",
                (e) => {
                    e.preventDefault();
                    button.style.transform = "scale(1)";
                    button.click(); // 터치 종료 시 클릭 이벤트 발생
                },
                { passive: false }
            );

            // 터치 취소 시 스케일 복구
            button.addEventListener("touchcancel", () => {
                button.style.transform = "scale(1)";
            });
        };

        // 모바일 터치 이벤트 추가
        if (this.isMobile) {
            [
                translationModeButton,
                rotationModeButton,
                positionResetModeButton,
            ].forEach(addTouchSupport);
        }

        // 버튼 이벤트 설정
        translationModeButton.onclick = () => {
            this.toggleModeButton(translationModeButton, () => {
                this.meshTransform.setTranslateMode();
            });
        };

        rotationModeButton.onclick = () => {
            this.toggleModeButton(rotationModeButton, () => {
                this.meshTransform.setRotateMode();
            });
        };

        positionResetModeButton.onclick = () => {
            // 활성화된 transform mode 버튼들을 모두 비활성화
            if (this.activeModeButton) {
                console.log("Deactivating active transform mode button:", this.activeModeButton.className);
                this.activeModeButton.classList.remove("active");
                this.applyButtonStyle(this.activeModeButton, false, this.liverViewer?.isDarkMode);
                this.activeModeButton = null;
                
                // transform mode 해제
                if (this.meshTransform && this.meshTransform.setViewMode) {
                    console.log("Setting view mode after position reset");
                    this.meshTransform.setViewMode();
                }
            }
            
            // 임시 효과 적용 및 기능 실행
            this.applyTemporaryEffect(positionResetModeButton);
            this.meshTransform.resetToOrigin();
            this.meshTransform.unhighlightAllMeshes();
        };

        // 버튼 컨테이너에 버튼 추가
        const buttonContainer = document.createElement("div");
        buttonContainer.style.display = "flex";
        buttonContainer.style.gap = this.isMobile ? "10px" : "5px";
        buttonContainer.appendChild(translationModeButton);
        buttonContainer.appendChild(rotationModeButton);
        buttonContainer.appendChild(positionResetModeButton);
        this.transformControlsContainer.appendChild(buttonContainer);

        document.body.appendChild(this.transformControlsContainer);

        if (this.meshTransform) {
            this.meshTransform.setOnSelectCallback((selectedObject) => {
                if (
                    selectedObject &&
                    selectedObject.name &&
                    selectedObject.name.includes("mov")
                ) {
                    this.transformControlsContainer.style.display = "flex";

                    // Hide measurement buttons on mobile when transform controls are active
                    if (this.isMobile) {
                        this.toggleButtonsVisibility(false);
                    }

                    if (!this.isMobile) {
                        this.updateControlsPosition(selectedObject);
                    }
                } else {
                    this.transformControlsContainer.style.display = "none";

                    // Show measurement buttons on mobile when transform controls are inactive
                    if (this.isMobile) {
                        this.toggleButtonsVisibility(true);
                    }

                    if (this.activeModeButton) {
                        this.activeModeButton.classList.remove("active");
                        this.applyButtonStyle(this.activeModeButton);
                        this.activeModeButton = null;
                        this.meshTransform.setViewMode();
                    }
                }
            });

            // 카메라 변화를 감지하여 버튼 위치 업데이트 (데스크톱에서만)
            if (!this.isMobile && this.meshTransform.orbitControls) {
                this.meshTransform.orbitControls.addEventListener(
                    "change",
                    () => {
                        if (this.meshTransform.selectedMesh) {
                            this.updateControlsPosition(
                                this.meshTransform.selectedMesh
                            );
                        }
                    }
                );
            }
        }

        // 업데이트 루프 시작 (데스크톱에서만)
        if (!this.isMobile) {
            this.startUpdating();
        }
        
        // HDRI 회전 컨트롤 추가
        // this.createHDRIrotationControls();
    }

    /**
     * Transform 컨트롤의 위치를 선택된 메시 기준으로 업데이트하는 함수
     * @param {THREE.Mesh} mesh - 선택된 3D 메시 객체
     */
    updateControlsPosition(mesh) {
        if (
            !mesh ||
            !this.camera ||
            !this.renderer ||
            !this.renderer.renderer ||
            !this.renderer.renderer.domElement ||
            this.transformControlsContainer.style.display === "none"
        ) {
            return;
        }

        const vector = new THREE.Vector3();

        // 메시의 중심점 계산
        const boundingBox = new THREE.Box3().setFromObject(mesh);
        const center = boundingBox.getCenter(new THREE.Vector3());

        // 월드 좌표를 화면 좌표로 변환
        vector.copy(center);
        vector.project(this.camera);

        // 뷰포트 좌표를 픽셀 좌표로 변환
        const x =
            (vector.x * 0.5 + 0.5) *
            this.renderer.renderer.domElement.clientWidth;
        const y =
            (-vector.y * 0.5 + 0.5) *
            this.renderer.renderer.domElement.clientHeight;

        const containerRect =
            this.transformControlsContainer.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let newX = x + 200; //(windowWidth * 2) / 3; 기본적으로 Mesh 우측에 표시
        let newY = y - containerRect.height / 2; // 수직 중앙 정렬

        // 화면 경계 체크 및 조정
        if (newX + containerRect.width > windowWidth) {
            newX = x - containerRect.width - 200; // Mesh 좌측에 표시
        }
        if (newY + containerRect.height > windowHeight) {
            newY = windowHeight - containerRect.height - 10;
        }
        if (newY < 10) {
            newY = 10;
        }

        this.transformControlsContainer.style.transform = `translate(${newX}px, ${newY}px)`;
    }

    startUpdating() {
        const update = () => {
            if (this.meshTransform && this.meshTransform.selectedMesh) {
                this.updateControlsPosition(this.meshTransform.selectedMesh);
            }
            requestAnimationFrame(update);
        };
        update();
    }

    /**
     * Transform 모드 버튼의 상태를 토글하는 함수
     * @param {HTMLElement} button - 토글할 버튼 요소
     * @param {Function} mode - 버튼 활성화시 실행할 모드 함수
     */
    toggleModeButton(button, mode) {
        // origin-position 버튼이 눌린 경우 특별 처리
        if (button.id === "origin-position") {
            // 활성화된 transform mode 버튼이 있다면 비활성화
            if (this.activeModeButton) {
                this.activeModeButton.classList.remove("active");
                this.applyButtonStyle(this.activeModeButton, false, this.liverViewer?.isDarkMode);
                this.activeModeButton = null;
                
                // transform mode 해제
                if (this.meshTransform && this.meshTransform.setViewMode) {
                    this.meshTransform.setViewMode();
                }
            }
            
            // origin-position 버튼은 활성화하지 않음 (일회성 기능)
            return;
        }
        
        if (this.activeModeButton === button) {
            // 현재 활성화된 버튼을 다시 클릭한 경우
            button.classList.remove("active");
            this.applyButtonStyle(button);
            this.activeModeButton = null;
            // 모드 해제 전에 현재 모드 확인
            if (this.meshTransform && this.meshTransform.setViewMode) {
                this.meshTransform.setViewMode(); // 모드 해제
            }
        } else {
            // 다른 버튼 활성화
            if (this.activeModeButton) {
                this.activeModeButton.classList.remove("active");
                
                // 이전 버튼 스타일 강제 적용
                this.applyButtonStyle(this.activeModeButton, false, this.liverViewer?.isDarkMode);
                
                // 이전 모드 해제
                if (this.meshTransform && this.meshTransform.setViewMode) {
                    this.meshTransform.setViewMode();
                }
            }
            button.classList.add("active");
            
            // 새 버튼 스타일 강제 적용
            this.applyButtonStyle(button, true, this.liverViewer?.isDarkMode);
            
            this.activeModeButton = button;
            // 새로운 모드 설정
            if (mode && typeof mode === 'function') {
                mode();
            }
        }
    }

    /**
     * 측정 도구 버튼의 상태를 토글하는 함수
     * @param {HTMLElement} button - 토글할 버튼 요소
     * @param {Function} enableFn - 활성화시 실행할 함수
     * @param {Function} disableFn - 비활성화시 실행할 함수
     */
    toggleMeasurementButton(button, enableFn, disableFn) {
        if (this.activeMeasurementButton === button) {
            // 현재 활성화된 버튼을 다시 클릭한 경우
            button.classList.remove("active");
            this.applyButtonStyle(button);
            this.activeMeasurementButton = null;
            disableFn();
        } else {
            // 다른 측정 버튼이 활성화되어 있었다면 비활성화
            if (this.activeMeasurementButton) {
                this.activeMeasurementButton.classList.remove("active");
                this.applyButtonStyle(this.activeMeasurementButton);
                if (
                    this.activeMeasurementButton ===
                        this.distanceMeasurementButton ||
                    this.activeMeasurementButton === this.angleMeasurementButton
                ) {
                    this.measurementTool.disableMeasurementMode();
                } else if (
                    this.activeMeasurementButton === this.seeThroughButton
                ) {
                    this.seeThrough.disableSeeThroughMode();
                }
            }
            button.classList.add("active");
            this.applyButtonStyle(button, true);
            this.activeMeasurementButton = button;
            enableFn();
        }
    }

    // Add new methods to control button visibility
    showAllButtons() {
        if (this.buttonContainer) {
            this.buttonContainer.style.display = "contents";
        }
        if (this.measurementContainer) {
            this.measurementContainer.style.display = "contents";
        }
    }

    hideAllButtons() {
        if (this.buttonContainer) {
            this.buttonContainer.style.display = "none";
        }
        if (this.measurementContainer) {
            this.measurementContainer.style.display = "none";
        }
    }

    toggleButtonsVisibility(show) {
        if (show) {
            this.showAllButtons();
        } else {
            this.hideAllButtons();
        }
    }

    // 일시적 버튼 효과
    applyTemporaryEffect(button) {
        this.applyButtonStyle(button, true);
        setTimeout(() => {
            this.applyButtonStyle(button);
        }, 200);
    }

    // Seethrough 크기 컨트롤 관련 메서드들
    /**
     * 시스루 모드의 크기 조절 컨트롤을 생성하는 함수
     * @returns {HTMLElement} 생성된 크기 조절 컨트롤 컨테이너
     */
    createSeeThroughSizeControls() {
        const controls = document.createElement("div");
        Object.assign(controls.style, {
            position: "fixed",
            display: "flex",
            flexDirection: "row",
            gap: "5px",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            borderRadius: "0.5rem",
            padding: "0.5rem",
            boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
            zIndex: "1000",
        });

        const sizes = [
            { name: "small", radius: 10, circleSize: 8 },
            { name: "medium", radius: 20, circleSize: 14 },
            { name: "large", radius: 30, circleSize: 20 },
        ];

        sizes.forEach((size) => {
            const button = this.createSizeButton(size);
            controls.appendChild(button);
        });

        return controls;
    }

    createSizeButton({ name, radius, circleSize }) {
        const button = document.createElement("button");

        // 기본 버튼 스타일 적용
        this.applyButtonStyle(button);

        // 원 아이콘 추가
        const circle = document.createElement("div");
        Object.assign(circle.style, {
            width: `${circleSize}px`,
            height: `${circleSize}px`,
            backgroundColor: "#00ffff",
            borderRadius: "50%",
            transition: "background-color 0.2s ease",
        });

        button.appendChild(circle);

        // 클릭 이벤트 설정
        button.onclick = () => {
            // 현재 컨테이너의 모든 버튼 비활성화
            if (this.seeThroughSizeControls) {
                const allButtons =
                    this.seeThroughSizeControls.querySelectorAll("button");
                allButtons.forEach((btn) => {
                    this.applyButtonStyle(btn);
                });
            }

            // 클릭된 버튼만 활성화
            button.style.backgroundColor = "rgba(52, 152, 219, 0.7)";

            // seeThrough 반경 업데이트
            this.seeThrough.updateSphereRadius(radius);
            this.currentSeeThroughSize = name;

            // 크기 선택 후 컨트롤 숨기기
            this.hideSeeThroughSizeControls();
        };

        // 현재 선택된 크기와 일치하면 활성화 상태로 설정
        if (name === this.currentSeeThroughSize) {
            button.style.backgroundColor = "rgba(52, 152, 219, 0.7)";
        }

        return button;
    }

    removeSeeThroughSizeButtons() {
        if (
            this.seeThroughSizeControls &&
            this.seeThroughSizeControls.parentElement
        ) {
            this.seeThroughSizeControls.parentElement.removeChild(
                this.seeThroughSizeControls
            );
        }
    }

    updateSizeButtonsStyle() {
        if (!this.seeThroughSizeControls) return;

        const buttons =
            this.seeThroughSizeControls.getElementsByTagName("button");
        Array.from(buttons).forEach((btn, index) => {
            if (index === this.getSizeIndex(this.currentSeeThroughSize)) {
                btn.style.backgroundColor = "rgba(52, 152, 219, 0.7)";
            } else {
                this.applyButtonStyle(btn);
            }
        });
    }

    getSizeIndex(sizeName) {
        const sizes = ["small", "medium", "large"];
        return sizes.indexOf(sizeName);
    }

    showSeeThroughSizeControls() {
        if (!this.seeThroughSizeControls) {
            this.seeThroughSizeControls = this.createSeeThroughSizeControls();
        }

        // medium 버튼이 Seethrough 버튼 바로 위에 오도록 위치 조정
        const buttonRect = this.seeThroughButton.getBoundingClientRect();

        const buttonWidth = this.isMobile ? 48 : 28; // 버튼 하나의 너비
        const gap = 5; // 버튼 사이 간격
        const totalWidth = buttonWidth * 3 + gap * 2; // 전체 컨트롤러 너비

        // medium 버튼이 Seethrough 버튼 중앙에 오도록 left 위치 계산
        const mediumButtonCenter = buttonRect.left + buttonRect.width / 2;
        const controlsLeft = mediumButtonCenter - totalWidth / 2 + buttonWidth; // medium 버튼이 중앙에 오도록 조정

        Object.assign(this.seeThroughSizeControls.style, {
            bottom: `${window.innerHeight - buttonRect.top + 10}px`,
            left: `${controlsLeft}px`,
        });

        document.body.appendChild(this.seeThroughSizeControls);
        this.updateSizeButtonsStyle();
    }

    // 크기 컨트롤 숨기기 메서드 업데이트
    hideSeeThroughSizeControls() {
        if (
            this.seeThroughSizeControls &&
            this.seeThroughSizeControls.parentElement
        ) {
            this.seeThroughSizeControls.remove();
            this.seeThroughSizeControls = null;
        }
    }

    initializeButtons() {
        const buttonContainer = document.createElement("div");
        Object.assign(buttonContainer.style, {
            display: "contents",
            gap: "5px",
        });

        const modelLoaderButton = this.createButton(
            this.getModelLoaderIcon(this.liverViewer?.isDarkMode || false),
            "3D Model Load",
            "model-switch"
        );

        buttonContainer.appendChild(modelLoaderButton);

        modelLoaderButton.onclick = async () => {
            try {
                const modelSelector =
                    this.modelSelector ||
                    (this.liverViewer && this.liverViewer.modelSelector);
                if (modelSelector) {
                    modelLoaderButton.classList.add("active");
                    this.applyButtonStyle(modelLoaderButton, true);

                    await modelSelector.show();

                    modelLoaderButton.classList.remove("active");
                    this.applyButtonStyle(modelLoaderButton);
                }
            } catch (error) {
                console.error("ModelSelector 호출 중 오류:", error);
                modelLoaderButton.classList.remove("active");
                this.applyButtonStyle(modelLoaderButton);
            }
        };

        // Measurement Container 생성
        const measurementContainer = document.createElement("div");
        Object.assign(measurementContainer.style, {
            display: "contents",
            gap: "5px",
        });

        // 시스루(see-through) 버튼
        this.seeThroughButton = this.createButton(
            this.getSeeThroughIcon(),
            "See Through",
            "see-through"
        );

        measurementContainer.appendChild(this.seeThroughButton);

        this.seeThroughButton.onclick = () => {
            const wasActive =
                this.activeMeasurementButton === this.seeThroughButton;

            this.toggleMeasurementButton(
                this.seeThroughButton,
                () => {
                    // 버튼이 활성화될 때
                    this.seeThrough.enableSeeThroughMode();

                    // 크기 조절 컨트롤 표시
                    if (!this.seeThroughSizeControls) {
                        this.seeThroughSizeControls =
                            this.createSeeThroughSizeControls();
                    }

                    // 버튼의 위치를 기준으로 컨트롤 위치 설정
                    const buttonRect =
                        this.seeThroughButton.getBoundingClientRect();
                    Object.assign(this.seeThroughSizeControls.style, {
                        position: "fixed",
                        bottom: `${window.innerHeight - buttonRect.top + 10}px`,
                        left: `${buttonRect.left}px`,
                        display: "flex",
                    });

                    if (!this.seeThroughSizeControls.parentElement) {
                        document.body.appendChild(this.seeThroughSizeControls);
                    }
                },
                () => {
                    // 버튼이 비활성화될 때
                    this.seeThrough.disableSeeThroughMode();
                    if (this.seeThroughSizeControls) {
                        this.seeThroughSizeControls.style.display = "none";
                    }
                }
            );
        };

        this.distanceMeasurementButton = this.createButton(
            this.getRulerIcon(),
            "Distance Measurement",
            "distance-measurement"
        );

        measurementContainer.appendChild(this.distanceMeasurementButton);

        this.distanceMeasurementButton.onclick = () => {
            this.toggleMeasurementButton(
                this.distanceMeasurementButton,
                () => {
                    this.measurementTool.dispose();
                    // 측정 완료 콜백 설정
                    this.measurementTool.onMeasurementComplete = () => {
                        // 버튼 스타일 초기화
                        this.activeMeasurementButton.classList.remove("active");
                        this.applyButtonStyle(this.activeMeasurementButton);
                        this.activeMeasurementButton = null;
                    };
                    this.measurementTool.enableMeasurementMode("distance");
                },
                () => this.measurementTool.disableMeasurementMode()
            );
        };

        // 각도 측정 버튼
        this.angleMeasurementButton = this.createButton(
            this.getAngleIcon(),
            "Angle Measurement",
            "angle-measurement"
        );

        measurementContainer.appendChild(this.angleMeasurementButton);

        this.angleMeasurementButton.onclick = () => {
            this.toggleMeasurementButton(
                this.angleMeasurementButton,
                () => {
                    this.measurementTool.dispose();
                    // 측정 완료 콜백 설정
                    this.measurementTool.onMeasurementComplete = () => {
                        // 버튼 스타일 초기화
                        this.activeMeasurementButton.classList.remove("active");
                        this.applyButtonStyle(this.activeMeasurementButton);
                        this.activeMeasurementButton = null;
                    };
                    this.measurementTool.enableMeasurementMode("angle");
                },
                () => this.measurementTool.disableMeasurementMode()
            );
        };

        // // 리셋 버튼
        // this.resetButton = this.createButton(
        //     this.getResetIcon(),
        //     "Reset Measurements",
        //     "reset-measurement"
        // );

        // measurementContainer.appendChild(this.resetButton);

        // this.resetButton.onclick = () => {
        //     this.applyTemporaryEffect(this.resetButton);
        //     this.measurementTool.clearAllMeasurements();

        //     if (this.activeMeasurementButton) {
        //         this.activeMeasurementButton.classList.remove("active");
        //         this.applyButtonStyle(this.activeMeasurementButton);
        //         if (
        //             this.activeMeasurementButton ===
        //                 this.distanceMeasurementButton ||
        //             this.activeMeasurementButton === this.angleMeasurementButton
        //         ) {
        //             this.measurementTool.disableMeasurementMode();
        //         }
        //         this.activeMeasurementButton = null;
        //     }
        // };

        this.toolbar.appendChild(buttonContainer);
        this.toolbar.appendChild(measurementContainer);

        // Store containers for later access
        this.buttonContainer = buttonContainer;
        this.measurementContainer = measurementContainer;
    }

    createButton(icon, title, id) {
        const button = this.createToolbarButton(icon, title, id);
        return button;
    }

    // Icon SVGs
    getSunIcon(isDarkMode) {
        const color = isDarkMode ? "#ffffff" : "#1a1a1a";
        return `<svg id="a" data-name="ICONS" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M12,17.82c-3.21,0-5.82-2.61-5.82-5.82s2.61-5.82,5.82-5.82,5.82,2.61,5.82,5.82-2.61,5.82-5.82,5.82ZM12,7.18c-2.66,0-4.82,2.16-4.82,4.82s2.16,4.82,4.82,4.82,4.82-2.16,4.82-4.82-2.16-4.82-4.82-4.82Z" fill="${color}"/>
  <g>
    <path d="M12,4.56c-.28,0-.5-.22-.5-.5V1.79c0-.28.22-.5.5-.5s.5.22.5.5v2.27c0,.28-.22.5-.5.5Z" fill="${color}"/>
    <path d="M12,22.71c-.28,0-.5-.22-.5-.5v-2.27c0-.28.22-.5.5-.5s.5.22.5.5v2.27c0,.28-.22.5-.5.5Z" fill="${color}"/>
  </g>
  <g>
    <path d="M22.21,12.5h-2.27c-.28,0-.5-.22-.5-.5s.22-.5.5-.5h2.27c.28,0,.5.22.5.5s-.22.5-.5.5Z"/>
    <path d="M4.06,12.5H1.79c-.28,0-.5-.22-.5-.5s.22-.5.5-.5h2.27c.28,0,.5.22.5.5s-.22.5-.5.5Z" fill="${color}"/>
  </g>
  <g>
    <path d="M6.39,6.89c-.13,0-.26-.05-.35-.15l-1.6-1.6c-.2-.2-.2-.51,0-.71s.51-.2.71,0l1.6,1.6c.2.2.2.51,0,.71-.1.1-.23.15-.35.15Z" fill="${color}"/>
    <path d="M19.22,19.72c-.13,0-.26-.05-.35-.15l-1.6-1.6c-.2-.2-.2-.51,0-.71s.51-.2.71,0l1.6,1.6c.2.2.2.51,0,.71-.1.1-.23.15-.35.15Z" fill="${color}"/>
  </g>
  <g>
    <path d="M17.61,6.89c-.13,0-.26-.05-.35-.15-.2-.2-.2-.51,0-.71l1.6-1.6c.2-.2.51-.2.71,0s.2.51,0,.71l-1.6,1.6c-.1.1-.23.15-.35.15Z"/>
    <path d="M4.78,19.72c-.13,0-.26-.05-.35-.15-.2-.2-.2-.51,0-.71l1.6-1.6c.2-.2.51-.2.71,0s.2.51,0,.71l-1.6,1.6c-.1.1-.23.15-.35.15Z" fill="${color}"/>
  </g>
</svg>`;
    }

    getMoonIcon(isDarkMode) {
        const color = isDarkMode ? "#ffffff" : "#1a1a1a";
        return `<svg id="a" data-name="ICONS" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M12.32,22.92c-.05,0-.1,0-.15,0-3.31-.05-6.38-1.6-8.43-4.26C1.58,15.85.83,12.27,1.69,8.82,3.14,3,8.62,1.47,10.91,1.09c.43-.07.84.11,1.08.47.24.36.24.81,0,1.17-.88,1.35-1.31,2.93-1.26,4.56.13,4.08,3.56,7.51,7.65,7.63.99.04,1.94-.11,2.85-.43.4-.14.83-.04,1.12.27.3.31.39.76.23,1.16-1.64,4.21-5.75,7-10.26,7ZM11.07,2.08c-2.6.44-7.15,1.92-8.41,6.98-.79,3.15-.1,6.43,1.87,8.99,1.86,2.42,4.65,3.83,7.65,3.87,4.14.02,7.95-2.5,9.46-6.37h0s0-.08-.02-.1c-1.1.34-2.18.5-3.29.47-4.6-.14-8.46-4-8.61-8.6-.06-1.83.43-3.61,1.42-5.13l-.08-.12Z" fill="${color}"/>
</svg>`;
    }

    getRulerIcon(isDarkMode) {
        const color = isDarkMode ? "#ffffff" : "#1a1a1a";
        return `<svg id="a" data-name="ICONS" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M21.8,20.38H2.2c-.6,0-1.08-.49-1.08-1.08v-7.14c0-.6.49-1.08,1.08-1.08h19.6c.6,0,1.08.49,1.08,1.08v7.14c0,.6-.49,1.08-1.08,1.08ZM2.2,12.07s-.08.04-.08.08v7.14s.04.08.08.08h19.6s.08-.04.08-.08v-7.14s-.04-.08-.08-.08H2.2Z" fill="${color}"/>
  <rect x="3" y="6.54" width="18.01" height="1" fill="${color}"/>
  <path d="M1.83,10.46c-.28,0-.5-.22-.5-.5v-5.83c0-.28.22-.5.5-.5s.5.22.5.5v5.83c0,.28-.22.5-.5.5Z" fill="${color}"/>
  <g>
    <path d="M3.71,15.31c-.21,0-.37-.17-.37-.37v-3.34c0-.21.17-.37.37-.37s.37.17.37.37v3.34c0,.21-.17.37-.37.37Z" fill="${color}"/>
    <path d="M5.78,14.31c-.21,0-.37-.17-.37-.37v-2.34c0-.21.17-.37.37-.37s.37.17.37.37v2.34c0,.21-.17.37-.37.37Z" fill="${color}"/>
    <path d="M7.86,14.31c-.21,0-.37-.17-.37-.37v-2.34c0-.21.17-.37.37-.37s.37.17.37.37v2.34c0,.21-.17.37-.37.37Z" fill="${color}"/>
    <path d="M9.93,15.31c-.21,0-.37-.17-.37-.37v-3.34c0-.21.17-.37.37-.37s.37.17.37.37v3.34c0,.21-.17.37-.37.37Z" fill="${color}"/>
    <path d="M12,14.31c-.21,0-.37-.17-.37-.37v-2.34c0-.21.17-.37.37-.37s.37.17.37.37v2.34c0,.21-.17.37-.37.37Z" fill="${color}"/>
    <path d="M14.07,14.31c-.21,0-.37-.17-.37-.37v-2.34c0-.21.17-.37.37-.37s.37.17.37.37v2.34c0,.21-.17.37-.37.37Z" fill="${color}"/>
    <path d="M16.14,15.31c-.21,0-.37-.17-.37-.37v-3.34c0-.21.17-.37.37-.37s.37.17.37.37v3.34c0,.21-.17.37-.37.37Z" fill="${color}"/>
    <path d="M18.22,14.31c-.21,0-.37-.17-.37-.37v-2.34c0-.21.17-.37.37-.37s.37.17.37.37v2.34c0,.21-.17.37-.37.37Z" fill="${color}"/>
    <path d="M20.29,14.31c-.21,0-.37-.17-.37-.37v-2.34c0-.21.17-.37.37-.37s.37.17.37.37v2.34c0,.21-.17.37-.37.37Z" fill="${color}"/>
  </g>
  <path d="M22.17,10.46c-.28,0-.5-.22-.5-.5v-5.83c0-.28.22-.5.5-.5s.5.22.5.5v5.83c0,.28-.22.5-.5.5Z" fill="${color}"/>
  <path d="M4.75,9.29c-.13,0-.26-.05-.35-.15l-1.75-1.75c-.2-.2-.2-.51,0-.71l1.75-1.75c.2-.2.51-.2.71,0s.2.51,0,.71l-1.4,1.4,1.4,1.4c.2.2.2.51,0,.71-.1.1-.23.15-.35.15Z" fill="${color}"/>
  <path d="M19.25,9.29c-.13,0-.26-.05-.35-.15-.2-.2-.2-.51,0-.71l1.4-1.4-1.4-1.4c-.2-.2-.2-.51,0-.71s.51-.2.71,0l1.75,1.75c.09.09.15.22.15.35s-.05.26-.15.35l-1.75,1.75c-.1.1-.23.15-.35.15Z" fill="${color}"/>
</svg>`;
    }

    getAngleIcon(isDarkMode) {
        const color = isDarkMode ? "#ffffff" : "#1a1a1a";
        return `<svg id="a" data-name="ICONS" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M22.27,21.67H1.69c-.18,0-.34-.09-.43-.25-.09-.15-.09-.34,0-.5L11.34,2.58c.13-.24.44-.33.68-.2.24.13.33.44.2.68L2.53,20.67h19.73c.28,0,.5.22.5.5s-.22.5-.5.5Z" fill="${color}"/>
  <path d="M9.25,21.2c-.28,0-.5-.18-.5-.46,0-2.51-1.31-4.77-3.42-5.98-.24-.14-.32-.44-.18-.68.14-.24.45-.32.68-.18,2.42,1.39,3.92,3.98,3.92,6.76,0,.28-.22.54-.5.54Z" fill="${color}"/>
</svg>`;
    }

    getResetIcon(isDarkMode) {
        const color = isDarkMode ? "#ffffff" : "#1a1a1a";
        return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" 
                    fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" 
                    class="lucide lucide-list-restart"><path d="M21 6H3"/><path d="M7 12H3"/><path d="M7 18H3"/>
                    <path d="M12 18a5 5 0 0 0 9-3 4.5 4.5 0 0 0-4.5-4.5c-1.33 0-2.54.54-3.41 1.41L11 14"/>
                    <path d="M11 10v4h4"/>
                    </svg>`;
    }

    getSeeThroughIcon(isDarkMode) {
        const color = isDarkMode ? "#ffffff" : "#1a1a1a";
        return `<svg id="a" data-name="ICONS" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <defs>
    <style>
      .b {
        fill: ${color};
      }
    </style>
  </defs>
  <g>
    <g>
      <path class="b" d="M10.31,18.96c-2.31,0-4.48-.9-6.12-2.54-1.63-1.63-2.53-3.81-2.53-6.12s.9-4.48,2.53-6.12c3.37-3.37,8.86-3.37,12.24,0h0c3.37,3.37,3.37,8.86,0,12.24-1.63,1.63-3.81,2.54-6.12,2.54ZM10.31,2.66c-1.96,0-3.92.75-5.41,2.24-1.45,1.45-2.24,3.37-2.24,5.41s.8,3.97,2.24,5.41c1.45,1.45,3.37,2.24,5.41,2.24s3.97-.8,5.41-2.24c2.98-2.98,2.98-7.84,0-10.82h0c-1.49-1.49-3.45-2.24-5.41-2.24Z"/>
      <path class="b" d="M17.91,18.42c-.13,0-.26-.05-.35-.15l-1.84-1.84c-.2-.2-.2-.51,0-.71s.51-.2.71,0l1.84,1.84c.2.2.2.51,0,.71-.1.1-.23.15-.35.15Z"/>
      <path class="b" d="M21.84,22.34c-.13,0-.26-.05-.35-.15l-3.68-3.68c-.2-.2-.2-.51,0-.71s.51-.2.71,0l3.68,3.68c.2.2.2.51,0,.71-.1.1-.23.15-.35.15Z"/>
    </g>
    <path d="M10.31,18.96c-2.31,0-4.48-.9-6.12-2.54-1.63-1.63-2.53-3.81-2.53-6.12s.9-4.48,2.53-6.12c3.37-3.37,8.86-3.37,12.24,0h0c3.37,3.37,3.37,8.86,0,12.24-1.63,1.63-3.81,2.54-6.12,2.54ZM10.31,2.66c-1.96,0-3.92.75-5.41,2.24-1.45,1.45-2.24,3.37-2.24,5.41s.8,3.97,2.24,5.41c1.45,1.45,3.37,2.24,5.41,2.24s3.97-.8,5.41-2.24c2.98-2.98,2.98-7.84,0-10.82h0c-1.49-1.49-3.45-2.24-5.41-2.24Z" fill="${color}"/>
    <path d="M17.91,18.42c-.13,0-.26-.05-.35-.15l-1.84-1.84c-.2-.2-.2-.51,0-.71s.51-.2.71,0l1.84,1.84c.2.2.2.51,0,.71-.1.1-.23.15-.35.15Z" fill="${color}"/>
    <path d="M21.84,22.59c-.19,0-.38-.07-.53-.22l-3.68-3.68c-.29-.29-.29-.77,0-1.06s.77-.29,1.06,0l3.68,3.68c.29.29.29.77,0,1.06-.15.15-.34.22-.53.22Z" fill="${color}"/>
  </g>
  <path d="M15.44,8.64c-.67.19-1.47.04-2.32-.25.05-.05.11-.12.16-.17.46-.48.88-1.01,1.13-1.46.21-.37.32-.77.1-.88-.29-.15-.58.35-.66.48-.32.49-.71.86-1.16,1.33-.7.73-1.46,1.39-1.83,2.38-.23.62-.3,1.25-.38,1.87-.02.21-.04.32-.07.52-.29-.37-.65-.56-.94-.78-.14-.11-.29-.21-.45-.31-.44-.3-.85-.58-1.18-.96-.64-.72-1.05-1.78-.95-2.82.02-.17-.07-.33-.2-.34-.18-.01-.27.22-.29.32-.21.79.1,1.98.63,2.79-1.22.1-1.9.59-2.48,1.06-.07.06-.29.26-.2.37.13.16.37-.03.42-.06.71-.52,1.63-1,2.58-.84h.09c.38.41.8.71,1.22.99.15.11.29.21.44.31.56.41.93.79,1.13,1.21-.67,2.82-2.91,4.59-2.91,4.59l1.56.54s2.13-2.11,2.39-5.81c.04-.23.06-.46.09-.69.06-.6.13-1.15.32-1.66.22-.62.63-1.13,1.1-1.64.59.23,1.21.34,1.85.34.41,0,.83-.1,1.09-.19.1-.04.38-.15.35-.27-.03-.12-.39-.06-.63,0Z" fill="${color}"/>
</svg>`;
    }

    getModelLoaderIcon(isDarkMode) {
        const color = isDarkMode ? "#ffffff" : "#1a1a1a";
        return `<svg id="a" data-name="ICONS" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <g>
    <path d="M21.15,21.27H2.91c-.92,0-1.67-.75-1.67-1.67v-4.41c0-.92.75-1.67,1.67-1.67h4.11c.67,0,1.27.4,1.53,1.01l.43,1.01c.1.25.35.4.61.4h4.86c.27,0,.51-.16.61-.4l.43-1.01c.26-.61.86-1.01,1.53-1.01h4.11c.92,0,1.67.75,1.67,1.67v4.41c0,.92-.75,1.67-1.67,1.67ZM2.91,14.53c-.37,0-.67.3-.67.67v4.41c0,.37.3.67.67.67h18.24c.37,0,.67-.3.67-.67v-4.41c0-.37-.3-.67-.67-.67h-4.11c-.27,0-.51.16-.61.4l-.43,1.01c-.26.61-.86,1.01-1.53,1.01h-4.86c-.67,0-1.27-.4-1.53-1.01l-.43-1.01c-.11-.25-.35-.4-.61-.4H2.91Z" fill="${color}"/>
    <path d="M21.09,14.45H2.85c-.92,0-1.67-.75-1.67-1.67v-4.71c0-.75.61-1.37,1.36-1.37h4.61c.55,0,1.04.33,1.25.83l.59,1.37c.06.13.19.22.34.22h5.26c.15,0,.28-.09.33-.22l.59-1.37c.21-.5.71-.83,1.25-.83h4.61c.75,0,1.36.61,1.36,1.37v4.71c0,.92-.75,1.67-1.67,1.67ZM2.55,7.7c-.2,0-.36.16-.36.37v4.71c0,.37.3.67.67.67h18.24c.37,0,.67-.3.67-.67v-4.71c0-.2-.16-.37-.36-.37h-4.61c-.15,0-.28.09-.33.22l-.59,1.37c-.21.5-.71.83-1.25.83h-5.26c-.55,0-1.04-.33-1.25-.83l-.59-1.37c-.06-.13-.19-.22-.33-.22H2.55Z" fill="${color}"/>
    <path d="M21.83,7.7c-.14,0-.27-.05-.37-.16l-3.4-3.71c-.06-.07-.15-.11-.24-.11H6.13c-.09,0-.18.04-.24.11l-3.4,3.71c-.19.2-.5.22-.71.03-.2-.19-.22-.5-.03-.71l3.4-3.71c.31-.34.76-.54,1.23-.54h11.4c.47,0,.91.2,1.23.54l3.4,3.71c.19.2.17.52-.03.71-.1.09-.22.13-.34.13Z" fill="${color}"/>
  </g>
  <g>
    <path d="M21.15,21.27H2.91c-.92,0-1.67-.75-1.67-1.67v-4.41c0-.92.75-1.67,1.67-1.67h4.11c.67,0,1.27.4,1.53,1.01l.43,1.01c.1.25.35.4.61.4h4.86c.27,0,.51-.16.61-.4l.43-1.01c.26-.61.86-1.01,1.53-1.01h4.11c.92,0,1.67.75,1.67,1.67v4.41c0,.92-.75,1.67-1.67,1.67ZM2.91,14.53c-.37,0-.67.3-.67.67v4.41c0,.37.3.67.67.67h18.24c.37,0,.67-.3.67-.67v-4.41c0-.37-.3-.67-.67-.67h-4.11c-.27,0-.51.16-.61.4l-.43,1.01c-.26.61-.86,1.01-1.53,1.01h-4.86c-.67,0-1.27-.4-1.53-1.01l-.43-1.01c-.11-.25-.35-.4-.61-.4H2.91Z" fill="${color}"/>
    <path d="M21.09,14.45H2.85c-.92,0-1.67-.75-1.67-1.67v-4.41c0-.92.75-1.67,1.67-1.67h4.11c.67,0,1.27.4,1.53,1.01l.43,1.01c.1.25.35.4.61.4h4.86c.27,0,.51-.16.61-.4l.43-1.01c.26-.61.86-1.01,1.53-1.01h4.11c.92,0,1.67.75,1.67,1.67v4.41c0,.92-.75,1.67-1.67,1.67ZM2.85,7.7c-.37,0-.67.3-.67.67v4.41c0,.37.3.67.67.67h18.24c.37,0,.67-.3.67-.67v-4.41c0-.37-.3-.67-.67-.67h-4.11c-.27,0-.51.16-.61.4l-.43,1.01c-.26.61-.86,1.01-1.53,1.01h-4.86c-.67,0-1.27-.4-1.53-1.01l-.43-1.01c-.1-.25-.35-.4-.61-.4H2.85Z" fill="${color}"/>
    <path d="M21.83,7.7c-.14,0-.27-.05-.37-.16l-3.3-3.6c-.13-.14-.3-.22-.49-.22H6.27c-.19,0-.37.08-.49.22l-3.3,3.6c-.19.2-.5.22-.71.03-.2-.19-.22-.5-.03-.71l3.3-3.6c.31-.34.76-.54,1.23-.54h11.4c.47,0,.91.2,1.23.54l3.3,3.6c.19.2.17.52-.03.71-.1.09-.22.13-.34.13Z" fill="${color}"/>
  </g>
</svg>`;
    }

    showModelSelector() {
        console.log("showModelSelector 호출됨");
        if (this.liverViewer && this.liverViewer.modelSelector) {
            console.log("ModelSelector 인스턴스 존재, show 메서드 호출");
            this.liverViewer.modelSelector.show();
        } else {
            console.error("ModelSelector가 정의되지 않았습니다.");
        }
    }

    showAnimationControls(show) {
        console.log("showAnimationControls called with:", show);
        
        // ModelLoader가 없거나 애니메이션이 없는 경우 컨트롤 숨김
        if (!this.modelLoader || !this.modelLoader.isAnimatable()) {
            console.log("No animations available, hiding controls");
            if (this.animationButton) {
                this.animationButton.style.display = 'none';
            }
            if (this.sliderContainer) {
                this.sliderContainer.style.display = 'none';
            }
            return;
        }

        // 애니메이션 버튼이 없으면 생성
        if (!this.animationButton) {
            console.log("Creating animation button");
            this.createAnimationButton();
        }
        
        // 애니메이션 버튼 표시
        if (this.animationButton) {
            this.animationButton.style.display = 'flex';
        }

        // 슬라이더 컨트롤 표시/숨김
        if (this.sliderContainer) {
            this.sliderContainer.style.display = show ? "block" : "none";

            if (show && this.modelLoader) {
                const duration = this.modelLoader.getAnimationDuration();
                if (duration > 0) {
                    this.timeSlider.max = duration * 1000; // 밀리초 단위로 변환
                    let isDragging = false;
                    let lastSliderValue = 0;
                    let shouldUpdateSlider = true;

                    // 슬라이더 클릭 또는 드래그 시작할 때
                    const stopAnimation = () => {
                        isDragging = true;
                        shouldUpdateSlider = false;
                        lastSliderValue = parseFloat(this.timeSlider.value);
                        if (this.isPlaying) {
                            this.stopAnimation(); // 재생 중지
                        }
                    };

                    // 슬라이더 드래그 종료 시
                    const resumeAnimation = () => {
                        isDragging = false;
                        // 드래그가 끝난 위치에서 애니메이션 재시작
                        const time = lastSliderValue / 1000;
                        this.modelLoader.setAnimationTime(time);
                        if (this.isPlaying) {
                            this.modelLoader.resumeAnimation();
                        }
                    };

                    this.timeSlider.onmousedown = stopAnimation;
                    this.timeSlider.onmouseup = resumeAnimation;
                    this.timeSlider.onmouseleave = resumeAnimation;
                    this.timeSlider.ontouchend = resumeAnimation;

                    // 슬라이더 값 변경 시
                    this.timeSlider.oninput = (e) => {
                        const time = parseFloat(e.target.value) / 1000;
                        lastSliderValue = e.target.value;
                        this.modelLoader.setAnimationTime(time);
                    };

                    // 애니메이션 프레임 업데이트 함수
                    const updateSlider = () => {
                        if (this.modelLoader && this.modelLoader.mixer && !isDragging && shouldUpdateSlider) {
                            // 현재 애니메이션 시간 가져오기
                            const currentTime = this.modelLoader.mixer.time;
                            // 총 지속 시간으로 나눈 후 현재 위치 계산
                            const normalizedTime = (currentTime % duration) * 1000;
                            // 슬라이더 업데이트
                            this.timeSlider.value = normalizedTime;
                            lastSliderValue = normalizedTime;
                        }
                        requestAnimationFrame(updateSlider);
                    };

                    // 애니메이션 프레임 업데이트 시작
                    updateSlider();
                } else {
                    console.warn("No animation duration available");
                    this.sliderContainer.style.display = "none";
                }
            }
        }
    }

    toggleAnimation() {
        console.log("toggleAnimation called");
        if (!this.animationButton) {
            console.warn("Animation button not initialized, creating new one");
            this.createAnimationButton();
            if (!this.animationButton) {
                console.error("Failed to create animation button");
                return;
            }
        }

        this.isPlaying = !this.isPlaying;
        if (this.modelLoader) {
            if (this.isPlaying) {
                this.modelLoader.resumeAnimation();
            } else {
                this.modelLoader.pauseAnimation();
            }
        }

        // 버튼 상태 업데이트
        this.animationButton.innerHTML = this.isPlaying ? '⏸' : '▶';
        this.animationButton.classList.toggle('active');
        this.animationButton.style.background = this.isPlaying ? 
            'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.2)';
    }

    stopAnimation() {
        console.log("stopAnimation called");
        if (!this.animationButton) {
            console.warn("Animation button not initialized, creating new one");
            this.createAnimationButton();
            if (!this.animationButton) {
                console.error("Failed to create animation button");
                return;
            }
        }

        this.isPlaying = false;
        if (this.modelLoader) {
            this.modelLoader.pauseAnimation();
        }

        this.animationButton.innerHTML = '▶';
        this.animationButton.classList.remove('active');
        this.animationButton.style.background = 'rgba(255, 255, 255, 0.2)';
    }

    createAnimationButton() {
        console.log("createAnimationButton called");
        if (this.animationButton) {
            console.log("Animation button already exists");
            return;
        }

        const button = document.createElement('button');
        button.className = 'toolbar-button animation-button';
        button.innerHTML = '⏸'; // 초기 상태를 일시정지 아이콘으로 설정
        button.title = '애니메이션 일시정지';
        button.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 16px;
            cursor: pointer;
            padding: 5px;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3); // 초기 상태를 활성화된 스타일로 설정
        `;

        button.onclick = () => this.toggleAnimation();

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'animation-button-container';
        buttonContainer.style.cssText = `
            display: flex;
            gap: 5px;
            margin-bottom: 5px;
        `;
        buttonContainer.appendChild(button);
        
        if (this.toolbar) {
            this.toolbar.insertBefore(buttonContainer, this.toolbar.firstChild.nextSibling);
            this.animationButton = button;
            this.isPlaying = true; // 초기 상태를 재생 중으로 설정
            console.log("Animation button created and added to toolbar");
        } else {
            console.error("No toolbar found for button");
        }
    }

    createModelSelectButton() {
        const button = document.createElement("button");
        button.textContent = "모델 선택";
        button.onclick = () => {
            if (this.modelLoader && this.modelLoader.showModelSelector) {
                this.modelLoader.showModelSelector();
            } else {
                console.warn("ModelLoader 또는 showModelSelector가 없습니다.");
            }
        };
        return button;
    }

    // 컴포넌트가 제거될 때 리소스 정리
    dispose() {
        if (this.transformControlsContainer) {
            this.transformControlsContainer.remove();
        }
        if (this.meshTransform) {
            this.meshTransform.onSelect = null;
        }
        window.removeEventListener("resize", this.applyTransformControlsLayout);
        window.removeEventListener("resize", this.applyResponsiveLayout);
    }

    // 측정 도구 활성화 메서드
    enableMeasurement(mode) {
        if (this.measurementTool) {
            this.measurementTool.enableMeasurementMode(mode);
        }
    }

    resetMeasurementButtons() {
        // 활성화된 버튼이 있다면 비활성화
        if (this.activeMeasurementButton) {
            this.activeMeasurementButton.classList.remove("active");
            this.applyButtonStyle(this.activeMeasurementButton);

            // 측정 도구나 시스루 모드 비활성화
            if (
                this.activeMeasurementButton ===
                    this.distanceMeasurementButton ||
                this.activeMeasurementButton === this.angleMeasurementButton
            ) {
                this.measurementTool.disableMeasurementMode();
            } else if (this.activeMeasurementButton === this.seeThroughButton) {
                this.seeThrough.disableSeeThroughMode();
            }

            this.activeMeasurementButton = null;
        }
    }

    /**
     * 다크모드 변경 시 모든 툴바 버튼 스타일 업데이트
     */
    updateTheme(isDarkMode) {
        // liverViewer 참조 설정 (viewerState에서 가져오기)
        if (!this.liverViewer && window.liverViewer) {
            this.liverViewer = window.liverViewer;
        }
        
        // 다크모드 상태 확인
        const currentIsDarkMode = isDarkMode !== undefined ? isDarkMode : (this.liverViewer ? this.liverViewer.isDarkMode : false);
        
        // 모드 전환 시 transition 일시 비활성화
        const buttons = this.toolbar.querySelectorAll('button');
        const originalTransitions = [];
        
        buttons.forEach((button, index) => {
            originalTransitions[index] = button.style.transition;
            button.style.transition = "none";
        });
        
        // 모든 툴바 버튼들의 아이콘을 현재 테마에 맞게 업데이트
        buttons.forEach((button, index) => {
            const isActive = button.classList.contains('active');
            
            // 버튼 스타일 업데이트
            this.applyButtonStyle(button, isActive, currentIsDarkMode);
            
            // 아이콘 업데이트 (TopBar 방식)
            if (button.id === 'theme-toggle') {
                button.innerHTML = currentIsDarkMode ? this.getSunIcon(currentIsDarkMode) : this.getMoonIcon(currentIsDarkMode);
            } else if (button.id === 'distance-measurement') {
                button.innerHTML = this.getRulerIcon(currentIsDarkMode);
            } else if (button.id === 'angle-measurement') {
                button.innerHTML = this.getAngleIcon(currentIsDarkMode);
            } else if (button.id === 'see-through') {
                button.innerHTML = this.getSeeThroughIcon(currentIsDarkMode);
            } else if (button.id === 'reset-camera') {
                button.innerHTML = this.getResetIcon(currentIsDarkMode);
            } else if (button.id === 'model-switch') {
                button.innerHTML = this.getModelLoaderIcon(currentIsDarkMode);
            }
        });
        
        // 특정 버튼들도 직접 업데이트
        if (this.seeThroughButton) {
            const isActive = this.activeMeasurementButton === this.seeThroughButton;
            this.applyButtonStyle(this.seeThroughButton, isActive, currentIsDarkMode);
            this.seeThroughButton.innerHTML = this.getSeeThroughIcon(currentIsDarkMode);
        }
        
        if (this.distanceMeasurementButton) {
            const isActive = this.activeMeasurementButton === this.distanceMeasurementButton;
            this.applyButtonStyle(this.distanceMeasurementButton, isActive, currentIsDarkMode);
            this.distanceMeasurementButton.innerHTML = this.getRulerIcon(currentIsDarkMode);
        }
        
        if (this.angleMeasurementButton) {
            const isActive = this.activeMeasurementButton === this.angleMeasurementButton;
            this.applyButtonStyle(this.angleMeasurementButton, isActive, currentIsDarkMode);
            this.angleMeasurementButton.innerHTML = this.getAngleIcon(currentIsDarkMode);
        }
        
        // 애니메이션 버튼도 업데이트
        if (this.animationButton) {
            const isActive = this.isPlaying;
            this.applyButtonStyle(this.animationButton, isActive, currentIsDarkMode);
        }

        // Transform control 버튼들도 업데이트
        if (this.transformControlsContainer) {
            const transformButtons = this.transformControlsContainer.querySelectorAll('button');
            
            transformButtons.forEach((button, index) => {
                const isActive = button.classList.contains('active');
                
                // 버튼 스타일 강제 업데이트 (isDarkMode 명시적 전달)
                this.applyButtonStyle(button, isActive, currentIsDarkMode);
                
                // 아이콘 색상 업데이트 (currentColor를 실제 색상으로 변경)
                const color = currentIsDarkMode ? "#ffffff" : "#1a1a1a";
                const svg = button.querySelector('svg');
                if (svg) {
                    // fill="currentColor"를 실제 색상으로 변경
                    svg.setAttribute('fill', color);
                    // path 요소들의 fill도 업데이트
                    const paths = svg.querySelectorAll('path');
                    paths.forEach(path => {
                        path.setAttribute('fill', color);
                    });
                }
            });
        }
        
        // 툴바 컨테이너 배경색 업데이트 (진짜 Glassmorphism - 약한 블러)
        if (this.toolbar) {
            if (currentIsDarkMode) {
                // 다크모드: 완전 투명한 글래스
                this.toolbar.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
                this.toolbar.style.backdropFilter = "blur(15px) saturate(120%)";
                this.toolbar.style.border = "1px solid rgba(255, 255, 255, 0.05)";
                this.toolbar.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)";
            } else {
                // 라이트모드: 완전 투명한 글래스
                this.toolbar.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                this.toolbar.style.backdropFilter = "blur(15px) saturate(120%)";
                this.toolbar.style.border = "1px solid rgba(255, 255, 255, 0.08)";
                this.toolbar.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.2)";
            }
        }
        
        // Transform controls container 배경색 업데이트 (Glassmorphism 스타일)
        if (this.transformControlsContainer) {
            if (currentIsDarkMode) {
                // 다크모드: 완전 투명한 글래스
                this.transformControlsContainer.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
                this.transformControlsContainer.style.backdropFilter = "blur(15px) saturate(120%)";
                this.transformControlsContainer.style.border = "1px solid rgba(255, 255, 255, 0.05)";
                this.transformControlsContainer.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)";
            } else {
                // 라이트모드: 완전 투명한 글래스
                this.transformControlsContainer.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                this.transformControlsContainer.style.backdropFilter = "blur(15px) saturate(120%)";
                this.transformControlsContainer.style.border = "1px solid rgba(255, 255, 255, 0.08)";
                this.transformControlsContainer.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.2)";
            }
        }
        
        // transition 복원
        buttons.forEach((button, index) => {
            if (originalTransitions[index]) {
                button.style.transition = originalTransitions[index];
            }
        });
        
    }
    
    // HDRI 회전 컨트롤 섹션 추가
    /*
    createHDRIrotationControls() {
        // HDRI 회전 컨트롤 컨테이너 (우측하단에 배치)
        const hdriContainer = document.createElement('div');
        hdriContainer.className = 'hdri-rotation-controls';
        hdriContainer.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.15);
        `;

        // 원형 다이얼 컨테이너
        const dialContainer = document.createElement('div');
        dialContainer.style.cssText = `
            position: relative;
            width: 120px;
            height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // 원형 트랙 (SVG)
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '120');
        svg.setAttribute('height', '120');
        svg.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            transform: rotate(-90deg);
        `;

        // 배경 원형 트랙 (회색)
        const backgroundTrack = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        backgroundTrack.setAttribute('cx', '60');
        backgroundTrack.setAttribute('cy', '60');
        backgroundTrack.setAttribute('r', '50');
        backgroundTrack.setAttribute('fill', 'none');
        backgroundTrack.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
        backgroundTrack.setAttribute('stroke-width', '8');
        backgroundTrack.setAttribute('stroke-linecap', 'round');

        // 활성 트랙 (파란색)
        const activeTrack = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        activeTrack.setAttribute('cx', '60');
        activeTrack.setAttribute('cy', '60');
        activeTrack.setAttribute('r', '50');
        activeTrack.setAttribute('fill', 'none');
        activeTrack.setAttribute('stroke', '#2196F3');
        activeTrack.setAttribute('stroke-width', '8');
        activeTrack.setAttribute('stroke-linecap', 'round');
        activeTrack.setAttribute('stroke-dasharray', '314'); // 2 * π * 50
        activeTrack.setAttribute('stroke-dashoffset', '78.5'); // 270도에 해당 (314 * 0.75)

        svg.appendChild(backgroundTrack);
        svg.appendChild(activeTrack);
        dialContainer.appendChild(svg);

        // 중앙 회색 원
        const centerCircle = document.createElement('div');
        centerCircle.style.cssText = `
            width: 60px;
            height: 60px;
            background: #666666;
            border-radius: 50%;
            position: relative;
            z-index: 2;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            user-select: none;
        `;

        // ToggleTheme_L.svg 아이콘 사용
        const themeIcon = document.createElement('div');
        themeIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,17.82c-3.21,0-5.82-2.61-5.82-5.82s2.61-5.82,5.82-5.82,5.82,2.61,5.82,5.82-2.61,5.82-5.82,5.82ZM12,7.18c-2.66,0-4.82,2.16-4.82,4.82s2.16,4.82,4.82,4.82,4.82-2.16,4.82-4.82-2.16-4.82-4.82-4.82Z"/>
                <g>
                    <path d="M12,4.56c-.28,0-.5-.22-.5-.5V1.79c0-.28.22-.5.5-.5s.5.22.5.5v2.27c0,.28-.22.5-.5.5Z"/>
                    <path d="M12,22.71c-.28,0-.5-.22-.5-.5v-2.27c0-.28.22-.5.5-.5s.5.22.5.5v2.27c0,.28-.22.5-.5.5Z"/>
                </g>
                <g>
                    <path d="M22.21,12.5h-2.27c-.28,0-.5-.22-.5-.5s.22-.5.5-.5h2.27c.28,0,.5.22.5.5s-.22.5-.5.5Z"/>
                    <path d="M4.06,12.5H1.79c-.28,0-.5-.22-.5-.5s.22-.5.5-.5h2.27c.28,0,.5.22.5.5s-.22.5-.5.5Z"/>
                </g>
                <g>
                    <path d="M6.39,6.89c-.13,0-.26-.05-.35-.15l-1.6-1.6c-.2-.2-.2-.51,0-.71s.51-.2.71,0l1.6,1.6c.2.2.2.51,0,.71-.1.1-.23.15-.35.15Z"/>
                    <path d="M19.22,19.72c-.13,0-.26-.05-.35-.15l-1.6-1.6c-.2-.2-.2-.51,0-.71s.51-.2.71,0l1.6,1.6c.2.2.2.51,0,.71-.1.1-.23.15-.35.15Z"/>
                </g>
                <g>
                    <path d="M17.61,6.89c-.13,0-.26-.05-.35-.15-.2-.2-.2-.51,0-.71l1.6-1.6c.2-.2.51-.2.71,0s.2.51,0,.71l-1.6,1.6c-.1.1-.23.15-.35.15Z"/>
                    <path d="M4.78,19.72c-.13,0-.26-.05-.35-.15-.2-.2-.2-.51,0-.71l1.6-1.6c.2-.2.51-.2.71,0s.2.51,0,.71l-1.6,1.6c-.1.1-.23.15-.35.15Z"/>
                </g>
            </svg>
        `;
        themeIcon.style.cssText = `
            color: #ffffff;
            width: 24px;
            height: 24px;
        `;

        centerCircle.appendChild(themeIcon);
        dialContainer.appendChild(centerCircle);

        // 각도 표시
        const angleDisplay = document.createElement('div');
        angleDisplay.textContent = '270°';
        angleDisplay.style.cssText = `
            position: absolute;
            bottom: -30px;
            left: 50%;
            transform: translateX(-50%);
            color: #ffffff;
            font-size: 14px;
            font-weight: 500;
            background: rgba(0, 0, 0, 0.7);
            padding: 4px 8px;
            border-radius: 4px;
        `;
        dialContainer.appendChild(angleDisplay);

        // 마우스/터치 이벤트 처리
        let isDragging = false;
        let startAngle = 0;
        let currentAngle = 270; // 초기값

        const updateDial = (angle) => {
            currentAngle = angle;
            const normalizedOffset = (angle / 360) % 1;
            const strokeDashoffset = 314 * (1 - normalizedOffset);
            activeTrack.setAttribute('stroke-dashoffset', strokeDashoffset);
            angleDisplay.textContent = `${angle}°`;
            
            // HDRI 회전 실행
            this.rotateHDRI(angle);
        };

        const getAngleFromEvent = (event) => {
            const rect = dialContainer.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            let clientX, clientY;
            if (event.touches && event.touches[0]) {
                clientX = event.touches[0].clientX;
                clientY = event.touches[0].clientY;
            } else {
                clientX = event.clientX;
                clientY = event.clientY;
            }
            
            const deltaX = clientX - centerX;
            const deltaY = clientY - centerY;
            let angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
            
            // -90도에서 시작하도록 조정
            angle = (angle + 90 + 360) % 360;
            return Math.round(angle);
        };

        // 마우스 이벤트
        centerCircle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startAngle = getAngleFromEvent(e);
            centerCircle.style.transform = 'scale(0.95)';
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const angle = getAngleFromEvent(e);
                updateDial(angle);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                centerCircle.style.transform = 'scale(1)';
            }
        });

        // 터치 이벤트
        centerCircle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isDragging = true;
            startAngle = getAngleFromEvent(e);
            centerCircle.style.transform = 'scale(0.95)';
        });

        document.addEventListener('touchmove', (e) => {
            if (isDragging) {
                e.preventDefault();
                const angle = getAngleFromEvent(e);
                updateDial(angle);
            }
        });

        document.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                centerCircle.style.transform = 'scale(1)';
            }
        });

        hdriContainer.appendChild(dialContainer);

        // body에 직접 추가 (우측하단에 고정)
        document.body.appendChild(hdriContainer);

        console.log('HDRI rotation dial UI created successfully in bottom-right corner');
    }
    */

    /**
     * HDRI 회전 실행
     * @param {number} degrees - 회전할 각도 (0-360)
     */
    /*
    rotateHDRI(degrees) {
        console.log(`Attempting to rotate HDRI to ${degrees}°`);
        
        // LiverViewer를 통해 직접 접근
        if (window.liverViewer) {
            console.log('LiverViewer found:', window.liverViewer);
            
            // Scene에 직접 접근 (Scene 객체 자체가 Three.js Scene)
            if (window.liverViewer.scene) {
                const scene = window.liverViewer.scene;
                console.log('Scene found:', scene);
                
                if (scene.environment) {
                    console.log('Environment texture found:', scene.environment);
                    
                    // texture offset 조정
                    if (scene.environment.offset) {
                        const normalizedOffset = (degrees / 360) % 1;
                        scene.environment.offset.x = normalizedOffset;
                        console.log(`HDRI offset adjusted to ${normalizedOffset} (${degrees}°)`);
                        
                        // LiverViewer의 기존 렌더링 시스템 활용
                        if (window.liverViewer.renderer && window.liverViewer.renderer.renderer) {
                            // 강제 렌더링으로 즉시 화면 업데이트
                            try {
                                // LiverViewer의 현재 카메라와 씬으로 강제 렌더링
                                const renderer = window.liverViewer.renderer.renderer;
                                const currentScene = scene;
                                const currentCamera = window.liverViewer.camera?.camera || window.liverViewer.camera;
                                
                                if (currentCamera) {
                                    renderer.render(currentScene, currentCamera);
                                    console.log('Forced render executed successfully');
                                } else {
                                    console.warn('Camera not available for forced render');
                                }
                            } catch (error) {
                                console.warn('Forced render failed:', error);
                            }
                            
                            // LiverViewer의 메인 렌더링 루프 직접 호출
                            if (window.liverViewer.render && typeof window.liverViewer.render === 'function') {
                                try {
                                    window.liverViewer.render();
                                    console.log('LiverViewer render method called');
                                } catch (error) {
                                    console.warn('LiverViewer render method failed:', error);
                                }
                            }
                            
                            // LiverViewer의 업데이트 시스템도 활용
                            if (window.liverViewer.viewerState && window.liverViewer.viewerState.setState) {
                                window.liverViewer.viewerState.setState({
                                    renderNeeded: true
                                });
                            }
                        }
                    } else {
                        console.warn('Environment texture has no offset property');
                    }
                } else {
                    console.warn('No environment texture found in Scene');
                }
            } else {
                console.warn('Scene not found in LiverViewer');
            }
        } else {
            console.warn('LiverViewer not available');
        }
    }
    */
}