export default class TextPanel {
  /**
   * TextPanel 클래스 생성자
   * @param {boolean} isMobile - 모바일 환경 여부
   * @param {PanelManager} panelManager - 패널 관리자 객체
   * @param {boolean} isDarkMode - 다크 모드 여부
   *
   * 기존에 존재하는 TextPanel 요소를 확인하고 제거한 후
   * 새로운 TextPanel을 초기화합니다.
   */
  constructor({ isMobile, panelManager, isDarkMode = true }) {
    // 이미 존재하는 TextPanel 요소 확인
    const existingPanel = document.querySelector(".text-panel");
    const existingToggle = document.querySelector(".text-panel-toggle");
    const existingResizeHandle = document.querySelector(
      ".text-panel-resize-handle"
    );

    if (existingPanel) {
      console.log("Removing existing TextPanel");
      existingPanel.remove();
    }
    if (existingToggle) {
      console.log("Removing existing toggle button");
      existingToggle.remove();
    }
    if (existingResizeHandle) {
      console.log("Removing existing resize handle");
      existingResizeHandle.remove();
    }

    this.isMobile = isMobile;
    this.panelManager = panelManager;
    this.isDarkMode = isDarkMode;
    this.isOpen = false;
    this.position = "right";
    this.container = null;
    this.toggleContainer = null;
    this.content = "";
    this.defaultWidth = 250; // 기본 패널 너비
    this.minWidth = 150; // 최소 패널 너비
    this.maxWidth = 500; // 최대 패널 너비
    this.currentWidth = this.defaultWidth;

    console.log("TextPanel constructor called:", {
      isMobile: this.isMobile,
      isDarkMode: this.isDarkMode,
      panelManager: !!this.panelManager,
    });

    this.initialize();
  }

  /**
   * TextPanel 초기화 함수
   * 패널과 토글 버튼을 생성하고 이벤트를 설정합니다.
   * 기존 패널이 있다면 재사용하고, 없다면 새로 생성합니다.
   */
  initialize() {
    console.log("TextPanel initialize called");

    // 기존 패널 찾기
    const existingPanel = document.querySelector(".text-panel");

    if (existingPanel) {
      console.log("Using existing TextPanel");
      this.panel = existingPanel;
      this.container = existingPanel;
      return;
    }

    // 기존 패널이 없을 경우에만 새로 생성
    this.panel = this.createPanel();
    this.toggleContainer = this.createToggleContainer();
    this.resizeHandle = this.createResizeHandle(); // 리사이징 핸들 생성
    this.contentContainer = null;

    if (this.panelManager) {
      this.panelManager.registerPanel(this, "right");
    }

    this.setupPanel();
    this.setupToggleEvents();
    this.setupResizeEvents(); // 리사이징 이벤트 설정

    document.body.appendChild(this.panel);
    document.body.appendChild(this.toggleContainer);
    document.body.appendChild(this.resizeHandle); // 리사이징 핸들 추가

    this.container = this.panel;

    console.log("New TextPanel created");
    this.applyTheme(this.isDarkMode);
  }

  /**
   * 패널 요소 생성 함수
   * @returns {HTMLElement} 생성된 패널 요소
   *
   * 스크롤 가능한 패널 컨테이너를 생성하고
   * 기본 스타일을 적용합니다.
   */
  createPanel() {
    const panel = document.createElement("div");
    panel.className = "text-panel";
    const topBarHeight = "60px";

    Object.assign(panel.style, {
      position: "fixed",
      top: "0",
      right: `-${this.defaultWidth}px`, // 기본 너비 적용
      width: `${this.defaultWidth}px`, // 기본 너비 적용
      height: "100%",
      backgroundColor: this.isDarkMode
        ? "rgba(0, 0, 0, 0.4)"
        : "rgba(255, 255, 255, 0.4)",
      backdropFilter: "blur(20px) saturate(120%)",
      transition: "right 0.3s ease-in-out",
      zIndex: "950",
      padding: "20px",
      boxSizing: "border-box",
      overflowY: "auto",
      border: this.isDarkMode
        ? "1px solid rgba(255, 255, 255, 0.08)"
        : "1px solid rgba(255, 255, 255, 0.15)",
      boxShadow: this.isDarkMode
        ? "-2px 0 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
        : "-2px 0 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
      display: "none",
      scrollbarWidth: "none", // Firefox
      msOverflowStyle: "none", // IE and Edge
      "&::-webkit-scrollbar": {
        // Chrome, Safari, Opera
        display: "none",
      },
    });

    // Webkit 스크롤바 숨기기 위한 스타일 추가
    const style = document.createElement("style");
    style.textContent = `
            .text-panel::-webkit-scrollbar {
                display: none;
            }
        `;

    document.head.appendChild(style);

    return panel;
  }

  /**
   * 리사이징 핸들 생성 함수
   * @returns {HTMLElement} 생성된 리사이징 핸들
   */
  createResizeHandle() {
    const handle = document.createElement("div");
    handle.className = "text-panel-resize-handle";

    Object.assign(handle.style, {
      position: "fixed",
      top: "0",
      right: `${this.defaultWidth}px`,
      width: "8px",
      height: "100%",
      backgroundColor: "transparent",
      cursor: "ew-resize",
      zIndex: "950",
      display: "none", // 초기에는 숨김 상태
    });

    // 호버 효과를 위한 스타일 추가
    const style = document.createElement("style");
    style.textContent = `
            .text-panel-resize-handle:hover {
                background-color: ${
                  this.isDarkMode
                    ? "rgba(100, 100, 100, 0.5)"
                    : "rgba(200, 200, 200, 0.5)"
                };
            }
            .text-panel-resize-handle.active {
                background-color: ${
                  this.isDarkMode
                    ? "rgba(100, 100, 100, 0.8)"
                    : "rgba(200, 200, 200, 0.8)"
                };
            }
        `;

    document.head.appendChild(style);

    return handle;
  }

  /**
   * 토글 버튼 컨테이너 생성 함수
   * @returns {HTMLElement} 생성된 토글 버튼 컨테이너
   *
   * 패널을 열고 닫을 수 있는 토글 버튼을
   * SVG 아이콘과 함께 생성합니다.
   */
  createToggleContainer() {
    const container = document.createElement("div");
    container.className = "text-panel-toggle";
    const topBarHeight = "60px";

    Object.assign(container.style, {
      position: "fixed",
      top: `calc(50% + ${topBarHeight}/2)`,
      right: "0",
      transform: "translateY(-50%)",
      width: "40px",
      height: "40px",
      backgroundColor: this.isDarkMode
        ? "rgba(0, 0, 0, 0.1)"
        : "rgba(255, 255, 255, 0.08)",
      backdropFilter: "blur(15px) saturate(120%)",
      transition: "right 0.3s ease-in-out",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "5px 0 0 5px",
      border: this.isDarkMode
        ? "1px solid rgba(255, 255, 255, 0.05)"
        : "1px solid rgba(255, 255, 255, 0.08)",
      boxShadow: this.isDarkMode
        ? "-2px 0 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
        : "-2px 0 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
      zIndex: "950",
    });

    // L.svg 아이콘 생성
    const toggleIcon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    toggleIcon.setAttribute("width", "24");
    toggleIcon.setAttribute("height", "24");
    toggleIcon.setAttribute("viewBox", "0 0 24 24");
    toggleIcon.setAttribute("fill", this.isDarkMode ? "white" : "black");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M17.69,22.62c-.12,0-.23-.04-.33-.12L6.17,12.81c-.23-.2-.37-.49-.37-.8s.13-.6.37-.8L17.35,1.5c.21-.18.52-.16.71.05.18.21.16.52-.05.71L6.83,11.96l11.19,9.78c.21.18.23.5.05.71-.1.11-.24.17-.38.17Z"
    );

    toggleIcon.appendChild(path);
    Object.assign(toggleIcon.style, {
      transition: "transform 0.3s",
      transform: "rotate(0deg)",
    });

    container.appendChild(toggleIcon);
    return container;
  }

  /**
   * 패널 구성 요소 설정 함수
   *
   * 패널 내부의 콘텐츠 컨테이너와 제목을
   * 생성하고 스타일을 적용합니다.
   */
  setupPanel() {
    const topBarHeight = "30px";

    this.contentContainer = document.createElement("div");
    Object.assign(this.contentContainer.style, {
      height: "100%",
      marginTop: topBarHeight,
      boxSizing: "border-box",
      overflowY: "auto",
    });

    const title = document.createElement("h3");
    title.textContent = "Text Content";
    title.style.marginBottom = "20px";
    title.style.paddingLeft = "20px";
    title.style.fontSize = "18px";

    this.contentContainer.appendChild(title);
    this.panel.appendChild(this.contentContainer);
  }

  /**
   * 리사이징 이벤트 설정 함수
   *
   * 마우스 드래그로 패널 크기를 조절하는
   * 이벤트 리스너를 추가합니다.
   */
  setupResizeEvents() {
    let isDragging = false;
    let startX, startWidth;

    // 마우스 다운 이벤트
    this.resizeHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      isDragging = true;
      startX = e.clientX;
      startWidth = this.currentWidth;
      this.resizeHandle.classList.add("active");

      // 전역 마우스 이벤트를 위한 스타일 추가
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ew-resize";
    });

    // 마우스 이동 이벤트 (document에 이벤트 바인딩)
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      const moveX = startX - e.clientX;
      const newWidth = Math.min(
        Math.max(startWidth + moveX, this.minWidth),
        this.maxWidth
      );

      this.currentWidth = newWidth;
      this.panel.style.width = `${newWidth}px`;
      this.resizeHandle.style.right = `${newWidth}px`;

      // 토글 버튼 위치 조정 (패널이 열려있을 때만)
      if (this.isOpen) {
        this.toggleContainer.style.right = `${newWidth}px`;
      }
    });

    // 마우스 업 이벤트 (document에 이벤트 바인딩)
    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        this.resizeHandle.classList.remove("active");

        // 전역 스타일 원래대로 복구
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }
    });

    // 마우스가 창 밖으로 나갔을 때 이벤트
    document.addEventListener("mouseleave", () => {
      if (isDragging) {
        isDragging = false;
        this.resizeHandle.classList.remove("active");

        // 전역 스타일 원래대로 복구
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }
    });
  }

  /**
   * 콘텐츠 표시 함수
   * @param {string} text - 표시할 텍스트 내용
   */
  showContent(text) {
    console.log("Showing content with text length:", text.length);

    // 기존 내용 제거
    this.clearContent();

    // 제목 추가
    const title = document.createElement("h3");
    title.textContent = "Text Content";
    title.style.marginBottom = "20px";
    title.style.paddingLeft = "20px";
    title.style.fontSize = "18px";
    this.contentContainer.appendChild(title);

    // 텍스트 내용 추가
    const textSection = document.createElement("h5");
    textSection.style.margin = "10px 0";
    textSection.style.paddingLeft = "20px";
    textSection.style.fontSize = "14px";
    textSection.style.fontWeight = "normal";
    textSection.style.whiteSpace = "pre-line";
    textSection.textContent = text;

    this.contentContainer.appendChild(textSection);
  }

  /**
   * 콘텐츠 영역 초기화 함수
   */
  clearContent() {
    while (this.contentContainer.firstChild) {
      this.contentContainer.removeChild(this.contentContainer.firstChild);
    }
  }

  /**
   * 토글 버튼 이벤트 설정 함수
   *
   * 토글 버튼 클릭 시 패널을 열고 닫는
   * 이벤트 리스너를 추가합니다.
   */
  setupToggleEvents() {
    this.toggleContainer.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePanel();
    });
  }

  /**
   * 패널 토글 함수
   *
   * 패널의 열림/닫힘 상태를 전환하고
   * 애니메이션을 적용합니다.
   */
  togglePanel() {
    if (this.isTransitioning && !this.themeTransitionTimeout) return;

    this.isTransitioning = true;
    this.isOpen = !this.isOpen;

    if (this.panelManager) {
      this.panelManager.updatePanelState(this, this.isOpen);
    }

    // 모바일에서 다른 패널이 닫힐 때 시각적 피드백 (실시간 상태 확인)
    const currentIsMobile = window.innerWidth < 768;
    if (currentIsMobile && this.isOpen && this.panelManager) {
      console.log("모바일: Volume Panel 열림 - Mesh Panel이 자동으로 닫힙니다.");
    }

    if (this.isOpen) {
      this.panel.style.display = "block";
      this.resizeHandle.style.display = "block"; // 리사이즈 핸들 표시

      requestAnimationFrame(() => {
        this.panel.style.right = "0";
        this.toggleContainer.style.right = `${this.currentWidth}px`;
        this.resizeHandle.style.right = `${this.currentWidth}px`;
      });
    } else {
      this.panel.style.right = `-${this.currentWidth}px`;
      this.toggleContainer.style.right = "0";
      this.resizeHandle.style.right = `${this.currentWidth}px`;
      this.resizeHandle.style.display = "none"; // 리사이즈 핸들 숨김

      setTimeout(() => {
        this.panel.style.display = "none";
      }, 300);
    }

    this.toggleContainer.firstChild.style.transform = this.isOpen
      ? "rotate(180deg)"
      : "rotate(0deg)";

    setTimeout(() => {
      this.isTransitioning = false;
    }, 300);
  }

  /**
   * 패널 닫기 함수
   *
   * 열려있는 패널을 애니메이션과 함께
   * 부드럽게 닫습니다.
   */
  close() {
    if (this.isOpen) {
      this.isOpen = false;

      if (this.panelManager) {
        this.panelManager.updatePanelState(this, false);
      }



      requestAnimationFrame(() => {
        this.panel.style.right = `-${this.currentWidth}px`;
        this.toggleContainer.style.right = "0";
        this.resizeHandle.style.right = `${this.currentWidth}px`;
        this.resizeHandle.style.display = "none"; // 리사이즈 핸들 숨김
        this.toggleContainer.firstChild.style.transform = "rotate(0deg)";

        setTimeout(() => {
          this.panel.style.display = "none";
        }, 300);
      });
    }
  }

  /**
   * 콘텐츠 업데이트 함수
   * @param {string} text - 표시할 텍스트 내용
   *
   * 패널의 콘텐츠를 업데이트하고
   * 필요한 경우 패널을 자동으로 엽니다.
   */
  updateContent(text) {
    console.log(
      "TextPanel updateContent called with text length:",
      text.length
    );

    if (!this.container) {
      console.log("Container not found, initializing TextPanel");
      this.initialize();
    }

    this.content = text;

    // HTML 콘텐츠인지 확인
    if (
      text.includes("<div") ||
      text.includes("<table") ||
      text.includes("<style")
    ) {
      this.clearContent();

      // 제목 추가
      const title = document.createElement("h3");
      title.textContent = "Volume Data";
      title.style.marginBottom = "20px";
      title.style.paddingLeft = "20px";
      title.style.fontSize = "18px";
      this.contentContainer.appendChild(title);

      // HTML 콘텐츠 추가
      const contentDiv = document.createElement("div");
      contentDiv.className = "text-panel-content";
      contentDiv.style.padding = "0 20px";
      contentDiv.style.fontSize = "14px";
      contentDiv.innerHTML = text;

      this.contentContainer.appendChild(contentDiv);
    } else {
      // 일반 텍스트인 경우
      this.showContent(text);
    }

    if (!this.isOpen) {
      if (this.content !== "") {
        console.log("Opening panel automatically");
        this.togglePanel();
      }
    }
  }

  /**
   * 테마 적용 함수
   * @param {boolean} isDarkMode - 다크 모드 여부
   *
   * 패널과 토글 버튼에 다크/라이트 모드
   * 스타일을 적용합니다.
   */
  applyTheme(isDarkMode) {
    // 패널 스타일 적용
    Object.assign(this.panel.style, {
      backgroundColor: isDarkMode
        ? "rgba(0, 0, 0, 0.9)"
        : "rgba(245, 245, 245, 0.95)",
      color: isDarkMode ? "white" : "black",
      boxShadow: isDarkMode
        ? "-2px 0 5px rgba(0, 0, 0, 0.3)"
        : "-2px 0 5px rgba(0, 0, 0, 0.1)",
    });

    // 토글 버튼 스타일 적용
    Object.assign(this.toggleContainer.style, {
      backgroundColor: isDarkMode
        ? "rgba(0, 0, 0, 0.8)"
        : "rgba(245, 245, 245, 0.95)",
      boxShadow: isDarkMode
        ? "-2px 0 5px rgba(0, 0, 0, 0.3)"
        : "-2px 0 5px rgba(0, 0, 0, 0.1)",
    });

    // 리사이즈 핸들 스타일 적용
    if (this.resizeHandle) {
      // 호버 효과 스타일 업데이트
      const styleSheet = document.styleSheets[document.styleSheets.length - 1];
      for (let i = 0; i < styleSheet.cssRules.length; i++) {
        const rule = styleSheet.cssRules[i];
        if (rule.selectorText === ".text-panel-resize-handle:hover") {
          styleSheet.deleteRule(i);
          styleSheet.insertRule(
            `.text-panel-resize-handle:hover { 
                        background-color: ${
                          isDarkMode
                            ? "rgba(100, 100, 100, 0.5)"
                            : "rgba(200, 200, 200, 0.5)"
                        };
                    }`,
            i
          );
        } else if (rule.selectorText === ".text-panel-resize-handle.active") {
          styleSheet.deleteRule(i);
          styleSheet.insertRule(
            `.text-panel-resize-handle.active { 
                        background-color: ${
                          isDarkMode
                            ? "rgba(100, 100, 100, 0.8)"
                            : "rgba(200, 200, 200, 0.8)"
                        };
                    }`,
            i
          );
        }
      }
    }

    // 토글 아이콘 색상 적용
    const toggleIcon = this.toggleContainer.querySelector("svg");
    if (toggleIcon) {
      toggleIcon.setAttribute("fill", isDarkMode ? "white" : "black");
    }
  }

  /**
   * 테마 업데이트 함수
   * @param {boolean} isDarkMode - 다크 모드 여부
   *
   * 패널의 테마를 변경하고 트랜지션
   * 애니메이션을 적용합니다.
   */
  updateTheme(isDarkMode) {
    console.log("TextPanel updateTheme called with isDarkMode:", isDarkMode);
    this.isDarkMode = isDarkMode;
    console.log("TextPanel isDarkMode updated to:", this.isDarkMode);

    // 모드 전환 시 transition 일시 제거
    const originalPanelTransition = this.panel.style.transition;
    const originalToggleTransition = this.toggleContainer.style.transition;
    
    this.panel.style.transition = "none";
    this.toggleContainer.style.transition = "none";

    // 패널 스타일 업데이트 (Glassmorphism)
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
        ? "-2px 0 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
        : "-2px 0 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
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
        ? "-2px 0 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
        : "-2px 0 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
    });

    // 리사이즈 핸들 스타일 업데이트
    if (this.resizeHandle) {
      // 호버 효과 스타일 업데이트
      const styleSheet = document.styleSheets[document.styleSheets.length - 1];
      for (let i = 0; i < styleSheet.cssRules.length; i++) {
        const rule = styleSheet.cssRules[i];
        if (rule.selectorText === ".text-panel-resize-handle:hover") {
          styleSheet.deleteRule(i);
          styleSheet.insertRule(
            `.text-panel-resize-handle:hover { 
                        background-color: ${
                          isDarkMode
                            ? "rgba(100, 100, 100, 0.5)"
                            : "rgba(200, 200, 200, 0.5)"
                        };
                    }`,
            i
          );
        } else if (rule.selectorText === ".text-panel-resize-handle.active") {
          styleSheet.deleteRule(i);
          styleSheet.insertRule(
            `.text-panel-resize-handle.active { 
                        background-color: ${
                          isDarkMode
                            ? "rgba(100, 100, 100, 0.8)"
                            : "rgba(200, 200, 200, 0.8)"
                        };
                    }`,
            i
          );
        }
      }
    }

    // 토글 아이콘 색상 업데이트
    const toggleIcon = this.toggleContainer.querySelector("svg");
    if (toggleIcon) {
      toggleIcon.setAttribute("fill", isDarkMode ? "white" : "black");
    }

    // transition 복원
    requestAnimationFrame(() => {
      this.panel.style.transition = originalPanelTransition;
      this.toggleContainer.style.transition = originalToggleTransition;
    });
  }
}
