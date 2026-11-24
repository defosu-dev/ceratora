"use client";

import {
    type CropHandle,
    type CropRect,
    CropUtils,
} from "@/lib/imageProcessor";
import { cn } from "@/lib/utils";
import { type KeyboardEvent, type PointerEvent, useRef } from "react";

const HANDLES: { id: CropHandle; className: string }[] = [
    {
        id: "nw",
        className:
            "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
    },
    {
        id: "n",
        className:
            "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
    },
    {
        id: "ne",
        className:
            "top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
    },
    {
        id: "e",
        className:
            "top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
    },
    {
        id: "se",
        className:
            "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
    },
    {
        id: "s",
        className:
            "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
    },
    {
        id: "sw",
        className:
            "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
    },
    {
        id: "w",
        className:
            "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
    },
];

/** Smallest crop box size on screen, in CSS pixels. */
const MIN_BOX_PX = 24;

interface DragState {
    handle: CropHandle | "move";
    pointerId: number;
    startX: number;
    startY: number;
    startCrop: CropRect;
    bounds: DOMRect;
}

interface PinchState {
    startDistance: number;
    startZoom: number;
}

const getDistance = (points: { x: number; y: number }[]) =>
    Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);

/**
 * Canva / WordPress-style crop editor: the whole source image with a
 * draggable crop box, eight resize handles and a rule-of-thirds grid.
 * The crop is stored as fractions of the source size (see CropRect).
 */
export function CropEditor({
    src,
    alt,
    natural,
    crop,
    aspect,
    onChange,
    zoom,
    onZoomChange,
    areaLabel,
}: {
    src: string;
    alt: string;
    natural: { width: number; height: number };
    crop: CropRect;
    /** Pixel aspect ratio (width / height), or null for a free crop. */
    aspect: number | null;
    onChange: (crop: CropRect) => void;
    /** View zoom of the canvas (1 = fit). Does not change the crop. */
    zoom: number;
    onZoomChange: (zoom: number) => void;
    areaLabel: string;
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const pointersRef = useRef(new Map<number, { x: number; y: number }>());
    const pinchRef = useRef<PinchState | null>(null);

    /** Two fingers on a touch screen switch from dragging to zooming. */
    const handlePointerDownCapture = (e: PointerEvent<HTMLDivElement>) => {
        const pointers = pointersRef.current;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
            dragRef.current = null;
            pinchRef.current = {
                startDistance: getDistance([...pointers.values()]),
                startZoom: zoom,
            };
        }
    };

    const ratio = aspect
        ? CropUtils.toFractionRatio(aspect, natural.width, natural.height)
        : null;

    const startDrag = (
        e: PointerEvent<HTMLElement>,
        handle: CropHandle | "move",
    ) => {
        const container = containerRef.current;
        if (!container || e.button !== 0 || pinchRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = {
            handle,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            startCrop: crop,
            bounds: container.getBoundingClientRect(),
        };
    };

    const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
        const pointers = pointersRef.current;
        if (pointers.has(e.pointerId)) {
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
        const pinch = pinchRef.current;
        if (pinch && pointers.size >= 2 && pinch.startDistance > 0) {
            const distance = getDistance([...pointers.values()].slice(0, 2));
            onZoomChange(pinch.startZoom * (distance / pinch.startDistance));
            return;
        }

        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        const { bounds } = drag;
        if (!bounds.width || !bounds.height) return;

        const dx = (e.clientX - drag.startX) / bounds.width;
        const dy = (e.clientY - drag.startY) / bounds.height;

        onChange(
            drag.handle === "move"
                ? CropUtils.move(drag.startCrop, dx, dy)
                : CropUtils.resize(
                      drag.startCrop,
                      drag.handle,
                      dx,
                      dy,
                      ratio,
                      Math.min(1, MIN_BOX_PX / bounds.width),
                      Math.min(1, MIN_BOX_PX / bounds.height),
                  ),
        );
    };

    const endDrag = (e: PointerEvent<HTMLDivElement>) => {
        pointersRef.current.delete(e.pointerId);
        if (pointersRef.current.size < 2) pinchRef.current = null;
        if (dragRef.current?.pointerId === e.pointerId) {
            dragRef.current = null;
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const step = e.shiftKey ? 0.1 : 0.01;
        const deltas: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
        };
        const delta = deltas[e.key];
        if (!delta) return;
        e.preventDefault();
        onChange(CropUtils.move(crop, delta[0], delta[1]));
    };

    const pct = (value: number) => `${value * 100}%`;
    const right = crop.x + crop.width;
    const bottom = crop.y + crop.height;

    return (
        <div
            ref={containerRef}
            className="relative shrink-0 touch-none select-none"
            style={{
                width: `calc(min(${natural.width}px, 100%, calc(65vh * ${
                    natural.width / natural.height
                })) * ${zoom})`,
                aspectRatio: `${natural.width} / ${natural.height}`,
                boxShadow: "0 0 0 1px var(--border)",
            }}
            onPointerDownCapture={handlePointerDownCapture}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
        >
            {/*eslint-disable-next-line*/}
            <img
                src={src}
                alt={alt}
                draggable={false}
                className="pointer-events-none block h-full w-full"
            />

            {/* Dimmed area outside the crop box */}
            <div
                className="pointer-events-none absolute inset-x-0 top-0 bg-black/55"
                style={{ height: pct(crop.y) }}
            />
            <div
                className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55"
                style={{ height: pct(1 - bottom) }}
            />
            <div
                className="pointer-events-none absolute left-0 bg-black/55"
                style={{
                    top: pct(crop.y),
                    height: pct(crop.height),
                    width: pct(crop.x),
                }}
            />
            <div
                className="pointer-events-none absolute right-0 bg-black/55"
                style={{
                    top: pct(crop.y),
                    height: pct(crop.height),
                    width: pct(1 - right),
                }}
            />

            {/* Crop box */}
            <div
                role="group"
                tabIndex={0}
                aria-label={areaLabel}
                onPointerDown={(e) => startDrag(e, "move")}
                onKeyDown={handleKeyDown}
                className="absolute cursor-move outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                    left: pct(crop.x),
                    top: pct(crop.y),
                    width: pct(crop.width),
                    height: pct(crop.height),
                }}
            >
                <span className="pointer-events-none absolute inset-0 border border-white/90 shadow-[0_0_0_1px_rgb(0_0_0/0.25)]" />
                <span className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/40" />
                <span className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/40" />
                <span className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/40" />
                <span className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/40" />

                {HANDLES.map((handle) => (
                    <span
                        key={handle.id}
                        aria-hidden="true"
                        onPointerDown={(e) => startDrag(e, handle.id)}
                        className={cn(
                            "absolute z-10 flex size-6 items-center justify-center",
                            handle.className,
                        )}
                    >
                        <span className="block size-3 rounded-full border border-primary bg-white shadow-sm" />
                    </span>
                ))}
            </div>
        </div>
    );
}
