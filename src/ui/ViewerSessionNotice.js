import { isViewerAuthenticationError, viewerManifestErrorMessage } from "../services/ViewerProjectManifestService.js";

export class ViewerSessionNotice {
    constructor(recovery) {
        this.recovery = recovery;
        this.element = document.createElement("section");
        this.element.setAttribute("aria-label", "Viewer session");
        this.element.style.cssText = "position:fixed;z-index:10001;left:16px;bottom:16px;max-width:min(480px,calc(100vw - 64px));padding:18px;background:#fff;color:#172438;border:1px solid #c6d2e3;border-radius:12px;box-shadow:0 4px 24px #0003;font:14px/1.5 system-ui";
        this.element.innerHTML = `<p role="status" style="margin:0 0 10px"></p><div data-actions><button data-login type="button">Liveraiz.net 로그인</button> <button data-check type="button" hidden>로그인 완료 확인</button> <button data-cancel type="button" hidden>취소</button><p><a data-link target="_blank" rel="noopener noreferrer" hidden>로그인 탭 열기</a></p><details hidden><summary>로그인 코드 입력</summary><textarea aria-label="일회용 로그인 확인 코드" rows="3" style="width:100%;box-sizing:border-box"></textarea><button data-code type="button">로그인 코드 확인</button></details></div>`;
        this.message = this.element.querySelector('[role="status"]');
        this.login = this.element.querySelector('[data-login]');
        this.check = this.element.querySelector('[data-check]');
        this.cancel = this.element.querySelector('[data-cancel]');
        this.link = this.element.querySelector('[data-link]');
        this.details = this.element.querySelector('details');
        this.input = this.element.querySelector('textarea');
        this.login.onclick = () => { recovery.cancel(); recovery.start(); };
        this.check.onclick = () => recovery.ready();
        this.cancel.onclick = () => {
            recovery.cancel();
            this.update({ status: "expired", message: "로그인을 취소했습니다. 현재 모델은 유지됩니다. 필요할 때 다시 로그인하세요." });
        };
        this.element.querySelector('[data-code]').onclick = () => {
            const code = this.input.value;
            this.input.value = "";
            recovery.submitCode(code);
        };
        this.element.hidden = true;
        document.body.appendChild(this.element);
    }

    showError(error) {
        this.authRequired = isViewerAuthenticationError(error);
        this.element.hidden = false;
        this.message.textContent = this.authRequired
            ? "세션이 만료되었습니다. 현재 모델은 유지됩니다. 새 모델을 불러오려면 Liveraiz.net에 다시 로그인하세요."
            : viewerManifestErrorMessage(error);
        this.element.querySelector('[data-actions]').hidden = !this.authRequired;
        this.login.hidden = !this.authRequired;
        this.login.disabled = false;
        this.check.hidden = this.cancel.hidden = this.link.hidden = this.details.hidden = true;
    }

    update({ status, message, error, loginUrl }) {
        if (status === "complete") { this.element.hidden = true; this.input.value = ""; return; }
        this.element.hidden = false;
        this.element.querySelector('[data-actions]').hidden = status === "blocked";
        const messages = {
            opening: "로그인 탭을 준비하고 있습니다. 현재 작업 화면은 유지됩니다.",
            waiting: "열린 탭에서 로그인하세요. 탭이 열리지 않았다면 아래 ‘로그인 탭 열기’를 누르세요.",
            exchanging: "로그인을 확인하고 있습니다. 현재 모델은 유지됩니다.",
        };
        const errors = {
            AUTH_ACCOUNT_MISMATCH: "처음 프로젝트를 연 계정으로 로그인하세요. 현재 모델은 유지됩니다.",
            AUTH_RECOVERY_CONTEXT_INVALID: "이 세션을 복구할 수 없습니다. 포털에서 프로젝트를 새로 열어주세요. 현재 모델은 유지됩니다.",
            VIEWER_REVISION_CHANGED: "프로젝트 모델이 변경되었습니다. 포털에서 최신 결과를 새 탭으로 열어주세요. 현재 모델은 유지됩니다.",
        };
        this.message.textContent = message || errors[error?.code] || (error ? error.message : messages[status]) || "다시 로그인하세요.";
        this.login.hidden = false;
        this.login.textContent = loginUrl ? "다시 로그인" : "Liveraiz.net 로그인";
        this.login.disabled = status === "opening" || status === "exchanging";
        this.check.hidden = this.cancel.hidden = !loginUrl;
        this.link.hidden = this.details.hidden = !loginUrl;
        if (loginUrl) this.link.href = loginUrl;
    }

    dispose() { this.input.value = ""; this.element.remove(); }
}
