import {
    fetchViewerProjectManifest,
    refreshViewerProjectManifest,
} from "./ViewerProjectManifestService.js";

/** Keeps S3 GET signatures fresh while the viewer remains open. */
export class ViewerManifestSession {
    constructor(projectId, launchToken, onRefresh, requests = {}) {
        this.projectId = projectId;
        this.launchToken = launchToken;
        this.onRefresh = onRefresh;
        this.fetchInitial = requests.fetchInitial || fetchViewerProjectManifest;
        this.fetchRefresh = requests.fetchRefresh || refreshViewerProjectManifest;
        this.clock = requests.clock || Date.now;
        // Browser timer functions require window as their receiver. Calling a
        // bare timer stored on this session throws "Illegal invocation".
        this.setTimer = requests.setTimer || ((callback, delay) => globalThis.setTimeout(callback, delay));
        this.clearTimer = requests.clearTimer || ((timer) => globalThis.clearTimeout(timer));
        this.refreshToken = null;
        this.refreshAt = 0;
        this.timer = null;
        this.refreshPromise = null;
        this.closed = false;
        this.terminalError = null;
        this.legacySession = false;
    }

    async open() {
        const manifest = await this.fetchInitial(this.projectId, this.launchToken);
        this.launchToken = null;
        this.accept(manifest);
        return manifest;
    }

    async ensureFresh(force = false) {
        if (this.terminalError) throw this.terminalError;
        if (this.legacySession && !this.closed) {
            if (this.clock() < this.refreshAt) return null;
            this.terminalError = new Error(
                "The S3 file links have expired. Please open the project again from the portal."
            );
            throw this.terminalError;
        }
        if (!this.refreshToken || this.closed) {
            throw new Error("Viewer session has ended. Reopen the result from the portal.");
        }
        if (this.refreshPromise) return this.refreshPromise;
        if (!force && this.clock() < this.refreshAt) return null;

        this.refreshPromise = this.fetchRefresh(this.projectId, this.refreshToken)
            .then((manifest) => {
                this.onRefresh?.(manifest);
                this.accept(manifest);
                return manifest;
            })
            .catch((error) => {
                if ([401, 403, 409].includes(error?.status)) {
                    this.terminalError = error;
                    this.close();
                } else {
                    // A throttled background tab can miss its timer. The next selection retries.
                    this.schedule(60_000);
                }
                throw error;
            })
            .finally(() => { this.refreshPromise = null; });
        return this.refreshPromise;
    }

    accept(manifest) {
        if (!Array.isArray(manifest?.models)
                || (!manifest.refreshToken && manifest.legacySession !== true)) {
            throw new Error("Viewer manifest session is invalid.");
        }
        this.legacySession = manifest.legacySession === true;
        this.refreshToken = manifest.refreshToken;
        if (this.legacySession) {
            // The old /manifest endpoint signs GET URLs for ten minutes. Stop
            // selection before that deadline because no refresh API exists.
            this.refreshAt = this.clock() + 9 * 60_000;
            return;
        }
        const seconds = Number(manifest.refreshAfterSeconds);
        const delay = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 8 * 60_000) : 8 * 60_000;
        this.refreshAt = this.clock() + delay;
        this.schedule(delay);
    }

    schedule(delay) {
        if (this.timer !== null) this.clearTimer(this.timer);
        if (this.closed) return;
        this.timer = this.setTimer(() => {
            this.timer = null;
            this.ensureFresh().catch((error) => console.warn("Viewer URL refresh failed:", error));
        }, delay);
    }

    close() {
        this.closed = true;
        if (this.timer !== null) this.clearTimer(this.timer);
        this.timer = null;
        this.refreshToken = null;
        this.launchToken = null;
    }
}
