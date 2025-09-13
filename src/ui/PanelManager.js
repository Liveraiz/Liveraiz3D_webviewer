class PanelManager {
    /**
     * PanelManager 클래스 생성자
     * 좌우 패널과 활성 패널을 관리하는 객체를 초기화합니다.
     * @param {boolean} isMobile - 모바일 환경 여부
     */
    constructor(isMobile = false) {
        this.leftPanel = null;
        this.rightPanel = null;
        this.activePanel = null;
        this.isMobile = isMobile;
        
        // 화면 크기 변경 시 모바일 상태 업데이트
        this.updateMobileState = this.updateMobileState.bind(this);
        window.addEventListener('resize', this.updateMobileState);
    }

    /**
     * 패널을 등록하는 함수
     * @param {Panel} panel - 등록할 패널 객체
     * @param {string} position - 패널 위치 ('left' 또는 'right')
     */
    registerPanel(panel, position) {
        if (position === 'left') {
            this.leftPanel = panel;
        } else if (position === 'right') {
            this.rightPanel = panel;
        }
        console.log(`패널 등록: ${position} 패널`);
    }

    /**
     * 패널의 열림/닫힘 상태를 업데이트하는 함수
     * @param {Panel} panel - 상태를 업데이트할 패널 객체
     * @param {boolean} isOpen - 패널의 열림 상태
     * 
     * 패널이 열릴 때:
     * 1. 다른 활성 패널이 있다면 해당 패널을 닫음
     * 2. 현재 패널을 활성 패널로 설정
     * 
     * 패널이 닫힐 때:
     * 1. 해당 패널이 활성 패널이었다면 활성 패널을 null로 설정
     */
    updatePanelState(panel, isOpen) {
        const panelType = this.getPanelType(panel);
        const currentActiveType = this.activePanel ? this.getPanelType(this.activePanel) : 'none';
        
        // 실시간 모바일 상태 확인
        const currentIsMobile = window.innerWidth < 768;
        


        if (isOpen) {
            // 모바일에서만 다른 패널을 닫음 (실시간 상태 사용)
            if (currentIsMobile && this.activePanel && this.activePanel !== panel) {
                const otherPanelType = this.getPanelType(this.activePanel);

                
                const otherPanel = this.activePanel;
                const panelWidth = "250px";
                
                if (otherPanel === this.leftPanel) {
                    otherPanel.panel.style.left = `-${panelWidth}`;
                    otherPanel.toggleContainer.style.left = "0";
                } else {
                    otherPanel.panel.style.right = `-${panelWidth}`;
                    otherPanel.toggleContainer.style.right = "0";
                }
                
                otherPanel.toggleContainer.firstChild.style.transform = "rotate(0)";
                setTimeout(() => {
                    otherPanel.panel.style.display = 'none';
                }, 300);
                
                otherPanel.isOpen = false;
                this.activePanel = null;
            }
            
            this.activePanel = panel;
        } else {
            if (this.activePanel === panel) {
                this.activePanel = null;
            }
        }


    }

    /**
     * 모든 패널을 닫는 함수
     * 좌우 패널의 상태를 확인하고 열려있는 패널을 모두 닫습니다.
     * 활성 패널을 null로 초기화합니다.
     */
    closeAllPanels() {
        if (this.leftPanel?.isOpen) {
            this.leftPanel.close();
        }
        if (this.rightPanel?.isOpen) {
            this.rightPanel.close();
        }
        this.activePanel = null;
    }

    /**
     * 모바일 환경에서 패널 상태를 확인하는 함수
     * @returns {boolean} 모바일 환경에서 패널이 열려있는지 여부
     */
    isAnyPanelOpenInMobile() {
        if (!this.isMobile) return false;
        return this.leftPanel?.isOpen || this.rightPanel?.isOpen;
    }

    /**
     * 모바일 상태를 업데이트하는 함수
     */
    updateMobileState() {
        const newIsMobile = window.innerWidth < 768;
        if (this.isMobile !== newIsMobile) {

            this.isMobile = newIsMobile;
        }
    }

    /**
     * 패널 타입을 반환하는 함수
     * @param {Panel} panel - 패널 객체
     * @returns {string} 패널 타입 ('Mesh Panel', 'Volume Panel', 'Unknown')
     */
    getPanelType(panel) {
        if (!panel) return 'Unknown';
        
        if (panel.constructor.name === 'ObjectListPanel') {
            return 'Mesh Panel';
        } else if (panel.constructor.name === 'TextPanel') {
            return 'Volume Panel';
        }
        return 'Unknown';
    }

    /**
     * 모바일 환경에서 특정 패널이 열려있는지 확인하는 함수
     * @param {string} position - 확인할 패널 위치 ('left' 또는 'right')
     * @returns {boolean} 해당 패널이 열려있는지 여부
     */
    isPanelOpenInMobile(position) {
        if (!this.isMobile) return false;
        
        if (position === 'left') {
            return this.leftPanel?.isOpen;
        } else if (position === 'right') {
            return this.rightPanel?.isOpen;
        }
        return false;
    }

    /**
     * 현재 패널 상태를 반환하는 함수
     * @returns {Object} 현재 패널 상태 정보
     */
    getCurrentPanelState() {
        return {
            isMobile: this.isMobile,
            leftPanel: {
                type: this.getPanelType(this.leftPanel),
                isOpen: this.leftPanel?.isOpen || false
            },
            rightPanel: {
                type: this.getPanelType(this.rightPanel),
                isOpen: this.rightPanel?.isOpen || false
            },
            activePanel: this.activePanel ? this.getPanelType(this.activePanel) : 'none'
        };
    }
}

export { PanelManager }; 