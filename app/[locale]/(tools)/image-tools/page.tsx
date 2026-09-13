"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n";
import {
    ArchiveUtils,
    ImageProcessingOptions,
    ImageProcessor,
    ProcessedImage,
} from "@/lib/imageProcessor";
import {
    Download,
    Eye,
    FolderArchive,
    Image as ImageIcon,
    Settings,
    Trash2,
    Upload,
    X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
    { label: "Full", value: 9999 },
] as const;

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
    const [qualityMode, setQualityMode] = useState<"manual" | "auto">("manual");
    const [options, setOptions] = useState<ImageProcessingOptions>({
        format: "webp",
        quality: 80,
        cornerRadius: 0,
        maxSizeKB: undefined,
        maxWidth: undefined,
        maxHeight: undefined,
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewFileId, setPreviewFileId] = useState<string | null>(null);
    const [previewScale, setPreviewScale] = useState<number | null>(null);
    const previewImgRef = useRef<HTMLImageElement | null>(null);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [selectedProcessedImage, setSelectedProcessedImage] =
        useState<ProcessedImage | null>(null);

    useEffect(() => {
        const anyOpen = isPreviewModalOpen || selectedProcessedImage !== null;
        if (!anyOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setIsPreviewModalOpen(false);
            setSelectedProcessedImage(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
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
        const url = URL.createObjectURL(previewFile);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [previewFile]);

    const updatePreviewScale = () => {
        const img = previewImgRef.current;
        if (!img || !img.naturalWidth || !img.clientWidth) return;
        setPreviewScale(Math.min(1, img.clientWidth / img.naturalWidth));
    };

    const getScaledRadius = (): string => {
        if (activeRadius === 9999) return "9999px";
        const scale = previewScale ?? 1;
        return `${Math.round(activeRadius * scale)}px`;
    };

    const resetResults = () => {
        setProcessedImages([]);
        setProgress(0);
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
            if (!e.dataTransfer.files) return;
            const incoming = Array.from(e.dataTransfer.files);
            addFiles(incoming);
        },
        [addFiles],
    );

    const handleDragOver = (e: React.DragEvent) => e.preventDefault();

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
                (current, total) => setProgress((current / total) * 100),
                controller.signal,
            );

            if (controller.signal.aborted) {
                if (processed.length > 0) {
                    setProcessedImages(processed);
                    toast.info(
                        `${t.imageTools.toast.cancelled} ${processed.length}/${selectedFiles.length}`,
                    );
                } else {
                    toast.info(t.imageTools.toast.cancelledAll);
                }
            } else {
                setProcessedImages(processed);
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

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (
            Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
        );
    };

    const selectedCount = files.filter((f) => f.selected).length;
    const activeRadius = options.cornerRadius ?? 0;

    return (
        <main className="flex-1 w-full max-w-5xl flex-col gap-8 p-6">
            <div className="flex flex-col gap-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight">
                    {t.imageTools.title}
                </h1>
                <p className="text-muted-foreground">{t.imageTools.subtitle}</p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
                <div className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5" />
                                {t.imageTools.settings.title}
                            </CardTitle>
                            <CardDescription>
                                {t.imageTools.settings.description}{" "}
                                {selectedCount}{" "}
                                {t.imageTools.settings.selectedFiles}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="format" className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="format">
                                        {t.imageTools.format.tab}
                                    </TabsTrigger>
                                    <TabsTrigger value="size">
                                        {t.imageTools.size.tab}
                                    </TabsTrigger>
                                    <TabsTrigger value="style">
                                        {t.imageTools.style.tab}
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent
                                    value="format"
                                    className="space-y-4 mt-4"
                                >
                                    <div className="space-y-2">
                                        <Label>
                                            {t.imageTools.format.outputFormat}
                                        </Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(
                                                ["webp", "png", "jpeg"] as const
                                            ).map((fmt) => (
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
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label>
                                            {t.imageTools.format.qualityMode}
                                        </Label>
                                        <RadioGroup
                                            value={qualityMode}
                                            onValueChange={(v) =>
                                                setQualityMode(
                                                    v as "manual" | "auto",
                                                )
                                            }
                                        >
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem
                                                    value="manual"
                                                    id="manual"
                                                />
                                                <Label
                                                    htmlFor="manual"
                                                    className="font-normal cursor-pointer"
                                                >
                                                    {t.imageTools.format.manual}
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem
                                                    value="auto"
                                                    id="auto"
                                                />
                                                <Label
                                                    htmlFor="auto"
                                                    className="font-normal cursor-pointer"
                                                >
                                                    {t.imageTools.format.auto}
                                                </Label>
                                            </div>
                                        </RadioGroup>
                                    </div>

                                    {qualityMode === "manual" ? (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <Label>
                                                    {
                                                        t.imageTools.format
                                                            .quality
                                                    }
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
                                                {
                                                    t.imageTools.format
                                                        .recommended
                                                }
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label htmlFor="maxSizeKB">
                                                {t.imageTools.format.maxSize}
                                            </Label>
                                            <Input
                                                id="maxSizeKB"
                                                type="number"
                                                placeholder={
                                                    t.imageTools.format
                                                        .placeholder
                                                }
                                                value={options.maxSizeKB ?? ""}
                                                onChange={(e) =>
                                                    setOptions({
                                                        ...options,
                                                        maxSizeKB: e.target
                                                            .value
                                                            ? Number(
                                                                  e.target
                                                                      .value,
                                                              )
                                                            : undefined,
                                                    })
                                                }
                                                min={1}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                {
                                                    t.imageTools.format
                                                        .autoDescription
                                                }
                                            </p>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent
                                    value="size"
                                    className="space-y-4 mt-4"
                                >
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="maxWidth">
                                                {t.imageTools.size.maxWidth}
                                            </Label>
                                            <Input
                                                id="maxWidth"
                                                type="number"
                                                placeholder={
                                                    t.imageTools.size.auto
                                                }
                                                value={options.maxWidth ?? ""}
                                                onChange={(e) =>
                                                    setOptions({
                                                        ...options,
                                                        maxWidth: e.target.value
                                                            ? Number(
                                                                  e.target
                                                                      .value,
                                                              )
                                                            : undefined,
                                                    })
                                                }
                                                min={1}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="maxHeight">
                                                {t.imageTools.size.maxHeight}
                                            </Label>
                                            <Input
                                                id="maxHeight"
                                                type="number"
                                                placeholder={
                                                    t.imageTools.size.auto
                                                }
                                                value={options.maxHeight ?? ""}
                                                onChange={(e) =>
                                                    setOptions({
                                                        ...options,
                                                        maxHeight: e.target
                                                            .value
                                                            ? Number(
                                                                  e.target
                                                                      .value,
                                                              )
                                                            : undefined,
                                                    })
                                                }
                                                min={1}
                                            />
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent
                                    value="style"
                                    className="space-y-4 mt-4"
                                >
                                    <div className="space-y-3">
                                        <Label>
                                            {t.imageTools.style.cornerRadius}
                                        </Label>

                                        <div className="grid grid-cols-6 gap-1">
                                            {CORNER_RADIUS_PRESETS.map(
                                                (preset) => (
                                                    <Button
                                                        key={preset.value}
                                                        variant={
                                                            activeRadius ===
                                                            preset.value
                                                                ? "default"
                                                                : "outline"
                                                        }
                                                        size="sm"
                                                        className="text-xs px-1"
                                                        onClick={() =>
                                                            setOptions({
                                                                ...options,
                                                                cornerRadius:
                                                                    preset.value,
                                                            })
                                                        }
                                                    >
                                                        {preset.label}
                                                    </Button>
                                                ),
                                            )}
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
                                                    activeRadius === 9999
                                                        ? "Full"
                                                        : "0"
                                                }
                                                onChange={(e) =>
                                                    setOptions({
                                                        ...options,
                                                        cornerRadius:
                                                            Number(
                                                                e.target.value,
                                                            ) || 0,
                                                    })
                                                }
                                                className="w-24"
                                            />
                                            <div className="flex-1">
                                                <Slider
                                                    value={[
                                                        Math.min(
                                                            activeRadius,
                                                            500,
                                                        ),
                                                    ]}
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

                                        {previewUrl ? (
                                            <div className="flex flex-col gap-2 pt-1">
                                                <p className="text-xs text-muted-foreground">
                                                    {t.imageTools.style.preview}
                                                </p>
                                                {/*eslint-disable-next-line*/}
                                                <img
                                                    ref={previewImgRef}
                                                    src={previewUrl}
                                                    alt="preview"
                                                    className="block max-w-full self-start cursor-zoom-in transition-opacity hover:opacity-90"
                                                    style={{
                                                        borderRadius:
                                                            getScaledRadius(),
                                                        boxShadow:
                                                            "0 0 0 1px #e5e5e5",
                                                    }}
                                                    onLoad={updatePreviewScale}
                                                    onClick={() =>
                                                        setIsPreviewModalOpen(
                                                            true,
                                                        )
                                                    }
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center h-20 rounded-lg border border-dashed text-xs text-muted-foreground">
                                                {
                                                    t.imageTools.style
                                                        .previewEmpty
                                                }
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    <div className="flex gap-2">
                        <Button
                            onClick={processImages}
                            disabled={selectedCount === 0 || isProcessing}
                            size="lg"
                            className="flex-1"
                        >
                            {isProcessing
                                ? `${t.imageTools.process.processing} ${Math.round(progress)}%`
                                : `${t.imageTools.process.button} ${selectedCount} ${
                                      selectedCount === 1
                                          ? t.imageTools.process.image
                                          : t.imageTools.process.images
                                  }`}
                        </Button>

                        {isProcessing && (
                            <Button
                                onClick={cancelProcessing}
                                size="lg"
                                variant="outline"
                                className="shrink-0"
                            >
                                <X className="h-4 w-4 mr-1" />
                                {t.imageTools.process.cancel}
                            </Button>
                        )}
                    </div>

                    {isProcessing && (
                        <Progress value={progress} className="w-full" />
                    )}
                </div>

                <div className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Upload className="h-5 w-5" />
                                {t.imageTools.upload.title}
                            </CardTitle>
                            <CardDescription>
                                {t.imageTools.upload.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                                onClick={() =>
                                    document
                                        .getElementById("fileInput")
                                        ?.click()
                                }
                            >
                                <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground mb-2">
                                    {t.imageTools.upload.dropzone}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {t.imageTools.upload.formats}
                                </p>
                                <Input
                                    id="fileInput"
                                    type="file"
                                    multiple
                                    accept="image/*,.zip,.7z,.rar,.tar,.tar.gz,.tgz,.cbz,application/zip,application/x-zip-compressed,application/x-7z-compressed,application/x-rar-compressed"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                            </div>

                            {files.length > 0 && (
                                <div className="mt-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                checked={files.every(
                                                    (f) => f.selected,
                                                )}
                                                onCheckedChange={
                                                    toggleAllSelection
                                                }
                                            />
                                            <p className="text-sm font-medium">
                                                {t.imageTools.upload.selected}{" "}
                                                {selectedCount}{" "}
                                                {t.imageTools.upload.of}{" "}
                                                {files.length}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            {selectedCount > 0 &&
                                                selectedCount <
                                                    files.length && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={clearSelected}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        {
                                                            t.imageTools.upload
                                                                .deleteSelected
                                                        }
                                                    </Button>
                                                )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={clearAll}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                {t.imageTools.upload.clearAll}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                                        {files.map((file) => {
                                            const isPreviewFile =
                                                previewEntry?.id === file.id;
                                            return (
                                                <div
                                                    key={file.id}
                                                    className={`group flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors cursor-pointer ${
                                                        file.selected
                                                            ? "bg-accent/50"
                                                            : ""
                                                    }`}
                                                    onClick={() =>
                                                        toggleFileSelection(
                                                            file.id,
                                                        )
                                                    }
                                                >
                                                    <Checkbox
                                                        checked={file.selected}
                                                        onCheckedChange={() =>
                                                            toggleFileSelection(
                                                                file.id,
                                                            )
                                                        }
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs truncate">
                                                            {file.file.name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatFileSize(
                                                                file.file.size,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div
                                                        className={`flex items-center gap-1 transition-opacity ${
                                                            isPreviewFile
                                                                ? "opacity-100"
                                                                : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                                                        }`}
                                                    >
                                                        <Button
                                                            variant={
                                                                isPreviewFile
                                                                    ? "secondary"
                                                                    : "ghost"
                                                            }
                                                            size="icon-xs"
                                                            title={
                                                                t.imageTools
                                                                    .upload
                                                                    .useForPreview
                                                            }
                                                            aria-label={
                                                                t.imageTools
                                                                    .upload
                                                                    .useForPreview
                                                            }
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPreviewFileId(
                                                                    file.id,
                                                                );
                                                            }}
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-xs"
                                                            className="text-muted-foreground hover:text-destructive"
                                                            title={
                                                                t.imageTools
                                                                    .upload
                                                                    .removeFile
                                                            }
                                                            aria-label={
                                                                t.imageTools
                                                                    .upload
                                                                    .removeFile
                                                            }
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeFile(
                                                                    file.id,
                                                                );
                                                            }}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle>
                                        {t.imageTools.results.title}
                                    </CardTitle>
                                    <CardDescription>
                                        {processedImages.length > 0
                                            ? `${t.imageTools.results.processed} ${processedImages.length} ${t.imageTools.process.images}`
                                            : t.imageTools.results.description}
                                    </CardDescription>
                                </div>
                                {processedImages.length > 0 && (
                                    <div className="flex flex-col items-end gap-1">
                                        {processedImages.length > 10 ? (
                                            <>
                                                <Button
                                                    onClick={downloadZip}
                                                    disabled={isCreatingZip}
                                                    size="sm"
                                                >
                                                    <FolderArchive className="h-4 w-4 mr-2" />
                                                    {isCreatingZip
                                                        ? "..."
                                                        : t.imageTools.results
                                                              .downloadZip}
                                                </Button>
                                                <span className="text-[11px] text-muted-foreground text-right">
                                                    {
                                                        t.imageTools.results
                                                            .zipOnlyNotice
                                                    }
                                                </span>
                                            </>
                                        ) : processedImages.length > 1 ? (
                                            <div className="flex items-center gap-2">
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
                                                    {isCreatingZip
                                                        ? "..."
                                                        : "ZIP"}
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                onClick={downloadAll}
                                                size="sm"
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                {t.imageTools.results.download}
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {processedImages.length > 0 ? (
                                <div className="space-y-3 max-h-150 overflow-y-auto">
                                    {processedImages.map((img, idx) => {
                                        const percentChange = (
                                            ((img.size - img.originalSize) /
                                                img.originalSize) *
                                            100
                                        ).toFixed(1);
                                        const isSmaller =
                                            img.size < img.originalSize;

                                        return (
                                            <div
                                                key={idx}
                                                className="border rounded-lg p-3 flex items-center gap-3 hover:bg-accent transition-colors cursor-pointer"
                                                onClick={() =>
                                                    setSelectedProcessedImage(
                                                        img,
                                                    )
                                                }
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm truncate">
                                                        {img.fileName}
                                                    </p>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        <Badge
                                                            variant="secondary"
                                                            className="text-xs"
                                                        >
                                                            {img.format.toUpperCase()}
                                                        </Badge>
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            {formatFileSize(
                                                                img.originalSize,
                                                            )}{" "}
                                                            →{" "}
                                                            {formatFileSize(
                                                                img.size,
                                                            )}
                                                        </Badge>
                                                        <Badge
                                                            variant={
                                                                isSmaller
                                                                    ? "default"
                                                                    : "destructive"
                                                            }
                                                            className="text-xs"
                                                        >
                                                            {isSmaller
                                                                ? "-"
                                                                : "+"}
                                                            {Math.abs(
                                                                Number(
                                                                    percentChange,
                                                                ),
                                                            )}
                                                            %
                                                        </Badge>
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            {img.width}×
                                                            {img.height}
                                                        </Badge>
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            Q:{" "}
                                                            {img.appliedQuality}
                                                            %
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        ImageProcessor.downloadImage(
                                                            img,
                                                        );
                                                    }}
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                    <p className="text-sm">
                                        {t.imageTools.results.willAppear}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
            {isPreviewModalOpen && previewUrl && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
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
                        >
                            <X className="h-4 w-4" />
                        </button>
                        {/*eslint-disable-next-line*/}
                        <img
                            src={previewUrl}
                            alt="preview full"
                            className="block max-w-[90vw] max-h-[90vh] object-contain"
                            style={{
                                borderRadius:
                                    activeRadius === 9999
                                        ? "9999px"
                                        : (() => {
                                              const img = previewImgRef.current;
                                              if (!img || !img.naturalWidth)
                                                  return `${activeRadius}px`;
                                              const scaleW =
                                                  (window.innerWidth * 0.9) /
                                                  img.naturalWidth;
                                              const scaleH =
                                                  (window.innerHeight * 0.9) /
                                                  img.naturalHeight;
                                              const scale = Math.min(
                                                  scaleW,
                                                  scaleH,
                                                  1,
                                              );
                                              return `${Math.round(activeRadius * scale)}px`;
                                          })(),
                            }}
                        />
                    </div>
                </div>
            )}
            {selectedProcessedImage &&
                (() => {
                    const objectUrl = URL.createObjectURL(
                        selectedProcessedImage.blob,
                    );
                    const isSmaller =
                        selectedProcessedImage.size <
                        selectedProcessedImage.originalSize;
                    const percentChange = Math.abs(
                        Number(
                            (
                                ((selectedProcessedImage.size -
                                    selectedProcessedImage.originalSize) /
                                    selectedProcessedImage.originalSize) *
                                100
                            ).toFixed(1),
                        ),
                    );
                    return (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
                            onClick={() => setSelectedProcessedImage(null)}
                        >
                            <div
                                className="relative flex flex-col items-center gap-3"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    className="absolute -top-3 -right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-zinc-800 text-black dark:text-white shadow-lg hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                                    onClick={() =>
                                        setSelectedProcessedImage(null)
                                    }
                                    aria-label="Close"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                                {/*eslint-disable-next-line*/}
                                <img
                                    src={objectUrl}
                                    alt={selectedProcessedImage.fileName}
                                    className="block max-w-[90vw] max-h-[82vh] object-contain rounded-lg"
                                    onLoad={() =>
                                        URL.revokeObjectURL(objectUrl)
                                    }
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
                                        →{" "}
                                        {formatFileSize(
                                            selectedProcessedImage.size,
                                        )}
                                    </span>
                                    <span
                                        className={`text-xs font-semibold ${isSmaller ? "text-green-500" : "text-red-500"}`}
                                    >
                                        {isSmaller ? "−" : "+"}
                                        {percentChange}%
                                    </span>
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
                    );
                })()}
        </main>
    );
}
