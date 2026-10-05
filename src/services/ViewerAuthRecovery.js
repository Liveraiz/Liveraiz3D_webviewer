import { apiBaseUrl } from "./ViewerProjectManifestService.js";

const base64url = (bytes) => btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function createRecoveryProof(crypto = globalThis.crypto) {
    const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const codeVerifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const codeChallenge = base64url(new Uint8Array(await crypto.subtle.digest(
        "SHA-256", new TextEncoder().encode(codeVerifier)
    )));
    return { state, codeVerifier, codeChallenge };
}

export async function applyRecoveredViewerSession(session, selector, manifest, alreadyLoaded, isActive = () => true) {
    session.validateManifest(manifest);
    if (!isActive()) return false;
    if (alreadyLoaded) selector.refreshManifest(manifest);
    else await selector.loadManifest(manifest, "s3");
    if (!isActive()) return false;
    session.resume(manifest);
    return true;
}

/** Owns only the login exchange. Scene/model lifetime belongs to the viewer. */
export class ViewerAuthRecovery {
    constructor({ getRecovery, onRecovered, onChange, apiBase, portalOrigin, fetch: fetcher,
        createProof, openWindow, createChannel, setTimer, clearTimer } = {}) {
        this.getRecovery = getRecovery;
        this.onRecovered = onRecovered;
        this.onChange = onChange || (() => {});
        this.apiBase = apiBase ?? apiBaseUrl();
        this.portalOrigin = new URL(portalOrigin || import.meta.env?.VITE_LIVERAIZ_PORTAL_URL || this.apiBase).origin;
        this.fetch = fetcher || globalThis.fetch.bind(globalThis);
        this.createProof = createProof || createRecoveryProof;
        this.openWindow = openWindow || (() => window.open("about:blank", "_blank"));
        this.createChannel = createChannel || ((name) => new BroadcastChannel(name));
        this.setTimer = setTimer || ((fn, ms) => globalThis.setTimeout(fn, ms));
        this.clearTimer = clearTimer || ((id) => globalThis.clearTimeout(id));
        this.generation = 0;
        this.attempt = null;
        this.disposed = false;
    }

    async request(path, body) {
        const response = await this.fetch(`${this.apiBase}/api/auth/handoffs${path}`, {
            method: "POST", credentials: "omit", cache: "no-store",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(data.message || "로그인 연결에 실패했습니다. 다시 시도하세요.");
            error.code = data.code;
            error.status = response.status;
            throw error;
        }
        return data;
    }

    // Called directly in a click handler, before any await, to preserve user activation.
    async start() {
        if (this.disposed || this.attempt) return;
        const recovery = this.getRecovery();
        if (!recovery) return;
        const generation = ++this.generation;
        let popup;
        try { popup = this.openWindow(); if (popup) popup.opener = null; } catch { /* manual link remains available */ }
        const attempt = { generation, popup, recovery, busy: false };
        this.attempt = attempt;
        this.onChange({ status: "opening" });
        try {
            Object.assign(attempt, await this.createProof());
            if (!this.isCurrent(attempt)) return;
            const result = await this.request("", {
                clientId: "viewer", state: attempt.state,
                codeChallenge: attempt.codeChallenge, codeChallengeMethod: "S256", recovery,
            });
            if (!this.isCurrent(attempt)) return;
            const loginUrl = new URL(result.loginUrl);
            if (!["https:", "http:"].includes(loginUrl.protocol)
                    || loginUrl.origin !== this.portalOrigin || loginUrl.pathname !== "/auth/reauth"
                    || typeof result.handoffId !== "string" || !result.handoffId
                    || loginUrl.searchParams.get("handoff") !== result.handoffId) {
                throw new Error("로그인 주소가 올바르지 않습니다.");
            }
            const remaining = Math.min(600000, Date.parse(result.expiresAt) - Date.now());
            if (!Number.isFinite(remaining) || remaining <= 0) throw new Error("로그인 연결 요청이 만료되었습니다. 다시 로그인하세요.");
            Object.assign(attempt, { handoffId: result.handoffId, loginUrl: loginUrl.href });
            try {
                attempt.channel = this.createChannel(`liveraiz-auth:${attempt.state}`);
                attempt.channel.onmessage = ({ data }) => { this.receive(data); };
            } catch { /* copy/paste supports browsers without BroadcastChannel */ }
            attempt.timer = this.setTimer(() => {
                if (!this.isCurrent(attempt)) return;
                this.cancel();
                this.onChange({ status: "expired", message: "로그인 대기 시간이 지났습니다. 다시 로그인하세요." });
            }, remaining);
            this.onChange({ status: "waiting", loginUrl: attempt.loginUrl });
            try { if (popup) popup.location.href = attempt.loginUrl; } catch { /* use the visible link */ }
        } catch (error) {
            if (!this.isCurrent(attempt)) return;
            try { popup?.close(); } catch { /* already navigated or browser policy */ }
            this.cancel();
            this.onChange({ status: [403, 410].includes(error.status) || (error.status === 409 && error.code !== "AUTH_ACCOUNT_MISMATCH") ? "blocked" : "error", error });
        }
    }

    isCurrent(attempt) {
        return !this.disposed && this.attempt === attempt && this.generation === attempt.generation;
    }

    ready() {
        const a = this.attempt;
        if (a?.handoffId) a.channel?.postMessage({ type: "liveraiz-auth-ready", handoffId: a.handoffId, state: a.state });
    }

    async submitCode(text) {
        try {
            const data = JSON.parse(text);
            if (!this.matches(data)) throw new Error("이 작업 화면의 로그인 코드가 아닙니다. 새 로그인 결과를 복사하세요.");
            await this.receive({ ...data, type: "liveraiz-auth-code" });
        } catch (error) {
            this.onChange({ status: "error", error, loginUrl: this.attempt?.loginUrl });
        }
    }

    matches(data) {
        const a = this.attempt;
        return a && data?.handoffId === a.handoffId && data?.state === a.state
            && typeof data.code === "string" && data.code.length > 0 && data.code.length <= 2048;
    }

    async receive(data) {
        if (data?.type !== "liveraiz-auth-code" || !this.matches(data)) return;
        const a = this.attempt;
        const ack = () => a.channel?.postMessage({ type: "liveraiz-auth-complete", handoffId: a.handoffId, state: a.state });
        if (a.completed) { ack(); return; }
        if (a.busy) return;
        a.busy = true;
        this.onChange({ status: "exchanging", loginUrl: a.loginUrl });
        try {
            const result = await this.request("/exchange", {
                handoffId: a.handoffId, code: data.code, codeVerifier: a.codeVerifier,
            });
            if (!this.isCurrent(a)) return;
            if (result.kind !== "viewer" || String(result.context?.projectId) !== String(a.recovery.projectId)) {
                throw new Error("로그인 결과의 프로젝트가 일치하지 않습니다.");
            }
            await this.onRecovered(result.manifest, result.context, () => this.isCurrent(a));
            if (!this.isCurrent(a)) return;
            a.completed = true;
            a.codeVerifier = null;
            a.recovery = null;
            this.clearTimer(a.timer);
            ack();
            this.onChange({ status: "complete" });
            a.timer = this.setTimer(() => { if (this.isCurrent(a)) this.cancel(); }, 3000);
        } catch (error) {
            if (this.isCurrent(a)) {
                const blocked = [403, 410].includes(error.status) || (error.status === 409 && error.code !== "AUTH_ACCOUNT_MISMATCH");
                // The server may have consumed the code even when its response was lost.
                // Retry starts a new handoff/proof rather than replaying this exchange.
                this.cancel();
                this.onChange({ status: blocked ? "blocked" : "error", error });
            }
        } finally {
            a.busy = false;
        }
    }

    cancel() {
        this.generation++;
        const a = this.attempt;
        if (a) {
            this.clearTimer(a.timer);
            a.channel?.close();
            a.codeVerifier = null;
            a.recovery = null;
        }
        this.attempt = null;
    }

    dispose() {
        this.disposed = true;
        this.cancel();
    }
}
