// ui/FloatingModeButtons.js
import { Constants } from '../utils/Constants';

export default class FloatingModeButtons {
    constructor(options) {
        this.onXRModeRequested = options.onXRModeRequested || (() => {});
        this.onStereoModeRequested = options.onStereoModeRequested || (() => {});
        this.onStereoAspectRequested = options.onStereoAspectRequested || (() => {});
        this.isDarkMode = options.isDarkMode || false;
        this.isMobile = options.isMobile || false;
        this.liverViewer = options.liverViewer || null;

        this.container = null;
        this.xrButton = null;
        this.sbsButton = null;
        this.topBottomButton = null;
        this.anamorphicButton = null;
        this.lineByLineButton = null;
        this.isStereoscopicActive = false;
        this.activeStereoMode = null;
        this.isAnamorphic = true;

        this.initialize();
    }

    initialize() {
        this.createContainer();
        this.createButtons();
        this.setupEventListeners();
        document.body.appendChild(this.container);
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'floating-mode-buttons-container';
        
        const config = Constants.FLOATING_BUTTONS;
        
        Object.assign(this.container.style, {
            position: 'fixed',
            bottom: config.CONTAINER.BOTTOM,
            right: config.CONTAINER.RIGHT,
            display: 'flex',
            gap: config.CONTAINER.GAP,
            zIndex: config.CONTAINER.Z_INDEX,
            pointerEvents: 'auto',
            fontFamily: Constants.UI.FONT.FAMILY
        });

        // 모바일에서 safe area 고려
        if (this.isMobile) {
            this.container.style.bottom = `calc(${config.CONTAINER.SAFE_AREA_BOTTOM} + ${config.CONTAINER.BOTTOM})`;
        }
    }

    createButtons() {
        // 현재 stereoscopic 기능을 사용하지 않으므로 버튼 생성 비활성화
        
        // // Enter XR Mode 버튼
        // // this.xrButton = this.createButton({
        // //     id: 'enter-xr-button',
        // //     label: 'Enter XR',
        // //     icon: 'XR',
        // //     onClick: () => this.handleXRModeClick()
        // // });

        // // 3D SBS 버튼
        // this.sbsButton = this.createButton({
        //     id: '3d-sbs-button',
        //     label: '3D SBS',
        //     icon: '3D',
        //     stereoMode: Constants.STEREOSCOPIC.MODES?.SIDE_BY_SIDE || 'side-by-side',
        //     onClick: () => this.handleStereoModeClick(Constants.STEREOSCOPIC.MODES?.SIDE_BY_SIDE || 'side-by-side')
        // });

        // // 3D Top/Bottom 버튼
        // this.topBottomButton = this.createButton({
        //     id: '3d-top-bottom-button',
        //     label: '3D TB',
        //     icon: '3D',
        //     stereoMode: Constants.STEREOSCOPIC.MODES?.TOP_BOTTOM || 'top-bottom',
        //     onClick: () => this.handleStereoModeClick(Constants.STEREOSCOPIC.MODES?.TOP_BOTTOM || 'top-bottom')
        // });

        // // Anamorphic toggle button
        // this.anamorphicButton = this.createButton({
        //     id: '3d-anamorphic-button',
        //     label: 'AM',
        //     icon: 'AN',
        //     stereoAspect: 'anamorphic',
        //     onClick: () => this.handleStereoAspectClick()
        // });

        // // 3D Line-by-Line 버튼 (비활성화)
        // // this.lineByLineButton = this.createButton({
        // //     id: '3d-line-button',
        // //     label: '3D LBL',
        // //     icon: '3D',
        // //     onClick: () => this.handleStereoModeClick('line-by-line')
        // // });

        // // this.container.appendChild(this.xrButton);
        // this.container.appendChild(this.sbsButton);
        // this.container.appendChild(this.topBottomButton);
        // this.container.appendChild(this.anamorphicButton);
        // // this.container.appendChild(this.lineByLineButton);

        // // this.applyButtonStyles(this.xrButton);
        // this.applyButtonStyles(this.sbsButton);
        // this.applyButtonStyles(this.topBottomButton);
        // // this.applyButtonStyles(this.lineByLineButton);
    }

    createButton(options) {
        const button = document.createElement('button');
        button.id = options.id;
        button.setAttribute('aria-label', options.label);
        button.title = options.label;

        const config = Constants.FLOATING_BUTTONS;

        Object.assign(button.style, {
            width: `${config.BUTTON.SIZE}px`,
            height: `${config.BUTTON.SIZE}px`,
            borderRadius: `${config.BUTTON.BORDER_RADIUS}px`,
            border: 'none',
            padding: '0',
            cursor: 'pointer',
            fontSize: config.BUTTON.FONT_SIZE,
            fontWeight: Constants.UI.FONT.WEIGHTS.MEDIUM,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '2px',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(8px)'
        });

        // 아이콘과 라벨 콘텐츠
        const iconSpan = document.createElement('span');
        iconSpan.style.fontSize = '18px';
        iconSpan.textContent = options.icon;

        const labelSpan = document.createElement('span');
        labelSpan.style.fontSize = '9px';
        labelSpan.style.lineHeight = '1';
        labelSpan.textContent = options.label;

        button.appendChild(iconSpan);
        button.appendChild(labelSpan);

        if (options.stereoMode) {
            button.dataset.stereoMode = options.stereoMode;
        }

        if (options.stereoAspect) {
            button.dataset.stereoAspect = options.stereoAspect;
        }

        const isStereoButtonActive = () => Boolean(this.activeStereoMode && button.dataset.stereoMode === this.activeStereoMode);
        const isAspectButtonActive = () => Boolean(button.dataset.stereoAspect && this.isAnamorphic);

        button.addEventListener('mouseenter', () => {
            const config = Constants.FLOATING_BUTTONS;
            const theme = this.isDarkMode ? config.DARK_MODE : config.LIGHT_MODE;
            button.style.backgroundColor = theme.HOVER;
            button.style.transform = (isStereoButtonActive() || isAspectButtonActive()) ? 'scale(1.08)' : 'scale(1.04)';
        });

        button.addEventListener('mouseleave', () => {
            const config = Constants.FLOATING_BUTTONS;
            const theme = this.isDarkMode ? config.DARK_MODE : config.LIGHT_MODE;
            button.style.backgroundColor = theme.BACKGROUND;
            button.style.transform = (isStereoButtonActive() || isAspectButtonActive()) ? 'scale(1.06)' : 'scale(1)';
        });

        button.addEventListener('mousedown', () => {
            button.style.transform = 'scale(0.96)';
        });

        button.addEventListener('mouseup', () => {
            button.style.transform = (isStereoButtonActive() || isAspectButtonActive()) ? 'scale(1.06)' : 'scale(1)';
        });

        button.addEventListener('click', options.onClick);

        return button;
    }

    applyButtonStyles(button) {
        if (!button) return;

        const config = Constants.FLOATING_BUTTONS;
        const theme = this.isDarkMode ? config.DARK_MODE : config.LIGHT_MODE;

        Object.assign(button.style, {
            backgroundColor: theme.BACKGROUND,
            color: theme.TEXT,
            boxShadow: theme.SHADOW,
            border: `1px solid ${theme.BORDER}`
        });

        // 3D 버튼 활성 상태를 시각적으로 표시
        if (button.dataset.stereoMode && button.dataset.stereoMode === this.activeStereoMode) {
            button.style.boxShadow = '0 0 0 2px rgba(0, 180, 255, 0.9), 0 8px 16px rgba(0, 0, 0, 0.25)';
            button.style.transform = 'scale(1.06)';
        } else if (button.dataset.stereoAspect && this.isAnamorphic) {
            button.style.boxShadow = '0 0 0 2px rgba(255, 180, 0, 0.9), 0 8px 16px rgba(0, 0, 0, 0.25)';
            button.style.transform = 'scale(1.06)';
        }
    }

    setupEventListeners() {
        // 다크모드 변경 시 업데이트
        if (this.liverViewer && this.liverViewer.viewerState) {
            this.liverViewer.viewerState.subscribe((state) => {
                if (state.isDarkMode !== undefined) {
                    this.isDarkMode = state.isDarkMode;
                    this.updateTheme();
                }
            });
        }
    }

    handleXRModeClick() {
        console.log('Enter XR Mode requested');
        this.onXRModeRequested();
    }

    handleStereoModeClick(mode) {
        console.log('3D mode requested:', mode);
        this.onStereoModeRequested(mode);
    }

    updateTheme() {
        // 버튼 생성이 비활성화되어 있으므로 updateTheme도 비활성화
        // this.applyButtonStyles(this.xrButton);
        // this.applyButtonStyles(this.sbsButton);
        // this.applyButtonStyles(this.topBottomButton);
        // this.applyButtonStyles(this.anamorphicButton);
        // this.applyButtonStyles(this.lineByLineButton);
    }

    setStereoscopicActive(isActive, activeStereoMode = null, isAnamorphic = true) {
        this.isStereoscopicActive = Boolean(isActive);
        this.activeStereoMode = this.isStereoscopicActive ? activeStereoMode : null;
        this.isAnamorphic = Boolean(isAnamorphic);
        this.updateTheme();
    }

    handleStereoAspectClick() {
        this.isAnamorphic = !this.isAnamorphic;
        console.log('Stereo aspect toggled. Anamorphic:', this.isAnamorphic);
        this.onStereoAspectRequested?.(this.isAnamorphic);
        this.updateTheme();
    }

    setDarkMode(isDarkMode) {
        this.isDarkMode = isDarkMode;
        this.updateTheme();
    }

    /**
     * FloatingModeButtons 숨기기
     * Stereoscopic 모드나 기타 전체화면 모드에서 호출
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    /**
     * FloatingModeButtons 보이기
     */
    show() {
        if (this.container) {
            this.container.style.display = 'flex';
        }
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
