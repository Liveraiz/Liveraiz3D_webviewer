/**
 * 뷰어 관련 상수 정의
 * 색상, 크기, 모드 등 뷰어에서 사용되는 기본 값들을 정의
 */
// 각 상수값을 관리하는 클래스
export const Constants = {
    /**
     * 색상 상수
     * 다크/라이트 모드의 배경색과 UI 요소 색상 정의
     */
    COLORS: {
        DARK_BACKGROUND: '#1a1a1a',
        LIGHT_BACKGROUND: '#ffffff',
        DARK_TEXT: '#ffffff',
        LIGHT_TEXT: '#000000',
        DARK_BORDER: '#333333',
        LIGHT_BORDER: '#dddddd',
        DARK_PANEL: '#242424',
        LIGHT_PANEL: '#ffffff',
        DARK_HOVER: '#2a2a2a',
        LIGHT_HOVER: '#f0f0f0',
      
    },

    /**
     * 크기 상수
     * UI 요소의 크기와 여백 정의
     */
    SIZES: {
        PANEL_WIDTH: 300,
        PANEL_PADDING: 10,
        BUTTON_HEIGHT: 30,
        BORDER_RADIUS: 4,
    },

    /**
     * 모드 상수
     * 뷰어의 다양한 동작 모드 정의
     */
    MODES: {
        VIEW: 'view',
        TRANSLATE: 'translate',
        ROTATE: 'rotate',
        SCALE: 'scale',
    },

    /**
     * 성능 관련 상수
     * FPS 및 렌더링 관련 설정 정의
     */
    PERFORMANCE: {
        TARGET_FPS: 30,
        MIN_FPS: 15,
        MAX_FPS: 60,
    },

    /**
     * 애니메이션 상수
     * 애니메이션 지속 시간과 타이밍 정의
     */
    ANIMATION: {
        DURATION: 300,
        EASING: 'ease-in-out',
    },

    /**
     * 이벤트 상수
     * 커스텀 이벤트 이름 정의
     */
    EVENTS: {
        MODEL_LOADED: 'modelLoaded',
        RENDER_NEEDED: 'renderNeeded',
        STATE_CHANGED: 'stateChanged',
    },

    /**
     * 메시지 상수
     * 사용자에게 표시되는 메시지 정의
     */
    MESSAGES: {
        LOAD_ERROR: '모델을 불러오는 중 오류가 발생했습니다.',
        RENDER_ERROR: '렌더링 중 오류가 발생했습니다.',
        UNSUPPORTED_BROWSER: '지원되지 않는 브라우저입니다.',
    },

    CAMERA: {
        FOV: {
            MOBILE: 60,
            DESKTOP: 45
        },
        NEAR: 0.1,
        FAR: 1000,
        MIN_DISTANCE: 0.1,
        DEFAULT_POSITION: {
            x: 0,
            y: 0,
            z: 5
        }
    },
    
    MATERIAL: {
        HEALTHY: {
            METALNESS: 0.0,
            ROUGHNESS: 0.1,
            TRANSMISSION: 0.5,
            IOR: 1,
            OPACITY: 0.5
        },
        VESSEL: {
            METALNESS: 0.3,
            ROUGHNESS: 0.2,
            CLEARCOAT: 0.5,
            CLEARCOAT_ROUGHNESS: 0.1,
            ENV_MAP_INTENSITY: 1.5
        },
        FIBROSIS: {
            METALNESS: 0.0,
            ROUGHNESS: 0.1,
            TRANSMISSION: 0.5,
            IOR: 1,
            OPACITY: 0.5,
            NORMAL_SCALE: 0.5
        }
    },
    
    /**
     * UI 관련 상수
     * 폰트, 패널, 툴바 등 UI 요소의 스타일 정의
     */
    UI: {
        FONT: {
            FAMILY: "'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
            SIZES: {
                SMALL: '12px',
                NORMAL: '14px',
                MEDIUM: '16px',
                LARGE: '18px',
                XLARGE: '22px'
            },
            WEIGHTS: {
                LIGHT: 300,
                REGULAR: 400,
                MEDIUM: 500,
                BOLD: 700
            }
        },
        PANEL: {
            WIDTH: 250,
            BACKGROUND_OPACITY: 0.9,
            DARK: {
                BACKGROUND: "rgba(0, 0, 0, 0.9)",
                TEXT: "white",
                HOVER: "rgba(255, 255, 255, 0.2)",
                ROW: "rgba(255, 255, 255, 0.1)"
            },
            LIGHT: {
                BACKGROUND: "rgba(245, 245, 245, 0.95)",
                TEXT: "black",
                HOVER: "rgba(220, 220, 220, 0.95)",
                ROW: "rgba(230, 230, 230, 0.95)"
            },
            TOP_BAR_HEIGHT: "60px",
            MOBILE_TOP_BAR_HEIGHT: "50px"
        },
        TOOLBAR: {
            BUTTON: {
                SIZE: 32,
                ICON_SIZE: 20
            }
        },
        SAFE_AREA: {
            TOP: 'env(safe-area-inset-top, 0px)',
            BOTTOM: 'env(safe-area-inset-bottom, 0px)'
        }
    },
    
    RENDER: {
        TONE_MAPPING: {
            EXPOSURE: 0.65
        },
        PIXEL_RATIO: {
            MOBILE_MAX: 1
        }
    },
    
    //기본으로 불러오는 에셋
    ASSETS: {
        MODELS: {
            LIVER: '/models/LDLT_D_fusion.glb'
        },
        TEXTURES: {
            NORMAL_MAP: './textures/13263-normal.jpg',
            ENVIRONMENT: '/studio_small_03_2k.hdr'
        }
    },
    
};
  
//투명도 컨트롤을 위한 liver keywords
export const LIVER_KEYWORDS = [
    "liver",
    "lobe","Rtlobe","Ltlobe","Rt_lobe","Lt_lobe",
    "LLS", "LMS", "Spigelian",  "Spigel",  "RAS",  "RPS",
    "RHVt", "RSHVt", "RIHVt", "RIHVat", "RIHVpt",
    "MHVt", "V5t", "V58t", "V8t",
    "V4t", "V4at", "V4bt", "LHVt", "Remnant", "Resection"
];

// 투명도 조절 가능한 mesh 이름 키워드 (통합 관리)
export const OPACITY_CONTROLLABLE_KEYWORDS = [
    ...LIVER_KEYWORDS,
    "myometrium","uterus", "recipient_cavity"
];

export const VESSEL_KEYWORDS = [
    "ha",     // hepatic artery
    "pv",     // portal vein
    "bd",     // bile duct
    "hv",     // hepatic vein
];

// 오브젝트 리스트에서 우선 체크할 제외 키워드
export const PRIMARY_EXCLUDE_KEYWORDS = [
    'vol',
    'wireframe'
];

// 오브젝트 리스트에서 일반 제외 키워드
export const EXCLUDE_KEYWORDS = [
    'XY', 
    'YZ', 
    'XZ', 
    'START', 
    'END', 
    'EMPTY', 
    'Plane', 
    'Camera', 
    'Light', 
    'Empty', 
    'Cube'
];

// 메시 관련 상수
export const MESH_CONSTANTS = {
    // 혈관 관련 키워드
    VESSEL_KEYWORDS: ['vein', 'artery', 'vessel'],
    
    // 신장 구조의 계층 (큰 구조부터 작은 구조 순)
    KIDNEY_HIERARCHY: ['kidney', 'cortex', 'column', 'medulla'],
    
    // 기관별 우선순위 (추후 다른 기관도 추가 가능)
    ORGAN_PRIORITIES: {
        KIDNEY: {
            hierarchy: ['kidney', 'cortex', 'column', 'medulla'],
            sides: ['left', 'right']
        }
        // 다른 기관들도 추가 가능
        // LIVER: { ... },
        // HEART: { ... }
    }
};
  
// 폰트 스타일을 적용하는 함수
function applyGlobalFontStyle() {
    const style = document.createElement('style');
    style.textContent = `
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        
        *, *::before, *::after {
            font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        }
    `;
    document.head.appendChild(style);
}

// 폰트 스타일 적용 함수 export
export const initializeGlobalStyles = () => {
    applyGlobalFontStyle();
};
  