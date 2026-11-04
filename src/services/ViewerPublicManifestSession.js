import { fetchViewerPublicManifest, isViewerPublicTerminalError } from "./ViewerPublicProjectService.js";

/** Rechecks public access without creating or recovering an authenticated session. */
export class ViewerPublicManifestSession {
    constructor(projectId, onManifest, requests = {}) {
        this.projectId = projectId;
        this.onManifest = onManifest;
        this.fetchManifest = requests.fetchManifest || fetchViewerPublicManifest;
        this.onError = requests.onError;
        this.clock = requests.clock || Date.now;
        this.setTimer = requests.setTimer || ((callback, delay) => globalThis.setTimeout(callback, delay));
        this.clearTimer = requests.clearTimer || ((timer) => globalThis.clearTimeout(timer));
        this.revisionId = null;
        this.refreshAt = 0;
        this.timer = null;
        this.pending = null;
        this.request = null;
        this.generation = 0;
        this.closed = false;
        this.terminalError = null;
    }

    open() { return this.ensureFresh(true); }

    async ensureFresh(force = false) {
        if (this.terminalError) throw this.terminalError;
        if (this.closed) throw new Error("Public viewer has ended.");
        if (this.pending) return this.pending;
        if (!force && this.revisionId && this.clock() < this.refreshAt) return null;
        const generation = this.generation;
        const request = new AbortController();
        this.request = request;
        const active = () => !this.closed && generation === this.generation;
        const pending = Promise.resolve()
            .then(() => this.fetchManifest(this.projectId, this.revisionId, { signal: request.signal }))
            .then(async (manifest) => {
                if (!active()) return null;
                this.validateManifest(manifest);
                await this.onManifest?.(manifest);
                if (!active()) return null;
                this.revisionId = String(manifest.revisionId);
                const seconds = Number(manifest.refreshAfterSeconds);
                const delay = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 60_000) : 60_000;
                this.refreshAt = this.clock() + delay;
                this.schedule(delay);
                return manifest;
            })
            .catch((error) => {
                if (active()) {
                    if (isViewerPublicTerminalError(error)) {
                        this.terminalError = error;
                        this.close();
                    } else this.schedule(60_000);
                    this.onError?.(error);
                }
                throw error;
            })
            .finally(() => {
                if (this.pending === pending) this.pending = null;
                if (this.request === request) this.request = null;
            });
        this.pending = pending;
        return pending;
    }

    validateManifest(manifest) {
        if (!Array.isArray(manifest?.models) || manifest.models.length === 0 || !manifest.revisionId) {
            throw new Error("Public viewer manifest is invalid.");
        }
        if (this.revisionId && String(manifest.revisionId) !== this.revisionId) {
            const error = new Error("Public project revision changed.");
            error.status = 409;
            error.code = "VIEWER_REVISION_CHANGED";
            throw error;
        }
    }

    schedule(delay) {
        if (this.timer !== null) this.clearTimer(this.timer);
        if (this.closed) return;
        this.timer = this.setTimer(() => {
            this.timer = null;
            this.ensureFresh().catch(() => {});
        }, delay);
    }

    close() {
        this.closed = true;
        this.generation++;
        this.request?.abort();
        if (this.timer !== null) this.clearTimer(this.timer);
        this.timer = null;
    }
}
