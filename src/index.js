// index.js - 메인 애플리케이션 진입점
import LiverViewer from './core/LiverViewer';
import { ErrorHandler } from './utils/ErrorHandler';

/**
 * 애플리케이션을 초기화하는 메인 함수
 * LiverViewer 인스턴스를 생성하고 성능 측정을 수행
 */
const initializeApp = () => {
    try {
        const startTime = performance.now();
        
        console.log('=== 애플리케이션 초기화 시작 ===');
        
        // LiverViewer 인스턴스 생성 - DOM container ID를 전달
        const viewer = new LiverViewer('container');
        
        // 애플리케이션 초기화 시간 측정 및 기록
        ErrorHandler.logPerformance('Application Initialization', startTime);
        
        console.log('=== 애플리케이션 초기화 완료 ===');
    } catch (error) {
        // 초기화 과정에서 발생한 에러 처리
        ErrorHandler.handle(error, 'Application Initialization');
    }
};

// DOM 로딩 상태에 따른 초기화 처리
if (document.readyState === 'loading') {
    // DOM이 아직 로딩 중인 경우, DOMContentLoaded 이벤트 리스너 등록
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM이 이미 로드된 경우, 즉시 초기화 실행
    initializeApp();
}