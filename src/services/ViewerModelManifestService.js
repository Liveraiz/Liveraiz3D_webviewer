import { VIEWER_PROVIDER } from "./ViewerEntryService";

export function normalizeViewerManifest(data, provider = VIEWER_PROVIDER.S3) {
    if (!data || !Array.isArray(data.models) || data.models.length === 0) {
        throw new Error("The viewer manifest contains no models.");
    }

    const models = data.models.map((model) => {
        if (!model || !model.glbUrl) {
            throw new Error("The viewer manifest contains a model without a GLB URL.");
        }
        return { ...model, _viewerProvider: provider };
    });

    return {
        manifest: { ...data, models },
        models,
    };
}

export function resolveViewerAssetUrl(model, propertyName, dropboxService) {
    const url = model?.[propertyName];
    if (!url) return null;
    return isS3ManifestProvider(model._viewerProvider)
        ? url
        : dropboxService.getDirectDownloadUrl(url);
}

export function isS3ManifestProvider(provider) {
    return provider === VIEWER_PROVIDER.S3;
}
