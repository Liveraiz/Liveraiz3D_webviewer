// utils/EventEmitter.js
export class EventEmitter {
  /**
   * 이벤트 이미터 생성자
   * 이벤트 핸들러를 저장할 객체 초기화
   */
  constructor() {
      this.events = {};
  }

  /**
   * 이벤트 리스너 등록
   * 특정 이벤트에 대한 콜백 함수를 등록
   * @param {string} event - 이벤트 이름
   * @param {Function} callback - 실행될 콜백 함수
   * @returns {Function} - 이벤트 리스너 제거 함수
   */
  on(event, callback) {
      if (!this.events[event]) {
          this.events[event] = [];
      }
      this.events[event].push(callback);
      
      return () => this.off(event, callback);
  }

  /**
   * 이벤트 리스너 제거
   * 특정 이벤트에서 콜백 함수를 제거
   * @param {string} event - 이벤트 이름
   * @param {Function} callback - 제거할 콜백 함수
   */
  off(event, callback) {
      if (!this.events[event]) return;
      
      this.events[event] = this.events[event]
          .filter(cb => cb !== callback);
  }

  /**
   * 이벤트 발생
   * 특정 이벤트의 모든 리스너에게 데이터를 전달하여 실행
   * @param {string} event - 이벤트 이름
   * @param {*} data - 리스너에게 전달할 데이터
   */
  emit(event, data) {
      if (!this.events[event]) return;
      
      this.events[event].forEach(callback => {
          callback(data);
      });
  }
}