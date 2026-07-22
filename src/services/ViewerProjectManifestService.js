const DEFAULT_API_URL = "http://localhost:8077";

export async function fetchViewerProjectManifest(projectId, launchToken, apiBase = apiBaseUrl()) {
    if (!projectId || !/^\d+$/.test(projectId) || !launchToken) {
        throw new Error("Missing S3 projectId or launch token");
    }

    const response = await fetch(
        `${apiBase}/api/viewer-projects/${encodeURIComponent(projectId)}/manifest`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ launchToken }),
        }
    );

    if (!response.ok) {
        let message = `Manifest request failed (${response.status})`;
        try {
            const body = await response.json();
            message = body.message || message;
        } catch (error) {
            // Preserve the HTTP status when an intermediary returns non-JSON.
        }
        throw new Error(message);
    }

    return response.json();
}

function apiBaseUrl() {
    return (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
}
