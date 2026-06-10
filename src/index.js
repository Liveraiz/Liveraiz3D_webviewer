// index.js - 메인 애플리케이션 진입점
import LiverViewer from './core/LiverViewer';
import { ErrorHandler } from './utils/ErrorHandler';

let viewer = null;

/**
 * 애플리케이션을 초기화하는 메인 함수
 * LiverViewer 인스턴스를 생성하고 성능 측정을 수행
 */
const initializeApp = () => {
    try {
        const startTime = performance.now();
        
        console.log('=== 애플리케이션 초기화 시작 ===');
        
        // LiverViewer 인스턴스 생성 - DOM container ID를 전달
        viewer = new LiverViewer('container');
        
        // 글로벌 스코프에 viewer 노출 (Electron IPC 통신용)
        window.liverAIzViewer = viewer;
        
        // 애플리케이션 초기화 시간 측정 및 기록
        ErrorHandler.logPerformance('Application Initialization', startTime);
        
        console.log('=== 애플리케이션 초기화 완료 ===');
        
        // Electron에서 CLI 파일 경로 확인
        if (window.desktop && window.desktop.onLoadFile) {
            console.log('[Hospital Integration] Listening for load-file event...');
            window.desktop.onLoadFile((filePath) => {
                console.log('[Hospital Integration] ✓ Auto-loading file:', filePath);
                if (viewer && viewer.loadFile) {
                    viewer.loadFile(filePath);
                } else {
                    console.warn('[Hospital Integration] Viewer not ready yet');
                }
            });
        } else {
            console.log('[Hospital Integration] Desktop API not available (web mode)');
        }
        
        // Also try to get CLI file via IPC (in case event was missed)
        if (window.desktop && window.desktop.getCliFile) {
            console.log('[Hospital Integration] Checking for CLI file via IPC...');
            window.desktop.getCliFile().then((filePath) => {
                if (filePath) {
                    console.log('[Hospital Integration] CLI file found via IPC:', filePath);
                    // Give viewer a moment to fully initialize before loading
                    setTimeout(() => {
                        if (viewer && viewer.loadFile) {
                            viewer.loadFile(filePath);
                        }
                    }, 500);
                }
            }).catch((err) => {
                console.log('[Hospital Integration] No CLI file or error:', err);
            });
        }
    } catch (error) {
        // 초기화 과정에서 발생한 에러 처리
        ErrorHandler.handle(error, 'Application Initialization');
    }
};

/**
 * 애플리케이션 정리 및 종료 핸들러
 * 윈도우나 탭이 닫힐 때 리소스를 정리하고 프로세스 종료
 */
const handleBeforeUnload = (event) => {
    try {
        console.log('=== 애플리케이션 정리 시작 ===');
        
        if (viewer && typeof viewer.dispose === 'function') {
            viewer.dispose();
        }
        
        viewer = null;
        
        console.log('=== 애플리케이션 정리 완료 ===');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
};

const handleUnload = (event) => {
    try {
        console.log('[Index] Unload event triggered');
        
        if (viewer && typeof viewer.dispose === 'function') {
            viewer.dispose();
        }
        
        viewer = null;
    } catch (error) {
        console.error('[Index] Error during unload cleanup:', error);
    }
};

/**
 * Electron에서 윈도우가 닫히기 전에 호출되는 핸들러
 */
const notifyAppClose = () => {
    try {
        console.log('[Index] App close notification received');
        
        if (viewer && typeof viewer.dispose === 'function') {
            viewer.dispose();
        }
        
        viewer = null;
    } catch (error) {
        console.error('[Index] Error in close handler:', error);
    }
};

// Electron에서 close 이벤트를 받을 수 있도록 설정
if (window.desktop && window.desktop.onAppClose) {
    window.desktop.onAppClose(notifyAppClose);
}

// DOM 로딩 상태에 따른 초기화 처리
if (document.readyState === 'loading') {
    // DOM이 아직 로딩 중인 경우, DOMContentLoaded 이벤트 리스너 등록
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM이 이미 로드된 경우, 즉시 초기화 실행
    initializeApp();
}

// 윈도우/탭 종료 시 리소스 정리
window.addEventListener('beforeunload', handleBeforeUnload);
window.addEventListener('unload', handleUnload);
window.addEventListener('pagehide', handleUnload);