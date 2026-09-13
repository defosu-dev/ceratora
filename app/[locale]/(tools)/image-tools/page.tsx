"use client";

import { Badge } from "@/components/ui/badge";
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
import { useTranslation } from "@/lib/i18n";
import {
    ArchiveUtils,
    ImageProcessingOptions,
    ImageProcessor,
    ProcessedImage,
} from "@/lib/imageProcessor";
import { cn } from "@/lib/utils";
import {
    Circle,
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
    SlidersHorizontal,
    Sparkles,
    Trash2,
    X,
    type LucideIcon,
} from "lucide-react";
import {
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { toast } from "react-toastify";
import { useAppProvider } from "../../_components/AppProvider";

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

const DEFAULT_OPTIONS: ImageProcessingOptions = {
    format: "webp",
    quality: 80,
    cornerRadius: 0,
    maxSizeKB: undefined,
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
    onToggle,
    onPreview,
    onRemove,
    previewLabel,
    removeLabel,
}: {
    file: File;
    selected: boolean;
    isPreview: boolean;
    onToggle: () => void;
    onPreview: () => void;
    onRemove: () => void;
    previewLabel: string;
    removeLabel: string;
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

/** A processed output. Solid outline with metrics and download actions. */
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

    return (
        <div className="group flex flex-col overflow-hidden rounded-xl border bg-card">
            <button
                type="button"
                onClick={onOpen}
                aria-label={`${previewAriaLabel}: ${image.fileName}`}
                className="relative flex aspect-4/3 w-full items-center justify-center overflow-hidden bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {/*eslint-disable-next-line*/}
                <img
                    ref={imgRef}
                    alt={image.fileName}
                    loading="lazy"
                    className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                />
                <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-full bg-background/90 p-2 shadow-sm">
                        <Eye className="h-4 w-4" />
                    </span>
                </span>
            </button>
            <div className="flex flex-1 flex-col gap-2 p-3">
                <p
                    className="truncate text-sm font-medium"
                    title={image.fileName}
                >
                    {image.fileName}
                </p>
                <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[11px]">
                        {image.format.toUpperCase()}
                    </Badge>
                    <Badge
                        variant={isSmaller ? "default" : "destructive"}
                        className="text-[11px]"
                    >
                        {isSmaller ? "−" : "+"}
                        {percent}%
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                        {formatFileSize(image.originalSize)} →{" "}
                        {formatFileSize(image.size)}
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                        {image.width}×{image.height}
                    </Badge>
                </div>
                <div className="mt-auto flex gap-2 pt-1">
                    <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={onOpen}
                    >
                        <Eye className="h-4 w-4" />
                        {previewLabel}
                    </Button>
                    <Button
                        size="icon-sm"
                        variant="outline"
                        title={downloadLabel}
                        aria-label={downloadLabel}
                        onClick={() => ImageProcessor.downloadImage(image)}
                    >
                        <Download className="h-4 w-4" />
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
    const [qualityMode, setQualityMode] = useState<"manual" | "auto">("manual");
    const [options, setOptions] =
        useState<ImageProcessingOptions>(DEFAULT_OPTIONS);
    const [isDragging, setIsDragging] = useState(false);
    const [canvasMode, setCanvasMode] = useState<"preview" | "results">(
        "preview",
    );
    const [pane, setPane] = useState<"sources" | "canvas" | "settings">(
        "canvas",
    );

    const abortControllerRef = useRef<AbortController | null>(null);
    const dragDepthRef = useRef(0);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Corner-radius preview: one chosen source image, shown large.
    const [previewFileId, setPreviewFileId] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewScale, setPreviewScale] = useState<number | null>(null);
    const [previewNatural, setPreviewNatural] = useState<{
        width: number;
        height: number;
    } | null>(null);
    const [modalScale, setModalScale] = useState<number | null>(null);
    const previewImgRef = useRef<HTMLImageElement | null>(null);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

    const [selectedProcessedImage, setSelectedProcessedImage] =
        useState<ProcessedImage | null>(null);
    const [processedPreviewUrl, setProcessedPreviewUrl] = useState<
        string | null
    >(null);

    useEffect(() => {
        const anyOpen = isPreviewModalOpen || selectedProcessedImage !== null;
        if (!anyOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setIsPreviewModalOpen(false);
            setSelectedProcessedImage(null);
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [isPreviewModalOpen, selectedProcessedImage]);

    const previewEntry =
        files.find((f) => f.id === previewFileId) ?? files[0] ?? null;
    const previewFile = previewEntry?.file ?? null;
    useEffect(() => {
        if (!previewFile) {
            setPreviewUrl(null);
            return;
        }
        setPreviewScale(null);
        setPreviewNatural(null);
        const url = URL.createObjectURL(previewFile);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [previewFile]);

    useEffect(() => {
        if (!selectedProcessedImage) {
            setProcessedPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(selectedProcessedImage.blob);
        setProcessedPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [selectedProcessedImage]);

    const previewOutputSize = previewNatural
        ? calculateOutputSize(
              previewNatural.width,
              previewNatural.height,
              options.maxWidth,
              options.maxHeight,
          )
        : null;

    const handlePreviewLoad = () => {
        const img = previewImgRef.current;
        if (!img || !img.naturalWidth || !img.naturalHeight) return;
        setPreviewNatural({
            width: img.naturalWidth,
            height: img.naturalHeight,
        });
        const output = calculateOutputSize(
            img.naturalWidth,
            img.naturalHeight,
            options.maxWidth,
            options.maxHeight,
        );
        setPreviewScale(
            output.width > 0 ? Math.min(1, img.clientWidth / output.width) : 1,
        );
    };

    const getScaledRadius = (): string => {
        if (activeRadius === 9999) return "9999px";
        const scale = previewScale ?? 1;
        return `${Math.round(activeRadius * scale)}px`;
    };

    const handleModalLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const el = e.currentTarget;
        if (!el.naturalWidth || !previewOutputSize) return;
        setModalScale(Math.min(1, el.clientWidth / previewOutputSize.width));
    };

    const getModalRadius = (): string => {
        if (activeRadius === 9999) return "9999px";
        return `${Math.round(activeRadius * (modalScale ?? 1))}px`;
    };

    const selectPreviewFile = (id: string) => {
        setPreviewFileId(id);
        setCanvasMode("preview");
        setPane("canvas");
    };

    const openPreviewModal = () => {
        setModalScale(null);
        setIsPreviewModalOpen(true);
    };

    const openFileDialog = () => {
        fileInputRef.current?.click();
    };

    const resetResults = () => {
        setProcessedImages([]);
        setProgress(0);
        setProgressCount(null);
    };

    const resetOptions = () => {
        setOptions({ ...DEFAULT_OPTIONS });
        setQualityMode("manual");
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
        const selectedFiles = files
            .filter((f) => f.selected)
            .map((f) => f.file);
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
            };

            const processed = await ImageProcessor.processImages(
                selectedFiles,
                processingOptions,
                (current, total) => {
                    setProgress((current / total) * 100);
                    setProgressCount({ current, total });
                },
                controller.signal,
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
        resetResults();
    };

    const clearSelected = () => {
        setFiles((prev) => prev.filter((f) => !f.selected));
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
    const activeRadius = options.cornerRadius ?? 0;

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

    const optionsSummary =
        qualityMode === "manual"
            ? `${t.imageTools.format.quality} ${options.quality}%`
            : `≤ ${options.maxSizeKB ?? 0} KB`;

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
                        "min-h-0 flex-1 flex-col overflow-hidden xl:flex",
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
                            {canvasMode === "preview"
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

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {canvasMode === "results" ? (
                            <div className="p-4">
                                {processedImages.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                                        {processedImages.map((img, idx) => (
                                            <ResultCard
                                                key={`${img.fileName}-${idx}`}
                                                image={img}
                                                onOpen={() =>
                                                    setSelectedProcessedImage(
                                                        img,
                                                    )
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
                                                        .downloadFile
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
                            <div className="flex min-h-80 items-center justify-center p-6 xl:h-full">
                                {previewUrl && previewEntry ? (
                                    <div className="flex flex-col items-center gap-4">
                                        {/*eslint-disable-next-line*/}
                                        <img
                                            key={
                                                previewOutputSize
                                                    ? `${previewOutputSize.width}x${previewOutputSize.height}`
                                                    : "preview"
                                            }
                                            ref={previewImgRef}
                                            src={previewUrl}
                                            alt={previewEntry.file.name}
                                            role="button"
                                            tabIndex={0}
                                            title={t.imageTools.style.preview}
                                            aria-label={
                                                t.imageTools.style.preview
                                            }
                                            onClick={openPreviewModal}
                                            onKeyDown={(e) => {
                                                if (
                                                    e.key === "Enter" ||
                                                    e.key === " "
                                                ) {
                                                    e.preventDefault();
                                                    openPreviewModal();
                                                }
                                            }}
                                            className="block cursor-zoom-in object-contain outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            style={{
                                                maxWidth: previewOutputSize
                                                    ? `min(${previewOutputSize.width}px, 100%)`
                                                    : "100%",
                                                maxHeight: previewOutputSize
                                                    ? `min(${previewOutputSize.height}px, 65vh)`
                                                    : "65vh",
                                                borderRadius:
                                                    getScaledRadius(),
                                                boxShadow:
                                                    "0 0 0 1px var(--border)",
                                            }}
                                            onLoad={handlePreviewLoad}
                                        />
                                        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border bg-background px-3 py-2 text-xs shadow-sm">
                                            <span
                                                className="max-w-45 truncate font-medium"
                                                title={previewEntry.file.name}
                                            >
                                                {previewEntry.file.name}
                                            </span>
                                            {previewNatural &&
                                                previewOutputSize && (
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
                                                {formatFileSize(
                                                    previewEntry.file.size,
                                                )}
                                            </span>
                                            <div className="hidden h-3 w-px bg-border sm:block" />
                                            <button
                                                type="button"
                                                onClick={openPreviewModal}
                                                aria-label={
                                                    t.imageTools.style.preview
                                                }
                                                title={
                                                    t.imageTools.style.preview
                                                }
                                                className="text-muted-foreground transition-colors hover:text-foreground"
                                            >
                                                <Maximize2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
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
                            icon={Maximize2}
                            title={t.imageTools.size.tab}
                        >
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
                        </SettingSection>

                        <div className="h-px bg-border" />

                        <SettingSection
                            icon={Circle}
                            title={t.imageTools.style.tab}
                        >
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
                                            setOptions({
                                                ...options,
                                                cornerRadius: preset.value,
                                            })
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
                                        setOptions({
                                            ...options,
                                            cornerRadius:
                                                Number(e.target.value) || 0,
                                        })
                                    }
                                    className="w-24"
                                    aria-label={t.imageTools.style.cornerRadius}
                                />
                                <div className="flex-1">
                                    <Slider
                                        value={[Math.min(activeRadius, 500)]}
                                        onValueChange={([value]) =>
                                            setOptions({
                                                ...options,
                                                cornerRadius: value,
                                            })
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

            {isPreviewModalOpen && previewUrl && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-6"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t.imageTools.style.preview}
                    onClick={() => setIsPreviewModalOpen(false)}
                >
                    <div
                        className="relative"
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
                        {/*eslint-disable-next-line*/}
                        <img
                            src={previewUrl}
                            alt="preview full"
                            className="block object-contain"
                            style={{
                                maxWidth: previewOutputSize
                                    ? `min(${previewOutputSize.width}px, 90vw)`
                                    : "90vw",
                                maxHeight: previewOutputSize
                                    ? `min(${previewOutputSize.height}px, 90vh)`
                                    : "90vh",
                                borderRadius: getModalRadius(),
                            }}
                            onLoad={handleModalLoad}
                        />
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
                        {/*eslint-disable-next-line*/}
                        <img
                            src={processedPreviewUrl}
                            alt={selectedProcessedImage.fileName}
                            className="block max-w-[90vw] max-h-[82vh] object-contain rounded-lg"
                        />

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
