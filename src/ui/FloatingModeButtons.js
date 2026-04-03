// ui/FloatingModeButtons.js
import { Constants } from '../utils/Constants';

export default class FloatingModeButtons {
    constructor(options) {
        this.onXRModeRequested = options.onXRModeRequested || (() => {});
        this.on3DGlassModeRequested = options.on3DGlassModeRequested || (() => {});
        this.isDarkMode = options.isDarkMode || false;
        this.isMobile = options.isMobile || false;
        this.liverViewer = options.liverViewer || null;

        this.container = null;
        this.xrButton = null;
        this.glassButton = null;
        this.glassButtonLabel = null;
        this.stereoModeMenu = null;
        this.isStereoscopicActive = false;
        this.stereoscopicMode = Constants.STEREOSCOPIC.DEFAULT_MODE || 'side-by-side';

        this.stereoscopicModeLabels = {
            [Constants.STEREOSCOPIC.MODES.SIDE_BY_SIDE]: 'SBS',
            [Constants.STEREOSCOPIC.MODES.TOP_BOTTOM]: 'TAB',
            [Constants.STEREOSCOPIC.MODES.ANAGLYPH]: 'ANA',
            [Constants.STEREOSCOPIC.MODES.INTERLACED]: 'INT'
        };

        this.handleDocumentClick = this.handleDocumentClick.bind(this);

        this.initialize();
    }

    initialize() {
        this.createContainer();
        this.createButtons();
        this.createStereoscopicModeMenu();
        this.setupEventListeners();
        document.body.appendChild(this.container);
        document.addEventListener('click', this.handleDocumentClick);
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
        // Enter XR Mode 버튼
        // this.xrButton = this.createButton({
        //     id: 'enter-xr-button',
        //     label: 'Enter XR',
        //     icon: 'XR',
        //     onClick: () => this.handleXRModeClick()
        // });

        // 3D Glass Mode 버튼
        this.glassButton = this.createButton({
            id: '3d-glass-button',
            label: this.getStereoscopicButtonLabel(),
            icon: '3D',
            onClick: () => this.handle3DGlassModeClick()
        });

        this.glassButtonLabel = this.glassButton.querySelector('span:last-child');

        // this.container.appendChild(this.xrButton);
        this.container.appendChild(this.glassButton);

        // this.applyButtonStyles(this.xrButton);
        this.applyButtonStyles(this.glassButton);
    }

    createStereoscopicModeMenu() {
        this.stereoModeMenu = document.createElement('div');
        this.stereoModeMenu.id = 'stereo-mode-menu';

        Object.assign(this.stereoModeMenu.style, {
            position: 'absolute',
            right: '0',
            bottom: '60px',
            display: 'none',
            minWidth: '140px',
            padding: '6px',
            borderRadius: '10px',
            boxSizing: 'border-box',
            backdropFilter: 'blur(8px)'
        });

        const modeItems = [
            { key: Constants.STEREOSCOPIC.MODES.SIDE_BY_SIDE, label: 'SBS (좌우)' },
            { key: Constants.STEREOSCOPIC.MODES.TOP_BOTTOM, label: 'Top-Bottom' },
            { key: Constants.STEREOSCOPIC.MODES.ANAGLYPH, label: 'Anaglyph' },
            { key: Constants.STEREOSCOPIC.MODES.INTERLACED, label: 'Interlaced (Line-by-Line)' }
        ];

        modeItems.forEach((modeItem) => {
            const optionButton = document.createElement('button');
            optionButton.type = 'button';
            optionButton.dataset.mode = modeItem.key;
            optionButton.textContent = modeItem.label;

            Object.assign(optionButton.style, {
                width: '100%',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 10px',
                textAlign: 'left',
                cursor: 'pointer',
                background: 'transparent',
                fontSize: '12px',
                marginBottom: '4px'
            });

            optionButton.addEventListener('click', (event) => {
                event.stopPropagation();
                this.selectStereoscopicMode(modeItem.key);
            });

            this.stereoModeMenu.appendChild(optionButton);
        });

        const offButton = document.createElement('button');
        offButton.type = 'button';
        offButton.dataset.mode = 'off';
        offButton.textContent = '끄기';

        Object.assign(offButton.style, {
            width: '100%',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 10px',
            textAlign: 'left',
            cursor: 'pointer',
            background: 'transparent',
            fontSize: '12px',
            marginTop: '2px'
        });

        offButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this.on3DGlassModeRequested('off');
            this.hideStereoscopicModeMenu();
        });

        this.stereoModeMenu.appendChild(offButton);
        this.container.appendChild(this.stereoModeMenu);
        this.updateModeMenuTheme();
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

        button.addEventListener('mouseenter', () => {
            const config = Constants.FLOATING_BUTTONS;
            const theme = this.isDarkMode ? config.DARK_MODE : config.LIGHT_MODE;
            button.style.backgroundColor = theme.HOVER;
            button.style.transform = this.isStereoscopicActive && button === this.glassButton ? 'scale(1.08)' : 'scale(1.04)';
        });

        button.addEventListener('mouseleave', () => {
            const config = Constants.FLOATING_BUTTONS;
            const theme = this.isDarkMode ? config.DARK_MODE : config.LIGHT_MODE;
            button.style.backgroundColor = theme.BACKGROUND;
            button.style.transform = this.isStereoscopicActive && button === this.glassButton ? 'scale(1.06)' : 'scale(1)';
        });

        button.addEventListener('mousedown', () => {
            button.style.transform = 'scale(0.96)';
        });

        button.addEventListener('mouseup', () => {
            button.style.transform = this.isStereoscopicActive && button === this.glassButton ? 'scale(1.06)' : 'scale(1)';
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
        if (button === this.glassButton && this.isStereoscopicActive) {
            button.style.boxShadow = '0 0 0 2px rgba(0, 180, 255, 0.9), 0 8px 16px rgba(0, 0, 0, 0.25)';
            button.style.transform = 'scale(1.06)';
        }

        this.updateModeMenuTheme();
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

    handle3DGlassModeClick() {
        console.log('3D Glass Mode menu opened');
        this.toggleStereoscopicModeMenu();
    }

    updateTheme() {
        this.applyButtonStyles(this.xrButton);
        this.applyButtonStyles(this.glassButton);
        this.updateModeMenuTheme();
    }

    setStereoscopicActive(isActive, activeMode = null) {
        this.isStereoscopicActive = Boolean(isActive);

        if (activeMode) {
            this.stereoscopicMode = activeMode;
        }

        this.updateStereoscopicButtonLabel();
        this.updateTheme();
    }

    selectStereoscopicMode(mode) {
        this.stereoscopicMode = mode;
        this.updateStereoscopicButtonLabel();
        this.on3DGlassModeRequested(mode);
        this.hideStereoscopicModeMenu();
    }

    getStereoscopicButtonLabel() {
        return `3D ${this.getModeShortLabel(this.stereoscopicMode)}`;
    }

    getModeShortLabel(mode) {
        return this.stereoscopicModeLabels[mode] || 'SBS';
    }

    updateStereoscopicButtonLabel() {
        if (!this.glassButtonLabel) return;
        this.glassButtonLabel.textContent = this.getStereoscopicButtonLabel();
        this.glassButton.title = this.getStereoscopicButtonLabel();
        this.glassButton.setAttribute('aria-label', this.getStereoscopicButtonLabel());
    }

    toggleStereoscopicModeMenu() {
        if (!this.stereoModeMenu) return;

        const isOpen = this.stereoModeMenu.style.display === 'block';
        this.stereoModeMenu.style.display = isOpen ? 'none' : 'block';
        this.updateModeMenuTheme();
    }

    hideStereoscopicModeMenu() {
        if (!this.stereoModeMenu) return;
        this.stereoModeMenu.style.display = 'none';
    }

    updateModeMenuTheme() {
        if (!this.stereoModeMenu) return;

        const config = Constants.FLOATING_BUTTONS;
        const theme = this.isDarkMode ? config.DARK_MODE : config.LIGHT_MODE;

        Object.assign(this.stereoModeMenu.style, {
            backgroundColor: theme.BACKGROUND,
            border: `1px solid ${theme.BORDER}`,
            boxShadow: theme.SHADOW
        });

        const optionButtons = this.stereoModeMenu.querySelectorAll('button');
        optionButtons.forEach((button) => {
            const mode = button.dataset.mode;
            const isModeButton = mode !== 'off';
            const isSelected = isModeButton && this.stereoscopicMode === mode;
            const isOffButton = mode === 'off';

            button.style.color = theme.TEXT;
            button.style.backgroundColor = isSelected
                ? (this.isDarkMode ? 'rgba(0, 180, 255, 0.25)' : 'rgba(0, 140, 220, 0.2)')
                : 'transparent';
            button.style.opacity = isOffButton && !this.isStereoscopicActive ? '0.6' : '1';

            button.onmouseenter = () => {
                button.style.backgroundColor = isSelected
                    ? (this.isDarkMode ? 'rgba(0, 180, 255, 0.35)' : 'rgba(0, 140, 220, 0.28)')
                    : theme.HOVER;
            };

            button.onmouseleave = () => {
                button.style.backgroundColor = isSelected
                    ? (this.isDarkMode ? 'rgba(0, 180, 255, 0.25)' : 'rgba(0, 140, 220, 0.2)')
                    : 'transparent';
            };
        });
    }

    handleDocumentClick(event) {
        if (!this.container || !this.stereoModeMenu) return;

        const clickedInsideMenu = this.stereoModeMenu.contains(event.target);
        const clickedGlassButton = this.glassButton && this.glassButton.contains(event.target);

        if (!clickedInsideMenu && !clickedGlassButton) {
            this.hideStereoscopicModeMenu();
        }
    }

    setDarkMode(isDarkMode) {
        this.isDarkMode = isDarkMode;
        this.updateTheme();
    }

    destroy() {
        document.removeEventListener('click', this.handleDocumentClick);
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
