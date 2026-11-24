"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
    type BgRemovalStatus,
    BackgroundRemover,
} from "@/lib/backgroundRemover";
import { useTranslation } from "@/lib/i18n";
import {
    ArchiveUtils,
    type CropRect,
    CropUtils,
    ImageProcessingOptions,
    ImageProcessor,
    type PaintStroke,
    type PaintTool,
    ProcessedImage,
} from "@/lib/imageProcessor";
import { cn } from "@/lib/utils";
import {
    Brush,
    Circle,
    Eraser,
    HardDrive,
    Loader2,
    Crop,
    Download,
    Eye,
    FileImage,
    FolderArchive,
    FolderOpen,
    Image as ImageIcon,
    Maximize2,
    MoreHorizontal,
    Plus,
    RotateCcw,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    Redo2,
    Undo2,
    X,
    ZoomIn,
    ZoomOut,
    type LucideIcon,
} from "lucide-react";
import {
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import { toast } from "react-toastify";
import { useAppProvider } from "../../_components/AppProvider";
import { CropEditor } from "./_components/CropEditor";
import { PaintLayer } from "./_components/PaintLayer";
import { ToolButton } from "./_components/ToolButton";
import { useZoomViewport } from "./_hooks/useZoomViewport";

interface FileWithSelection {
    file: File;
    id: string;
    selected: boolean;
}

const CORNER_RADIUS_PRESETS = [
    { label: "0", value: 0 },
    { label: "8", value: 8 },
    { label: "12", value: 12 },
    { label: "16", value: 16 },
    { label: "24", value: 24 },
    { label: "28", value: 28 },
    { label: "Full", value: 9999 },
] as const;

type CropAspect =
    | "free"
    | "original"
    | "1:1"
    | "4:3"
    | "3:4"
    | "16:9"
    | "9:16"
    | "3:2";

const CROP_ASPECT_PRESETS: { value: CropAspect; ratio: number | null }[] = [
    { value: "free", ratio: null },
    { value: "original", ratio: null },
    { value: "1:1", ratio: 1 },
    { value: "4:3", ratio: 4 / 3 },
    { value: "3:4", ratio: 3 / 4 },
    { value: "16:9", ratio: 16 / 9 },
    { value: "9:16", ratio: 9 / 16 },
    { value: "3:2", ratio: 3 / 2 },
];

/** View zoom (1 = fit). Only changes how big the image looks. */
const ZOOM_MIN = 0.25;
const CANVAS_ZOOM_MAX = 4;
/** Previews may be tiny (icons), so they can be magnified further. */
const MODAL_ZOOM_MAX = 16;
const ZOOM_STEP = 1.25;

const BG_IDLE_STATUS: BgRemovalStatus = { state: "idle", progress: 0 };

const DEFAULT_OPTIONS: ImageProcessingOptions = {
    format: "webp",
    quality: 80,
    cornerRadius: 0,
    maxSizeKB: 35,
    maxWidth: undefined,
    maxHeight: undefined,
};

function formatFileSize(bytes: number) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function getSizeDelta(img: ProcessedImage) {
    const isSmaller = img.size < img.originalSize;
    const percent =
        img.originalSize > 0
            ? Math.round(
                  (Math.abs(img.size - img.originalSize) / img.originalSize) *
                      1000,
              ) / 10
            : 0;
    return { isSmaller, percent };
}

/** Mirrors ImageProcessor.calculateDimensions (aspect ratio kept). */
function calculateOutputSize(
    originalWidth: number,
    originalHeight: number,
    maxWidth?: number,
    maxHeight?: number,
) {
    let width = originalWidth;
    let height = originalHeight;

    if (!maxWidth && !maxHeight) return { width, height };
    if (originalHeight === 0) return { width, height };

    const ratio = originalWidth / originalHeight;

    if (maxWidth && width > maxWidth) {
        width = maxWidth;
        height = width / ratio;
    }
    if (maxHeight && height > maxHeight) {
        height = maxHeight;
        width = height * ratio;
    }

    return { width: Math.round(width), height: Math.round(height) };
}

/** Positions the full source image inside a frame so only the crop shows. */
function getCropImageStyle(crop: CropRect): React.CSSProperties {
    return {
        width: `${100 / crop.width}%`,
        height: `${100 / crop.height}%`,
        left: `${(-crop.x / crop.width) * 100}%`,
        top: `${(-crop.y / crop.height) * 100}%`,
    };
}

/** Tracks an element's rendered width (callback ref + ResizeObserver). */
function useElementWidth<T extends HTMLElement>() {
    const [element, setElement] = useState<T | null>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        if (!element) return;
        const observer = new ResizeObserver(([entry]) =>
            setWidth(entry.contentRect.width),
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [element]);

    return [setElement, width] as const;
}

/** − / percentage (click = fit) / + buttons for a zoomable view. */
function ZoomControls({
    zoom,
    max,
    onZoom,
    labels,
}: {
    zoom: number;
    max: number;
    onZoom: (zoom: number) => void;
    labels: { zoomIn: string; zoomOut: string; zoomFit: string };
}) {
    const buttonClass =
        "text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40";
    return (
        <>
            <button
                type="button"
                onClick={() => onZoom(zoom / ZOOM_STEP)}
                disabled={zoom <= ZOOM_MIN}
                aria-label={labels.zoomOut}
                title={labels.zoomOut}
                className={buttonClass}
            >
                <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
                type="button"
                onClick={() => onZoom(1)}
                aria-label={labels.zoomFit}
                title={labels.zoomFit}
                className={cn(
                    "w-11 text-center font-mono text-xs",
                    buttonClass,
                )}
            >
                {Math.round(zoom * 100)}%
            </button>
            <button
                type="button"
                onClick={() => onZoom(zoom * ZOOM_STEP)}
                disabled={zoom >= max}
                aria-label={labels.zoomIn}
                title={labels.zoomIn}
                className={buttonClass}
            >
                <ZoomIn className="h-3.5 w-3.5" />
            </button>
        </>
    );
}

function SettingSection({
    icon: Icon,
    title,
    children,
}: {
    icon: LucideIcon;
    title: string;
    children: ReactNode;
}) {
    return (
        <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {title}
            </h3>
            {children}
        </section>
    );
}

/**
 * A source (input) file. Visually distinct from a processed result:
 * dashed outline, selection checkbox, and no output metrics.
 */
function SourceCard({
    file,
    selected,
    isPreview,
    isCropped,
    onToggle,
    onPreview,
    onRemove,
    previewLabel,
    removeLabel,
    croppedLabel,
}: {
    file: File;
    selected: boolean;
    isPreview: boolean;
    isCropped: boolean;
    onToggle: () => void;
    onPreview: () => void;
    onRemove: () => void;
    previewLabel: string;
    removeLabel: string;
    croppedLabel: string;
}) {
    const imgRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        const url = URL.createObjectURL(file);
        const el = imgRef.current;
        if (el) el.src = url;
        return () => {
            URL.revokeObjectURL(url);
            if (el) el.removeAttribute("src");
        };
    }, [file]);

    return (
        <div
            className={`group relative overflow-hidden rounded-lg border transition-colors ${
                selected
                    ? "border-primary bg-accent/30"
                    : "border-dashed border-input bg-card"
            }`}
        >
            <button
                type="button"
                onClick={onPreview}
                aria-label={`${previewLabel}: ${file.name}`}
                className="relative flex aspect-square w-full items-center justify-center overflow-hidden p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {/*eslint-disable-next-line*/}
                <img
                    ref={imgRef}
                    alt={file.name}
                    loading="lazy"
                    className="max-h-full max-w-full rounded-sm object-contain"
                />
                <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                {isPreview && (
                    <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded-full bg-primary p-1 text-primary-foreground shadow-sm">
                        <Eye className="h-3 w-3" />
                    </span>
                )}
                {isCropped && (
                    <span
                        className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-full bg-background/90 p-1 text-foreground shadow-sm"
                        title={croppedLabel}
                    >
                        <Crop className="h-3 w-3" />
                    </span>
                )}
            </button>

            <div className="absolute top-1.5 left-1.5">
                <Checkbox
                    checked={selected}
                    onCheckedChange={onToggle}
                    aria-label={file.name}
                    className="bg-background/90 shadow-sm"
                />
            </div>

            <div className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Button
                    variant="secondary"
                    size="icon-xs"
                    title={removeLabel}
                    aria-label={removeLabel}
                    onClick={onRemove}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>

            <p className="truncate px-2 pb-1.5 text-[11px]" title={file.name}>
                {file.name}
            </p>
        </div>
    );
}

/** Checkerboard behind previews, so transparent areas are visible. */
const CHECKERBOARD_STYLE: React.CSSProperties = {
    backgroundColor: "var(--muted)",
    backgroundImage:
        "repeating-conic-gradient(color-mix(in oklch, var(--muted-foreground) 14%, transparent) 0% 25%, transparent 0% 50%)",
    backgroundSize: "16px 16px",
};

/** A processed output: preview on a checkerboard, size savings, actions. */
function ResultCard({
    image,
    onOpen,
    previewLabel,
    previewAriaLabel,
    downloadLabel,
}: {
    image: ProcessedImage;
    onOpen: () => void;
    previewLabel: string;
    previewAriaLabel: string;
    downloadLabel: string;
}) {
    const imgRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        const url = URL.createObjectURL(image.blob);
        const el = imgRef.current;
        if (el) el.src = url;
        return () => {
            URL.revokeObjectURL(url);
            if (el) el.removeAttribute("src");
        };
    }, [image]);

    const { isSmaller, percent } = getSizeDelta(image);
    const sizeRatio =
        image.originalSize > 0
            ? Math.min(100, (image.size / image.originalSize) * 100)
            : 100;

    return (
        <div className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-md">
            <button
                type="button"
                onClick={onOpen}
                aria-label={`${previewAriaLabel}: ${image.fileName}`}
                className="relative flex aspect-4/3 w-full items-center justify-center overflow-hidden border-b outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                style={CHECKERBOARD_STYLE}
            >
                {/*eslint-disable-next-line*/}
                <img
                    ref={imgRef}
                    alt={image.fileName}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain p-4 drop-shadow-sm transition-transform duration-200 group-hover:scale-[1.03]"
                />
                <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15" />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-full bg-background/90 p-2 shadow-sm">
                        <Eye className="h-4 w-4" />
                    </span>
                </span>
                <span className="pointer-events-none absolute top-2 left-2 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide shadow-sm backdrop-blur">
                    {image.format.toUpperCase()}
                </span>
                <span
                    className={cn(
                        "pointer-events-none absolute top-2 right-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm",
                        isSmaller ? "bg-emerald-600/90" : "bg-destructive/90",
                    )}
                >
                    {isSmaller ? "−" : "+"}
                    {percent}%
                </span>
            </button>
            <div className="flex flex-1 flex-col gap-3 p-3">
                <div className="min-w-0 space-y-1">
                    <p
                        className="truncate text-sm font-medium"
                        title={image.fileName}
                    >
                        {image.fileName}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="shrink-0">
                            {image.width}×{image.height}
                        </span>
                        <span className="h-3 w-px shrink-0 bg-border" />
                        <span className="truncate">
                            <span className="line-through decoration-muted-foreground/60">
                                {formatFileSize(image.originalSize)}
                            </span>{" "}
                            →{" "}
                            <span className="font-medium text-foreground">
                                {formatFileSize(image.size)}
                            </span>
                        </span>
                    </p>
                </div>
                <div
                    className="h-1 overflow-hidden rounded-full bg-muted"
                    aria-hidden="true"
                >
                    <div
                        className={cn(
                            "h-full rounded-full",
                            isSmaller ? "bg-emerald-500" : "bg-destructive",
                        )}
                        style={{ width: `${Math.max(sizeRatio, 2)}%` }}
                    />
                </div>
                <div className="mt-auto flex gap-2">
                    <Button
                        size="sm"
                        className="min-w-0 flex-1"
                        onClick={() => ImageProcessor.downloadImage(image)}
                    >
                        <Download className="h-4 w-4" />
                        <span className="truncate">{downloadLabel}</span>
                    </Button>
                    <Button
                        size="icon-sm"
                        variant="outline"
                        title={previewLabel}
                        aria-label={`${previewAriaLabel}: ${image.fileName}`}
                        onClick={onOpen}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function ImageToolsPage() {
    const { locale } = useAppProvider();
    const t = useTranslation(locale);

    const [files, setFiles] = useState<FileWithSelection[]>([]);
    const [processedImages, setProcessedImages] = useState<ProcessedImage[]>(
        [],
    );
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCreatingZip, setIsCreatingZip] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressCount, setProgressCount] = useState<{
        current: number;
        total: number;
    } | null>(null);
    const [qualityMode, setQualityMode] = useState<"manual" | "auto">("auto");
    const [options, setOptions] =
        useState<ImageProcessingOptions>(DEFAULT_OPTIONS);
    const [isDragging, setIsDragging] = useState(false);
    const [canvasMode, setCanvasMode] = useState<
        "preview" | "crop" | "results"
    >("preview");
    const [pane, setPane] = useState<"sources" | "canvas" | "settings">(
        "canvas",
    );

    const abortControllerRef = useRef<AbortController | null>(null);
    const dragDepthRef = useRef(0);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Corner-radius preview: one chosen source image, shown large.
    const [previewFileId, setPreviewFileId] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewNatural, setPreviewNatural] = useState<{
        width: number;
        height: number;
    } | null>(null);
    const [setPreviewFrame, previewFrameWidth] =
        useElementWidth<HTMLDivElement>();
    const [setModalFrame, modalFrameWidth] = useElementWidth<HTMLDivElement>();
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

    // Crop: one area per source file (fractions of the source size).
    const [crops, setCrops] = useState<Record<string, CropRect>>({});
    const [cropAspect, setCropAspect] = useState<CropAspect>("free");
    // Crop or resize: only the chosen one is shown and applied.
    // Corner radius per image (falls back to options.cornerRadius). With
    // "same for selected", edits go to every image checked in Sources.
    const [radiusForSelected, setRadiusForSelected] = useState(true);
    const [radii, setRadii] = useState<Record<string, number>>({});
    /** Images whose background the user removed (by id). */
    const [bgRemoved, setBgRemoved] = useState<Record<string, boolean>>({});
    /** Eraser / brush strokes per image (by id). */
    const [paints, setPaints] = useState<Record<string, PaintStroke[]>>({});
    /** Undone strokes per image, for redo (cleared by a new stroke). */
    const [redos, setRedos] = useState<Record<string, PaintStroke[]>>({});
    const [paintTool, setPaintTool] = useState<PaintTool | null>(null);
    const [brushSize, setBrushSize] = useState(32);
    const [brushColor, setBrushColor] = useState("#ffffff");
    const [transformMode, setTransformMode] = useState<"crop" | "size">("size");

    const [selectedProcessedImage, setSelectedProcessedImage] =
        useState<ProcessedImage | null>(null);
    const [processedPreviewUrl, setProcessedPreviewUrl] = useState<
        string | null
    >(null);
    const [isBgConsentOpen, setIsBgConsentOpen] = useState(false);

    useEffect(() => {
        const anyOpen =
            isPreviewModalOpen ||
            selectedProcessedImage !== null ||
            isBgConsentOpen;
        if (!anyOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setIsPreviewModalOpen(false);
            setSelectedProcessedImage(null);
            setIsBgConsentOpen(false);
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [isPreviewModalOpen, selectedProcessedImage, isBgConsentOpen]);

    // Wheel zoom + drag to pan: the work area (preview / crop) and the
    // full-size preview dialogs.
    const {
        zoom: viewZoom,
        zoomTo: changeViewZoom,
        attach: attachCanvasViewport,
        panHandlers: canvasPanHandlers,
    } = useZoomViewport({
        min: ZOOM_MIN,
        max: CANVAS_ZOOM_MAX,
        enabled: canvasMode !== "results",
    });
    const {
        zoom: modalZoom,
        zoomTo: changeModalZoom,
        reset: resetModalZoom,
        attach: attachModalViewport,
        panHandlers: modalPanHandlers,
    } = useZoomViewport({
        min: ZOOM_MIN,
        max: MODAL_ZOOM_MAX,
        enabled: isPreviewModalOpen || selectedProcessedImage !== null,
    });
    const zoomLabels = {
        zoomIn: t.workspace.zoomIn,
        zoomOut: t.workspace.zoomOut,
        zoomFit: t.workspace.zoomFit,
    };

    const previewEntry =
        files.find((f) => f.id === previewFileId) ?? files[0] ?? null;
    const previewFile = previewEntry?.file ?? null;

    // Background removal: model status, and the previewed image's cut-out.
    const bgStatus = useSyncExternalStore(
        BackgroundRemover.subscribe,
        BackgroundRemover.getStatus,
        () => BG_IDLE_STATUS,
    );
    // Per image: only the one the user pressed the button for.
    const removeBg = previewEntry
        ? (bgRemoved[previewEntry.id] ?? false)
        : false;
    const [cutout, setCutout] = useState<{ file: File; blob: Blob } | null>(
        null,
    );
    const [cutoutFailed, setCutoutFailed] = useState<File | null>(null);
    useEffect(() => {
        if (!removeBg || !previewFile) return;
        let cancelled = false;
        BackgroundRemover.remove(previewFile)
            .then((blob) => {
                if (!cancelled) setCutout({ file: previewFile, blob });
            })
            .catch(() => {
                if (cancelled) return;
                setCutoutFailed(previewFile);
                // One toast even if several requests fail together.
                toast.error(t.imageTools.background.error, {
                    toastId: "bg-removal-error",
                });
            });
        return () => {
            cancelled = true;
        };
    }, [removeBg, previewFile, t]);

    /**
     * What the canvas shows: the source, or its cut-out once it's ready
     * (the source again if removal failed).
     */
    const previewSource: Blob | null = !removeBg
        ? previewFile
        : cutout && cutout.file === previewFile
          ? cutout.blob
          : cutoutFailed === previewFile
            ? previewFile
            : null;
    const isRemovingBg = removeBg && previewFile !== null && !previewSource;

    /**
     * The "Remove background" button. The first time (model not in the
     * browser cache yet) it asks for consent before the large download.
     */
    const handleRemoveBackgroundClick = async () => {
        if (removeBg) {
            toggleRemoveBackground(false);
            return;
        }
        if (await BackgroundRemover.isModelCached()) {
            toggleRemoveBackground(true);
        } else {
            setIsBgConsentOpen(true);
        }
    };

    const confirmModelDownload = () => {
        setIsBgConsentOpen(false);
        toggleRemoveBackground(true);
    };

    // Eraser / brush: only on the preview tab, for the previewed image.
    const activeTool =
        canvasMode === "preview" && previewEntry ? paintTool : null;
    const previewStrokes = (previewEntry && paints[previewEntry.id]) || [];
    const hasErased = previewStrokes.some((s) => s.tool === "erase");

    const selectPaintTool = (tool: PaintTool) => {
        setPaintTool((prev) =>
            prev === tool && canvasMode === "preview" ? null : tool,
        );
        setCanvasMode("preview");
    };

    const previewRedos = (previewEntry && redos[previewEntry.id]) || [];

    const addStroke = (stroke: PaintStroke) => {
        if (!previewEntry) return;
        const id = previewEntry.id;
        setPaints((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), stroke] }));
        setRedos((prev) => ({ ...prev, [id]: [] }));
    };

    const undoStroke = () => {
        const last = previewStrokes.at(-1);
        if (!previewEntry || !last) return;
        const id = previewEntry.id;
        setPaints((prev) => ({ ...prev, [id]: previewStrokes.slice(0, -1) }));
        setRedos((prev) => ({ ...prev, [id]: [...previewRedos, last] }));
    };

    const redoStroke = () => {
        const next = previewRedos.at(-1);
        if (!previewEntry || !next) return;
        const id = previewEntry.id;
        setPaints((prev) => ({ ...prev, [id]: [...previewStrokes, next] }));
        setRedos((prev) => ({ ...prev, [id]: previewRedos.slice(0, -1) }));
    };

    const clearStrokes = () => {
        if (!previewEntry) return;
        const id = previewEntry.id;
        setPaints((prev) => ({ ...prev, [id]: [] }));
        setRedos((prev) => ({ ...prev, [id]: [] }));
    };

    const toggleRemoveBackground = (enabled: boolean) => {
        if (!previewEntry) return;
        const id = previewEntry.id;
        setBgRemoved((prev) => ({ ...prev, [id]: enabled }));
        // Turning it on again retries a failed image.
        setCutoutFailed(null);
        if (enabled) BackgroundRemover.load();
    };

    // Shortcuts: E eraser, B brush, Esc to put the tool down,
    // Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo. Matched by physical key
    // (e.code), so they work with any keyboard layout (e.g. Ukrainian).
    const shortcutsRef = useRef({
        selectPaintTool,
        undoStroke,
        redoStroke,
        activeTool,
    });
    useEffect(() => {
        shortcutsRef.current = {
            selectPaintTool,
            undoStroke,
            redoStroke,
            activeTool,
        };
    });
    const canUseShortcuts =
        canvasMode !== "results" &&
        previewEntry !== null &&
        !isPreviewModalOpen &&
        !isBgConsentOpen;
    useEffect(() => {
        if (!canUseShortcuts) return;
        const onKey = (e: KeyboardEvent) => {
            const target = e.target;
            if (
                target instanceof Element &&
                target.closest("input, textarea, select, [contenteditable]")
            ) {
                return;
            }
            const shortcuts = shortcutsRef.current;
            if (e.ctrlKey || e.metaKey) {
                if (!shortcuts.activeTool || e.altKey) return;
                const redo =
                    e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey);
                if (e.code !== "KeyZ" && !redo) return;
                e.preventDefault();
                if (redo) shortcuts.redoStroke();
                else shortcuts.undoStroke();
            } else if (e.altKey || e.shiftKey || e.repeat) {
                return;
            } else if (e.code === "KeyE") {
                shortcuts.selectPaintTool("erase");
            } else if (e.code === "KeyB") {
                shortcuts.selectPaintTool("brush");
            } else if (e.key === "Escape" && shortcuts.activeTool) {
                setPaintTool(null);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [canUseShortcuts]);

    useEffect(() => {
        if (!previewSource) {
            setPreviewUrl(null);
            return;
        }
        setPreviewNatural(null);
        const url = URL.createObjectURL(previewSource);
        setPreviewUrl(url);
        const probe = new Image();
        probe.onload = () =>
            setPreviewNatural({
                width: probe.naturalWidth,
                height: probe.naturalHeight,
            });
        probe.src = url;
        return () => {
            probe.onload = null;
            URL.revokeObjectURL(url);
        };
    }, [previewSource]);

    useEffect(() => {
        if (!selectedProcessedImage) {
            setProcessedPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(selectedProcessedImage.blob);
        setProcessedPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [selectedProcessedImage]);

    const activeCrop =
        (transformMode === "crop" && previewEntry && crops[previewEntry.id]) ||
        CropUtils.FULL;
    const previewCropArea = previewNatural
        ? CropUtils.getArea(
              previewNatural.width,
              previewNatural.height,
              activeCrop,
          )
        : null;
    const previewOutputSize = previewCropArea
        ? calculateOutputSize(
              previewCropArea.width,
              previewCropArea.height,
              transformMode === "size" ? options.maxWidth : undefined,
              transformMode === "size" ? options.maxHeight : undefined,
          )
        : null;

    /** Frame width that fits the output size into the given max bounds. */
    const getFrameWidth = (maxWidth: string, maxHeight: string) =>
        previewOutputSize
            ? `min(${previewOutputSize.width}px, ${maxWidth}, calc(${maxHeight} * ${
                  previewOutputSize.width / previewOutputSize.height
              }))`
            : undefined;

    const getScaledRadius = (frameWidth: number): string => {
        if (activeRadius === 9999) return "9999px";
        const scale =
            previewOutputSize && frameWidth > 0
                ? Math.min(1, frameWidth / previewOutputSize.width)
                : 1;
        return `${Math.round(activeRadius * scale)}px`;
    };

    const getAspectRatio = (aspect: CropAspect): number | null => {
        if (aspect === "original") {
            return previewNatural
                ? previewNatural.width / previewNatural.height
                : null;
        }
        return (
            CROP_ASPECT_PRESETS.find((p) => p.value === aspect)?.ratio ?? null
        );
    };
    const cropRatio = getAspectRatio(cropAspect);

    const updateCrop = (next: CropRect) => {
        if (!previewEntry) return;
        const id = previewEntry.id;
        setCrops((prev) => {
            const rest = { ...prev };
            delete rest[id];
            return CropUtils.isFull(next) ? rest : { ...rest, [id]: next };
        });
    };

    const selectCropAspect = (aspect: CropAspect) => {
        setCropAspect(aspect);
        const ratio = getAspectRatio(aspect);
        if (ratio && previewNatural) {
            updateCrop(
                CropUtils.fitAspect(
                    ratio,
                    previewNatural.width,
                    previewNatural.height,
                ),
            );
        }
    };

    const selectTransformMode = (mode: "crop" | "size") => {
        setTransformMode(mode);
        if (mode === "crop") setCanvasMode("crop");
        else setCanvasMode((prev) => (prev === "crop" ? "preview" : prev));
    };

    /** Sets the radius for the selected images, or only the previewed one. */
    const applyCornerRadius = (value: number, toSelected: boolean) => {
        const ids = toSelected
            ? files.filter((f) => f.selected).map((f) => f.id)
            : previewEntry
              ? [previewEntry.id]
              : [];
        if (ids.length === 0) {
            setOptions({ ...options, cornerRadius: value });
            return;
        }
        setRadii((prev) => {
            const next = { ...prev };
            for (const id of ids) next[id] = value;
            return next;
        });
    };

    const setCornerRadius = (value: number) =>
        applyCornerRadius(value, radiusForSelected);

    /** Checking "same for selected" copies the current value to them. */
    const toggleRadiusForSelected = (forSelected: boolean) => {
        if (forSelected) applyCornerRadius(activeRadius, true);
        setRadiusForSelected(forSelected);
    };

    const resetCrop = () => {
        setCropAspect("free");
        updateCrop(CropUtils.FULL);
    };

    const selectPreviewFile = (id: string) => {
        setPreviewFileId(id);
        setCanvasMode((prev) => (prev === "crop" ? "crop" : "preview"));
        setPane("canvas");
    };

    const openPreviewModal = () => {
        resetModalZoom();
        setIsPreviewModalOpen(true);
    };

    const openProcessedPreview = (image: ProcessedImage) => {
        resetModalZoom();
        setSelectedProcessedImage(image);
    };

    const openFileDialog = () => {
        fileInputRef.current?.click();
    };

    const resetResults = () => {
        setProcessedImages([]);
        setProgress(0);
        setProgressCount(null);
        setCanvasMode("preview");
    };

    const resetOptions = () => {
        setOptions({ ...DEFAULT_OPTIONS });
        setQualityMode("auto");
        setRadii({});
        setBgRemoved({});
        setRadiusForSelected(true);
        setCrops({});
        setCropAspect("free");
        setTransformMode("size");
    };

    const addFiles = useCallback(
        async (incomingFiles: File[]) => {
            const rawImages: File[] = [];
            const archiveFiles: File[] = [];

            for (const file of incomingFiles) {
                if (ArchiveUtils.isArchive(file)) {
                    archiveFiles.push(file);
                } else if (ArchiveUtils.isImageFile(file.name, file.type)) {
                    rawImages.push(file);
                }
            }

            let extractedCount = 0;
            if (archiveFiles.length > 0) {
                const toastId = toast.loading(t.imageTools.toast.unzipping);
                try {
                    for (const arc of archiveFiles) {
                        const imagesFromArchive =
                            await ArchiveUtils.extractImagesFromArchive(arc);
                        if (imagesFromArchive.length > 0) {
                            extractedCount += imagesFromArchive.length;
                            rawImages.push(...imagesFromArchive);
                        }
                    }
                    toast.dismiss(toastId);
                    if (extractedCount === 0 && rawImages.length === 0) {
                        toast.warn(t.imageTools.toast.noImagesInZip);
                        return;
                    }
                } catch {
                    toast.dismiss(toastId);
                    toast.error(t.imageTools.toast.error);
                }
            }

            if (rawImages.length === 0) return;

            const newEntries = rawImages.map((file) => ({
                file,
                id: crypto.randomUUID(),
                selected: true,
            }));
            setFiles(newEntries);
            setCrops({});
            setRadii({});
            setBgRemoved({});
            setPaints({});
            setRedos({});
            setPreviewFileId(null);
            setCanvasMode("preview");
            setPane("canvas");
            resetResults();

            if (extractedCount > 0) {
                toast.success(
                    `${t.imageTools.toast.unzippedCount} ${extractedCount}`,
                );
            } else if (rawImages.length === 1) {
                toast.success(t.imageTools.toast.uploadedSingle);
            } else {
                toast.success(
                    `${t.imageTools.toast.uploadedCount} ${rawImages.length}`,
                );
            }
        },
        [t],
    );

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const incoming = Array.from(e.target.files);
        addFiles(incoming);
        e.target.value = "";
    };

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            dragDepthRef.current = 0;
            setIsDragging(false);
            if (!e.dataTransfer.files) return;
            const incoming = Array.from(e.dataTransfer.files);
            addFiles(incoming);
        },
        [addFiles],
    );

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        if (!e.dataTransfer?.types?.includes("Files")) return;
        dragDepthRef.current += 1;
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setIsDragging(false);
    };

    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const clipboardData = e.clipboardData;
            if (!clipboardData) return;

            const candidateFiles: File[] = [];

            // 1. Extract all files from clipboardData.items
            if (clipboardData.items && clipboardData.items.length > 0) {
                for (let i = 0; i < clipboardData.items.length; i++) {
                    const item = clipboardData.items[i];
                    if (item.kind === "file") {
                        const file = item.getAsFile();
                        if (file) {
                            candidateFiles.push(file);
                        }
                    }
                }
            }

            // 2. Extract all files from clipboardData.files
            if (clipboardData.files && clipboardData.files.length > 0) {
                for (let i = 0; i < clipboardData.files.length; i++) {
                    const file = clipboardData.files[i];
                    if (file) {
                        candidateFiles.push(file);
                    }
                }
            }

            // 3. Filter valid image & archive files and deduplicate
            const seen = new Set<string>();
            const validFiles: File[] = [];

            for (const file of candidateFiles) {
                const isValid =
                    ArchiveUtils.isImageFile(file.name, file.type) ||
                    ArchiveUtils.isArchive(file);

                if (isValid) {
                    const key = `${file.name}_${file.size}_${file.lastModified}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        validFiles.push(file);
                    }
                }
            }

            if (validFiles.length > 0) {
                e.preventDefault();
                addFiles(validFiles);
            }
        };

        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [addFiles]);

    const toggleFileSelection = (id: string) => {
        setFiles((prev) =>
            prev.map((f) =>
                f.id === id ? { ...f, selected: !f.selected } : f,
            ),
        );
    };

    const toggleAllSelection = () => {
        const allSelected = files.every((f) => f.selected);
        setFiles((prev) => prev.map((f) => ({ ...f, selected: !allSelected })));
    };

    const processImages = async () => {
        const selectedEntries = files.filter((f) => f.selected);
        const selectedFiles = selectedEntries.map((f) => f.file);
        if (selectedFiles.length === 0) return;

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsProcessing(true);
        setProgress(0);
        setProgressCount(null);

        try {
            const processingOptions: ImageProcessingOptions = {
                ...options,
                quality: qualityMode === "manual" ? options.quality : undefined,
                maxSizeKB:
                    qualityMode === "auto" ? options.maxSizeKB : undefined,
                maxWidth:
                    transformMode === "size" ? options.maxWidth : undefined,
                maxHeight:
                    transformMode === "size" ? options.maxHeight : undefined,
            };

            const processed = await ImageProcessor.processImages(
                selectedFiles,
                processingOptions,
                (current, total) => {
                    setProgress((current / total) * 100);
                    setProgressCount({ current, total });
                },
                controller.signal,
                selectedEntries.map((f) => {
                    const extra: Partial<ImageProcessingOptions> = {};
                    if (transformMode === "crop" && crops[f.id]) {
                        extra.crop = crops[f.id];
                    }
                    if (radii[f.id] !== undefined) {
                        extra.cornerRadius = radii[f.id];
                    }
                    if (bgRemoved[f.id]) extra.removeBackground = true;
                    if (paints[f.id]?.length) extra.strokes = paints[f.id];
                    return extra;
                }),
            );

            if (controller.signal.aborted) {
                if (processed.length > 0) {
                    setProcessedImages(processed);
                    setCanvasMode("results");
                    setPane("canvas");
                    toast.info(
                        `${t.imageTools.toast.cancelled} ${processed.length}/${selectedFiles.length}`,
                    );
                } else {
                    toast.info(t.imageTools.toast.cancelledAll);
                }
            } else if (processed.length === 0) {
                // Every file failed (e.g. the background model didn't load).
                toast.error(t.imageTools.toast.error);
            } else {
                setProcessedImages(processed);
                setCanvasMode("results");
                setPane("canvas");
                toast.success(t.imageTools.toast.success);
            }
        } catch {
            toast.error(t.imageTools.toast.error);
        } finally {
            setIsProcessing(false);
            abortControllerRef.current = null;
        }
    };

    const cancelProcessing = () => {
        abortControllerRef.current?.abort();
    };

    const downloadAll = () => {
        try {
            processedImages.forEach((img) => ImageProcessor.downloadImage(img));
            toast.success(t.imageTools.toast.downloadSuccess);
        } catch {
            toast.error(t.imageTools.toast.downloadError);
        }
    };

    const downloadZip = async () => {
        if (processedImages.length === 0) return;
        setIsCreatingZip(true);
        try {
            await ArchiveUtils.downloadZip(
                processedImages,
                `ceratora_processed_${Date.now()}.zip`,
            );
            toast.success(t.imageTools.toast.zipDownloadSuccess);
        } catch {
            toast.error(t.imageTools.toast.zipDownloadError);
        } finally {
            setIsCreatingZip(false);
        }
    };

    const clearAll = () => {
        setFiles([]);
        setCrops({});
        setRadii({});
        setBgRemoved({});
        setPaints({});
        setRedos({});
        setPreviewFileId(null);
        resetResults();
    };

    const clearSelected = () => {
        setFiles((prev) => prev.filter((f) => !f.selected));
        setPreviewFileId((prev) => {
            const remaining = files.filter((f) => !f.selected);
            return remaining.some((f) => f.id === prev) ? prev : null;
        });
        resetResults();
    };

    const removeFile = (id: string) => {
        setFiles((prev) => prev.filter((f) => f.id !== id));
        setPreviewFileId((prev) => (prev === id ? null : prev));
        resetResults();
    };

    const selectedCount = files.filter((f) => f.selected).length;
    const allSelected = files.length > 0 && files.every((f) => f.selected);
    const someSelected = files.some((f) => f.selected);
    const activeRadius = previewEntry
        ? (radii[previewEntry.id] ?? options.cornerRadius ?? 0)
        : (options.cornerRadius ?? 0);

    const totalOriginalSize = processedImages.reduce(
        (sum, img) => sum + img.originalSize,
        0,
    );
    const totalProcessedSize = processedImages.reduce(
        (sum, img) => sum + img.size,
        0,
    );
    const totalReduction =
        totalOriginalSize > 0
            ? Math.round(
                  ((totalOriginalSize - totalProcessedSize) /
                      totalOriginalSize) *
                      100,
              )
            : 0;

    const croppedSelectedCount =
        transformMode === "crop"
            ? files.filter((f) => f.selected && crops[f.id]).length
            : 0;
    const optionsSummary = [
        qualityMode === "manual"
            ? `${t.imageTools.format.quality} ${options.quality}%`
            : `≤ ${options.maxSizeKB ?? 0} KB`,
        croppedSelectedCount > 0
            ? `${t.imageTools.crop.tab}: ${croppedSelectedCount}`
            : null,
    ]
        .filter(Boolean)
        .join(" · ");

    const paneOptions = [
        {
            value: "sources" as const,
            label: t.workspace.sources,
            icon: FolderOpen,
        },
        {
            value: "canvas" as const,
            label: t.workspace.canvas,
            icon: ImageIcon,
        },
        {
            value: "settings" as const,
            label: t.imageTools.settings.title,
            icon: SlidersHorizontal,
        },
    ];

    return (
        <div
            className="relative flex h-full min-h-0 flex-col"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
        >
            {/* Pane switcher (small screens only) */}
            <div className="flex h-12 shrink-0 items-center gap-1 border-b px-3 xl:hidden">
                {paneOptions.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => setPane(option.value)}
                        aria-pressed={pane === option.value}
                        className={cn(
                            "flex flex-1 items-center justify-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                            pane === option.value
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                        )}
                    >
                        <option.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{option.label}</span>
                    </button>
                ))}
            </div>

            {/* Workspace body */}
            <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
                {/* Sources */}
                <aside
                    className={cn(
                        "min-h-0 flex-1 flex-col overflow-hidden xl:flex xl:w-80 xl:flex-none xl:border-r",
                        pane === "sources" ? "flex" : "hidden",
                    )}
                >
                    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
                        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <FolderOpen className="h-3.5 w-3.5" />
                            {t.workspace.sources}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {files.length}
                        </span>
                    </div>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={openFileDialog}
                        >
                            <Plus className="h-4 w-4" />
                            {files.length > 0
                                ? t.workspace.replace
                                : t.workspace.import}
                        </Button>

                        {files.length > 0 ? (
                            <>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            checked={
                                                allSelected
                                                    ? true
                                                    : someSelected
                                                      ? "indeterminate"
                                                      : false
                                            }
                                            onCheckedChange={
                                                toggleAllSelection
                                            }
                                            aria-label={
                                                t.imageTools.upload.selectAll
                                            }
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            {selectedCount}{" "}
                                            {t.imageTools.upload.of}{" "}
                                            {files.length}
                                        </span>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                aria-label={
                                                    t.imageTools.upload.clearAll
                                                }
                                            >
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={clearSelected}
                                                disabled={selectedCount === 0}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                {
                                                    t.imageTools.upload
                                                        .deleteSelected
                                                }
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={clearAll}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                {t.imageTools.upload.clearAll}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-2">
                                    {files.map((file) => (
                                        <SourceCard
                                            key={file.id}
                                            file={file.file}
                                            selected={file.selected}
                                            isPreview={
                                                previewEntry?.id === file.id
                                            }
                                            isCropped={
                                                transformMode === "crop" &&
                                                Boolean(crops[file.id])
                                            }
                                            onToggle={() =>
                                                toggleFileSelection(file.id)
                                            }
                                            onPreview={() =>
                                                selectPreviewFile(file.id)
                                            }
                                            onRemove={() =>
                                                removeFile(file.id)
                                            }
                                            previewLabel={
                                                t.workspace.previewSource
                                            }
                                            removeLabel={
                                                t.imageTools.upload.removeFile
                                            }
                                            croppedLabel={t.imageTools.crop.tab}
                                        />
                                    ))}
                                </div>
                            </>
                        ) : (
                            <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                                {t.workspace.dropToStart}
                            </p>
                        )}
                    </div>
                </aside>

                {/* Canvas: preview / results */}
                <section
                    className={cn(
                        "relative min-h-0 flex-1 flex-col overflow-hidden xl:flex",
                        pane === "canvas" ? "flex" : "hidden",
                    )}
                >
                    <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 xl:h-12 xl:flex-nowrap xl:gap-3 xl:overflow-hidden xl:px-4 xl:py-0">
                        <div className="inline-flex shrink-0 items-center rounded-lg border bg-muted/40 p-0.5">
                            <button
                                type="button"
                                onClick={() => setCanvasMode("preview")}
                                className={cn(
                                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                                    canvasMode === "preview"
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {t.imageTools.style.preview}
                            </button>
                            <button
                                type="button"
                                onClick={() => selectTransformMode("crop")}
                                className={cn(
                                    "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors",
                                    canvasMode === "crop"
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                <Crop className="h-3.5 w-3.5" />
                                {t.imageTools.crop.tab}
                            </button>
                            <button
                                type="button"
                                onClick={() => setCanvasMode("results")}
                                className={cn(
                                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                                    canvasMode === "results"
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {t.imageTools.results.title}
                            </button>
                        </div>

                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                            {canvasMode !== "results"
                                ? previewEntry
                                    ? previewEntry.file.name
                                    : t.imageTools.style.previewEmpty
                                : processedImages.length > 0
                                  ? `${t.imageTools.results.total}: ${formatFileSize(
                                        totalOriginalSize,
                                    )} → ${formatFileSize(
                                        totalProcessedSize,
                                    )} (${
                                        totalReduction >= 0 ? "−" : "+"
                                    }${Math.abs(totalReduction)}%)`
                                  : t.imageTools.results.description}
                        </span>

                        {canvasMode !== "results" && previewEntry && (
                            <div className="flex shrink-0 items-center gap-2">
                                {activeTool && (
                                    <div
                                        className="flex items-center gap-2"
                                        title={t.imageTools.paint.size}
                                    >
                                        <Slider
                                            className="w-24"
                                            min={2}
                                            max={200}
                                            step={1}
                                            value={[brushSize]}
                                            onValueChange={([value]) =>
                                                setBrushSize(value)
                                            }
                                            aria-label={t.imageTools.paint.size}
                                        />
                                        <span className="w-7 text-right font-mono text-xs text-muted-foreground">
                                            {brushSize}
                                        </span>
                                    </div>
                                )}
                                {activeTool === "brush" && (
                                    <label
                                        className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-full border shadow-sm"
                                        style={{ backgroundColor: brushColor }}
                                        title={t.imageTools.paint.color}
                                    >
                                        <input
                                            type="color"
                                            value={brushColor}
                                            onChange={(e) =>
                                                setBrushColor(e.target.value)
                                            }
                                            aria-label={
                                                t.imageTools.paint.color
                                            }
                                            className="absolute inset-0 cursor-pointer opacity-0"
                                        />
                                    </label>
                                )}
                                <div
                                    role="toolbar"
                                    aria-label={t.imageTools.paint.tools}
                                    className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5"
                                >
                                    <ToolButton
                                        icon={Eraser}
                                        label={t.imageTools.paint.eraser}
                                        shortcut="E"
                                        active={activeTool === "erase"}
                                        onClick={() => selectPaintTool("erase")}
                                    />
                                    <ToolButton
                                        icon={Brush}
                                        label={t.imageTools.paint.brush}
                                        shortcut="B"
                                        active={activeTool === "brush"}
                                        onClick={() => selectPaintTool("brush")}
                                    />
                                    <div className="mx-0.5 h-4 w-px bg-border" />
                                    <ToolButton
                                        icon={Undo2}
                                        label={t.imageTools.paint.undo}
                                        shortcut="Ctrl+Z"
                                        disabled={previewStrokes.length === 0}
                                        onClick={undoStroke}
                                    />
                                    <ToolButton
                                        icon={Redo2}
                                        label={t.imageTools.paint.redo}
                                        shortcut="Ctrl+Shift+Z"
                                        disabled={previewRedos.length === 0}
                                        onClick={redoStroke}
                                    />
                                    <ToolButton
                                        icon={Trash2}
                                        label={t.imageTools.paint.clear}
                                        disabled={previewStrokes.length === 0}
                                        onClick={clearStrokes}
                                    />
                                </div>
                            </div>
                        )}

                        {canvasMode === "results" &&
                            processedImages.length > 0 && (
                                <div className="flex shrink-0 items-center gap-2">
                                    {processedImages.length > 10 ? (
                                        <Button
                                            onClick={downloadZip}
                                            disabled={isCreatingZip}
                                            size="sm"
                                            title={
                                                t.imageTools.results
                                                    .zipOnlyNotice
                                            }
                                        >
                                            <FolderArchive className="h-4 w-4 mr-2" />
                                            {isCreatingZip
                                                ? "..."
                                                : t.imageTools.results
                                                      .downloadZip}
                                        </Button>
                                    ) : processedImages.length > 1 ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                onClick={downloadAll}
                                                size="sm"
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                {
                                                    t.imageTools.results
                                                        .downloadAll
                                                }
                                            </Button>
                                            <Button
                                                onClick={downloadZip}
                                                disabled={isCreatingZip}
                                                size="sm"
                                            >
                                                <FolderArchive className="h-4 w-4 mr-2" />
                                                {isCreatingZip ? "..." : "ZIP"}
                                            </Button>
                                        </>
                                    ) : (
                                        <Button onClick={downloadAll} size="sm">
                                            <Download className="h-4 w-4 mr-2" />
                                            {t.imageTools.results.download}
                                        </Button>
                                    )}
                                </div>
                            )}
                    </div>

                    <div
                        ref={attachCanvasViewport}
                        {...canvasPanHandlers}
                        className={cn(
                            "min-h-0 flex-1 overflow-auto",
                            canvasMode !== "results" &&
                                viewZoom > 1 &&
                                "cursor-grab select-none active:cursor-grabbing",
                        )}
                    >
                        {canvasMode === "results" ? (
                            <div className="p-4">
                                {processedImages.length > 0 ? (
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-4">
                                        {processedImages.map((img, idx) => (
                                            <ResultCard
                                                key={`${img.fileName}-${idx}`}
                                                image={img}
                                                onOpen={() =>
                                                    openProcessedPreview(img)
                                                }
                                                previewLabel={
                                                    t.imageTools.results.preview
                                                }
                                                previewAriaLabel={
                                                    t.imageTools.results
                                                        .previewFile
                                                }
                                                downloadLabel={
                                                    t.imageTools.results
                                                        .download
                                                }
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-input p-10 text-center xl:h-full">
                                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                        </span>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium">
                                                {t.imageTools.results
                                                    .willAppear}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {
                                                    t.imageTools.results
                                                        .description
                                                }
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex min-h-80 items-center-safe justify-center px-6 pt-6 pb-20 xl:min-h-full">
                                {(previewUrl || isRemovingBg) &&
                                previewEntry ? (
                                    <div className="flex w-full flex-col items-center-safe gap-4">
                                        {isRemovingBg ? (
                                            <div className="flex h-60 w-full max-w-sm flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                                <p className="text-sm font-medium">
                                                    {bgStatus.state ===
                                                    "loading"
                                                        ? `${t.imageTools.background.loading} ${Math.round(bgStatus.progress)}%`
                                                        : t.imageTools
                                                              .background
                                                              .processing}
                                                </p>
                                                {bgStatus.state ===
                                                    "loading" && (
                                                    <Progress
                                                        value={
                                                            bgStatus.progress
                                                        }
                                                        className="w-48"
                                                    />
                                                )}
                                            </div>
                                        ) : !previewUrl || !previewNatural ? (
                                            <div className="h-40 w-40 animate-pulse rounded-md bg-muted" />
                                        ) : canvasMode === "crop" ? (
                                            <CropEditor
                                                src={previewUrl}
                                                alt={previewEntry.file.name}
                                                natural={previewNatural}
                                                crop={activeCrop}
                                                aspect={cropRatio}
                                                onChange={updateCrop}
                                                zoom={viewZoom}
                                                onZoomChange={changeViewZoom}
                                                areaLabel={
                                                    t.imageTools.crop.area
                                                }
                                            />
                                        ) : (
                                            <div
                                                ref={setPreviewFrame}
                                                role="button"
                                                tabIndex={0}
                                                title={
                                                    t.imageTools.style.preview
                                                }
                                                aria-label={
                                                    t.imageTools.style.preview
                                                }
                                                onClick={
                                                    activeTool
                                                        ? undefined
                                                        : openPreviewModal
                                                }
                                                onKeyDown={(e) => {
                                                    if (
                                                        e.key === "Enter" ||
                                                        e.key === " "
                                                    ) {
                                                        e.preventDefault();
                                                        openPreviewModal();
                                                    }
                                                }}
                                                className={cn(
                                                    "relative shrink-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                    !activeTool &&
                                                        "cursor-zoom-in",
                                                )}
                                                style={{
                                                    width: `calc(${getFrameWidth(
                                                        "100%",
                                                        "65vh",
                                                    )} * ${viewZoom})`,
                                                    aspectRatio:
                                                        previewOutputSize
                                                            ? `${previewOutputSize.width} / ${previewOutputSize.height}`
                                                            : undefined,
                                                    borderRadius:
                                                        getScaledRadius(
                                                            previewFrameWidth,
                                                        ),
                                                    boxShadow:
                                                        "0 0 0 1px var(--border)",
                                                    ...((removeBg ||
                                                        hasErased) &&
                                                        CHECKERBOARD_STYLE),
                                                }}
                                            >
                                                {activeTool ||
                                                previewStrokes.length > 0 ? (
                                                    <PaintLayer
                                                        src={previewUrl}
                                                        alt={
                                                            previewEntry.file
                                                                .name
                                                        }
                                                        natural={previewNatural}
                                                        strokes={previewStrokes}
                                                        tool={activeTool}
                                                        color={brushColor}
                                                        size={brushSize}
                                                        onStroke={addStroke}
                                                        className="absolute max-w-none"
                                                        style={getCropImageStyle(
                                                            activeCrop,
                                                        )}
                                                    />
                                                ) : (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={previewUrl}
                                                        alt={
                                                            previewEntry.file
                                                                .name
                                                        }
                                                        draggable={false}
                                                        className="absolute max-w-none"
                                                        style={getCropImageStyle(
                                                            activeCrop,
                                                        )}
                                                    />
                                                )}
                                            </div>
                                        )}
                                        {canvasMode === "crop" && (
                                            <p className="max-w-md text-center text-xs text-muted-foreground">
                                                {t.imageTools.crop.hint}
                                            </p>
                                        )}
                                        {previewFileId === null &&
                                            files.length > 1 && (
                                                <p className="text-xs text-muted-foreground">
                                                    {t.workspace.pickPreview}
                                                </p>
                                            )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-input p-10 text-center">
                                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                        </span>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium">
                                                {t.imageTools.style
                                                    .previewEmpty}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {t.imageTools.style.description}
                                            </p>
                                        </div>
                                        <Button onClick={openFileDialog}>
                                            <Plus className="h-4 w-4" />
                                            {t.workspace.import}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    {canvasMode !== "results" && previewUrl && previewEntry && (
                        <div className="absolute inset-x-0 bottom-3 z-10 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs whitespace-nowrap shadow-sm *:shrink-0">
                            <span
                                className="max-w-45 min-w-0 shrink! truncate font-medium"
                                title={previewEntry.file.name}
                            >
                                {previewEntry.file.name}
                            </span>
                            {previewNatural && previewOutputSize && (
                                <>
                                    <div className="hidden h-3 w-px bg-border sm:block" />
                                    <span className="text-muted-foreground">
                                        {previewNatural.width !==
                                            previewOutputSize.width ||
                                        previewNatural.height !==
                                            previewOutputSize.height
                                            ? `${previewNatural.width}×${previewNatural.height} → ${previewOutputSize.width}×${previewOutputSize.height}`
                                            : `${previewOutputSize.width}×${previewOutputSize.height}`}
                                    </span>
                                </>
                            )}
                            <div className="hidden h-3 w-px bg-border sm:block" />
                            <span className="text-muted-foreground">
                                {formatFileSize(previewEntry.file.size)}
                            </span>
                            <div className="hidden h-3 w-px bg-border sm:block" />
                            <ZoomControls
                                zoom={viewZoom}
                                max={CANVAS_ZOOM_MAX}
                                onZoom={changeViewZoom}
                                labels={zoomLabels}
                            />
                            <div className="hidden h-3 w-px bg-border sm:block" />
                            {canvasMode === "crop" ? (
                                <button
                                    type="button"
                                    onClick={resetCrop}
                                    disabled={!crops[previewEntry.id]}
                                    aria-label={t.imageTools.crop.reset}
                                    title={t.imageTools.crop.reset}
                                    className="text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={openPreviewModal}
                                    aria-label={t.imageTools.style.preview}
                                    title={t.imageTools.style.preview}
                                    className="text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    <Maximize2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                </section>

                {/* Inspector */}
                <aside
                    className={cn(
                        "min-h-0 flex-1 flex-col overflow-hidden xl:flex xl:w-80 xl:flex-none xl:border-l",
                        pane === "settings" ? "flex" : "hidden",
                    )}
                >
                    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
                        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                            {t.imageTools.settings.title}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground"
                            title={t.imageTools.settings.reset}
                            aria-label={t.imageTools.settings.reset}
                            onClick={resetOptions}
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                        <SettingSection
                            icon={FileImage}
                            title={t.imageTools.format.tab}
                        >
                            <div className="grid grid-cols-3 gap-2">
                                {(["webp", "png", "jpeg"] as const).map(
                                    (fmt) => (
                                        <Button
                                            key={fmt}
                                            variant={
                                                options.format === fmt
                                                    ? "default"
                                                    : "outline"
                                            }
                                            size="sm"
                                            onClick={() =>
                                                setOptions({
                                                    ...options,
                                                    format: fmt,
                                                })
                                            }
                                        >
                                            {fmt.toUpperCase()}
                                        </Button>
                                    ),
                                )}
                            </div>
                        </SettingSection>

                        <div className="h-px bg-border" />

                        <SettingSection
                            icon={SlidersHorizontal}
                            title={t.imageTools.format.quality}
                        >
                            <RadioGroup
                                value={qualityMode}
                                onValueChange={(v) => {
                                    const mode = v as "manual" | "auto";
                                    setQualityMode(mode);
                                    if (mode === "auto" && !options.maxSizeKB) {
                                        setOptions({
                                            ...options,
                                            maxSizeKB: 35,
                                        });
                                    }
                                }}
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="manual" id="manual" />
                                    <Label
                                        htmlFor="manual"
                                        className="font-normal cursor-pointer"
                                    >
                                        {t.imageTools.format.manual}
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="auto" id="auto" />
                                    <Label
                                        htmlFor="auto"
                                        className="font-normal cursor-pointer"
                                    >
                                        {t.imageTools.format.auto}
                                    </Label>
                                </div>
                            </RadioGroup>

                            {qualityMode === "manual" ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <Label>
                                            {t.imageTools.format.quality}
                                        </Label>
                                        <span className="font-mono font-medium">
                                            {options.quality}%
                                        </span>
                                    </div>
                                    <Slider
                                        value={[options.quality ?? 80]}
                                        onValueChange={([value]) =>
                                            setOptions({
                                                ...options,
                                                quality: value,
                                            })
                                        }
                                        min={1}
                                        max={100}
                                        step={1}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t.imageTools.format.recommended}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label htmlFor="maxSizeKB">
                                        {t.imageTools.format.maxSize}
                                    </Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Button
                                            variant={
                                                options.maxSizeKB === 35
                                                    ? "default"
                                                    : "outline"
                                            }
                                            size="sm"
                                            className="px-1 text-xs"
                                            onClick={() =>
                                                setOptions({
                                                    ...options,
                                                    maxSizeKB: 35,
                                                })
                                            }
                                        >
                                            35 KB
                                        </Button>
                                        <Button
                                            variant={
                                                options.maxSizeKB === 100
                                                    ? "default"
                                                    : "outline"
                                            }
                                            size="sm"
                                            className="px-1 text-xs"
                                            onClick={() =>
                                                setOptions({
                                                    ...options,
                                                    maxSizeKB: 100,
                                                })
                                            }
                                        >
                                            100 KB
                                        </Button>
                                        <Button
                                            variant={
                                                options.maxSizeKB === undefined
                                                    ? "default"
                                                    : "outline"
                                            }
                                            size="sm"
                                            className="px-1 text-xs"
                                            onClick={() =>
                                                setOptions({
                                                    ...options,
                                                    maxSizeKB: undefined,
                                                })
                                            }
                                        >
                                            {t.imageTools.format.noLimit}
                                        </Button>
                                    </div>
                                    <Input
                                        id="maxSizeKB"
                                        type="number"
                                        placeholder={
                                            t.imageTools.format.placeholder
                                        }
                                        value={options.maxSizeKB ?? ""}
                                        onChange={(e) =>
                                            setOptions({
                                                ...options,
                                                maxSizeKB: e.target.value
                                                    ? Number(e.target.value)
                                                    : undefined,
                                            })
                                        }
                                        min={1}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t.imageTools.format.autoDescription}
                                    </p>
                                </div>
                            )}
                        </SettingSection>

                        <div className="h-px bg-border" />

                        <SettingSection
                            icon={Eraser}
                            title={t.imageTools.background.tab}
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={handleRemoveBackgroundClick}
                                disabled={
                                    files.length === 0 ||
                                    (!removeBg && bgStatus.state === "loading")
                                }
                            >
                                {removeBg ? (
                                    <RotateCcw className="h-4 w-4" />
                                ) : (
                                    <Eraser className="h-4 w-4" />
                                )}
                                {removeBg
                                    ? t.imageTools.background.restore
                                    : t.imageTools.background.remove}
                            </Button>

                            {bgStatus.state === "loading" && (
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>
                                            {t.imageTools.background.loading}
                                        </span>
                                        <span className="font-mono">
                                            {Math.round(bgStatus.progress)}%
                                        </span>
                                    </div>
                                    <Progress value={bgStatus.progress} />
                                </div>
                            )}
                            {bgStatus.state === "error" && (
                                <p
                                    className="text-xs text-destructive"
                                    title={bgStatus.error}
                                >
                                    {t.imageTools.background.error}
                                </p>
                            )}
                            {removeBg && options.format === "jpeg" && (
                                <p className="text-xs text-destructive">
                                    {t.imageTools.background.jpegWarning}
                                </p>
                            )}
                        </SettingSection>

                        <div className="h-px bg-border" />

                        <SettingSection
                            icon={Circle}
                            title={t.imageTools.style.tab}
                        >
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="radiusForSelected"
                                    checked={radiusForSelected}
                                    onCheckedChange={(checked) =>
                                        toggleRadiusForSelected(
                                            checked === true,
                                        )
                                    }
                                />
                                <Label
                                    htmlFor="radiusForSelected"
                                    className="cursor-pointer font-normal"
                                >
                                    {t.imageTools.style.applyToSelected}
                                    {files.length > 0 && ` (${selectedCount})`}
                                </Label>
                            </div>
                            {!radiusForSelected && previewEntry && (
                                <p className="truncate text-xs text-muted-foreground">
                                    {t.imageTools.style.perImage}{" "}
                                    <span className="font-medium text-foreground">
                                        {previewEntry.file.name}
                                    </span>
                                </p>
                            )}
                            <div className="grid grid-cols-4 gap-1">
                                {CORNER_RADIUS_PRESETS.map((preset) => (
                                    <Button
                                        key={preset.value}
                                        variant={
                                            activeRadius === preset.value
                                                ? "default"
                                                : "outline"
                                        }
                                        size="sm"
                                        className="text-xs px-1"
                                        onClick={() =>
                                            setCornerRadius(preset.value)
                                        }
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                            </div>

                            <div className="flex items-center gap-3">
                                <Input
                                    type="number"
                                    min={0}
                                    max={500}
                                    value={
                                        activeRadius === 9999
                                            ? ""
                                            : activeRadius
                                    }
                                    placeholder={
                                        activeRadius === 9999 ? "Full" : "0"
                                    }
                                    onChange={(e) =>
                                        setCornerRadius(
                                            Number(e.target.value) || 0,
                                        )
                                    }
                                    className="w-24"
                                    aria-label={t.imageTools.style.cornerRadius}
                                />
                                <div className="flex-1">
                                    <Slider
                                        value={[Math.min(activeRadius, 500)]}
                                        onValueChange={([value]) =>
                                            setCornerRadius(value)
                                        }
                                        min={0}
                                        max={500}
                                        step={1}
                                    />
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground">
                                {t.imageTools.style.description}
                            </p>
                        </SettingSection>

                        <div className="h-px bg-border" />

                        <section className="space-y-3">
                            <div
                                role="tablist"
                                className="grid grid-cols-2 rounded-lg border bg-muted/40 p-0.5"
                            >
                                {(
                                    [
                                        {
                                            value: "crop",
                                            icon: Crop,
                                            label: t.imageTools.crop.tab,
                                        },
                                        {
                                            value: "size",
                                            icon: Maximize2,
                                            label: t.imageTools.size.tab,
                                        },
                                    ] as const
                                ).map((mode) => (
                                    <button
                                        key={mode.value}
                                        type="button"
                                        role="tab"
                                        aria-selected={
                                            transformMode === mode.value
                                        }
                                        onClick={() =>
                                            selectTransformMode(mode.value)
                                        }
                                        className={cn(
                                            "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors",
                                            transformMode === mode.value
                                                ? "bg-background text-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground",
                                        )}
                                    >
                                        <mode.icon className="h-3.5 w-3.5" />
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                            {transformMode === "crop" ? (
                                <div className="space-y-3">
                                    {previewEntry && previewNatural ? (
                                        <>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">
                                                    {t.imageTools.crop.aspect}
                                                </Label>
                                                <div className="grid grid-cols-4 gap-1">
                                                    {CROP_ASPECT_PRESETS.map(
                                                        (preset) => (
                                                            <Button
                                                                key={
                                                                    preset.value
                                                                }
                                                                variant={
                                                                    cropAspect ===
                                                                    preset.value
                                                                        ? "default"
                                                                        : "outline"
                                                                }
                                                                size="sm"
                                                                className="px-1 text-xs"
                                                                onClick={() =>
                                                                    selectCropAspect(
                                                                        preset.value,
                                                                    )
                                                                }
                                                            >
                                                                {preset.value ===
                                                                "free"
                                                                    ? t
                                                                          .imageTools
                                                                          .crop
                                                                          .free
                                                                    : preset.value ===
                                                                        "original"
                                                                      ? t
                                                                            .imageTools
                                                                            .crop
                                                                            .original
                                                                      : preset.value}
                                                            </Button>
                                                        ),
                                                    )}
                                                </div>
                                            </div>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full text-xs"
                                                onClick={resetCrop}
                                                disabled={
                                                    !crops[previewEntry.id]
                                                }
                                            >
                                                <RotateCcw className="h-4 w-4" />
                                                {t.imageTools.crop.reset}
                                            </Button>

                                            <p className="text-xs text-muted-foreground">
                                                {t.imageTools.crop.description}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            {t.imageTools.crop.noImage}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="maxWidth"
                                            className="text-xs text-muted-foreground"
                                        >
                                            {t.imageTools.size.maxWidth}
                                        </Label>
                                        <Input
                                            id="maxWidth"
                                            type="number"
                                            placeholder={t.imageTools.size.auto}
                                            value={options.maxWidth ?? ""}
                                            onChange={(e) =>
                                                setOptions({
                                                    ...options,
                                                    maxWidth: e.target.value
                                                        ? Number(e.target.value)
                                                        : undefined,
                                                })
                                            }
                                            min={1}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="maxHeight"
                                            className="text-xs text-muted-foreground"
                                        >
                                            {t.imageTools.size.maxHeight}
                                        </Label>
                                        <Input
                                            id="maxHeight"
                                            type="number"
                                            placeholder={t.imageTools.size.auto}
                                            value={options.maxHeight ?? ""}
                                            onChange={(e) =>
                                                setOptions({
                                                    ...options,
                                                    maxHeight: e.target.value
                                                        ? Number(e.target.value)
                                                        : undefined,
                                                })
                                            }
                                            min={1}
                                        />
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                </aside>
            </div>

            {/* Action bar - always visible */}
            <div className="relative flex shrink-0 items-center gap-3 border-t bg-background/95 px-3 py-3 backdrop-blur sm:gap-4 sm:px-4">
                <div className="min-w-0 flex-1">
                    {isProcessing ? (
                        <>
                            <p className="truncate text-sm font-medium">
                                {t.imageTools.process.processing}{" "}
                                {Math.round(progress)}%
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                                {progressCount
                                    ? `${t.imageTools.process.progress} ${progressCount.current} ${t.imageTools.process.of} ${progressCount.total}`
                                    : `${t.imageTools.process.progress}...`}
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="truncate text-sm font-medium">
                                {files.length === 0
                                    ? t.imageTools.process.addFiles
                                    : selectedCount === 0
                                      ? t.imageTools.process.selectFiles
                                      : `${selectedCount} ${
                                            selectedCount === 1
                                                ? t.imageTools.process.image
                                                : t.imageTools.process.images
                                        }`}
                            </p>
                            {selectedCount > 0 && (
                                <p className="truncate text-xs text-muted-foreground">
                                    {(options.format ?? "webp").toUpperCase()}{" "}
                                    · {optionsSummary}
                                </p>
                            )}
                        </>
                    )}
                </div>

                {isProcessing ? (
                    <div className="flex shrink-0 items-center gap-3">
                        <Progress
                            value={progress}
                            className="hidden w-40 sm:block"
                        />
                        <Button variant="outline" onClick={cancelProcessing}>
                            <X className="h-4 w-4 mr-1" />
                            {t.imageTools.process.cancel}
                        </Button>
                    </div>
                ) : (
                    <Button
                        size="lg"
                        className="shrink-0"
                        onClick={processImages}
                        disabled={selectedCount === 0 || isProcessing}
                    >
                        <Sparkles className="h-4 w-4 mr-2" />
                        {t.imageTools.process.button}
                        {selectedCount > 0 && ` (${selectedCount})`}
                    </Button>
                )}
                {isProcessing && (
                    <Progress
                        value={progress}
                        className="absolute right-0 bottom-0 left-0 h-1 rounded-none sm:hidden"
                    />
                )}
            </div>

            {isDragging && (
                <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-primary/5">
                    <div className="rounded-xl border-2 border-dashed border-primary bg-background/90 px-6 py-4 text-sm font-medium text-primary shadow-sm">
                        {t.imageTools.upload.dragActive}
                    </div>
                </div>
            )}

            <Input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.zip,.7z,.rar,.tar,.tar.gz,.tgz,.cbz,application/zip,application/x-zip-compressed,application/x-7z-compressed,application/x-rar-compressed"
                onChange={handleFileSelect}
                className="hidden"
            />

            {isPreviewModalOpen && previewUrl && previewOutputSize && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-6"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t.imageTools.style.preview}
                    onClick={() => setIsPreviewModalOpen(false)}
                >
                    <div
                        className="relative flex flex-col items-center gap-3"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="absolute -top-3 -right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-zinc-800 text-black dark:text-white shadow-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                            onClick={() => setIsPreviewModalOpen(false)}
                            aria-label="Close"
                            autoFocus
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <div
                            ref={attachModalViewport}
                            {...modalPanHandlers}
                            className={cn(
                                "max-h-[82vh] max-w-[90vw] overflow-auto",
                                modalZoom > 1 &&
                                    "cursor-grab select-none active:cursor-grabbing",
                            )}
                        >
                            <div
                                ref={setModalFrame}
                                className="relative shrink-0 overflow-hidden"
                                style={{
                                    width: `calc(${getFrameWidth(
                                        "90vw",
                                        "82vh",
                                    )} * ${modalZoom})`,
                                    aspectRatio: previewOutputSize
                                        ? `${previewOutputSize.width} / ${previewOutputSize.height}`
                                        : undefined,
                                    borderRadius:
                                        getScaledRadius(modalFrameWidth),
                                }}
                            >
                                {previewStrokes.length > 0 && previewNatural ? (
                                    <PaintLayer
                                        src={previewUrl}
                                        alt="preview full"
                                        natural={previewNatural}
                                        strokes={previewStrokes}
                                        className="absolute max-w-none"
                                        style={getCropImageStyle(activeCrop)}
                                    />
                                ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={previewUrl}
                                        alt="preview full"
                                        draggable={false}
                                        className="absolute max-w-none"
                                        style={getCropImageStyle(activeCrop)}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-lg dark:bg-zinc-900">
                            <ZoomControls
                                zoom={modalZoom}
                                max={MODAL_ZOOM_MAX}
                                onZoom={changeModalZoom}
                                labels={zoomLabels}
                            />
                        </div>
                    </div>
                </div>
            )}
            {isBgConsentOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-6"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="bg-consent-title"
                    onClick={() => setIsBgConsentOpen(false)}
                >
                    <div
                        className="w-full max-w-md rounded-xl border bg-background p-6 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                                <Eraser className="h-5 w-5" />
                            </span>
                            <div className="space-y-1">
                                <h2
                                    id="bg-consent-title"
                                    className="text-base font-semibold"
                                >
                                    {t.imageTools.background.consentTitle}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {t.imageTools.background.consentDescription}
                                </p>
                            </div>
                        </div>
                        <ul className="mt-5 space-y-2.5 text-sm">
                            <li className="flex items-center gap-2.5">
                                <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                                {t.imageTools.background.consentSize.replace(
                                    "{size}",
                                    String(
                                        BackgroundRemover.getDownloadSizeMB(),
                                    ),
                                )}
                            </li>
                            <li className="flex items-center gap-2.5">
                                <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                                {t.imageTools.background.consentPrivacy}
                            </li>
                            <li className="flex items-center gap-2.5">
                                <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
                                {t.imageTools.background.consentCache}
                            </li>
                        </ul>
                        <div className="mt-6 flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsBgConsentOpen(false)}
                            >
                                {t.imageTools.background.consentCancel}
                            </Button>
                            <Button onClick={confirmModelDownload} autoFocus>
                                <Download className="h-4 w-4" />
                                {t.imageTools.background.consentConfirm}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {selectedProcessedImage && processedPreviewUrl && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-6"
                    role="dialog"
                    aria-modal="true"
                    aria-label={selectedProcessedImage.fileName}
                    onClick={() => setSelectedProcessedImage(null)}
                >
                    <div
                        className="relative flex flex-col items-center gap-3"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="absolute -top-3 -right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-zinc-800 text-black dark:text-white shadow-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                            onClick={() => setSelectedProcessedImage(null)}
                            aria-label="Close"
                            autoFocus
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <div
                            ref={attachModalViewport}
                            {...modalPanHandlers}
                            className={cn(
                                "max-h-[82vh] max-w-[90vw] overflow-auto rounded-lg",
                                modalZoom > 1 &&
                                    "cursor-grab select-none active:cursor-grabbing",
                            )}
                        >
                            {/*eslint-disable-next-line*/}
                            <img
                                src={processedPreviewUrl}
                                alt={selectedProcessedImage.fileName}
                                draggable={false}
                                className="block max-w-none"
                                style={{
                                    width: `calc(min(${
                                        selectedProcessedImage.width
                                    }px, 90vw, calc(82vh * ${
                                        selectedProcessedImage.width /
                                        Math.max(
                                            1,
                                            selectedProcessedImage.height,
                                        )
                                    })) * ${modalZoom})`,
                                }}
                            />
                        </div>

                        <div className="flex flex-wrap justify-center items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 shadow-lg">
                            <span className="text-xs font-medium text-foreground truncate max-w-45">
                                {selectedProcessedImage.fileName}
                            </span>
                            <div className="w-px h-3 bg-border" />
                            <span className="text-xs font-mono text-muted-foreground">
                                {selectedProcessedImage.format.toUpperCase()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {selectedProcessedImage.width}×
                                {selectedProcessedImage.height}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {formatFileSize(
                                    selectedProcessedImage.originalSize,
                                )}{" "}
                                → {formatFileSize(selectedProcessedImage.size)}
                            </span>
                            {(() => {
                                const { isSmaller, percent } = getSizeDelta(
                                    selectedProcessedImage,
                                );
                                return (
                                    <span
                                        className={`text-xs font-semibold ${
                                            isSmaller
                                                ? "text-green-500"
                                                : "text-red-500"
                                        }`}
                                    >
                                        {isSmaller ? "−" : "+"}
                                        {percent}%
                                    </span>
                                );
                            })()}
                            <div className="w-px h-3 bg-border" />
                            <ZoomControls
                                zoom={modalZoom}
                                max={MODAL_ZOOM_MAX}
                                onZoom={changeModalZoom}
                                labels={zoomLabels}
                            />
                            <div className="w-px h-3 bg-border" />
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs"
                                onClick={() =>
                                    ImageProcessor.downloadImage(
                                        selectedProcessedImage,
                                    )
                                }
                            >
                                <Download className="h-3 w-3 mr-1" />
                                {t.imageTools.results.download}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
