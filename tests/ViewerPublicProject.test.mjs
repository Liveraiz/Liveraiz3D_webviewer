import test from "node:test";
import assert from "node:assert/strict";
import { parseViewerEntry } from "../src/services/ViewerEntryService.js";
import { fetchViewerPublicManifest, viewerPublicErrorMessage } from "../src/services/ViewerPublicProjectService.js";
import { ViewerPublicManifestSession } from "../src/services/ViewerPublicManifestSession.js";
import { openPublicViewerProject } from "../src/services/ViewerPublicProject.js";
import { updateSignedViewerUrls } from "../src/services/ViewerModelManifestService.js";
import { ViewerPublicSessionNotice } from "../src/ui/ViewerPublicSessionNotice.js";

const manifest = (overrides = {}) => ({
    revisionId: "revision-1", refreshAfterSeconds: 60,
    models: [{ modelId: 11, glbUrl: "https://api.example/public/model.glb" }], ...overrides,
});
const disabled = () => Object.assign(new Error("disabled"), { status: 403, code: "VIEWER_PUBLIC_SHARE_DISABLED" });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });

test("public entry ignores launch secrets and keeps private/Dropbox routes independent", () => {
    const entry = parseViewerEntry({ search: "?type=s3&projectId=89&public=true&launchToken=unused", hash: "#launch=secret&refreshToken=unused" });
    assert.equal(entry.publicAccess, true);
    assert.equal(entry.projectId, "89");
    assert.equal(entry.launchToken, null);
    const privateEntry = parseViewerEntry({ search: "?type=s3&projectId=89&public=false", hash: "#launch=private" });
    assert.equal(privateEntry.publicAccess, false);
    assert.equal(privateEntry.launchToken, "private");
    assert.equal(parseViewerEntry({ search: "?json=https%3A%2F%2Fexample.com%2Fmodels.json", hash: "" }).provider, "dropbox");
});

test("public manifests use anonymous GET with an optional pinned revision and no credentials or tokens", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, options) => { calls.push({ url, options }); return response(manifest()); };
    try {
        await fetchViewerPublicManifest("89", null, { apiBase: "https://api.example" });
        await fetchViewerPublicManifest("89", "revision/1", { apiBase: "https://api.example" });
        await assert.rejects(() => fetchViewerPublicManifest("bad", null, { apiBase: "https://api.example" }), /projectId/);
    } finally { globalThis.fetch = originalFetch; }
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://api.example/api/viewer-projects/89/public-manifest");
    assert.equal(calls[1].url, "https://api.example/api/viewer-projects/89/public-manifest?revisionId=revision%2F1");
    for (const { options } of calls) {
        assert.equal(options.method, "GET");
        assert.equal(options.credentials, "omit");
        assert.equal(options.cache, "no-store");
        assert.deepEqual(options.headers, { Accept: "application/json" });
        assert.equal(options.body, undefined);
    }
});

test("public API preserves access/revision failures without suggesting authentication", async () => {
    const originalFetch = globalThis.fetch;
    try {
        for (const [status, code] of [[403, "VIEWER_PUBLIC_SHARE_DISABLED"], [409, "VIEWER_REVISION_CHANGED"], [404, null], [401, null], [503, null]]) {
            globalThis.fetch = async () => response({ code }, status);
            await assert.rejects(() => fetchViewerPublicManifest("89", null, { apiBase: "https://api.example" }), (error) => {
                assert.equal(error.status, status);
                assert.equal(error.code, code);
                assert.doesNotMatch(viewerPublicErrorMessage(error), /로그인|포털|portal|token|session/i);
                return true;
            });
        }
    } finally { globalThis.fetch = originalFetch; }
    assert.match(viewerPublicErrorMessage(disabled()), /공개 공유가 중단/);
});

test("public session rechecks expiry, pins the first revision, and deduplicates concurrent requests", async () => {
    let now = 0;
    const calls = [];
    const applied = [];
    let timer;
    const session = new ViewerPublicManifestSession("89", data => applied.push(data), {
        clock: () => now,
        setTimer: (callback, delay) => { timer = callback; assert.equal(delay, 60_000); return 1; }, clearTimer() {},
        fetchManifest: async (...args) => { calls.push(args); return manifest(); },
    });
    await session.open();
    assert.equal(calls[0][1], null);
    now = 59_999;
    assert.equal(await session.ensureFresh(), null);
    assert.equal(calls.length, 1);
    now = 60_000;
    timer();
    await Promise.all([session.ensureFresh(), session.ensureFresh()]);
    assert.equal(calls.length, 2);
    assert.equal(calls[1][1], "revision-1");
    assert.ok(calls[1][2].signal instanceof AbortSignal);
    assert.equal(applied.length, 2);
    assert.equal(session.refreshToken, undefined);
    assert.equal(session.launchToken, undefined);
    session.close();
});

test("public sharing Off stops renewal and selection without a recovery context", async () => {
    let calls = 0;
    let cleared = 0;
    const errors = [];
    const error = disabled();
    const session = new ViewerPublicManifestSession("89", () => {}, {
        setTimer: () => 1, clearTimer: () => { cleared++; }, onError: error => errors.push(error),
        fetchManifest: async () => { if (++calls > 1) throw error; return manifest(); },
    });
    await session.open();
    await assert.rejects(() => session.ensureFresh(true), error);
    await assert.rejects(() => session.ensureFresh(true), error);
    assert.equal(calls, 2);
    assert.equal(session.closed, true);
    assert.equal(session.recoveryContext, undefined);
    assert.equal(cleared, 1);
    assert.deepEqual(errors, [error]);
});

test("public session can retry an initial network failure and rejects a changed revision", async () => {
    let calls = 0;
    let timer;
    const applied = [];
    const session = new ViewerPublicManifestSession("89", data => applied.push(data), {
        setTimer: callback => { timer = callback; return 1; }, clearTimer() {},
        fetchManifest: async () => {
            calls++;
            if (calls === 1) throw new Error("network down");
            return manifest({ revisionId: calls === 2 ? "revision-1" : "revision-2" });
        },
    });
    await assert.rejects(() => session.open(), /network down/);
    timer();
    await session.ensureFresh(true);
    assert.equal(applied.length, 1);
    await assert.rejects(() => session.ensureFresh(true), error => error.code === "VIEWER_REVISION_CHANGED");
    assert.equal(applied.length, 1);
    assert.equal(session.closed, true);
});

test("disposing a pending public request aborts it and ignores its late response", async () => {
    const pending = deferred();
    let signal;
    let applied = 0;
    const session = new ViewerPublicManifestSession("89", () => { applied++; }, {
        fetchManifest: async (_projectId, _revision, options) => { signal = options.signal; return pending.promise; },
        setTimer: () => { throw new Error("closed requests must not schedule"); },
    });
    const opening = session.open();
    await Promise.resolve();
    session.close();
    assert.equal(signal.aborted, true);
    pending.resolve(manifest());
    assert.equal(await opening, null);
    assert.equal(applied, 0);
});

function controllerFixture(fetchManifest) {
    const browserEvents = {};
    const pageEvents = {};
    const errors = [];
    let retry;
    const viewer = {};
    const page = { visibilityState: "visible", addEventListener: (name, callback) => { pageEvents[name] = callback; } };
    const browser = {
        location: { pathname: "/", search: "?type=s3&projectId=89&public=true", hash: "#launch=ignored" },
        history: { replaceState(_state, _title, path) { browser.scrubbedUrl = path; } },
        addEventListener: (name, callback) => { browserEvents[name] = callback; },
    };
    const selector = {
        loads: 0, shows: 0, models: null,
        async loadManifest(data) { this.loads++; this.models = data.models.map(model => ({ ...model })); },
        refreshManifest(data) { updateSignedViewerUrls(this.models, data); },
        show() { this.shows++; this.beforeModelSelection().catch(() => {}); },
    };
    const open = () => openPublicViewerProject(viewer, { projectId: "89", publicAccess: true, launchToken: "ignored" }, selector, {
        window: browser, document: page,
        createNotice: onRetry => { retry = onRetry; return { showError: error => errors.push(error), update() {} }; },
        createSession: (projectId, onManifest, onError) => new ViewerPublicManifestSession(projectId, onManifest, {
            fetchManifest, onError, setTimer: () => 1, clearTimer() {},
        }),
    });
    return { open, viewer, selector, browser, page, browserEvents, pageEvents, errors, retry: () => retry() };
}

test("public viewer rechecks selection, focus, and visibility while preserving model references and avoiding login", async () => {
    let calls = 0;
    const fixture = controllerFixture(async () => { calls++; return manifest(); });
    assert.deepEqual(await fixture.open(), { showSelector: false });
    assert.equal(calls, 1);
    assert.equal(fixture.selector.loads, 1);
    assert.equal(fixture.selector.shows, 1);
    assert.equal(fixture.viewer.viewerAuthRecovery, undefined);
    assert.equal(fixture.browser.scrubbedUrl.includes("#"), false);
    const cardModel = fixture.selector.models[0];
    await fixture.selector.beforeModelSelection();
    assert.equal(calls, 2);
    await fixture.browserEvents.focus();
    assert.equal(calls, 3);
    fixture.pageEvents.visibilitychange();
    await fixture.viewer.viewerManifestSession.ensureFresh(true);
    assert.equal(calls, 4);
    assert.equal(fixture.selector.models[0], cardModel);
    assert.equal(fixture.selector.loads, 1);
    fixture.viewer.viewerManifestSession.close();
});

test("public viewer retry initializes the selector after a failed initial request", async () => {
    let calls = 0;
    const fixture = controllerFixture(async () => {
        if (++calls === 1) throw new Error("offline");
        return manifest();
    });
    await fixture.open();
    assert.equal(fixture.selector.loads, 0);
    assert.equal(fixture.errors.length, 1);
    await fixture.retry();
    assert.equal(fixture.selector.loads, 1);
    assert.equal(fixture.selector.shows, 1);
    fixture.viewer.viewerManifestSession.close();
});

test("public notice offers temporary-error retry and a sharing-disabled message with no login controls", async () => {
    const originalDocument = globalThis.document;
    const message = {};
    const button = {};
    const element = { style: {}, setAttribute() {}, querySelector: selector => selector === "p" ? message : button, remove() {} };
    globalThis.document = { createElement: () => element, body: { appendChild() {} } };
    let retries = 0;
    try {
        const notice = new ViewerPublicSessionNotice(async () => { retries++; });
        notice.showError(new Error("offline"));
        assert.equal(button.hidden, false);
        await button.onclick();
        assert.equal(retries, 1);
        notice.showError(disabled());
        assert.match(message.textContent, /공개 공유가 중단/);
        assert.equal(button.hidden, true);
        assert.doesNotMatch(element.innerHTML, /login|handoff|로그인/);
        notice.dispose();
    } finally { globalThis.document = originalDocument; }
});
