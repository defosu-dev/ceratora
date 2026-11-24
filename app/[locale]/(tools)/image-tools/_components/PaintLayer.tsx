"use client";

import {
    type PaintStroke,
    type PaintTool,
    PaintUtils,
} from "@/lib/imageProcessor";
import { cn } from "@/lib/utils";
import {
    type CSSProperties,
    type PointerEvent,
    useEffect,
    useRef,
    useState,
} from "react";

/** Longest side of the on-screen canvas; processing uses full resolution. */
const MAX_PREVIEW_SIDE = 2048;

interface PaintLayerProps {
    src: string;
    alt: string;
    natural: { width: number; height: number };
    strokes: PaintStroke[];
    /** Active tool; without one the layer only shows the result. */
    tool?: PaintTool | null;
    color?: string;
    /** Brush diameter in screen pixels. */
    size?: number;
    onStroke?: (stroke: PaintStroke) => void;
    className?: string;
    style?: CSSProperties;
}

/**
 * The image with its eraser / brush strokes, drawn on a canvas. With a tool
 * selected it takes pointer input and shows a brush-sized cursor.
 */
export function PaintLayer({
    src,
    alt,
    natural,
    strokes,
    tool = null,
    color = "#ffffff",
    size = 24,
    onStroke,
    className,
    style,
}: PaintLayerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);
    /** Committed strokes, rendered once; live strokes are drawn over it. */
    const baseRef = useRef<HTMLCanvasElement | null>(null);
    const strokeRef = useRef<PaintStroke | null>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);

    const scale = Math.min(
        1,
        MAX_PREVIEW_SIDE / Math.max(natural.width, natural.height),
    );
    const width = Math.max(1, Math.round(natural.width * scale));
    const height = Math.max(1, Math.round(natural.height * scale));

    useEffect(() => {
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (!cancelled) setImage(img);
        };
        img.src = src;
        return () => {
            cancelled = true;
        };
    }, [src]);

    const present = (live?: PaintStroke) => {
        const ctx = canvasRef.current?.getContext("2d");
        const base = baseRef.current;
        if (!ctx || !base) return;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(base, 0, 0);
        if (live) PaintUtils.draw(ctx, live, width, height);
    };

    useEffect(() => {
        if (!image) return;
        const base = baseRef.current ?? document.createElement("canvas");
        baseRef.current = base;
        base.width = width;
        base.height = height;
        const ctx = base.getContext("2d")!;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        PaintUtils.apply(ctx, strokes, width, height);
        present(strokeRef.current ?? undefined);
        // present only reads refs and the size.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [image, strokes, width, height]);

    const toImage = (e: PointerEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return {
            point: [
                (e.clientX - rect.left) / rect.width,
                (e.clientY - rect.top) / rect.height,
            ] as [number, number],
            rectWidth: rect.width,
        };
    };

    const moveCursor = (e: PointerEvent<HTMLCanvasElement>) => {
        const cursor = cursorRef.current;
        const parent = e.currentTarget.parentElement;
        if (!cursor || !parent) return;
        const rect = parent.getBoundingClientRect();
        cursor.style.transform = `translate(${e.clientX - rect.left}px, ${
            e.clientY - rect.top
        }px) translate(-50%, -50%)`;
        cursor.style.opacity = "1";
    };

    const hideCursor = () => {
        if (cursorRef.current) cursorRef.current.style.opacity = "0";
    };

    const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
        if (!tool || e.button !== 0) return;
        // Keep the viewport from panning and the frame from opening.
        e.stopPropagation();
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const { point, rectWidth } = toImage(e);
        strokeRef.current = {
            tool,
            color,
            size: size / rectWidth,
            points: [point],
        };
        present(strokeRef.current);
    };

    const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
        if (!tool) return;
        moveCursor(e);
        const stroke = strokeRef.current;
        if (!stroke) return;
        e.stopPropagation();
        stroke.points.push(toImage(e).point);
        present(stroke);
    };

    const finishStroke = (e: PointerEvent<HTMLCanvasElement>) => {
        const stroke = strokeRef.current;
        if (!stroke) return;
        e.stopPropagation();
        strokeRef.current = null;
        onStroke?.(stroke);
    };

    return (
        <>
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                role="img"
                aria-label={alt}
                className={cn(className, tool && "cursor-none touch-none")}
                style={style}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={finishStroke}
                onPointerCancel={finishStroke}
                onPointerLeave={hideCursor}
                onClick={(e) => {
                    if (tool) e.stopPropagation();
                }}
            />
            {tool && (
                <div
                    ref={cursorRef}
                    aria-hidden
                    className="pointer-events-none absolute top-0 left-0 rounded-full border border-white opacity-0 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
                    style={{
                        width: size,
                        height: size,
                        backgroundColor:
                            tool === "brush" ? `${color}55` : undefined,
                    }}
                />
            )}
        </>
    );
}
