// lib/backgroundModels.ts
//
// Background-removal models (both MIT), shared by the worker and the
// main-thread API. Kept separate so the main bundle doesn't pull in
// Transformers.js.

export type BgDevice = "webgpu" | "wasm";

/**
 * The 1024 px export needs more memory than the WASM heap allows
 * (std::bad_alloc), so WASM uses the 512 px export of the same model.
 */
export const BG_MODELS: Record<
    BgDevice,
    { id: string; dtype: "fp16" | "fp32"; sizeMB: number }
> = {
    webgpu: { id: "onnx-community/BiRefNet_lite", dtype: "fp16", sizeMB: 115 },
    wasm: { id: "studioludens/birefnet-lite-512", dtype: "fp32", sizeMB: 192 },
};
