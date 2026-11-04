import { isViewerPublicTerminalError, viewerPublicErrorMessage } from "../services/ViewerPublicProjectService.js";

export class ViewerPublicSessionNotice {
    constructor(onRetry) {
        this.element = document.createElement("section");
        this.element.setAttribute("aria-label", "Public project");
        this.element.style.cssText = "position:fixed;z-index:10001;left:16px;bottom:16px;max-width:min(480px,calc(100vw - 64px));padding:18px;background:#fff;color:#172438;border:1px solid #c6d2e3;border-radius:12px;box-shadow:0 4px 24px #0003;font:14px/1.5 system-ui";
        this.element.innerHTML = '<p role="alert" style="margin:0 0 10px"></p><button type="button">다시 시도</button>';
        this.message = this.element.querySelector("p");
        this.retry = this.element.querySelector("button");
        this.retry.onclick = async () => {
            this.retry.disabled = true;
            try { await onRetry(); } catch (error) { this.showError(error); }
            finally { this.retry.disabled = false; }
        };
        this.element.hidden = true;
        document.body.appendChild(this.element);
    }

    showError(error) {
        this.element.hidden = false;
        this.message.textContent = viewerPublicErrorMessage(error);
        this.retry.hidden = isViewerPublicTerminalError(error);
    }

    update({ status }) { if (status === "complete") this.element.hidden = true; }

    dispose() { this.element.remove(); }
}
