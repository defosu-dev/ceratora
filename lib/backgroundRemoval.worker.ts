// lib/backgroundRemoval.worker.ts
//
// Runs background removal off the main thread, fully in the browser.
// Model: BiRefNet_lite (MIT) via Transformers.js / onnxruntime-web.
// WebGPU: 1024 px fp16 export. WASM (or if WebGPU fails): 512 px fp32 export.

import {
    AutoModel,
    AutoProcessor,
    env,
    type PreTrainedModel,
    type Processor,
    RawImage,
} from "@huggingface/transformers";

import { BG_MODELS, type BgDevice } from "./backgroundModels";

export type BgWorkerRequest =
    | { type: "load"; remoteHost?: string }
    | { type: "remove"; id: number; blob: Blob };

export type BgWorkerResponse =
    | { type: "progress"; progress: number; loaded: number; total: number }
    | { type: "ready"; device: BgDevice }
    | { type: "result"; id: number; blob: Blob }
    | { type: "error"; id?: number; message: string };

interface LoadedModel {
    device: BgDevice;
    model: PreTrainedModel;
    processor: Processor;
}

let loading: Promise<LoadedModel> | null = null;
/** Set once WebGPU failed here, so the rest of the session stays on WASM. */
let webgpuFailed = false;

const post = (message: BgWorkerResponse) => self.postMessage(message);

async function hasWebGPU(): Promise<boolean> {
    const gpu = (
        navigator as Navigator & {
            gpu?: { requestAdapter(): Promise<unknown | null> };
        }
    ).gpu;
    if (!gpu) return false;
    try {
        return (await gpu.requestAdapter()) !== null;
    } catch {
        return false;
    }
}

/** Readable message with the underlying cause (fetch / ORT errors nest). */
function describeError(error: unknown): string {
    if (error instanceof Error) {
        const cause = (error as Error & { cause?: unknown }).cause;
        return cause
            ? `${error.message} (${describeError(cause)})`
            : error.message;
    }
    return String(error);
}

async function loadOn(device: BgDevice): Promise<LoadedModel> {
    const { id, dtype } = BG_MODELS[device];
    const model = await AutoModel.from_pretrained(id, {
        device,
        dtype,
        progress_callback: (info) => {
            if (info.status === "progress_total") {
                post({
                    type: "progress",
                    progress: info.progress,
                    loaded: info.loaded,
                    total: info.total,
                });
            }
        },
    });
    const processor = await AutoProcessor.from_pretrained(id);
    return { device, model, processor };
}

function loadModel(remoteHost?: string): Promise<LoadedModel> {
    if (loading) return loading;

    loading = (async () => {
        // Self-hosted models (e.g. /models/<model id>/...).
        if (remoteHost) env.remoteHost = remoteHost;
        // Files are kept in the browser's Cache API after the first download.
        env.useBrowserCache = true;

        let loaded: LoadedModel;
        if (!webgpuFailed && (await hasWebGPU())) {
            try {
                loaded = await loadOn("webgpu");
            } catch (error) {
                // An adapter exists but ORT can't use it (drivers, limits).
                console.warn(
                    "[bg-removal] WebGPU unavailable, using WASM:",
                    error,
                );
                webgpuFailed = true;
                loaded = await loadOn("wasm");
            }
        } else {
            loaded = await loadOn("wasm");
        }

        post({ type: "ready", device: loaded.device });
        return loaded;
    })();

    // Allow a retry after a failed download.
    loading.catch(() => {
        loading = null;
    });
    return loading;
}

async function predictMask(
    { model, processor }: LoadedModel,
    image: RawImage,
): Promise<RawImage> {
    const { pixel_values } = await processor(image);
    const outputs = await model({ input_image: pixel_values });
    // onnx-community names the output "output_image", the 512 export "logits".
    const logits = outputs.output_image ?? outputs.logits;
    return RawImage.fromTensor(logits[0].sigmoid().mul(255).to("uint8")).resize(
        image.width,
        image.height,
    );
}

async function removeBackground(blob: Blob): Promise<Blob> {
    const image = await RawImage.fromBlob(blob);

    let loaded = await loadModel();
    let mask: RawImage;
    try {
        mask = await predictMask(loaded, image);
    } catch (error) {
        if (loaded.device !== "webgpu") throw error;
        // E.g. out of GPU memory: retry once on WASM.
        console.warn("[bg-removal] WebGPU run failed, using WASM:", error);
        webgpuFailed = true;
        loading = null;
        loaded = await loadModel();
        mask = await predictMask(loaded, image);
    }

    // Full-resolution source + model mask as the alpha channel.
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const alpha = mask.data;
    const channels = mask.channels;
    for (let i = 0; i < canvas.width * canvas.height; i++) {
        pixels.data[i * 4 + 3] = alpha[i * channels];
    }
    ctx.putImageData(pixels, 0, 0);

    return canvas.convertToBlob({ type: "image/png" });
}

self.onmessage = async (event: MessageEvent<BgWorkerRequest>) => {
    const request = event.data;
    if (request.type === "load") {
        try {
            await loadModel(request.remoteHost);
        } catch (error) {
            console.error("[bg-removal] Model loading failed:", error);
            post({ type: "error", message: describeError(error) });
        }
        return;
    }

    try {
        const blob = await removeBackground(request.blob);
        post({ type: "result", id: request.id, blob });
    } catch (error) {
        console.error("[bg-removal] Background removal failed:", error);
        post({ type: "error", id: request.id, message: describeError(error) });
    }
};
