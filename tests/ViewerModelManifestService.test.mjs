import test from "node:test";
import assert from "node:assert/strict";

import { VIEWER_PROVIDER } from "../src/services/ViewerEntryService.js";
import {
    getViewerManifestLogoUrl,
    normalizeViewerManifest,
    resolveViewerAssetUrl,
    updateSignedViewerUrls,
} from "../src/services/ViewerModelManifestService.js";

test("S3 manifest keeps migrated metadata, presigned URLs, and multiple models", () => {
    const logoUrl = "https://bucket.example/logo.png?X-Amz-Signature=logo";
    const manifest = {
        folderInfo: { name: "LDLT case", description: "Patient-specific models" },
        logo: { logoImgUrl: logoUrl },
        models: [
            { name: "Liver", case: "LDLT", description: "First model", glbUrl: "https://bucket.example/1.glb?X-Amz-Signature=one" },
            { name: "Vessels", case: "HCC", description: "Second model", glbUrl: "https://bucket.example/2.glb?X-Amz-Signature=two" },
        ],
    };

    const normalized = normalizeViewerManifest(manifest, VIEWER_PROVIDER.S3);

    assert.equal(normalized.models.length, 2);
    assert.deepEqual(normalized.manifest.folderInfo, manifest.folderInfo);
    assert.deepEqual(normalized.models.map(({ name, case: modelCase, description }) => ({ name, case: modelCase, description })), [
        { name: "Liver", case: "LDLT", description: "First model" },
        { name: "Vessels", case: "HCC", description: "Second model" },
    ]);
    assert.equal(getViewerManifestLogoUrl(normalized.manifest), logoUrl);
    assert.equal(resolveViewerAssetUrl(normalized.models[1], "glbUrl", {
        getDirectDownloadUrl() { throw new Error("S3 URLs must not be rewritten"); },
    }), manifest.models[1].glbUrl);
});

test("optional migrated fields can be absent without losing a valid model", () => {
    const normalized = normalizeViewerManifest({ models: [{ name: "Model", glbUrl: "https://bucket.example/model.glb" }] });

    assert.equal(normalized.models.length, 1);
    assert.equal(normalized.models[0].case, undefined);
    assert.equal(getViewerManifestLogoUrl(normalized.manifest), null);
    assert.equal(getViewerManifestLogoUrl({ logo: { logoImgUrl: "" } }), null);
});

test("legacy Dropbox model URLs still use the Dropbox converter", () => {
    const { models } = normalizeViewerManifest({ models: [{ glbUrl: "https://www.dropbox.com/model.glb?dl=0" }] }, VIEWER_PROVIDER.DROPBOX);
    assert.equal(resolveViewerAssetUrl(models[0], "glbUrl", {
        getDirectDownloadUrl(url) { return url.replace("www.dropbox.com", "dl.dropboxusercontent.com"); },
    }), "https://dl.dropboxusercontent.com/model.glb?dl=0");
});

test("refresh replaces URLs for every model while preserving model-card references and metadata", () => {
    const { models } = normalizeViewerManifest({ models: [
        { modelId: 11, name: "First", case: "HCC", glbUrl: "old-1", tableUrl: "old-csv" },
        { modelId: 12, name: "Second", glbUrl: "old-2", thumbnailUrl: "old-thumbnail" },
    ] });
    const firstCardModel = models[0];
    const secondCardModel = models[1];
    const manifest = updateSignedViewerUrls(models, { folderInfo: { name: "Case" }, models: [
        { modelId: 11, name: "First", case: "HCC", glbUrl: "new-1", tableUrl: "new-csv" },
        { modelId: 12, name: "Second", glbUrl: "new-2", thumbnailUrl: "new-thumbnail" },
    ] });

    assert.equal(models[0], firstCardModel);
    assert.equal(models[1], secondCardModel);
    assert.deepEqual(models.map(({ glbUrl }) => glbUrl), ["new-1", "new-2"]);
    assert.equal(models[0].tableUrl, "new-csv");
    assert.equal(models[1].thumbnailUrl, "new-thumbnail");
    assert.equal(models[0].case, "HCC");
    assert.equal(manifest.folderInfo.name, "Case");
    assert.throws(() => updateSignedViewerUrls(models, { models: [
        { modelId: 12, glbUrl: "wrong-order" }, { modelId: 11, glbUrl: "wrong-order" },
    ] }), /model list changed/);
});
