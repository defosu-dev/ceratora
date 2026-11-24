"use client";

import {
    type MouseEvent,
    type PointerEvent,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

interface PanState {
    pointerId: number;
    x: number;
    y: number;
    left: number;
    top: number;
    moved: boolean;
}

/**
 * Canva-style zoom for a scrollable viewport: the mouse wheel (or trackpad
 * pinch) zooms around the cursor, and dragging pans the zoomed content.
 * `zoom` only changes how big things look; callers scale their content.
 */
export function useZoomViewport({
    min,
    max,
    enabled = true,
}: {
    min: number;
    max: number;
    enabled?: boolean;
}) {
    const [viewport, setViewport] = useState<HTMLElement | null>(null);
    const viewportRef = useRef<HTMLElement | null>(null);
    const [zoom, setZoom] = useState(1);
    const zoomRef = useRef(1);
    const anchorRef = useRef<{ x: number; y: number; ratio: number } | null>(
        null,
    );
    const panRef = useRef<PanState | null>(null);
    const suppressClickRef = useRef(false);

    const attach = useCallback((element: HTMLElement | null) => {
        viewportRef.current = element;
        setViewport(element);
    }, []);

    /** Zooms so that viewport point (x, y) — the center by default — stays put. */
    const zoomTo = useCallback(
        (value: number, x?: number, y?: number) => {
            const current = zoomRef.current;
            const next = Math.min(max, Math.max(min, value));
            if (next === current) return;
            const element = viewportRef.current;
            if (element) {
                anchorRef.current = {
                    x: x ?? element.clientWidth / 2,
                    y: y ?? element.clientHeight / 2,
                    ratio: next / current,
                };
            }
            zoomRef.current = next;
            setZoom(next);
        },
        [min, max],
    );

    const reset = useCallback(() => {
        anchorRef.current = null;
        zoomRef.current = 1;
        setZoom(1);
    }, []);

    // Keep the anchor point in place once the zoomed layout is applied.
    useLayoutEffect(() => {
        const anchor = anchorRef.current;
        const element = viewportRef.current;
        anchorRef.current = null;
        if (!anchor || !element) return;
        element.scrollLeft =
            (element.scrollLeft + anchor.x) * anchor.ratio - anchor.x;
        element.scrollTop =
            (element.scrollTop + anchor.y) * anchor.ratio - anchor.y;
    }, [zoom]);

    // Native listener: React's onWheel is passive and can't preventDefault.
    useEffect(() => {
        if (!viewport || !enabled) return;
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            // Cap mouse-wheel notches; trackpad gestures send small deltas.
            const delta = Math.max(-25, Math.min(25, e.deltaY));
            const rect = viewport.getBoundingClientRect();
            zoomTo(
                zoomRef.current * Math.exp(-delta * 0.01),
                e.clientX - rect.left,
                e.clientY - rect.top,
            );
        };
        viewport.addEventListener("wheel", handleWheel, { passive: false });
        return () => viewport.removeEventListener("wheel", handleWheel);
    }, [viewport, enabled, zoomTo]);

    const onPointerDown = (e: PointerEvent<HTMLElement>) => {
        suppressClickRef.current = false;
        if (
            !enabled ||
            e.pointerType === "touch" ||
            (e.button !== 0 && e.button !== 1)
        ) {
            return;
        }
        if (e.button === 1) e.preventDefault();
        panRef.current = {
            pointerId: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            left: e.currentTarget.scrollLeft,
            top: e.currentTarget.scrollTop,
            moved: false,
        };
    };

    const onPointerMove = (e: PointerEvent<HTMLElement>) => {
        const pan = panRef.current;
        if (!pan || pan.pointerId !== e.pointerId) return;
        const dx = e.clientX - pan.x;
        const dy = e.clientY - pan.y;
        if (!pan.moved) {
            if (Math.hypot(dx, dy) < 4) return;
            pan.moved = true;
            e.currentTarget.setPointerCapture(e.pointerId);
        }
        e.currentTarget.scrollLeft = pan.left - dx;
        e.currentTarget.scrollTop = pan.top - dy;
    };

    const onPointerUp = (e: PointerEvent<HTMLElement>) => {
        const pan = panRef.current;
        if (!pan || pan.pointerId !== e.pointerId) return;
        // A drag must not count as a click (e.g. open or close a preview).
        suppressClickRef.current = pan.moved;
        panRef.current = null;
    };

    const onClickCapture = (e: MouseEvent<HTMLElement>) => {
        if (!suppressClickRef.current) return;
        suppressClickRef.current = false;
        e.preventDefault();
        e.stopPropagation();
    };

    return {
        zoom,
        zoomTo,
        reset,
        attach,
        panHandlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
            onClickCapture,
        },
    };
}
