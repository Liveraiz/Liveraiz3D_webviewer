// ui/ModelSelector.js

import { DropboxService } from "../services/DropboxService";
import { DeviceDetector } from "../utils/DeviceDetector";
import { TableGenerator } from "./TableGenerator";

export default class ModelSelector {
    constructor(liverViewer) {
        // 기본 속성 초기화
        this.liverViewer = liverViewer;
        this.isDarkMode = liverViewer.isDarkMode;
        this.dialog = null;
        this.dropboxService = new DropboxService();
        this.modelLoader = null;
        this.lastLoadedModels = null;
        this.textPanel = null;
        this.patientInfoUrl = null; // 환자 정보 URL 저장
        this.lastJsonUrl = null; // JSON URL 저장
        this.isLoading = false; // 로딩 상태 추적
        this.currentModelIndex = 0; // 현재 선택된 모델의 인덱스
        this.lastScrollPosition = 0; // 마지막 carousel 스크롤 위치

        // UI 컨테이너 초기화
        this.container = document.createElement("div");
        this.container.className = "model-selector";
        this.container.style.display = "none";
        document.body.appendChild(this.container);

        // 모델 리스트 컨테이너 초기화
        this.modelList = document.createElement("div");
        this.modelList.className = "model-list";
        this.container.appendChild(this.modelList);
        this.tableGenerator = new TableGenerator(this.isDarkMode);

        this.close = this.close.bind(this);
        console.log("ModelSelector initialized:", {
            isDarkMode: this.isDarkMode,
            liverViewer: !!this.liverViewer,
            textPanel: !!this.liverViewer?.textPanel,
        });
    }

    toggleDarkMode() {
        console.log("ModelSelector toggleDarkMode called");
        if (this.liverViewer) {
            this.liverViewer.toggleDarkMode();
            this.tableGenerator.setTheme(this.isDarkMode);
            console.log("Current theme state:", {
                liverViewer: this.liverViewer.isDarkMode,
                modelSelector: this.isDarkMode,
            });
        }
    }

    setModelLoader(modelLoader) {
        console.log("ModelLoader 설정됨:", modelLoader);
        this.modelLoader = modelLoader;
        if (this.dropboxService) {
            this.dropboxService.setModelLoader(modelLoader);
        }
    }

    // setTextPanel(textPanel) {
    //     this.textPanel = textPanel;
    // }

    async loadDropboxFolderContents(jsonUrl, isDirectLoad = false) {
        try {
            this.lastJsonUrl = jsonUrl;
            console.log("입력 URL:", jsonUrl);

            // Dropbox URL 유효성 검사 (dropbox.com 또는 dropboxusercontent.com 허용)
            if (!jsonUrl.includes("dropbox.com") && !jsonUrl.includes("dropboxusercontent.com")) {
                throw new Error("올바른 Dropbox 링크가 아닙니다.");
            }

            // JSON 파일 로드 및 처리
            // isJsonFile=true로 설정하여 폴더 링크인 경우 model.json 경로 자동 추가
            const directUrl = this.dropboxService.getDirectDownloadUrl(jsonUrl, true);
            console.log("변환된 JSON URL:", directUrl);
            const response = await fetch(directUrl);
            if (!response.ok) {
                throw new Error("JSON 파일을 불러올 수 없습니다.");
            }

            const data = await response.json();
            console.log("불러온 JSON 데이터:", data);

            // 로고 데이터 처리 - onJsonLoaded 콜백이 있으면 호출
            if (
                data.logo &&
                this.liverViewer &&
                typeof this.onJsonLoaded === "function"
            ) {
                console.log("로고 데이터 발견, 콜백 실행:", data.logo);
                this.onJsonLoaded(data);
            }

            // UI 업데이트 또는 데이터 저장
            // isDirectLoad일 때도 모델 리스트를 업데이트해야 UI에 표시됨
            await this.updateModelList(data);
            this.lastLoadedModels = data.models || [];

            return data;
        } catch (error) {
            console.error("전체 처리 중 오류:", error);
            throw error;
        }
    }

    async handleTableDisplay(model) {
        // TextPanel 닫기
        if (this.liverViewer.textPanel) {
            this.liverViewer.textPanel.close();
        }

        if (model.tableUrl) {
            try {
                const response = await fetch(
                    this.dropboxService.getDirectDownloadUrl(model.tableUrl)
                );
                const tableText = await response.text();

                let tableHTML = "";

                // case 값을 정규화 (대소문자 무시, 공백 제거)
                const normalizedCase = model.case ? model.case.trim().toUpperCase() : "";
                // 모델 이름도 확인 (HVT, RL 등을 구분하기 위해)
                const modelName = model.name ? model.name.trim().toUpperCase() : "";
                console.log("Table display - model.case:", model.case, "normalized:", normalizedCase, "model.name:", model.name);

                if (normalizedCase === "HCC") {
                    tableHTML = this.tableGenerator.createHCCTable(
                        tableText,
                        model.case
                    );
                } else if (normalizedCase === "KT" || normalizedCase === "LDKT") {
                    tableHTML = this.tableGenerator.createKTTable(
                        tableText,
                        model.case
                    );
                } else if (normalizedCase === "LDLT" || normalizedCase === "LDLT RL" || normalizedCase.includes("LDLT")) {
                    // LDLT인 경우 모델 이름을 확인하여 HVT 또는 RL 테이블 선택
                    if (modelName.includes("HVT") || modelName.includes("HVt") || modelName.includes("HVT")) {
                        // HVT 테이블 (HTML 형식)
                        console.log("HVT 테이블 사용 (모델 이름 기반):", model.name);
                        tableHTML = this.tableGenerator.createHVTTable(
                            tableText,
                            model.case || "LDLT"
                        );
                    } else {
                        // RL 테이블 (기본 LDLT 테이블)
                        console.log("LDLT RL 테이블 사용 (모델 이름 기반):", model.name);
                        tableHTML = this.tableGenerator.createLDLTTable(
                            tableText,
                            model.case
                        );
                    }
                } else if (normalizedCase === "HVT" || (normalizedCase.includes("LDLT") && model.case?.toLowerCase().includes("hvt"))) {
                    // case에 직접 HVT가 명시된 경우
                    console.log("HVT 테이블 사용 (case 기반):", model.case);
                    tableHTML = this.tableGenerator.createHVTTable(
                        tableText,
                        model.case || "LDLT"
                    );
                } else {
                    console.warn("Unknown case type, using HCC table:", model.case);
                    tableHTML = this.tableGenerator.createHCCTable(
                        tableText,
                        model.case || "Unknown"
                    );
                }

                if (this.liverViewer.textPanel) {
                    this.liverViewer.textPanel.updateContent(tableHTML);
                }
            } catch (error) {
                console.error("테이블 데이터 로드 실패:", error);
                if (this.liverViewer.textPanel) {
                    this.liverViewer.textPanel.updateContent("");
                }
            }
        } else {
            if (this.liverViewer.textPanel) {
                this.liverViewer.textPanel.updateContent("");
            }
        }
    }

    extractFolderPath(url) {
        // Dropbox 폴더 URL에서 필요한 정보 추출
        const match = url.match(/\/fo\/([^/]+)/);
        return match ? match[1] : null;
    }

    async updateModelList(data) {
        try {
            // 데이터 유효성 검사
            if (!data) {
                return; // 조용히 리턴
            }

            // 모델 배열 확인
            const models = Array.isArray(data) ? data : data.models;
            if (!models || !Array.isArray(models)) {
                return; // 조용히 리턴
            }

            // container나 modelList가 없으면 조용히 리턴
            if (!this.container || !this.modelList) {
                return;
            }

            // 기존 모델 리스트 초기화
            this.modelList.innerHTML = "";

            // models 처리
            if (!models || !Array.isArray(models)) {
                console.error("Invalid models data:", models);
                return;
            }

            this.lastLoadedModels = models;

            // 기존 컨테이너 제거
            const oldContainer = document.getElementById("model-list");
            if (oldContainer) {
                oldContainer.remove();
            }

            // 새 컨테이너 생성
            const container = document.createElement("div");
            container.id = "model-list";

            const isMobile = new DeviceDetector().isMobile();
            const containerWidth = 300; // 원래 컨테이너 크기
            const cardWidth = (containerWidth / 3) * 1.5; // 카드 크기를 컨테이너의 50%로 축소

            // 캐러셀 컨테이너 스타일
            Object.assign(container.style, {
                display: "flex",
                gap: "0",
                overflowX: "auto",
                overflowY: "hidden",
                width: `${containerWidth}px`,
                boxSizing: "border-box",
                scrollSnapType: "x mandatory", // carousel 정상 동작을 위해 복원
                position: "relative",
                paddingLeft: `${(containerWidth - cardWidth) / 2}px`,
                paddingRight: `${(containerWidth - cardWidth) / 2}px`,
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
                scrollBehavior: "smooth",
                scrollSnapStop: "always", // carousel 정상 동작을 위해 복원
            });

            // 타일 정의 업데이트
            const style = document.createElement("style");
            style.textContent = `
                #model-list::-webkit-scrollbar {
                    display: none;
                }
                .model-item {
                    scroll-snap-align: center; /* carousel 정상 동작을 위해 복원 */
                    transition: all 0.3s ease;
                    opacity: 0.4;
                    transform: scale(0.85);
                    filter: brightness(0.7);
                    background-color: ${
                        this.isDarkMode
                            ? "rgba(255, 255, 255, 0.1)"
                            : "rgba(240, 240, 240, 0.95)"
                    } !important;
                }
                .model-item.active {
                    opacity: 1;
                    transform: scale(1);
                    filter: brightness(1);
                    z-index: 2;
                }
                .pagination-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: ${
                        this.isDarkMode
                            ? "rgba(255, 255, 255, 0.3)"
                            : "rgba(0, 0, 0, 0.3)"
                    };
                    transition: all 0.3s ease;
                }
                .pagination-dot.active {
                    background-color: ${
                        this.isDarkMode ? "white" : "rgba(0, 0, 0, 0.9)"
                    };
                    transform: scale(1.2);
                }
                #model-list-title {
                    color: ${
                        this.isDarkMode
                            ? "rgba(255, 255, 255, 0.8)"
                            : "rgba(0, 0, 0, 0.8)"
                    } !important;
                }
            `;
            document.head.appendChild(style);

            // 스크롤 이벤트로 중앙 아이템 활성 개선
            let scrollTimeout;
            let isScrollDisabled = false; // 스크롤 이벤트 비활성화 플래그
            
            const scrollHandler = () => {
                if (scrollTimeout) {
                    clearTimeout(scrollTimeout);
                }

                // 스크롤이 비활성화되어 있으면 처리하지 않음
                if (isScrollDisabled) return;

                scrollTimeout = setTimeout(() => {
                    const items = container.querySelectorAll(".model-item");
                    const dots =
                        dotsContainer.querySelectorAll(".pagination-dot");
                    const containerCenter =
                        container.scrollLeft + container.offsetWidth / 2;

                    items.forEach((item, index) => {
                        const itemCenter =
                            item.offsetLeft + item.offsetWidth / 2;
                        const distanceFromCenter = Math.abs(
                            containerCenter - itemCenter
                        );

                        if (distanceFromCenter < item.offsetWidth / 2) {
                            items.forEach((i) => {
                                i.classList.remove("active");
                                i.style.zIndex = "1";
                            });
                            item.classList.add("active");
                            item.style.zIndex = "2";

                            dots.forEach((dot, i) => {
                                if (i === index) {
                                    dot.classList.add("active");
                                    dot.style.backgroundColor = this.isDarkMode
                                        ? "white"
                                        : "black";
                                } else {
                                    dot.classList.remove("active");
                                    dot.style.backgroundColor = this.isDarkMode
                                        ? "rgba(255, 255, 255, 0.3)"
                                        : "rgba(0, 0, 0, 0.3)";
                                }
                            });
                        }
                    });
                }, 50);
            };
            
            container.addEventListener("scroll", scrollHandler);
            
            // 스크롤 이벤트 제어를 위한 메서드 추가
            this.disableScroll = () => { isScrollDisabled = true; };
            this.enableScroll = () => { isScrollDisabled = false; };

            // 좌우 버튼 추가
            const createNavigationButton = (direction) => {
                const button = document.createElement("button");
                
                // 현재 테마 상태를 여러 소스에서 확인
                const liverViewerDarkMode = this.liverViewer ? this.liverViewer.isDarkMode : null;
                const bodyDarkMode = document.body.classList.contains('dark-mode');
                const computedDarkMode = getComputedStyle(document.body).backgroundColor.includes('26, 26, 26');
                const currentIsDarkMode = liverViewerDarkMode !== null ? liverViewerDarkMode : (bodyDarkMode || computedDarkMode);
                
                Object.assign(button.style, {
                    position: "absolute",
                    top: "50%",
                    transform: "translateY(-50%)",
                    [direction]: "5px",
                    backgroundColor: currentIsDarkMode ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.8)",
                    color: currentIsDarkMode ? "white" : "black",
                    border: "none",
                    borderRadius: "50%",
                    width: "30px",
                    height: "30px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    zIndex: "3",
                    opacity: "0.7",
                    transition: "opacity 0.3s",
                });

                // 구글 아이콘 SVG 적용
                const svg = document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "svg"
                );
                svg.setAttribute("width", "24");
                svg.setAttribute("height", "24");
                svg.setAttribute("viewBox", "0 0 24 24");
                svg.setAttribute("fill", currentIsDarkMode ? "white" : "black");

                const path = document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "path"
                );
                if (direction === "left") {
                    // chevron_left 아이콘
                    path.setAttribute(
                        "d",
                        "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"
                    );
                } else {
                    // chevron_right 아이콘
                    path.setAttribute(
                        "d",
                        "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"
                    );
                }

                svg.appendChild(path);
                button.appendChild(svg);

                button.onmouseover = () => (button.style.opacity = "1");
                button.onmouseleave = () => (button.style.opacity = "0.7");

                return button;
            };

            const wrapper = document.createElement("div");
            Object.assign(wrapper.style, {
                position: "relative",
                width: "100%",
                paddingBottom: "45px",
            });

            const prevButton = createNavigationButton("left");
            const nextButton = createNavigationButton("right");

            // 슬라이드 이동 함수
            const moveToItem = (direction) => {
                console.log("moveToItem 호출됨:", direction, "로딩 상태:", this.isLoading);
                
                // 로딩 중이면 carousel 이동 완전 차단
                if (this.isLoading) {
                    console.log("로딩 중 - carousel 이동 완전 차단");
                    return;
                }
                
                // 모델 로딩 중이면 carousel 이동 차단
                if (this.isLoading) {
                    console.log("모델 로딩 중 - carousel 이동 차단");
                    return;
                }
                
                const items = container.querySelectorAll(".model-item");
                const dots = dotsContainer.querySelectorAll(".pagination-dot");
                const activeItem =
                    container.querySelector(".model-item.active");
                if (!activeItem) return;

                const currentIndex = Array.from(items).indexOf(activeItem);
                const targetIndex =
                    direction === "next"
                        ? Math.min(currentIndex + 1, items.length - 1)
                        : Math.max(currentIndex - 1, 0);

                // carousel 스크롤 복원 (로딩 중이 아닐 때만)
                if (!this.isLoading) {
                    items[targetIndex].scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                        inline: "center",
                    });
                }

                // 부드러운 전환을 위한 타이밍 조정
                setTimeout(() => {
                    // dots 업데이트
                    dots.forEach((dot, i) => {
                        if (i === targetIndex) {
                            dot.classList.add("active");
                            dot.style.backgroundColor = this.isDarkMode
                                ? "white"
                                : "black";
                        } else {
                            dot.classList.remove("active");
                            dot.style.backgroundColor = this.isDarkMode
                                ? "rgba(255, 255, 255, 0.3)"
                                : "rgba(0, 0, 0, 0.3)";
                        }
                    });

                    // 아이템 활성화 상태 업데이트
                    items.forEach((item, i) => {
                        if (i === targetIndex) {
                            item.classList.add("active");
                            item.style.zIndex = "2";
                        } else {
                            item.classList.remove("active");
                            item.style.zIndex = "1";
                        }
                    });
                }, 100); // 약간의 지연 추가
            };

            // 버튼 클릭 이벤트
            prevButton.onclick = () => moveToItem("prev");
            nextButton.onclick = () => moveToItem("next");

            // 터치 이벤트 처리
            let touchStartX = 0;
            let touchEndX = 0;
            let isSwiping = false;
            this.touchStartTime = 0; // 터치 시작 시간 추가

            container.addEventListener(
                "touchstart",
                (e) => {
                    // 로딩 중이면 터치 이벤트 무시
                    if (this.isLoading) {
                        console.log("터치 시작 차단 - 로딩 중");
                        isSwiping = false;
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    touchStartX = e.touches[0].clientX;
                    this.touchStartTime = Date.now(); // 터치 시작 시간 기록
                    isSwiping = true;
                },
                { passive: false }
            );

            container.addEventListener(
                "touchmove",
                (e) => {
                    if (!isSwiping || this.isLoading) {
                        if (this.isLoading) {
                            console.log("터치 이동 차단 - 로딩 중");
                            e.preventDefault();
                            e.stopPropagation();
                        }
                        return;
                    }
                    touchEndX = e.touches[0].clientX;
                },
                { passive: false }
            );

            container.addEventListener("touchend", (e) => {
                if (!isSwiping || this.isLoading) {
                    if (this.isLoading) {
                        console.log("터치 종료 차단 - 로딩 중");
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    return;
                }

                const swipeDistance = touchEndX - touchStartX;
                // 모바일에서 민감도 낮춤: 50px → 100px, 최소 스와이프 시간 추가
                const minSwipeDistance = this.isMobile ? 100 : 50;
                const swipeTime = Date.now() - this.touchStartTime;
                const minSwipeTime = 200; // 최소 200ms 이상 스와이프해야 함
                
                if (Math.abs(swipeDistance) > minSwipeDistance && swipeTime > minSwipeTime) {
                    // 모바일에서 스와이프 속도 제한 (너무 빠른 스와이프 방지)
                    const swipeSpeed = Math.abs(swipeDistance) / swipeTime;
                    const maxSwipeSpeed = this.isMobile ? 2.0 : 5.0; // px/ms
                    
                    if (swipeSpeed <= maxSwipeSpeed) {
                        console.log(`스와이프 감지: 거리=${Math.abs(swipeDistance)}px, 시간=${swipeTime}ms, 속도=${swipeSpeed.toFixed(2)}px/ms`);
                        moveToItem(swipeDistance > 0 ? "prev" : "next");
                    } else {
                        console.log(`스와이프 무시: 속도가 너무 빠름 (${swipeSpeed.toFixed(2)}px/ms > ${maxSwipeSpeed}px/ms)`);
                    }
                } else {
                    console.log(`스와이프 무시: 거리=${Math.abs(swipeDistance)}px, 시간=${swipeTime}ms (임계값: ${minSwipeDistance}px, ${minSwipeTime}ms)`);
                }

                isSwiping = false;
            });

            // 키드 이벤트 처리
            document.addEventListener("keydown", (e) => {
                if (this.dialog && !this.isLoading) {
                    if (e.key === "ArrowLeft") {
                        moveToItem("prev");
                    } else if (e.key === "ArrowRight") {
                        moveToItem("next");
                    }
                }
            });

            // 모델 카드에 클릭 이벤트 추가
            models.forEach((model, index) => {
                const item = document.createElement("div");
                item.className = "model-item";
                if (index === 0) item.classList.add("active");

                Object.assign(item.style, {
                    flex: `0 0 ${cardWidth}px`,
                    width: `${cardWidth}px`,
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    marginRight: "-15px", // 다음 카드가 살짝 보이도록
                    position: "relative",
                    zIndex: index === 0 ? "2" : "1",
                    boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                });

                // 썸네일 컨테이너 크기도 조정
                const thumbnailContainer = document.createElement("div");
                Object.assign(thumbnailContainer.style, {
                    width: "100%",
                    height: `${cardWidth}px`, // 정사각형 유지
                    backgroundColor: "rgba(0, 0, 0, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                });

                if (model.thumbnailUrl) {
                    const img = document.createElement("img");
                    img.src = this.dropboxService.getDirectDownloadUrl(
                        model.thumbnailUrl
                    );
                    Object.assign(img.style, {
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                    });
                    thumbnailContainer.appendChild(img);
                } else {
                    const defaultIcon = document.createElement("div");
                    defaultIcon.innerHTML = "🔲";
                    defaultIcon.style.fontSize = "24px";
                    thumbnailContainer.appendChild(defaultIcon);
                }

                item.appendChild(thumbnailContainer);

                // 텍스트 컨테이너
                const textContainer = document.createElement("div");
                Object.assign(textContainer.style, {
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                });

                const name = document.createElement("div");
                name.textContent = model.name;
                Object.assign(name.style, {
                    fontWeight: "bold",
                    color: this.isDarkMode ? "white" : "black",
                    fontSize: "14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                });
                textContainer.appendChild(name);

                if (model.description) {
                    const description = document.createElement("div");
                    description.textContent = model.description;
                    Object.assign(description.style, {
                        fontSize: "12px",
                        color: this.isDarkMode
                            ? "rgba(255, 255, 255, 0.7)"
                            : "rgba(0, 0, 0, 0.7)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    });
                    textContainer.appendChild(description);
                }

                item.appendChild(textContainer);

                                // 모델 클릭 이벤트 수정
                item.addEventListener("click", async (e) => {
                    // 이벤트 전파 차단 (carousel 넘어감 방지)
                    e.stopPropagation();
                    e.preventDefault();
                    
                    console.log("모델 클릭됨:", model.name, "활성 상태:", item.classList.contains("active"), "모바일:", this.isMobile);
                    
                    // 활성 카드인 경우에만 모델 로드 허용 (carousel 이동 방지)
                    if (item.classList.contains("active")) {
                        // 모바일에서 추가적인 carousel 이동 방지
                        if (this.isMobile) {
                            // 모바일에서 즉시 로딩 상태 설정
                            this.isLoading = true;
                            console.log("모바일 - 즉시 로딩 상태 설정");
                        }
                        // carousel 이동 완전 차단
                        console.log("모델 로드 시작 - carousel 이동 차단");
                        
                        try {
                            const directGlbUrl = this.dropboxService.getDirectDownloadUrl(model.glbUrl);
                            console.log("모델 로드 시도:", directGlbUrl);

                            if (this.liverViewer && this.liverViewer.modelLoader) {
                                // carousel 모든 이벤트 비활성화
                                if (this.disableScroll) {
                                    this.disableScroll();
                                }
                                
                                // 터치 이벤트 일시 비활성화
                                container.style.pointerEvents = 'none';
                                
                                // 스크롤 동작 완전 비활성화
                                container.style.scrollBehavior = 'auto';
                                container.style.overflowX = 'hidden';
                                
                                // 로딩 상태 시작
                                this.isLoading = true;
                                item.classList.add('loading');
                                
                                // 로딩 상태 표시
                                const loadingIndicator = document.createElement("div");
                                loadingIndicator.textContent = "Loading...";
                                loadingIndicator.style.position = "absolute";
                                loadingIndicator.style.top = "50%";
                                loadingIndicator.style.left = "50%";
                                loadingIndicator.style.transform = "translate(-50%, -50%)";
                                loadingIndicator.style.color = this.isDarkMode ? "white" : "black";
                                item.appendChild(loadingIndicator);

                                // 모델 로드
                                await this.loadModel(directGlbUrl, index);
                                console.log("모델 로드 성공");

                                // 로딩 인디케이터 제거
                                loadingIndicator.remove();
                                
                                // 로딩 상태 종료
                                this.isLoading = false;
                                item.classList.remove('loading');
                                
                                // carousel 모든 이벤트 재활성화
                                if (this.enableScroll) {
                                    this.enableScroll();
                                }
                                
                                // 터치 이벤트 재활성화
                                container.style.pointerEvents = 'auto';
                                
                                // 스크롤 동작 재활성화
                                container.style.scrollBehavior = 'smooth';
                                container.style.overflowX = 'auto';
                                
                                console.log("모델 로드 완료 - carousel 이벤트 재활성화");

                                // TextPanel 닫기
                                if (this.liverViewer.textPanel) {
                                    this.liverViewer.textPanel.close();
                                }

                                await this.handleTableDisplay(model);

                                // ModelSelector 닫기
                                this.close();

                                // URL 업데이트 (선택사항)
                                const currentUrl = new URL(window.location.href);
                                currentUrl.searchParams.set("model", model.name);
                                window.history.pushState({}, "", currentUrl);
                            } else {
                                console.error("modelLoader가 설정되지 않았습니다.");
                                throw new Error("modelLoader가 설정되지 않았습니다.");
                            }
                        } catch (error) {
                            console.error("모델 로드 실패:", error);
                            // 로딩 상태 종료 (에러 시에도)
                            this.isLoading = false;
                            item.classList.remove('loading');
                            
                            // carousel 모든 이벤트 재활성화 (에러 시에도)
                            if (this.enableScroll) {
                                this.enableScroll();
                            }
                            
                            // 터치 이벤트 재활성화 (에러 시에도)
                            container.style.pointerEvents = 'auto';
                            
                            // 스크롤 동작 재활성화 (에러 시에도)
                            container.style.scrollBehavior = 'smooth';
                            container.style.overflowX = 'auto';
                            
                            alert("모델을 로드하는데 실패했습니다: " + error.message);
                        }
                    } else {
                        // 비활성 카드 클릭 시 스크롤 기능 제거 (carousel 넘어감 문제 해결)
                        // 사용자가 원할 때만 수동으로 스크롤하도록 함
                        console.log("비활성 카드 클릭됨 - 스크롤 동작 비활성화");
                    }
                });

                container.appendChild(item);
            });

            // dots 컨테이너 스타일 수정
            const dotsContainer = document.createElement("div");
            Object.assign(dotsContainer.style, {
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
                position: "absolute",
                bottom: "10px",
                left: "0",
                right: "0",
                height: "20px",
                zIndex: "3",
            });

            // 페이지네이션 닷 생성 분 명시적 작성
            models.forEach((_, index) => {
                const dot = document.createElement("div");
                dot.className = "pagination-dot";
                if (index === 0) dot.classList.add("active");

                // 개별 dot 스타일 추가
                Object.assign(dot.style, {
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor:
                        index === 0 ? "white" : "rgba(255, 255, 255, 0.3)",
                    transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                    cursor: "pointer",
                });

                dotsContainer.appendChild(dot);
            });

            // 순서 확인
            wrapper.appendChild(prevButton);
            wrapper.appendChild(container);
            wrapper.appendChild(nextButton);
            wrapper.appendChild(dotsContainer);
            this.dialog.appendChild(wrapper);

            // 초기 스크롤 위치 설정 - carousel 문제 해결을 위해 제거
            // setTimeout(() => {
            //     const firstItem = container.querySelector(".model-item");
            //     if (firstItem) {
            //         firstItem.scrollIntoView({
            //             behavior: "smooth",
            //             block: "nearest",
            //             inline: "center",
            //         });
            //     }
            // }, 0);

            // 공유 버튼
            const shareButton = document.createElement("button");
            Object.assign(shareButton.style, {
                position: "absolute",
                bottom: "20px", // 하단에서 20px
                right: "20px", // 우측에서 20px
                background: "rgba(255, 149, 0, 0.8)",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                padding: "6px 12px",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                color: "white",
                fontSize: "12px",
                zIndex: "10", // 다른 요소들 위에 표시
            });

            // 공유 아이콘과 텍스트
            shareButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20.4,21.64H3.6c-1.11,0-2.01-.91-2.01-2.02v-4.29c0-.28.22-.5.5-.5s.5.22.5.5v4.29c0,.56.45,1.02,1.01,1.02h16.8c.56,0,1.01-.46,1.01-1.02v-4.34c0-.28.22-.5.5-.5s.5.22.5.5v4.34c0,1.12-.9,2.02-2.01,2.02Z"/>
                    <g>
                        <path d="M12,19.5c-.28,0-.5-.22-.5-.5V2.86c0-.28.22-.5.5-.5s.5.22.5.5v16.14c0,.28-.22.5-.5.5Z"/>
                        <path d="M16.92,8.51c-.13,0-.26-.05-.36-.15l-4.55-4.77-4.55,4.77c-.19.2-.51.21-.71.02-.2-.19-.21-.51-.02-.71l4.92-5.15c.19-.2.54-.2.72,0l4.92,5.15c.19.2.18.52-.02.71-.1.09-.22.14-.35.14Z"/>
                    </g>
                </svg>
                Share
            `;

            // hover 효과 추가
            shareButton.onmouseover = () => {
                shareButton.style.background = "rgba(0, 0, 0, 0.85)";
            };
            shareButton.onmouseleave = () => {
                shareButton.style.background = "rgba(0, 0, 0, 0.7)";
            };

            // 클릭 이벤트
            shareButton.onclick = async () => {
                if (this.lastJsonUrl) {
                    this.createShareableLink(this.lastJsonUrl);
                } else {
                    alert("공유할 모델이 로드되지 않았습니다.");
                }
            };

            this.dialog.appendChild(shareButton);
        } catch (error) {
            // 개발 모드에서만 로그 출력
            if (process.env.NODE_ENV === "development") {
                console.debug("모델 리스트 업데이트 중 오류:", error);
            }
        }
    }

    show() {
        if (this.dialog) {
            return;
        }

        // carousel 스크롤 위치 보존을 위한 변수
        this.savedScrollPosition = 0;

        // 현재 테마 상태 확인 (여러 소스에서 확인)
        const liverViewerDarkMode = this.liverViewer ? this.liverViewer.isDarkMode : null;
        const bodyDarkMode = document.body.classList.contains('dark-mode');
        const computedDarkMode = getComputedStyle(document.body).backgroundColor.includes('26, 26, 26');
        
        this.isDarkMode = liverViewerDarkMode !== null ? liverViewerDarkMode : (bodyDarkMode || computedDarkMode);
        console.log("ModelSelector show - current theme:", this.isDarkMode, {
            liverViewerDarkMode,
            bodyDarkMode,
            computedDarkMode
        });

        // 현재 선택된 모델의 위치로 carousel 스크롤
        if (this.lastLoadedModels && this.currentModelIndex >= 0) {
            console.log("Scrolling to current model index:", this.currentModelIndex);
            // 약간의 지연 후 carousel 위치 설정
            setTimeout(() => {
                const container = document.querySelector('#model-list');
                if (container && this.lastLoadedModels.length > this.currentModelIndex) {
                    const cardWidth = this.isMobile ? 120 : 150;
                    const scrollPosition = this.currentModelIndex * cardWidth;
                    container.scrollLeft = scrollPosition;
                    console.log("Carousel scrolled to position:", scrollPosition);
                }
            }, 100);
        }

        const bgColor = this.isDarkMode
            ? "rgba(0, 0, 0, 0.9)"
            : "rgba(245, 245, 245, 0.95)";
        const textColor = this.isDarkMode ? "white" : "black";

        this.dialog = document.createElement("div");
        Object.assign(this.dialog.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: this.isDarkMode
                ? "rgba(40, 40, 40, 0.95)"
                : "rgba(255, 255, 255, 0.95)",
            padding: "20px",
            borderRadius: "10px",
            zIndex: "1001",
            color: textColor,
            minWidth: "300px",
            boxShadow: this.isDarkMode
                ? "0 0 10px rgba(0, 0, 0, 0.5)"
                : "0 0 10px rgba(0, 0, 0, 0.2)",
            transition: "all 0.3s ease",
        });

        // 닫기 버튼
        const closeButton = document.createElement("button");
        closeButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${textColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;
        Object.assign(closeButton.style, {
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "none",
            border: "none",
            color: textColor,
            cursor: "pointer",
            padding: "5px",
        });
        closeButton.onclick = this.close;
        this.dialog.appendChild(closeButton);

        // 제목
        const title = document.createElement("h3");
        title.textContent = "Import 3D model";
        title.style.marginBottom = "20px";
        title.style.color = textColor;
        this.dialog.appendChild(title);

        // Dropbox 링크 입력 필드
        const inputContainer = document.createElement("div");
        Object.assign(inputContainer.style, {
            marginBottom: "20px",
            display: "flex",
            gap: "8px",
            alignItems: "center",
        });

        const input = document.createElement("input");
        Object.assign(input.style, {
            flex: "1",
            height: "32px",
            padding: "0 12px",
            backgroundColor: this.isDarkMode
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.05)",
            border: this.isDarkMode
                ? "1px solid rgba(255, 255, 255, 0.3)"
                : "1px solid rgba(0, 0, 0, 0.2)",
            borderRadius: "4px",
            color: textColor,
            fontSize: "13px",
        });
        input.placeholder = "paste dropbox link";

        const loadButton = document.createElement("button");
        loadButton.textContent = "Load";
        Object.assign(loadButton.style, {
            height: "32px",
            padding: "0 16px",
            backgroundColor: "#764ba2",
            border: "none",
            borderRadius: "4px",
            color: "white",
            cursor: "pointer",
        });

        inputContainer.appendChild(input);
        inputContainer.appendChild(loadButton);
        this.dialog.appendChild(inputContainer);

        // 구분선
        const divider = document.createElement("div");
        divider.style.borderTop = this.isDarkMode
            ? "1px solid rgba(255, 255, 255, 0.3)"
            : "1px solid rgba(0, 0, 0, 0.8)";
        divider.style.margin = "20px 0";
        this.dialog.appendChild(divider);

        // 기존 모델 목록
        const listTitle = document.createElement("h4");
        listTitle.id = "model-list-title";
        listTitle.textContent = "3D model list";
        Object.assign(listTitle.style, {
            fontSize: "14px",
            color: this.isDarkMode
                ? "rgba(255, 255, 255, 0.8)"
                : "rgba(0, 0, 0, 0.8)",
            fontWeight: "500",
            margin: "0 0 20px 0",
            padding: "0",
        });

        this.dialog.appendChild(listTitle);

        // 마지막으로 로드된 모델이 있다면 보여주기
        if (this.lastLoadedModels) {
            this.updateModelList(this.lastLoadedModels);
        }

        document.body.appendChild(this.dialog);

        // 테마 적용을 위한 스타일 시트 추가
        this.updateTheme(this.isDarkMode);

        // 이벤트 리스너
        loadButton.onclick = async () => {
            const url = input.value.trim();
            if (url) {
                try {
                    loadButton.disabled = true;
                    loadButton.textContent = "loading...";
                    await this.loadDropboxFolderContents(url);
                } catch (error) {
                    console.error("파일 로드 중 오류:", error);
                    alert(error.message || "파일을 로드하는데 실패했습니다.");
                } finally {
                    loadButton.disabled = false;
                    loadButton.textContent = "load";
                }
            }
        };
    }

    convertDropboxLink(url) {
        try {
            if (url.includes("dropbox.com")) {
                const match = url.match(/\/([a-z0-9]+)\/([^?]+)/i);
                if (!match) {
                    throw new Error("Invalid Dropbox URL format");
                }

                const fileId = match[1];
                const filePath = decodeURIComponent(match[2]);

                // 새로 형식의 직접 다운로드 URL 생성
                const directLink = `https://dl.dropboxusercontent.com/scl/fi/${fileId}/${filePath}`;
                console.log("변환된 Dropbox 링크:", directLink);
                return directLink;
            }
            return url;
        } catch (error) {
            console.error("Error converting Dropbox link:", error);
            return url;
        }
    }

    getModelName(path) {
        return path.split("/").pop().replace(".glb", "");
    }

    close() {
        try {
            if (this.dialog && document.body.contains(this.dialog)) {
                // carousel 스크롤 위치 보존을 위한 지연
                setTimeout(() => {
                    document.body.removeChild(this.dialog);
                    this.dialog = null;
                    
                    // carousel 스크롤 위치 복원
                    if (this.savedScrollPosition !== undefined) {
                        const container = document.querySelector('#model-list');
                        if (container) {
                            container.scrollLeft = this.savedScrollPosition;
                        }
                    }
                }, 50);
            }
        } catch (error) {
            console.error("Error closing dialog:", error);
        }
    }

    async loadModel(modelUrl, modelIndex = null) {
        console.log("loadModel called with URL:", modelUrl, "modelIndex:", modelIndex);

        try {
            // 현재 선택된 모델 인덱스 저장
            if (modelIndex !== null) {
                this.currentModelIndex = modelIndex;
                console.log("Current model index saved:", this.currentModelIndex);
            }

            // 드롭박스 URL인 경우, 폴더 URL 추출 시도
            // modelUrl이 드롭박스 공유 링크인 경우 lastJsonUrl 업데이트
            if (modelUrl && (modelUrl.includes('dropbox.com') || modelUrl.includes('dropboxusercontent.com'))) {
                try {
                    // 개별 파일 URL에서 폴더 URL 추출
                    const url = new URL(modelUrl);
                    const pathParts = url.pathname.split('/').filter(part => part);
                    const sclIndex = pathParts.indexOf('scl');
                    if (sclIndex !== -1) {
                        const sclType = pathParts[sclIndex + 1]; // 'fo' 또는 'fi'
                        if (sclType === 'fo' || sclType === 'fi') {
                            const folderId = pathParts[sclIndex + 2];
                            if (folderId) {
                                // 폴더 URL 생성 (model.json이 있는 폴더)
                                const folderUrl = `https://www.dropbox.com/scl/${sclType}/${folderId}/?dl=0`;
                                
                                // lastJsonUrl이 없거나 다른 폴더인 경우에만 업데이트
                                if (!this.lastJsonUrl || !this.lastJsonUrl.includes(folderId)) {
                                    this.lastJsonUrl = folderUrl;
                                    console.log("📋 lastJsonUrl 업데이트 (모델 URL에서 추출):", this.lastJsonUrl);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.warn("모델 URL에서 폴더 URL 추출 실패:", error);
                }
            }

            if (this.liverViewer && this.liverViewer.modelLoader) {
                console.log("Starting model load");
                await this.liverViewer.modelLoader.loadModel(modelUrl);
                console.log("Model loaded successfully");

                // 카메라 상태 기록기는 삭제되었으므로 제거
                // if (this.liverViewer.controlManager && this.liverViewer.controlManager.getCameraStateRecorder) {
                //     const recorder = this.liverViewer.controlManager.getCameraStateRecorder();
                //     if (recorder) {
                //         recorder.setModelSelector(this);
                //         recorder.updateDropboxUrl();
                //     }
                // }

                console.log("Model and patient info load completed");
                this.close();
            } else {
                console.error("ModelLoader not available:", {
                    hasLiverViewer: !!this.liverViewer,
                    hasModelLoader: !!this.liverViewer?.modelLoader,
                });
                throw new Error("modelLoader가 설정되지 않았습니다.");
            }
        } catch (error) {
            console.error("Model load failed:", error);
            console.error("Error details:", {
                message: error.message,
                stack: error.stack,
            });
            alert("모델을 로드하는데 실패했습니다: " + error.message);
        }
    }

    updateTheme(isDarkMode) {
        console.log("ModelSelector updateTheme called with isDarkMode:", isDarkMode);
        // 항상 상태 업데이트
        this.isDarkMode = isDarkMode;
        console.log("ModelSelector isDarkMode updated to:", this.isDarkMode);

        if (this.dialog && this.dialog.isConnected) {
            // Import 3D Model 제목 업데이트
            const importTitle = this.dialog.querySelector("h3");
            if (importTitle) {
                importTitle.style.color = isDarkMode ? "#ffffff" : "#000000";
            }

            // 3D Model List 제목 업데이트 - 이 부분을 수정
            const modelListTitle = this.dialog.querySelector(
                "#model-list-title, .model-list-title"
            );
            if (modelListTitle) {
                modelListTitle.style.color = isDarkMode ? "#ffffff" : "#000000";
            }

            // Dropbox URL 입력 필드 업데이트
            const urlInput = this.dialog.querySelector("input");
            if (urlInput) {
                Object.assign(urlInput.style, {
                    backgroundColor: isDarkMode ? "#333" : "#fff",
                    color: isDarkMode ? "#fff" : "#000",
                    border: `1px solid ${isDarkMode ? "#444" : "#ddd"}`,
                });
            }

            // 1. 모델 아이템 업데이트
            const modelItems = this.dialog.querySelectorAll(".model-item");
            modelItems.forEach((item) => {
                // 배경색 업데이트
                item.style.backgroundColor = isDarkMode
                    ? "rgba(20, 20, 20, 0.95)"
                    : "rgba(240, 240, 240, 0.95)";

                // 구분선 업데이트
                item.style.borderBottom = `1px solid ${
                    isDarkMode
                        ? "rgba(255, 255, 255, 0.1)"
                        : "rgba(0, 0, 0, 0.1)"
                }`;

                // 모델 카드 내 모든 텍스트 요소 찾기
                const textElements = item.querySelectorAll(
                    ".model-name, .model-description, div"
                );
                textElements.forEach((element) => {
                    if (element.classList.contains("model-name")) {
                        element.style.color = isDarkMode
                            ? "#ffffff"
                            : "#000000";
                    } else if (
                        element.classList.contains("model-description")
                    ) {
                        element.style.color = isDarkMode
                            ? "rgba(255, 255, 255, 0.7)"
                            : "rgba(0, 0, 0, 0.7)";
                    } else {
                        // 기타 텍스트 요소
                        element.style.color = isDarkMode
                            ? "#ffffff"
                            : "#000000";
                    }
                });
            });

            // 2. 페이지네이션 닷 업데이트
            const dots = this.dialog.querySelectorAll(".pagination-dot");
            dots.forEach((dot) => {
                if (dot.classList.contains("active")) {
                    dot.style.backgroundColor = isDarkMode
                        ? "#ffffff"
                        : "#000000";
                } else {
                    dot.style.backgroundColor = isDarkMode
                        ? "rgba(255, 255, 255, 0.3)"
                        : "rgba(0, 0, 0, 0.3)";
                }
            });

            // 3. 다이얼로그 배경색 업데이트
            this.dialog.style.backgroundColor = isDarkMode
                ? "rgba(20, 20, 20, 0.95)"
                : "rgba(240, 240, 240, 0.95)";

            // 4. 닫기 버튼 색상 업데이트
            const closeButton = this.dialog.querySelector("button svg");
            if (closeButton) {
                const lines = closeButton.querySelectorAll("line");
                lines.forEach((line) => {
                    line.setAttribute(
                        "stroke",
                        isDarkMode ? "#ffffff" : "#000000"
                    );
                });
            }

            // 5. Navigation 버튼 완전 재생성
            const existingNavButtons = this.dialog.querySelectorAll("button[data-nav-direction]");
            existingNavButtons.forEach(button => button.remove());
            
                         // 새로운 navigation 버튼 생성
             const createNavButton = (direction) => {
                 const button = document.createElement("button");
                 button.setAttribute("data-nav-direction", direction);
                 const currentIsDarkMode = isDarkMode || (this.liverViewer && this.liverViewer.isDarkMode);
                 
                 Object.assign(button.style, {
                     position: "absolute",
                     top: "50%",
                     transform: "translateY(-50%)",
                     [direction]: "5px",
                     backgroundColor: currentIsDarkMode ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.8)",
                     color: currentIsDarkMode ? "white" : "black",
                     border: "none",
                     borderRadius: "50%",
                     width: "30px",
                     height: "30px",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     cursor: "pointer",
                     zIndex: "3",
                     opacity: "0.7",
                     transition: "opacity 0.3s",
                 });

                 const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                 svg.setAttribute("width", "24");
                 svg.setAttribute("height", "24");
                 svg.setAttribute("viewBox", "0 0 24 24");
                 svg.setAttribute("fill", currentIsDarkMode ? "white" : "black");

                 const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                 path.setAttribute("fill", currentIsDarkMode ? "white" : "black");
                
                if (direction === "left") {
                    path.setAttribute("d", "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z");
                } else {
                    path.setAttribute("d", "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z");
                }

                svg.appendChild(path);
                button.appendChild(svg);
                
                // 이벤트 핸들러 추가
                button.onmouseover = () => (button.style.opacity = "1");
                button.onmouseleave = () => (button.style.opacity = "0.7");
                button.onclick = () => {
                    const container = this.dialog.querySelector('#model-list');
                    const items = container.querySelectorAll(".model-item");
                    const activeItem = container.querySelector(".model-item.active");
                    if (!activeItem) return;

                    const currentIndex = Array.from(items).indexOf(activeItem);
                    const targetIndex = direction === "left" 
                        ? Math.max(currentIndex - 1, 0)
                        : Math.min(currentIndex + 1, items.length - 1);

                    // 로딩 중이 아닐 때만 carousel 이동
                    if (!this.isLoading) {
                        items[targetIndex].scrollIntoView({
                            behavior: "smooth",
                            block: "nearest",
                            inline: "center"
                        });
                    }
                };

                return button;
            };

            // navigation 버튼들을 적절한 위치에 추가
            const modelListContainer = this.dialog.querySelector('#model-list');
            if (modelListContainer) {
                const leftButton = createNavButton("left");
                const rightButton = createNavButton("right");
                
                modelListContainer.parentElement.appendChild(leftButton);
                modelListContainer.parentElement.appendChild(rightButton);
            }

            console.log("Theme update completed:", {
                isDarkMode,
                itemsUpdated: modelItems.length,
                dotsUpdated: dots.length,
            });
        }
    }

    createModelItem(model, index) {
        const item = document.createElement("div");
        item.className = "model-item";

        const content = document.createElement("div");
        content.style.padding = "20px";

        const name = document.createElement("div");
        name.className = "model-name";
        name.textContent = model.name;
        name.style.color = this.isDarkMode ? "#ffffff" : "#000000"; // 명확한 색상값 사용
        name.style.fontSize = "16px";
        name.style.fontWeight = "bold";
        name.style.marginBottom = "8px";

        const description = document.createElement("div");
        description.className = "model-description";
        description.textContent = model.description;
        description.style.color = this.isDarkMode
            ? "rgba(255, 255, 255, 0.7)"
            : "rgba(0, 0, 0, 0.7)"; // 명확한 색상값 사용
        description.style.fontSize = "14px";

        content.appendChild(name);
        content.appendChild(description);
        item.appendChild(content);

        return item;
    }

    // 공유 가능한 링크 생성
    createShareableLink(jsonUrl) {
        const baseUrl = window.location.origin;
        const encodedJsonUrl = encodeURIComponent(jsonUrl);

        // 기본 공유 URL 생성
        const shareUrl = `${baseUrl}/?json=${encodedJsonUrl}`;

        console.log("Creating shareable link...");
        console.log("JSON URL:", jsonUrl);
        console.log("Generated share link:", shareUrl);

        this.showShareDialog(shareUrl);
    }

    // 공유 다이얼로그 표시
    showShareDialog(fullUrl) {
        const dialog = document.createElement("div");
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        const content = document.createElement("div");
        content.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            border-radius: 15px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            color: white;
        `;

        content.innerHTML = `
            <div style="text-align: center; margin-bottom: 25px;">
                <h2 style="margin: 0 0 10px 0; color: white; font-size: 24px; font-weight: 300;">LiverAiz3D</h2>
                <p style="margin: 0; color: rgba(255, 255, 255, 0.8); font-size: 14px;">3D Model Viewer - Share Link</p>
            </div>
            
            <div style="margin-bottom: 25px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500; color: white; font-size: 14px;">SHARE LINK:</label>
                <div style="display: flex; gap: 10px;">
                    <input type="text" value="${fullUrl}" readonly style="flex: 1; padding: 12px; border: none; border-radius: 8px; background: rgba(255, 255, 255, 0.9); color: #333; font-size: 14px;">
                    <button onclick="navigator.clipboard.writeText('${fullUrl}').then(() => alert('Link copied!'))" style="padding: 12px 20px; background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 8px; cursor: pointer; font-weight: 500; transition: all 0.3s ease;">COPY</button>
                </div>
            </div>
            
            <div style="text-align: center;">
                <button onclick="this.closest('.share-dialog').remove()" style="padding: 12px 30px; background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 8px; cursor: pointer; font-weight: 500; transition: all 0.3s ease;">CLOSE</button>
            </div>
        `;

        content.className = "share-dialog";
        dialog.appendChild(content);
        document.body.appendChild(dialog);

        // 배경 클릭시 닫기
        dialog.addEventListener("click", (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }
}
