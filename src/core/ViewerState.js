export default class ViewerState {
    /**
     * 뷰어 상태 관리 클래스 생성자
     * 애니메이션, 다크모드, 모바일, 렌더링 상태 등을 초기화
     */
    constructor() {
        this.state = {
            isAnimating: false,
            isDarkMode: false,
            isMobile: false,
            renderNeeded: false,
            fps: {
                target: 30,
                current: 0,
            },
        };
        this.listeners = new Set();
    }

    /**
     * 상태 업데이트
     * 현재 상태에 새로운 업데이트를 적용하고 리스너에게 알림
     * @param {Object} updates - 업데이트할 상태 객체
     */
    setState(updates) {
        Object.assign(this.state, updates);
        this.notifyListeners();
    }

    /**
     * 상태 변경 구독
     * 상태 변경 시 호출될 리스너 함수 등록
     * @param {Function} listener - 상태 변경 시 호출될 콜백 함수
     * @returns {Function} - 구독 취소 함수
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * 리스너 알림
     * 등록된 모든 리스너에게 현재 상태 전달
     */
    notifyListeners() {
        this.listeners.forEach((listener) => listener(this.state));
    }
}
