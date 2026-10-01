const DEFAULT_API_URL = "http://localhost:8077";

export async function fetchViewerProjectManifest(projectId, launchToken, apiBase = apiBaseUrl()) {
    if (!projectId || !/^\d+$/.test(projectId) || !launchToken) {
        throw new Error("Missing S3 projectId or launch token");
    }

    try {
        return await requestManifest(projectId, "session", { launchToken }, apiBase);
    } catch (error) {
        // Older API processes expose only /manifest. Their signed URLs cannot be
        // renewed, but a newly issued portal launch token can still open them.
        if (error?.status !== 404) throw error;
        const manifest = await requestManifest(projectId, null, { launchToken }, apiBase);
        return { ...manifest, legacySession: true };
    }
}

export async function refreshViewerProjectManifest(projectId, refreshToken, apiBase = apiBaseUrl()) {
    if (!projectId || !/^\d+$/.test(projectId) || !refreshToken) {
        throw new Error("Missing S3 projectId or refresh token");
    }
    return requestManifest(projectId, "refresh", { refreshToken }, apiBase);
}

async function requestManifest(projectId, action, body, apiBase) {
    const response = await fetch(
        `${apiBase}/api/viewer-projects/${encodeURIComponent(projectId)}/manifest${action ? `/${action}` : ""}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            cache: "no-store",
            body: JSON.stringify(body),
        }
    );

    if (!response.ok) {
        let message = `Manifest request failed (${response.status})`;
        let code = null;
        try {
            const body = await response.json();
            message = body?.message || message;
            code = typeof body?.code === "string" ? body.code : null;
        } catch (error) {
            // Preserve the HTTP status when an intermediary returns non-JSON.
        }
        const error = new Error(message);
        error.status = response.status;
        error.code = code;
        throw error;
    }

    return response.json();
}

export function viewerManifestErrorMessage(error) {
    switch (error?.code) {
        case "VIEWER_FILES_MISSING":
            return "Project viewer files are missing or incomplete in storage. Please ask the project administrator to restore or re-upload the files.";
        case "VIEWER_STORAGE_UNAVAILABLE":
            return "Model storage is temporarily unavailable. Please try again later.";
        case "VIEWER_REVISION_CHANGED":
            return "The project models changed. Please open the current result from the portal.";
        case "VIEWER_LAUNCH_EXPIRED":
            return "This viewer launch link is invalid or expired. Please open the project again from the portal.";
        case "VIEWER_SESSION_EXPIRED":
            return "The viewer session has expired. Please open the project again from the portal.";
        case "VIEWER_CONFIRMATION_REQUIRED":
            return "Model Files are awaiting Save Changes confirmation. Please ask the project administrator to confirm them.";
        case "VIEWER_PAYMENT_REQUIRED":
            return "Project payment is required before opening Model Files. Please complete payment in the portal.";
        default:
            break;
    }
    if (error?.status === 401) {
        return "This viewer link or session is no longer valid. Please open the project again from the portal.";
    }
    if (error?.status === 403) {
        return "This viewer result is not available to your account. Please check the project in the portal.";
    }
    if (error?.status === 409) {
        return "This viewer result cannot be opened because its files or revision may have changed. Please check the project in the portal.";
    }
    if (error?.status === 404) {
        return "The S3 viewer result is unavailable. Please check the project in the portal.";
    }
    if (error?.status === 503) {
        return "The model service or storage is temporarily unavailable. Please try again later.";
    }
    return "The S3 viewer could not load the project. Please try again or check the portal.";
}

function apiBaseUrl() {
    return (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
}
