export default class LogoManager {
    constructor({
        imageUrl = null,
        containerId = "container",
        position = "bottom-left",
        width = 120,
        height = 60,
        margin = 20,
        opacity = 0.8,
        isDarkMode = true,
        dropboxService = null, // dropboxService 파라미터 추가
    }) {
        this.imageUrl = imageUrl;
        this.containerId = containerId;
        this.position = position;
        this.width = width;
        this.height = height;
        this.margin = margin;
        this.opacity = opacity;
        this.isDarkMode = isDarkMode;
        this.dropboxService = dropboxService;

        this.logoContainer = null;

        // 이미지 URL이 있을 때만 로고 생성
        if (this.imageUrl) {
            this.createLogo();
        }
    }

    createLogo() {
        // 기존에 있는 로고 컨테이너가 있으면 제거
        const existingLogo = document.getElementById("viewer-logo-overlay");
        if (existingLogo) {
            existingLogo.remove();
        }

        // 로고 컨테이너 생성
        this.logoContainer = document.createElement("div");
        this.logoContainer.id = "viewer-logo-overlay";

        // 로고 이미지 생성
        const logoImg = document.createElement("img");
        logoImg.src = this.imageUrl;
        logoImg.alt = "Logo";
        logoImg.className = "viewer-logo-image";

        // 이미지를 컨테이너에 추가
        this.logoContainer.appendChild(logoImg);

        // 스타일 적용
        this.applyStyles();

        // DOM에 추가
        const container =
            document.getElementById(this.containerId) || document.body;
        container.appendChild(this.logoContainer);
    }

    applyStyles() {
        // 인라인 스타일 적용
        this.logoContainer.style.cssText = `
            position: absolute;
            z-index: 9999;
            pointer-events: none;
            user-select: none;
            background-color: transparent;
        `;

        // 위치 설정
        this.setPosition(this.position);

        // 로고 이미지 스타일 적용
        const logoImg = this.logoContainer.querySelector(".viewer-logo-image");
        if (logoImg) {
            logoImg.style.cssText = `
                width: ${this.width}px;
                height: ${this.height}px;
                object-fit: contain;
                opacity: ${this.opacity};
                display: block;
            `;
            
            // 현재 테마에 맞는 필터 적용
            this.applyColorMode(this.isDarkMode);
        }

        // 전역 스타일 추가
        this.createGlobalStyles();
    }

    setPosition(position) {
        // 기본값은 왼쪽 하단
        let positionStyle = "";

        switch (position) {
            case "top-left":
                positionStyle = `
                    top: ${this.margin}px;
                    left: ${this.margin}px;
                `;
                break;
            case "top-right":
                positionStyle = `
                    top: ${this.margin}px;
                    right: ${this.margin}px;
                `;
                break;
            case "bottom-right":
                positionStyle = `
                    bottom: ${this.margin}px;
                    right: ${this.margin}px;
                `;
                break;
            case "bottom-left":
            default:
                positionStyle = `
                    bottom: ${this.margin}px;
                    left: ${this.margin}px;
                `;
                break;
        }

        // 기존 스타일에 위치 스타일 추가
        this.logoContainer.style.cssText += positionStyle;
    }

    createGlobalStyles() {
        // 이미 스타일 요소가 있는지 확인
        let styleElement = document.getElementById("viewer-logo-styles");

        if (!styleElement) {
            styleElement = document.createElement("style");
            styleElement.id = "viewer-logo-styles";

            styleElement.textContent = `
                #viewer-logo-overlay {
                    transition: opacity 0.3s ease;
                }
                
                #viewer-logo-overlay:hover {
                    opacity: 1;
                }
                
                #viewer-logo-overlay img {
                    display: block;
                }
            `;

            document.head.appendChild(styleElement);
        }
    }

    updateLogo(newImageUrl) {
        if (!newImageUrl) return false;
        
        this.imageUrl = newImageUrl;
        
        // 로고 컨테이너가 있으면 이미지 경로만 업데이트
        const logoImg = this.logoContainer?.querySelector(".viewer-logo-image");
        if (logoImg) {
            logoImg.src = newImageUrl;
            return true;
        } else {
            // 로고 컨테이너가 없으면 새로 생성
            this.createLogo();
            return true;
        }
    }

    async loadFromDropbox(logoData) {
        try {
            console.log("Dropbox에서 로고 로드 중:", logoData);
            
            if (!logoData || !logoData.logoImgUrl) {
                console.error("로고 데이터가 올바르지 않거나 URL이 없습니다.");
                return false;
            }
            
            const logoUrl = logoData.logoImgUrl;
            console.log("로고 원본 URL:", logoUrl);
            
            let directUrl = logoUrl;
            
            // 1. dropboxService를 통한 변환 시도
            if (this.dropboxService && typeof this.dropboxService.getDirectDownloadUrl === 'function') {
                try {
                    directUrl = this.dropboxService.getDirectDownloadUrl(logoUrl);
                    console.log("서비스로 변환된 로고 URL:", directUrl);
                } catch (error) {
                    console.warn("dropboxService 변환 실패, 수동 변환 사용:", error);
                }
            } else {
                // 2. 서비스가 없으면 수동으로 URL 변환
                if (logoUrl.includes("dropbox.com")) {
                    if (logoUrl.includes("dl=0")) {
                        directUrl = logoUrl.replace("dl=0", "dl=1");
                    } else if (!logoUrl.includes("dl=")) {
                        directUrl = logoUrl + (logoUrl.includes("?") ? "&dl=1" : "?dl=1");
                    }
                    console.log("수동 변환된 로고 URL:", directUrl);
                }
            }
            
            // 이미지 URL 업데이트 및 로고 표시
            this.imageUrl = directUrl;
            this.createLogo();
            
            return true;
        } catch (error) {
            console.error("Dropbox에서 로고 로드 중 오류:", error);
            return false;
        }
    }

    // 테마 모드에 따른 스타일 적용
    applyColorMode(isDarkMode) {
        this.isDarkMode = isDarkMode;
        
        // 로고 이미지 찾기
        const logoImg = this.logoContainer?.querySelector(".viewer-logo-image");
        if (logoImg) {
            // 테마에 맞는 필터 설정
            if (isDarkMode) {
                logoImg.style.filter = `
                    drop-shadow(1px 1px 0 rgba(255, 255, 255, 0.8))
                    drop-shadow(-1px -1px 0 rgba(255, 255, 255, 0.8))
                    drop-shadow(1px -1px 0 rgba(255, 255, 255, 0.8))
                    drop-shadow(-1px 1px 0 rgba(255, 255, 255, 0.8))
                `;
            } else {
                logoImg.style.filter = `
                    drop-shadow(1px 1px 0 white) 
                    drop-shadow(-1px -1px 0 white)
                    drop-shadow(1px -1px 0 white)
                    drop-shadow(-1px 1px 0 white)
                `;
            }
        }
    }

    setDarkMode(isDarkMode) {
        this.isDarkMode = isDarkMode;
        this.applyColorMode(isDarkMode);
    }

    setDropboxService(dropboxService) {
        this.dropboxService = dropboxService;
    }

    show() {
        if (this.logoContainer) {
            this.logoContainer.style.display = "block";
        }
    }

    hide() {
        if (this.logoContainer) {
            this.logoContainer.style.display = "none";
        }
    }

    dispose() {
        if (this.logoContainer) {
            this.logoContainer.remove();
        }

        // 전역 스타일 제거
        const styleElement = document.getElementById("viewer-logo-styles");
        if (styleElement) {
            styleElement.remove();
        }
    }
}