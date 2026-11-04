import { clearLaunchTokenFromUrl, VIEWER_PROVIDER } from "./ViewerEntryService.js";
import { ViewerPublicManifestSession } from "./ViewerPublicManifestSession.js";
import { ViewerPublicSessionNotice } from "../ui/ViewerPublicSessionNotice.js";

export async function openPublicViewerProject(viewer, entry, modelSelector, dependencies = {}) {
    const browser = dependencies.window || window;
    const page = dependencies.document || document;
    const createSession = dependencies.createSession || ((projectId, onManifest, onError) =>
        new ViewerPublicManifestSession(projectId, onManifest, { onError }));
    const createNotice = dependencies.createNotice || ((onRetry) => new ViewerPublicSessionNotice(onRetry));
    let manifestLoaded = false;
    const session = createSession(entry.projectId, async (manifest) => {
        if (viewer.viewerManifestSession !== session) return;
        if (manifestLoaded) modelSelector.refreshManifest(manifest);
        else {
            await modelSelector.loadManifest(manifest, VIEWER_PROVIDER.S3);
            if (viewer.viewerManifestSession !== session) return;
            manifestLoaded = true;
            modelSelector.show();
        }
        viewer.viewerSessionNotice?.update({ status: "complete" });
    }, (error) => viewer.viewerSessionNotice?.showError(error));
    viewer.viewerManifestSession = session;
    viewer.viewerSessionNotice = createNotice(() => session.ensureFresh(true));
    modelSelector.beforeModelSelection = () => session.ensureFresh(true);
    viewer.viewerVisibilityHandler = () => {
        if (page.visibilityState === "visible") session.ensureFresh(true).catch(() => {});
    };
    viewer.viewerFocusHandler = () => session.ensureFresh(true).catch(() => {});
    page.addEventListener("visibilitychange", viewer.viewerVisibilityHandler);
    browser.addEventListener("focus", viewer.viewerFocusHandler);
    clearLaunchTokenFromUrl(browser.location, browser.history);
    entry.launchToken = null;
    try { await session.open(); } catch { /* The public notice owns retry and access errors. */ }
    return { showSelector: false };
}
