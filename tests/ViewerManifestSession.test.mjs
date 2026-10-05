import test from "node:test";
import assert from "node:assert/strict";

import { ViewerManifestSession } from "../src/services/ViewerManifestSession.js";
import {
    fetchViewerProjectManifest,
    refreshViewerProjectManifest,
    viewerManifestErrorMessage,
} from "../src/services/ViewerProjectManifestService.js";

test("default browser timers keep the global receiver while opening and closing a session", async () => {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    let scheduledDelay;
    let clearedTimer;
    globalThis.setTimeout = function (_callback, delay) {
        assert.equal(this, globalThis);
        scheduledDelay = delay;
        return 42;
    };
    globalThis.clearTimeout = function (timer) {
        assert.equal(this, globalThis);
        clearedTimer = timer;
    };
    try {
        const session = new ViewerManifestSession("78", "launch", () => {}, {
            fetchInitial: async () => ({
                refreshToken: "refresh", refreshAfterSeconds: 480,
                models: [{ modelId: 1, glbUrl: "signed" }],
            }),
        });
        assert.equal((await session.open()).models.length, 1);
        assert.equal(scheduledDelay, 480_000);
        session.close();
        assert.equal(clearedTimer, 42);
    } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
    }
});

test("model selection refreshes all signed URLs after eight minutes and shares one request", async () => {
    let now = 0;
    let refreshCalls = 0;
    const applied = [];
    const session = new ViewerManifestSession("89", "launch-secret", (manifest) => applied.push(manifest.models), {
        clock: () => now,
        setTimer: () => 1,
        clearTimer: () => {},
        fetchInitial: async () => ({ refreshToken: "memory-only-secret", refreshAfterSeconds: 480,
            models: [{ modelId: 1, glbUrl: "first-old" }, { modelId: 2, glbUrl: "second-old" }] }),
        fetchRefresh: async () => {
            refreshCalls++;
            return { refreshToken: "memory-only-secret", refreshAfterSeconds: 480,
                models: [{ modelId: 1, glbUrl: "first-new" }, { modelId: 2, glbUrl: "second-new" }] };
        },
    });

    assert.equal((await session.open()).models.length, 2);
    assert.equal(session.launchToken, null);
    now = 479_000;
    assert.equal(await session.ensureFresh(), null);
    now = 480_000;
    await Promise.all([session.ensureFresh(), session.ensureFresh()]);
    assert.equal(refreshCalls, 1);
    assert.deepEqual(applied[0].map(({ glbUrl }) => glbUrl), ["first-new", "second-new"]);
    session.close();
    await assert.rejects(() => session.ensureFresh(), /session has ended/);
});

test("manifest session endpoints use separate launch and refresh secrets", async () => {
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        return { ok: true, json: async () => ({ models: [] }) };
    };
    try {
        await fetchViewerProjectManifest("89", "launch", "https://api.example");
        await refreshViewerProjectManifest("89", "refresh", "https://api.example");
    } finally {
        globalThis.fetch = originalFetch;
    }
    assert.match(calls[0].url, /\/89\/manifest\/session$/);
    assert.deepEqual(JSON.parse(calls[0].options.body), { launchToken: "launch" });
    assert.match(calls[1].url, /\/89\/manifest\/refresh$/);
    assert.deepEqual(JSON.parse(calls[1].options.body), { refreshToken: "refresh" });
    assert.equal(calls[1].options.cache, "no-store");
    assert.equal(calls[0].options.credentials, "omit");
    assert.equal(calls[1].options.credentials, "omit");
});

test("fresh launch falls back to the legacy manifest endpoint only when session is unavailable", async () => {
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith("/manifest/session")) {
            return { ok: false, status: 404, json: async () => ({ error: "Not Found" }) };
        }
        return { ok: true, json: async () => ({ models: [{ modelId: 1, glbUrl: "signed" }] }) };
    };
    try {
        const manifest = await fetchViewerProjectManifest("89", "fresh-launch", "https://api.example");
        assert.equal(manifest.legacySession, true);
        assert.equal(manifest.models[0].glbUrl, "signed");
    } finally {
        globalThis.fetch = originalFetch;
    }
    assert.deepEqual(calls.map((call) => call.url), [
        "https://api.example/api/viewer-projects/89/manifest/session",
        "https://api.example/api/viewer-projects/89/manifest",
    ]);
    assert.equal(JSON.parse(calls[1].options.body).launchToken, "fresh-launch");
});

test("authentication failures do not fall back to the legacy manifest endpoint", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
        calls++;
        return { ok: false, status: 401, json: async () => ({ message: "expired" }) };
    };
    try {
        await assert.rejects(
            () => fetchViewerProjectManifest("89", "expired-launch", "https://api.example"),
            (error) => error.status === 401
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
    assert.equal(calls, 1);
    assert.match(viewerManifestErrorMessage({ status: 401 }), /no longer valid/);
    assert.match(viewerManifestErrorMessage({ status: 503 }), /temporarily unavailable/);
});

test("manifest errors identify missing files, changed revisions, and expired sessions", async () => {
    const originalFetch = globalThis.fetch;
    const cases = [
        { code: "VIEWER_FILES_MISSING", status: 409, message: /viewer files are missing or incomplete/ },
        { code: "VIEWER_REVISION_CHANGED", status: 409, message: /models changed/ },
        { code: "VIEWER_LAUNCH_EXPIRED", status: 401, message: /launch link is invalid or expired/ },
        { code: "VIEWER_SESSION_EXPIRED", status: 401, message: /session has expired/ },
        { code: "VIEWER_CONFIRMATION_REQUIRED", status: 409, message: /awaiting Save Changes confirmation/ },
        { code: "VIEWER_PAYMENT_REQUIRED", status: 403, message: /payment is required/ },
        { code: "VIEWER_STORAGE_UNAVAILABLE", status: 503, message: /storage is temporarily unavailable/ },
    ];
    try {
        for (const { code, status, message } of cases) {
            globalThis.fetch = async () => ({
                ok: false, status,
                json: async () => ({ code, message: "server detail" }),
            });
            await assert.rejects(
                () => fetchViewerProjectManifest("89", "launch", "https://api.example"),
                (error) => error.status === status && error.code === code
                    && message.test(viewerManifestErrorMessage(error))
            );
        }
    } finally {
        globalThis.fetch = originalFetch;
    }
    assert.match(viewerManifestErrorMessage({ status: 409 }), /files or revision may have changed/);
    assert.match(viewerManifestErrorMessage(new Error("Illegal invocation")), /could not load/);
});

test("legacy manifest remains selectable until its signed URLs approach expiry", async () => {
    let now = 0;
    const session = new ViewerManifestSession("89", "launch", () => {}, {
        clock: () => now,
        setTimer: () => { throw new Error("Legacy manifests must not schedule refresh"); },
        fetchInitial: async () => ({ legacySession: true, models: [{ modelId: 1, glbUrl: "signed" }] }),
    });
    assert.equal((await session.open()).models.length, 1);
    now = 8 * 60_000;
    assert.equal(await session.ensureFresh(), null);
    now = 9 * 60_000;
    await assert.rejects(() => session.ensureFresh(), /file links have expired/);
    session.close();
});

test("expired viewer permission stops renewal, while a temporary network error can retry", async () => {
    let calls = 0;
    const session = new ViewerManifestSession("89", "launch", () => {}, {
        clock: () => 0,
        setTimer: () => 1,
        clearTimer: () => {},
        fetchInitial: async () => ({ refreshToken: "secret", models: [{ modelId: 1, glbUrl: "old" }] }),
        fetchRefresh: async () => {
            calls++;
            if (calls === 1) throw new Error("network unavailable");
            const error = new Error("viewer session expired");
            error.status = 401;
            throw error;
        },
    });
    await session.open();
    await assert.rejects(() => session.ensureFresh(true), /network unavailable/);
    await assert.rejects(() => session.ensureFresh(true), /viewer session expired/);
    await assert.rejects(() => session.ensureFresh(true), /viewer session expired/);
    assert.equal(calls, 2);
});
