import { apiBaseUrl } from "./ViewerProjectManifestService.js";

export async function fetchViewerPublicManifest(projectId, revisionId = null, { apiBase = apiBaseUrl(), signal } = {}) {
    if (!projectId || !/^\d+$/.test(projectId)) throw new Error("Missing public projectId");
    const revision = revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : "";
    const response = await fetch(
        `${apiBase}/api/viewer-projects/${encodeURIComponent(projectId)}/public-manifest${revision}`,
        { method: "GET", credentials: "omit", cache: "no-store", headers: { Accept: "application/json" }, signal }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.message || `Public project request failed (${response.status})`);
        error.status = response.status;
        error.code = data.code;
        throw error;
    }
    return data;
}

export function isViewerPublicTerminalError(error) {
    return [401, 403, 404, 409].includes(error?.status);
}

export function viewerPublicErrorMessage(error) {
    if (error?.code === "VIEWER_PUBLIC_SHARE_DISABLED" || error?.status === 403) {
        return "이 프로젝트의 공개 공유가 중단되었습니다.";
    }
    if (error?.code === "VIEWER_REVISION_CHANGED" || error?.status === 409) {
        return "프로젝트 모델이 변경되었습니다. 공개 링크를 새로 열어주세요.";
    }
    if (error?.status === 404) return "공개 프로젝트를 찾을 수 없습니다.";
    if (error?.status === 401) return "이 공개 프로젝트를 열 수 없습니다.";
    if (error?.code === "VIEWER_PUBLIC_MODEL_LOAD_FAILED") {
        return "공개 모델을 불러오지 못했습니다. 모델을 다시 선택하거나 공개 링크를 새로 열어주세요.";
    }
    return "공개 프로젝트를 불러오지 못했습니다. 잠시 후 다시 시도하세요.";
}
