import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ViewerAuthRecovery, createRecoveryProof, applyRecoveredViewerSession } from "../src/services/ViewerAuthRecovery.js";
import { ViewerManifestSession } from "../src/services/ViewerManifestSession.js";
import { updateSignedViewerUrls } from "../src/services/ViewerModelManifestService.js";

const manifest = (refreshToken = "fresh", glbUrl = "new") => ({
    refreshToken, refreshAfterSeconds: 480, models: [{ modelId: 11, glbUrl }],
});
const expired = (code = "VIEWER_SESSION_EXPIRED") => Object.assign(new Error("expired"), { status: 401, code });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });

function fixture(overrides = {}) {
    const calls = [];
    const posts = [];
    const channel = { postMessage: data => posts.push(data), close() { this.closed = true; } };
    const popup = { location: {}, opener: {}, close() {} };
    let openCalls = 0;
    const changes = [];
    const applied = [];
    const controller = new ViewerAuthRecovery({
        apiBase: "https://api.example",
        portalOrigin: "https://liveraiz.net",
        getRecovery: () => ({ kind: "viewer-session", projectId: "78", token: "old-secret" }),
        onRecovered: async (data) => { applied.push(data); },
        onChange: data => changes.push(data),
        createProof: async () => ({ state: "state", codeVerifier: "verifier", codeChallenge: "challenge" }),
        openWindow: () => { openCalls++; return popup; },
        createChannel: () => channel,
        setTimer: () => 1, clearTimer: () => {},
        fetch: async (url, options) => {
            calls.push({ url, options });
            return response(url.endsWith("/exchange")
                ? { kind: "viewer", manifest: manifest(), context: { projectId: 78, revisionId: "same" } }
                : { handoffId: "handoff", loginUrl: "https://liveraiz.net/auth/reauth?handoff=handoff", expiresAt: new Date(Date.now() + 60000).toISOString() });
        },
        ...overrides,
    });
    return { controller, calls, posts, popup, channel, changes, applied, openCalls: () => openCalls };
}
const message = { type: "liveraiz-auth-code", handoffId: "handoff", state: "state", code: "one-time" };

test("callback clears expired one-time codes and requests a new login, including manual-only browsers", () => {
    const html = readFileSync(new URL("../public/auth/callback.html", import.meta.url), "utf8");
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    for (const supportsChannel of [true, false]) {
        const elements = Object.fromEntries(["status", "code", "copy", "manual", "h1"].map(id => [id, {}]));
        let onTimeout;
        let scrubbed;
        const channel = { postMessage() {}, close() { this.closed = true; } };
        runInNewContext(script, {
            URLSearchParams,
            location: { hash: "#handoffId=handoff&state=state&code=one-time", pathname: "/auth/callback.html" },
            history: { replaceState: (_state, _unused, path) => { scrubbed = path; } },
            document: { getElementById: id => elements[id], querySelector: selector => elements[selector] },
            window: { addEventListener() {}, close() {} },
            BroadcastChannel: function () { if (!supportsChannel) throw new Error("unsupported"); return channel; },
            setInterval: () => 1, clearInterval() {}, clearTimeout() {},
            setTimeout: (fn, delay) => { assert.equal(delay, 60000); onTimeout = fn; return 2; },
        });
        assert.equal(scrubbed, "/auth/callback.html");
        assert.match(elements.code.value, /one-time/);
        onTimeout();
        assert.equal(elements.code.value, "");
        assert.equal(elements.manual.hidden, true);
        assert.equal(elements.copy.disabled, true);
        assert.match(elements.status.textContent, /다시 로그인/);
    }
});

test("PKCE proof uses independent cryptographic state and a SHA-256 challenge", async () => {
    const proof = await createRecoveryProof(webcrypto);
    assert.match(proof.state, /^[A-Za-z0-9_-]{43}$/);
    assert.match(proof.codeVerifier, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(proof.state, proof.codeVerifier);
    const expected = Buffer.from(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(proof.codeVerifier))).toString("base64url");
    assert.equal(proof.codeChallenge, expected);
});

test("expired launch and manifest secrets remain memory recovery context; denied permissions do not", async () => {
    const initial = new ViewerManifestSession("78", "old-launch", () => {}, {
        fetchInitial: async () => { throw expired("VIEWER_LAUNCH_EXPIRED"); },
    });
    await assert.rejects(() => initial.open(), /expired/);
    assert.deepEqual(initial.recoveryContext(), { kind: "viewer-launch", projectId: "78", token: "old-launch" });
    initial.close();
    assert.equal(initial.recoveryContext(), null);

    for (const error of [expired(), Object.assign(new Error("payment"), { status: 403, code: "VIEWER_PAYMENT_REQUIRED" })]) {
        const session = new ViewerManifestSession("78", "launch", () => {}, {
            fetchInitial: async () => manifest("old-refresh"), fetchRefresh: async () => { throw error; },
            setTimer: () => 1, clearTimer: () => {},
        });
        await session.open();
        await assert.rejects(() => session.ensureFresh(true));
        assert.equal(session.recoveryContext()?.token ?? null, error.status === 401 ? "old-refresh" : null);
        if (error.status === 401) {
            session.resume(manifest());
            assert.equal(session.closed, false);
            assert.equal(session.terminalError, null);
            assert.equal(session.refreshToken, "fresh");
            assert.equal(await session.ensureFresh(), null);
        }
        session.close();
    }
});

test("recovery updates URLs with the same model and scene objects, without reloading or resetting selection", async () => {
    const geometry = {};
    const scene = { mesh: { geometry }, camera: { position: [1, 2, 3] }, measurements: [42] };
    const models = [{ modelId: 11, glbUrl: "old" }];
    const originalModel = models[0];
    const selector = {
        currentModelIndex: 3,
        refreshManifest: data => updateSignedViewerUrls(models, data),
        loadManifest: () => { throw new Error("Must not initialize loaded models"); },
    };
    const session = new ViewerManifestSession("78", null, () => {}, { setTimer: () => 1, clearTimer: () => {} });
    assert.equal(await applyRecoveredViewerSession(session, selector, manifest(), true), true);
    assert.equal(models[0], originalModel);
    assert.equal(models[0].glbUrl, "new");
    assert.equal(scene.mesh.geometry, geometry);
    assert.deepEqual(scene.camera.position, [1, 2, 3]);
    assert.deepEqual(scene.measurements, [42]);
    assert.equal(selector.currentModelIndex, 3);
    session.close();
});

test("initial launch recovery initializes the manifest once and stale/disposed sessions cannot resume", async () => {
    let loads = 0;
    let resumes = 0;
    const session = { validateManifest() {}, resume() { resumes++; } };
    const selector = { loadManifest: async () => { loads++; }, refreshManifest() { throw new Error("initial launch"); } };
    await applyRecoveredViewerSession(session, selector, manifest(), false);
    assert.equal(loads, 1);
    assert.equal(resumes, 1);
    assert.equal(await applyRecoveredViewerSession(session, selector, manifest(), false, () => false), false);
    assert.equal(loads, 1);
});

test("login opens synchronously, omits cookies, filters state, and ACKs only after successful manifest application", async () => {
    const pending = deferred();
    const f = fixture({ onRecovered: () => pending.promise });
    const start = f.controller.start();
    assert.equal(f.openCalls(), 1);
    assert.equal(f.popup.opener, null);
    await start;
    assert.match(f.popup.location.href, /^https:\/\/liveraiz.net\/auth\/reauth/);
    assert.equal(f.calls[0].options.credentials, "omit");
    const create = JSON.parse(f.calls[0].options.body);
    assert.equal(create.codeChallengeMethod, "S256");
    assert.equal(create.recovery.token, "old-secret");
    assert.equal(create.codeVerifier, undefined);
    await f.controller.receive({ ...message, state: "wrong" });
    assert.equal(f.calls.length, 1);
    const exchange = f.controller.receive(message);
    await Promise.resolve(); await Promise.resolve();
    await f.controller.receive(message);
    assert.equal(f.calls.length, 2);
    assert.equal(f.posts.length, 0);
    pending.resolve(); await exchange;
    assert.equal(f.posts[0].type, "liveraiz-auth-complete");
    await f.controller.receive(message);
    assert.equal(f.calls.length, 2);
    assert.equal(f.posts.length, 2);
    f.controller.dispose();
    assert.equal(f.channel.closed, true);
});

test("blocked popup/channel still supports a visible login link and pasted one-time code", async () => {
    const f = fixture({ openWindow: () => null, createChannel: () => { throw new Error("unsupported"); } });
    await f.controller.start();
    assert.match(f.changes.at(-1).loginUrl, /auth\/reauth/);
    await f.controller.submitCode(JSON.stringify(message));
    assert.equal(f.applied.length, 1);
    assert.equal(f.changes.at(-1).status, "complete");
    f.controller.dispose();
});

test("cancelled exchange response cannot restore credentials or apply a manifest", async () => {
    const pending = deferred();
    const f = fixture();
    await f.controller.start();
    f.controller.fetch = () => pending.promise;
    const exchange = f.controller.receive(message);
    f.controller.cancel();
    pending.resolve(response({ kind: "viewer", manifest: manifest(), context: { projectId: 78 } }));
    await exchange;
    assert.equal(f.applied.length, 0);
    assert.equal(f.posts.length, 0);
});

test("cancelling during initial manifest initialization cannot resume its session", async () => {
    const pending = deferred();
    const loading = deferred();
    let resumes = 0;
    const session = { validateManifest() {}, resume() { resumes++; } };
    const selector = { loadManifest: () => { loading.resolve(); return pending.promise; } };
    const f = fixture({ onRecovered: (data, _context, isCurrent) => applyRecoveredViewerSession(session, selector, data, false, isCurrent) });
    await f.controller.start();
    const exchange = f.controller.receive(message);
    await loading.promise;
    f.controller.cancel();
    pending.resolve();
    await exchange;
    assert.equal(resumes, 0);
    assert.equal(f.posts.length, 0);
});

test("late manifest refresh cannot replace a recovered session", async () => {
    const pending = deferred();
    let applied = 0;
    const session = new ViewerManifestSession("78", "launch", () => { applied++; }, {
        fetchInitial: async () => manifest("old"), fetchRefresh: () => pending.promise,
        setTimer: () => 1, clearTimer: () => {},
    });
    await session.open();
    const refresh = session.ensureFresh(true);
    session.resume(manifest("recovered"));
    pending.resolve(manifest("stale"));
    await refresh;
    assert.equal(applied, 0);
    assert.equal(session.refreshToken, "recovered");
    session.close();
});

test("lost exchange response retires its code and retry starts a new handoff", async () => {
    const f = fixture();
    await f.controller.start();
    let calls = 0;
    f.controller.fetch = async () => { calls++; throw new Error("offline"); };
    await f.controller.receive(message);
    await f.controller.receive(message);
    assert.equal(calls, 1);
    f.controller.ready();
    await f.controller.receive(message);
    assert.equal(calls, 1);
    assert.equal(f.controller.attempt, null);
    await f.controller.start();
    assert.equal(calls, 2);
    assert.equal(f.openCalls(), 2);
    f.controller.dispose();
});

test("login navigation rejects unexpected origin, path, handoff, and invalid expiration", async () => {
    const valid = { handoffId: "handoff", loginUrl: "https://liveraiz.net/auth/reauth?handoff=handoff", expiresAt: new Date(Date.now() + 60000).toISOString() };
    for (const result of [
        { ...valid, loginUrl: "https://untrusted.example/auth/reauth?handoff=handoff" },
        { ...valid, loginUrl: "https://liveraiz.net/redirect?handoff=handoff" },
        { ...valid, loginUrl: "https://liveraiz.net/auth/reauth?handoff=other" },
        { ...valid, expiresAt: "invalid" },
        { ...valid, expiresAt: new Date(0).toISOString() },
    ]) {
        const f = fixture({ fetch: async () => response(result) });
        await f.controller.start();
        assert.equal(f.controller.attempt, null);
        assert.equal(f.popup.location.href, undefined);
        assert.equal(f.changes.at(-1).status, "error");
    }
    let delay;
    const f = fixture({
        fetch: async () => response({ ...valid, expiresAt: new Date(Date.now() + 3600000).toISOString() }),
        setTimer: (_fn, ms) => { delay = ms; return 1; },
    });
    await f.controller.start();
    assert.equal(delay, 600000);
    f.controller.dispose();
});

test("revision and access errors stop recovery while account mismatch remains actionable", async () => {
    for (const [code, status, expected] of [["VIEWER_REVISION_CHANGED", 409, "blocked"], ["AUTH_RECOVERY_CONTEXT_INVALID", 410, "blocked"], ["AUTH_ACCOUNT_MISMATCH", 409, "error"]]) {
        const f = fixture();
        await f.controller.start();
        f.controller.fetch = async () => response({ code, message: code }, status);
        await f.controller.receive(message);
        assert.equal(f.changes.at(-1).status, expected);
        assert.equal(f.applied.length, 0);
        assert.equal(f.posts.length, 0);
        f.controller.dispose();
    }
});
