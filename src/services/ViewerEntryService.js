export const VIEWER_PROVIDER = Object.freeze({
    DROPBOX: "dropbox",
    S3: "s3",
    UNSUPPORTED: "unsupported",
});

export function parseViewerEntry(location = window.location) {
    const urlParams = new URLSearchParams(location.search);
    const jsonUrl = urlParams.get("json");
    const providerParam = urlParams.get("type");
    const provider = providerParam ? providerParam.toLowerCase() : null;

    if (provider === VIEWER_PROVIDER.S3) {
        return {
            provider: VIEWER_PROVIDER.S3,
            externalModelRequest: true,
            projectId: urlParams.get("projectId"),
            launchToken: new URLSearchParams(location.hash.replace(/^#/, "")).get("launch"),
        };
    }

    if ((!provider || provider === VIEWER_PROVIDER.DROPBOX) && jsonUrl) {
        return {
            provider: VIEWER_PROVIDER.DROPBOX,
            externalModelRequest: false,
            jsonUrl: decodeUrlValue(jsonUrl),
        };
    }

    if (providerParam) {
        return {
            provider: VIEWER_PROVIDER.UNSUPPORTED,
            externalModelRequest: false,
            rawProvider: providerParam,
        };
    }

    return {
        provider: null,
        externalModelRequest: false,
    };
}

export function clearLaunchTokenFromUrl(location = window.location, history = window.history) {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
}

export function isS3DownloadUrlError(error) {
    return /403|expired|signature|accessdenied/i.test(String(error?.message || error));
}

function decodeUrlValue(value) {
    try {
        return decodeURIComponent(value);
    } catch (error) {
        return value;
    }
}
