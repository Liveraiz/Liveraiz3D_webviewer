// utils/DeviceDetector.js
export class DeviceDetector {
  /**
   * 디바이스 감지 클래스 생성자
   * 사용자 에이전트 문자열을 초기화하여 디바이스 타입 감지에 사용
   */
  constructor() {
      this.userAgent = navigator.userAgent || navigator.vendor || window.opera;
  }

  getForceDesktop() {
      const params = new URLSearchParams(window.location.search);
      if (params.has("forceDesktop")) {
          const value = params.get("forceDesktop");
          const normalized = value === "1" || value === "true";

          try {
              localStorage.setItem("forceDesktop", normalized ? "1" : "0");
          } catch (error) {
              console.warn("Failed to persist forceDesktop setting", error);
          }

          return normalized;
      }

      try {
          return localStorage.getItem("forceDesktop") === "1";
      } catch (error) {
          return false;
      }
  }

  getPointerContext() {
      const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
      const coarsePointer =
          window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

      return {
          hasTouch,
          coarsePointer,
      };
  }

  /**
   * 모바일 기기 감지
   * 최신 모바일 기기 및 폴더블 디바이스 포함
   * @returns {boolean} 모바일 기기 여부
   */
  isMobile() {
      if (this.getForceDesktop()) {
          return false;
      }

      const userAgent = this.userAgent.toLowerCase();
      const { hasTouch, coarsePointer } = this.getPointerContext();

      // 휴대폰 UA (태블릿 제외)
      const mobileRegex =
          /android.*mobile|webos|iphone|ipod|blackberry|iemobile|opera mini|windows phone/i;

      // 폴더블/플립 디바이스 감지
      const foldableRegex = /galaxy z|galaxy fold|galaxy flip|mate x|mix fold|find n|razr/i;

      // 화면 크기 기반 보조 감지 (좁은 폭일 때만)
      const isMobileViewport = window.innerWidth < 600;

      return (
          mobileRegex.test(userAgent) ||
          (foldableRegex.test(userAgent) && hasTouch) ||
          (coarsePointer && hasTouch && isMobileViewport)
      );
  }

  /**
   * 태블릿 기기 감지
   * 최신 태블릿 및 폴더블 태블릿 포함
   * @returns {boolean} 태블릿 기기 여부
   */
  isTablet() {
      if (this.getForceDesktop()) {
          return false;
      }

      const userAgent = this.userAgent.toLowerCase();
      const { hasTouch, coarsePointer } = this.getPointerContext();

      // 기존 태블릿 기기
      const tabletRegex =
          /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(ip|ap|wp))))/i;

      // 최신 태블릿 모델
      const modernTabletRegex = /ipad pro|galaxy tab|matepad|mi pad|surface|ipad air|ipad mini|galaxy z fold/i;

      // 화면 크기 기반 감지 (600px 이상 900px 미만)
      const isTabletViewport = window.innerWidth >= 600 && window.innerWidth < 900;

      return (
          tabletRegex.test(userAgent) ||
          modernTabletRegex.test(userAgent) ||
          (coarsePointer && hasTouch && isTabletViewport)
      );
  }

  /**
   * 데스크톱 기기 감지
   * 모바일이나 태블릿이 아닌 데스크톱 기기인지 확인
   * @returns {boolean} 데스크톱 기기 여부
   */
  isDesktop() {
      return !this.isMobile() && !this.isTablet();
  }
}