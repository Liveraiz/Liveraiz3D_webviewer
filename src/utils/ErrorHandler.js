// utils/ErrorHandler.js
export class ErrorHandler {
  /**
   * 에러 처리 메서드
   * 에러 로깅 및 컨텍스트별 에러 메시지 표시
   * @param {Error} error - 발생한 에러 객체
   * @param {string} context - 에러가 발생한 컨텍스트
   */
  static handle(error, context = '') {
      console.error(`Error in ${context}:`, error);

      if (context === 'Model Loading') {
          this.showErrorMessage("모델을 불러오는데 실패했습니다. 다시 시도해주세요.");
      }
  }

  /**
   * 에러 메시지 표시
   * 사용자에게 시각적 에러 메시지를 표시
   * @param {string} message - 표시할 에러 메시지
   */
  static showErrorMessage(message) {
      const loadingElement = document.getElementById("loading");
      if (loadingElement) {
          // 로딩 아이콘과 메시지를 포함하는 컨테이너
          loadingElement.innerHTML = `
              <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                  <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  <span>${message}</span>
              </div>
          `;

          Object.assign(loadingElement.style, {
              color: "white",
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              padding: "20px",
              borderRadius: "8px",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: "1000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "200px",
              textAlign: "center"
          });

          // 회전 애니메이션 스타일 추가
          const style = document.createElement('style');
          style.textContent = `
              @keyframes spin {
                  to { transform: rotate(360deg); }
              }
              .animate-spin {
                  animation: spin 1s linear infinite;
              }
          `;
          document.head.appendChild(style);
          
          // 3초 후에 메시지 숨기기
          setTimeout(() => {
              loadingElement.style.display = "none";
              // 스타일 태그 제거
              style.remove();
          }, 3000);
      }
  }

  /**
   * 타입 에러 처리
   * undefined 속성 등의 타입 관련 에러 처리
   * @param {TypeError} error - 타입 에러 객체
   */
  static handleTypeError(error) {
      // Handle type errors (e.g., undefined properties)
      console.warn('Type Error Details:', {
          message: error.message,
          stack: error.stack
      });
  }

  /**
   * 참조 에러 처리
   * undefined 변수 등의 참조 관련 에러 처리
   * @param {ReferenceError} error - 참조 에러 객체
   */
  static handleReferenceError(error) {
      // Handle reference errors (e.g., undefined variables)
      console.warn('Reference Error Details:', {
          message: error.message,
          stack: error.stack
      });
  }

  /**
   * 일반 에러 처리
   * 기타 유형의 에러 처리
   * @param {Error} error - 일반 에러 객체
   */
  static handleGenericError(error) {
      // Handle other types of errors
      console.warn('Generic Error Details:', {
          message: error.message,
          stack: error.stack
      });
  }

  /**
   * 성능 로깅
   * 작업 수행 시간 측정 및 로깅
   * @param {string} label - 작업 레이블
   * @param {number} startTime - 시작 시간
   */
  static logPerformance(label, startTime) {
      const duration = performance.now() - startTime;
      console.log(`${label}: ${duration.toFixed(2)}ms`);
  }
}