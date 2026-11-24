// lib/imageProcessor.ts

import JSZip from "jszip";
import { BackgroundRemover } from "./backgroundRemover";

/** Crop area as fractions (0–1) of the source image size. */
export interface CropRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type CropHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type PaintTool = "erase" | "brush";

/** A freehand stroke; points and size are fractions of the source image. */
export interface PaintStroke {
    tool: PaintTool;
    /** Brush colour (ignored by the eraser). */
    color: string;
    /** Line width as a fraction of the image width. */
    size: number;
    points: [number, number][];
}

export interface ImageProcessingOptions {
    format?: "webp" | "png" | "jpeg";
    crop?: CropRect;
    /** Cut out the subject in the browser (see backgroundRemover.ts). */
    removeBackground?: boolean;
    /** Eraser / brush strokes, applied after background removal. */
    strokes?: PaintStroke[];
    quality?: number; // 0-100
    cornerRadius?: number;
    maxSizeKB?: number;
    maintainAspectRatio?: boolean;
    maxWidth?: number;
    maxHeight?: number;
}

export interface ProcessedImage {
    blob: Blob;
    fileName: string;
    originalName: string;
    originalSize: number;
    size: number;
    width: number;
    height: number;
    format: string;
    appliedQuality: number;
}

export class ImageProcessor {
    static async processImage(
        file: File,
        options: ImageProcessingOptions = {},
    ): Promise<ProcessedImage> {
        const {
            format = "webp",
            quality = 80,
            cornerRadius = 0,
            maxSizeKB,
            maintainAspectRatio = true,
            maxWidth,
            maxHeight,
            crop,
            removeBackground = false,
            strokes,
        } = options;

        const source = removeBackground
            ? await BackgroundRemover.remove(file)
            : file;
        const imageBitmap = await createImageBitmap(source);
        const image = strokes?.length
            ? PaintUtils.render(imageBitmap, strokes)
            : imageBitmap;

        const area = CropUtils.getArea(
            imageBitmap.width,
            imageBitmap.height,
            crop,
        );

        const { width, height } = this.calculateDimensions(
            area.width,
            area.height,
            maxWidth,
            maxHeight,
            maintainAspectRatio,
        );

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d", { alpha: true })!;

        ctx.clearRect(0, 0, width, height);

        if (cornerRadius > 0) {
            const maxRadius = Math.min(width, height) / 2;
            const effectiveRadius = Math.min(cornerRadius, maxRadius);
            this.applyRoundedCorners(ctx, width, height, effectiveRadius);
            ctx.clip();
        }

        ctx.drawImage(
            image,
            area.x,
            area.y,
            area.width,
            area.height,
            0,
            0,
            width,
            height,
        );
        imageBitmap.close();

        let blob: Blob;
        let appliedQuality: number;

        if (maxSizeKB !== undefined) {
            const result = await this.compressToSize(
                canvas,
                format,
                maxSizeKB * 1024,
            );
            blob = result.blob;
            appliedQuality = result.quality;
        } else {
            appliedQuality = quality;
            blob = await this.convertToBlob(canvas, format, quality);
        }

        return {
            blob,
            fileName: this.generateFileName(file.name, format),
            originalName: file.name,
            originalSize: file.size,
            size: blob.size,
            width,
            height,
            format,
            appliedQuality,
        };
    }

    private static async convertToBlob(
        canvas: OffscreenCanvas,
        format: string,
        quality: number,
    ): Promise<Blob> {
        let normalizedQuality = quality / 100;

        if (format === "webp" && normalizedQuality > 0.95)
            normalizedQuality = 0.95;
        if (format === "jpeg" && normalizedQuality > 0.98)
            normalizedQuality = 0.98;

        if (format === "png") {
            return this.compressPNGOffscreen(canvas, normalizedQuality);
        }

        const blob = await canvas.convertToBlob({
            type: `image/${format}`,
            quality: normalizedQuality,
        });

        if (!blob || blob.size === 0) {
            throw new Error(`Конвертація в ${format} не вдалась`);
        }

        return blob;
    }

    private static async compressPNGOffscreen(
        canvas: OffscreenCanvas,
        quality: number,
    ): Promise<Blob> {
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let colorDepth: number;
        if (quality >= 0.9) colorDepth = 256;
        else if (quality >= 0.7) colorDepth = 128;
        else if (quality >= 0.5) colorDepth = 64;
        else if (quality >= 0.3) colorDepth = 32;
        else colorDepth = 16;

        const step = Math.floor(256 / colorDepth);

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.round(data[i] / step) * step;
            data[i + 1] = Math.round(data[i + 1] / step) * step;
            data[i + 2] = Math.round(data[i + 2] / step) * step;
        }

        const tempCanvas = new OffscreenCanvas(canvas.width, canvas.height);
        const tempCtx = tempCanvas.getContext("2d")!;
        tempCtx.putImageData(imageData, 0, 0);

        return tempCanvas.convertToBlob({ type: "image/png" });
    }

    private static async compressToSize(
        canvas: OffscreenCanvas,
        format: string,
        targetSize: number,
    ): Promise<{ blob: Blob; quality: number }> {
        let minQuality = 10;
        let maxQuality = format === "webp" ? 95 : 98;
        let bestBlob: Blob | null = null;
        let bestQuality = 0;
        const maxAttempts = 12;
        let attempts = 0;

        while (attempts < maxAttempts && maxQuality - minQuality > 2) {
            const currentQuality = Math.round((minQuality + maxQuality) / 2);
            const blob = await this.convertToBlob(
                canvas,
                format,
                currentQuality,
            );

            if (blob.size <= targetSize) {
                bestBlob = blob;
                bestQuality = currentQuality;
                minQuality = currentQuality;
            } else {
                maxQuality = currentQuality;
            }

            attempts++;
        }

        if (!bestBlob) {
            bestQuality = minQuality;
            bestBlob = await this.convertToBlob(canvas, format, minQuality);
        }

        return { blob: bestBlob, quality: bestQuality };
    }

    static async processImages(
        files: File[],
        options: ImageProcessingOptions = {},
        onProgress?: (processed: number, total: number) => void,
        signal?: AbortSignal,
        /** Per-file overrides (e.g. crop, corner radius), by index. */
        fileOptions?: (Partial<ImageProcessingOptions> | undefined)[],
    ): Promise<ProcessedImage[]> {
        const results: ProcessedImage[] = [];

        for (let i = 0; i < files.length; i++) {
            if (signal?.aborted) break;

            try {
                const processed = await this.processImage(files[i], {
                    ...options,
                    ...fileOptions?.[i],
                });
                results.push(processed);
                onProgress?.(i + 1, files.length);
            } catch (error) {
                console.error(`Помилка обробки ${files[i].name}:`, error);
            }
        }

        return results;
    }

    private static calculateDimensions(
        originalWidth: number,
        originalHeight: number,
        maxWidth?: number,
        maxHeight?: number,
        maintainAspectRatio: boolean = true,
    ): { width: number; height: number } {
        let width = originalWidth;
        let height = originalHeight;

        if (!maxWidth && !maxHeight) return { width, height };

        if (maintainAspectRatio) {
            const ratio = originalWidth / originalHeight;

            if (maxWidth && maxHeight) {
                if (width > maxWidth) {
                    width = maxWidth;
                    height = width / ratio;
                }
                if (height > maxHeight) {
                    height = maxHeight;
                    width = height * ratio;
                }
            } else if (maxWidth) {
                if (width > maxWidth) {
                    width = maxWidth;
                    height = width / ratio;
                }
            } else if (maxHeight) {
                if (height > maxHeight) {
                    height = maxHeight;
                    width = height * ratio;
                }
            }
        } else {
            width = maxWidth || width;
            height = maxHeight || height;
        }

        return { width: Math.round(width), height: Math.round(height) };
    }

    private static applyRoundedCorners(
        ctx: OffscreenCanvasRenderingContext2D,
        width: number,
        height: number,
        radius: number,
    ): void {
        const r = Math.max(0, Math.min(radius, width / 2, height / 2));
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(width - r, 0);
        ctx.arcTo(width, 0, width, r, r);
        ctx.lineTo(width, height - r);
        ctx.arcTo(width, height, width - r, height, r);
        ctx.lineTo(r, height);
        ctx.arcTo(0, height, 0, height - r, r);
        ctx.lineTo(0, r);
        ctx.arcTo(0, 0, r, 0, r);
        ctx.closePath();
    }

    private static generateFileName(
        originalName: string,
        format: string,
    ): string {
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
        return `${nameWithoutExt}.${format}`;
    }

    static downloadImage(processedImage: ProcessedImage): void {
        const url = URL.createObjectURL(processedImage.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = processedImage.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export const ArchiveUtils = {
    isArchive(file: File): boolean {
        const name = file.name.toLowerCase();
        return (
            name.endsWith(".zip") ||
            name.endsWith(".7z") ||
            name.endsWith(".rar") ||
            name.endsWith(".tar") ||
            name.endsWith(".tar.gz") ||
            name.endsWith(".tgz") ||
            name.endsWith(".tar.bz2") ||
            name.endsWith(".tbz2") ||
            name.endsWith(".tar.xz") ||
            name.endsWith(".txz") ||
            name.endsWith(".cbz") ||
            name.endsWith(".cbr") ||
            name.endsWith(".gz") ||
            name.endsWith(".bz2") ||
            name.endsWith(".xz") ||
            file.type === "application/zip" ||
            file.type === "application/x-zip-compressed" ||
            file.type === "application/x-7z-compressed" ||
            file.type === "application/x-rar-compressed" ||
            file.type === "application/x-tar"
        );
    },

    isImageFile(filename: string, mimeType?: string): boolean {
        if (mimeType && mimeType.startsWith("image/")) return true;
        return /\.(png|jpe?g|webp|gif|bmp|svg|avif|tiff?|ico|heic|heif)$/i.test(
            filename,
        );
    },

    getMimeType(filename: string): string {
        const ext = filename.split(".").pop()?.toLowerCase();
        switch (ext) {
            case "jpg":
            case "jpeg":
                return "image/jpeg";
            case "png":
                return "image/png";
            case "webp":
                return "image/webp";
            case "gif":
                return "image/gif";
            case "svg":
                return "image/svg+xml";
            case "bmp":
                return "image/bmp";
            case "avif":
                return "image/avif";
            case "tif":
            case "tiff":
                return "image/tiff";
            case "ico":
                return "image/x-icon";
            case "heic":
            case "heif":
                return "image/heic";
            default:
                return "image/png";
        }
    },

    async extractImagesFromArchive(file: File): Promise<File[]> {
        const extractedFiles: File[] = [];

        // 1. Спробуємо через libarchive.js (підтримує 7z, rar, tar, zip, iso тощо у WebWorker)
        if (typeof window !== "undefined") {
            try {
                const { Archive } = await import("libarchive.js");
                Archive.init({
                    workerUrl: "/libarchive/worker-bundle.js",
                });
                const archive = await Archive.open(file);
                const entries = await archive.getFilesArray();

                for (const item of entries) {
                    const fileName = item.file.name;
                    const fullPath = item.path
                        ? `${item.path}${fileName}`
                        : fileName;
                    if (
                        !fullPath.startsWith("__MACOSX/") &&
                        !fullPath.includes("/.DS_Store") &&
                        !fullPath.endsWith(".DS_Store") &&
                        ArchiveUtils.isImageFile(fileName)
                    ) {
                        const extractedFile = await item.file.extract();
                        const mimeType =
                            ArchiveUtils.getMimeType(fileName) ||
                            extractedFile.type ||
                            "image/png";
                        const imageFile = new File(
                            [extractedFile],
                            fileName,
                            { type: mimeType },
                        );
                        extractedFiles.push(imageFile);
                    }
                }
                await archive.close();

                if (extractedFiles.length > 0) {
                    return extractedFiles;
                }
            } catch (archiveError) {
                console.warn(
                    "libarchive.js extraction failed, attempting fallback:",
                    archiveError,
                );
            }
        }

        // 2. Fallback до JSZip якщо це zip/cbz
        const lowerName = file.name.toLowerCase();
        if (
            lowerName.endsWith(".zip") ||
            lowerName.endsWith(".cbz") ||
            file.type.includes("zip")
        ) {
            try {
                const zip = await JSZip.loadAsync(file);
                const entries: { path: string; entry: JSZip.JSZipObject }[] =
                    [];
                zip.forEach((relativePath, entry) => {
                    if (
                        !entry.dir &&
                        !relativePath.startsWith("__MACOSX/") &&
                        !relativePath.includes("/.DS_Store") &&
                        !relativePath.endsWith(".DS_Store") &&
                        ArchiveUtils.isImageFile(relativePath)
                    ) {
                        entries.push({ path: relativePath, entry });
                    }
                });

                for (const item of entries) {
                    const blob = await item.entry.async("blob");
                    const baseName =
                        item.path.split("/").pop() || item.path;
                    const mimeType =
                        ArchiveUtils.getMimeType(baseName) ||
                        blob.type ||
                        "image/png";
                    const imageFile = new File([blob], baseName, {
                        type: mimeType,
                    });
                    extractedFiles.push(imageFile);
                }
            } catch (zipError) {
                console.error("JSZip fallback failed:", zipError);
            }
        }

        return extractedFiles;
    },

    // Backward-compatible alias
    async extractImagesFromZip(file: File): Promise<File[]> {
        return this.extractImagesFromArchive(file);
    },

    async downloadZip(
        images: ProcessedImage[],
        zipFileName = "ceratora_images.zip",
    ): Promise<void> {
        const zip = new JSZip();
        const usedNames = new Set<string>();

        for (const img of images) {
            let name = img.fileName;
            if (usedNames.has(name)) {
                const ext = name.split(".").pop() || "";
                const base = name.replace(/\.[^/.]+$/, "");
                let counter = 1;
                while (usedNames.has(`${base}_${counter}.${ext}`)) {
                    counter++;
                }
                name = `${base}_${counter}.${ext}`;
            }
            usedNames.add(name);
            zip.file(name, img.blob);
        }

        const content = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 6 },
        });

        const url = URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = url;
        a.download = zipFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
};

export const ImageUtils = {
    formatFileSize(bytes: number): string {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (
            Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
        );
    },

    isFormatSupported(): boolean {
        return typeof OffscreenCanvas !== "undefined";
    },

    async getImageInfo(
        file: File,
    ): Promise<{ width: number; height: number; size: number; type: string }> {
        const bitmap = await createImageBitmap(file);
        const info = {
            width: bitmap.width,
            height: bitmap.height,
            size: file.size,
            type: file.type,
        };
        bitmap.close();
        return info;
    },
};

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export const PaintUtils = {
    /** Draws one stroke onto a canvas of the image (any resolution). */
    draw(ctx: Context2D, stroke: PaintStroke, width: number, height: number) {
        const [first, ...rest] = stroke.points;
        if (!first) return;
        ctx.save();
        ctx.globalCompositeOperation =
            stroke.tool === "erase" ? "destination-out" : "source-over";
        ctx.strokeStyle = stroke.tool === "erase" ? "#000" : stroke.color;
        ctx.lineWidth = Math.max(stroke.size * width, 0.5);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(first[0] * width, first[1] * height);
        // A single click still leaves a round dot.
        if (rest.length === 0) {
            ctx.lineTo(first[0] * width + 0.01, first[1] * height);
        }
        for (const [x, y] of rest) ctx.lineTo(x * width, y * height);
        ctx.stroke();
        ctx.restore();
    },

    apply(
        ctx: Context2D,
        strokes: PaintStroke[],
        width: number,
        height: number,
    ) {
        for (const stroke of strokes) this.draw(ctx, stroke, width, height);
    },

    /** The image with the strokes applied, at full resolution. */
    render(image: ImageBitmap, strokes: PaintStroke[]): OffscreenCanvas {
        const canvas = new OffscreenCanvas(image.width, image.height);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        this.apply(ctx, strokes, image.width, image.height);
        return canvas;
    },
};

export const CropUtils = {
    FULL: { x: 0, y: 0, width: 1, height: 1 } as CropRect,

    isFull(crop?: CropRect): boolean {
        if (!crop) return true;
        const eps = 0.0005;
        return (
            crop.x < eps &&
            crop.y < eps &&
            crop.width > 1 - eps &&
            crop.height > 1 - eps
        );
    },

    /** Crop area in source pixels. Mirrored by the page preview. */
    getArea(
        width: number,
        height: number,
        crop?: CropRect,
    ): { x: number; y: number; width: number; height: number } {
        if (!crop || this.isFull(crop)) return { x: 0, y: 0, width, height };
        const x = clamp(Math.round(crop.x * width), 0, width - 1);
        const y = clamp(Math.round(crop.y * height), 0, height - 1);
        return {
            x,
            y,
            width: clamp(Math.round(crop.width * width), 1, width - x),
            height: clamp(Math.round(crop.height * height), 1, height - y),
        };
    },

    /**
     * Converts a pixel aspect ratio (width / height) into the ratio of
     * fractional crop sizes for an image of the given size.
     */
    toFractionRatio(ratio: number, width: number, height: number): number {
        return (ratio * height) / width;
    },

    /** Largest centered crop with the given pixel aspect ratio. */
    fitAspect(ratio: number, width: number, height: number): CropRect {
        const r = this.toFractionRatio(ratio, width, height);
        const w = r >= 1 ? 1 : r;
        const h = r >= 1 ? 1 / r : 1;
        return { x: (1 - w) / 2, y: (1 - h) / 2, width: w, height: h };
    },

    move(start: CropRect, dx: number, dy: number): CropRect {
        return {
            ...start,
            x: clamp(start.x + dx, 0, 1 - start.width),
            y: clamp(start.y + dy, 0, 1 - start.height),
        };
    },

    /**
     * Drags one edge or corner of the crop by (dx, dy) fractions.
     * `ratio` is a fractional ratio from toFractionRatio, or null for free.
     */
    resize(
        start: CropRect,
        handle: CropHandle,
        dx: number,
        dy: number,
        ratio: number | null,
        minWidth = 0.02,
        minHeight = 0.02,
    ): CropRect {
        const moveW = handle.includes("w");
        const moveE = handle.includes("e");
        const moveN = handle.includes("n");
        const moveS = handle.includes("s");

        let left = start.x;
        let top = start.y;
        let right = start.x + start.width;
        let bottom = start.y + start.height;

        if (moveW) left = clamp(left + dx, 0, right - minWidth);
        if (moveE) right = clamp(right + dx, left + minWidth, 1);
        if (moveN) top = clamp(top + dy, 0, bottom - minHeight);
        if (moveS) bottom = clamp(bottom + dy, top + minHeight, 1);

        if (!ratio) {
            return {
                x: left,
                y: top,
                width: right - left,
                height: bottom - top,
            };
        }

        // Aspect locked: keep the opposite edge (or the center) in place.
        let width = right - left;
        let height = bottom - top;
        const horizontal = moveW || moveE;
        const vertical = moveN || moveS;

        if (horizontal && !vertical) height = width / ratio;
        else if (vertical && !horizontal) width = height * ratio;
        else if (width / ratio > height) height = width / ratio;
        else width = height * ratio;

        const startRight = start.x + start.width;
        const startBottom = start.y + start.height;
        const centerX = start.x + start.width / 2;
        const centerY = start.y + start.height / 2;

        const maxWidth = moveW
            ? startRight
            : moveE
              ? 1 - start.x
              : 2 * Math.min(centerX, 1 - centerX);
        const maxHeight = moveN
            ? startBottom
            : moveS
              ? 1 - start.y
              : 2 * Math.min(centerY, 1 - centerY);

        if (width < minWidth) {
            width = minWidth;
            height = width / ratio;
        }
        if (height < minHeight) {
            height = minHeight;
            width = height * ratio;
        }
        if (width > maxWidth) {
            width = maxWidth;
            height = width / ratio;
        }
        if (height > maxHeight) {
            height = maxHeight;
            width = height * ratio;
        }

        const x = moveW
            ? startRight - width
            : moveE
              ? start.x
              : centerX - width / 2;
        const y = moveN
            ? startBottom - height
            : moveS
              ? start.y
              : centerY - height / 2;

        return { x, y, width, height };
    },
};
