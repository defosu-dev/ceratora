// lib/backgroundRemover.ts
//
// Main-thread API for in-browser background removal. The model runs in a
// Web Worker (see backgroundRemoval.worker.ts); nothing leaves the device.

import { BG_MODELS, type BgDevice } from "./backgroundModels";
import type {
    BgWorkerRequest,
    BgWorkerResponse,
} from "./backgroundRemoval.worker";

export interface BgRemovalStatus {
    state: "idle" | "loading" | "ready" | "error";
    /** Model download progress, 0–100. */
    progress: number;
    device?: BgDevice;
    error?: string;
}

/**
 * Optional self-hosted model location, e.g. "/models/". The folder must
 * mirror the Hugging Face repo: /models/onnx-community/BiRefNet_lite/...
 * By default the model is downloaded from the Hugging Face Hub once and
 * then served from the browser cache.
 */
const MODEL_HOST = process.env.NEXT_PUBLIC_BG_MODEL_HOST || undefined;

/** Cache API bucket Transformers.js stores downloaded files in. */
const MODEL_CACHE_NAME = "transformers-cache";

let worker: Worker | null = null;
let status: BgRemovalStatus = { state: "idle", progress: 0 };
let nextId = 0;
const listeners = new Set<() => void>();
const pending = new Map<
    number,
    { resolve: (blob: Blob) => void; reject: (error: Error) => void }
>();
/** One cut-out per source blob, shared by the preview and processing. */
const cache = new WeakMap<Blob, Promise<Blob>>();

function setStatus(next: Partial<BgRemovalStatus>) {
    status = { ...status, ...next };
    listeners.forEach((listener) => listener());
}

function send(message: BgWorkerRequest) {
    getWorker().postMessage(message);
}

function getWorker(): Worker {
    if (worker) return worker;
    worker = new Worker(
        new URL("./backgroundRemoval.worker.ts", import.meta.url),
        { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<BgWorkerResponse>) => {
        const message = event.data;
        switch (message.type) {
            case "progress":
                setStatus({ state: "loading", progress: message.progress });
                break;
            case "ready":
                setStatus({
                    state: "ready",
                    progress: 100,
                    device: message.device,
                    error: undefined,
                });
                break;
            case "result":
                pending.get(message.id)?.resolve(message.blob);
                pending.delete(message.id);
                break;
            case "error":
                console.error("[bg-removal]", message.message);
                if (message.id !== undefined) {
                    pending.get(message.id)?.reject(new Error(message.message));
                    pending.delete(message.id);
                }
                if (status.state !== "ready") {
                    setStatus({ state: "error", error: message.message });
                }
                break;
        }
    };
    return worker;
}

export const BackgroundRemover = {
    /** Approximate one-time download: fp16 with WebGPU, fp32 without. */
    getDownloadSizeMB(): number {
        return typeof navigator !== "undefined" && "gpu" in navigator
            ? BG_MODELS.webgpu.sizeMB
            : BG_MODELS.wasm.sizeMB;
    },

    /** Whether the model was downloaded before (so no consent is needed). */
    async isModelCached(): Promise<boolean> {
        if (status.state === "ready") return true;
        if (typeof caches === "undefined") return false;
        try {
            const cache = await caches.open(MODEL_CACHE_NAME);
            const requests = await cache.keys();
            const ids = Object.values(BG_MODELS).map((model) => model.id);
            return requests.some(
                (request) =>
                    request.url.endsWith(".onnx") &&
                    ids.some((id) => request.url.includes(id)),
            );
        } catch {
            return false;
        }
    },

    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },

    getStatus(): BgRemovalStatus {
        return status;
    },

    /** Starts downloading the model (no-op if already loading or loaded). */
    load(): void {
        if (status.state === "loading" || status.state === "ready") return;
        setStatus({ state: "loading", progress: 0, error: undefined });
        send({ type: "load", remoteHost: MODEL_HOST });
    },

    /** Returns a PNG of the image with a transparent background. */
    remove(blob: Blob): Promise<Blob> {
        const cached = cache.get(blob);
        if (cached) return cached;

        this.load();
        const id = nextId++;
        const result = new Promise<Blob>((resolve, reject) => {
            pending.set(id, { resolve, reject });
            send({ type: "remove", id, blob });
        });
        cache.set(blob, result);
        result.catch(() => cache.delete(blob));
        return result;
    },
};
