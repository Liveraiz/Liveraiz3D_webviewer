import {
    fetchViewerProjectManifest,
    refreshViewerProjectManifest,
    isViewerAuthenticationError,
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
        this.onError = requests.onError;
        this.generation = 0;
    }

    async open() {
        const generation = this.generation;
        try {
            const manifest = await this.fetchInitial(this.projectId, this.launchToken);
            if (this.closed || generation !== this.generation) throw new Error("Viewer session has ended.");
            this.accept(manifest);
            this.launchToken = null;
            return manifest;
        } catch (error) {
            if (generation === this.generation && !this.closed) this.handleError(error);
            throw error;
        }
    }

    async ensureFresh(force = false) {
        if (this.terminalError) throw this.terminalError;
        if (this.legacySession && !this.closed) {
            if (this.clock() < this.refreshAt) return null;
            this.terminalError = new Error(
                "The S3 file links have expired. Please open the project again from the portal."
            );
            this.onError?.(this.terminalError);
            throw this.terminalError;
        }
        if (!this.refreshToken || this.closed) {
            throw new Error("Viewer session has ended. Reopen the result from the portal.");
        }
        if (this.refreshPromise) return this.refreshPromise;
        if (!force && this.clock() < this.refreshAt) return null;

        const generation = this.generation;
        const pending = this.fetchRefresh(this.projectId, this.refreshToken)
            .then((manifest) => {
                if (this.closed || generation !== this.generation) return null;
                this.onRefresh?.(manifest);
                this.accept(manifest);
                return manifest;
            })
            .catch((error) => {
                if (generation === this.generation && !this.closed) this.handleError(error);
                throw error;
            })
            .finally(() => { if (this.refreshPromise === pending) this.refreshPromise = null; });
        this.refreshPromise = pending;
        return pending;
    }

    handleError(error) {
        if ([401, 403, 409].includes(error?.status)) {
            this.terminalError = error;
            // An expired secret still proves the original recovery context to the API.
            this.close(isViewerAuthenticationError(error));
        } else {
            this.schedule(60_000);
        }
        this.onError?.(error);
    }

    recoveryContext() {
        if (!isViewerAuthenticationError(this.terminalError)) return null;
        const token = this.refreshToken || this.launchToken;
        return token ? {
            kind: this.refreshToken ? "viewer-session" : "viewer-launch",
            token,
            projectId: this.projectId,
        } : null;
    }

    resume(manifest) {
        this.validateManifest(manifest);
        this.generation++;
        this.closed = false;
        this.terminalError = null;
        this.refreshPromise = null;
        this.launchToken = null;
        this.accept(manifest);
    }

    validateManifest(manifest) {
        if (!Array.isArray(manifest?.models)
                || (!manifest.refreshToken && manifest.legacySession !== true)) {
            throw new Error("Viewer manifest session is invalid.");
        }
    }

    accept(manifest) {
        this.validateManifest(manifest);
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

    close(preserveRecovery = false) {
        this.generation++;
        this.closed = true;
        if (this.timer !== null) this.clearTimer(this.timer);
        this.timer = null;
        if (!preserveRecovery) {
            this.refreshToken = null;
            this.launchToken = null;
        }
    }
}
