// utils/LoadingManager.js
export class LoadingManager {
  /**
   * 로딩 매니저 생성자
   * 로딩 UI 요소와 로딩 상태를 초기화
   */
  constructor() {
      this.loadingElement = document.getElementById('loading');
      this.total = 0;
      this.loaded = 0;
  }

  /**
   * 로딩 시작
   * 전체 로딩 항목 수를 설정하고 로딩 UI 초기화
   * @param {number} totalItems - 전체 로딩할 항목 수
   */
  start(totalItems) {
      this.total = totalItems;
      this.loaded = 0;
      this.updateUI();
  }

  /**
   * 로딩 증가
   * 로딩된 항목 수를 증가시키고 UI 업데이트
   */
  incrementLoaded() {
      this.loaded++;
      this.updateUI();
  }

  /**
   * UI 업데이트
   * 현재 로딩 진행률을 계산하여 UI에 표시
   */
  updateUI() {
      if (!this.loadingElement) return;

      const percent = (this.loaded / this.total) * 100;
      this.loadingElement.textContent = `Loading: ${Math.round(percent)}%`;
      
      if (this.loaded === this.total) {
          this.hideLoading();
      }
  }

  /**
   * 로딩 UI 숨기기
   * 로딩이 완료되면 로딩 UI를 화면에서 숨김
   */
  hideLoading() {
      if (this.loadingElement) {
          this.loadingElement.style.display = 'none';
      }
  }

  /**
   * 에러 표시
   * 로딩 중 발생한 에러 메시지를 UI에 표시
   * @param {string} message - 표시할 에러 메시지
   */
  showError(message) {
      if (this.loadingElement) {
          this.loadingElement.textContent = `Error: ${message}`;
          this.loadingElement.style.color = 'red';
      }
  }
}