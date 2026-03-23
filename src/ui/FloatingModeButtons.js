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
        const config = Constants.FLOATING_BUTTONS;

        // Enter XR Mode 버튼
        this.xrButton = this.createButton({
            id: 'enter-xr-button',
            label: 'Enter XR',
            icon: '🥽',
            onClick: () => this.handleXRModeClick()
        });

        // 3D Glass Mode 버튼
        this.glassButton = this.createButton({
            id: '3d-glass-button',
            label: '3D Glass',
            icon: '👓',
            onClick: () => this.handle3DGlassModeClick()
        });

        this.container.appendChild(this.xrButton);
        this.container.appendChild(this.glassButton);

        this.applyButtonStyles(this.xrButton);
        this.applyButtonStyles(this.glassButton);
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

        button.addEventListener('click', options.onClick);

        return button;
    }

    applyButtonStyles(button) {
        const config = Constants.FLOATING_BUTTONS;
        const theme = this.isDarkMode ? config.DARK_MODE : config.LIGHT_MODE;

        Object.assign(button.style, {
            backgroundColor: theme.BACKGROUND,
            color: theme.TEXT,
            boxShadow: theme.SHADOW,
            border: `1px solid ${theme.BORDER}`
        });

        // Hover 효과
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = theme.HOVER;
            button.style.transform = 'scale(1.1)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = theme.BACKGROUND;
            button.style.transform = 'scale(1)';
        });

        // Active 효과
        button.addEventListener('mousedown', () => {
            button.style.transform = 'scale(0.95)';
        });

        button.addEventListener('mouseup', () => {
            button.style.transform = 'scale(1)';
        });
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
        console.log('3D Glass Mode requested');
        this.on3DGlassModeRequested();
    }

    updateTheme() {
        this.applyButtonStyles(this.xrButton);
        this.applyButtonStyles(this.glassButton);
    }

    setDarkMode(isDarkMode) {
        this.isDarkMode = isDarkMode;
        this.updateTheme();
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
