"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Hover time before the tooltip shows. */
const TOOLTIP_DELAY_MS = 500;

interface ToolButtonProps {
    icon: LucideIcon;
    label: string;
    /** Keyboard shortcut shown in the tooltip. */
    shortcut?: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
}

/** Square icon button with a delayed tooltip (rendered in a portal). */
export function ToolButton({
    icon: Icon,
    label,
    shortcut,
    active,
    disabled,
    onClick,
}: ToolButtonProps) {
    const ref = useRef<HTMLButtonElement>(null);
    const timerRef = useRef<number | null>(null);
    const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

    const cancel = () => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = null;
        setTip(null);
    };

    const schedule = () => {
        cancel();
        timerRef.current = window.setTimeout(() => {
            const rect = ref.current?.getBoundingClientRect();
            if (rect) {
                setTip({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
            }
        }, TOOLTIP_DELAY_MS);
    };

    useEffect(
        () => () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
            }
        },
        [],
    );

    return (
        <>
            <button
                ref={ref}
                type="button"
                aria-label={label}
                aria-pressed={active}
                disabled={disabled}
                onClick={() => {
                    cancel();
                    onClick();
                }}
                onPointerEnter={schedule}
                onPointerLeave={cancel}
                onFocus={schedule}
                onBlur={cancel}
                className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40",
                    active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                )}
            >
                <Icon className="h-3.5 w-3.5" />
            </button>
            {tip &&
                createPortal(
                    <Tooltip x={tip.x} y={tip.y}>
                        {label}
                        {shortcut && (
                            <kbd className="ml-2 rounded border border-border px-1 font-mono text-[10px] opacity-70">
                                {shortcut}
                            </kbd>
                        )}
                    </Tooltip>,
                    document.body,
                )}
        </>
    );
}

function Tooltip({
    x,
    y,
    children,
}: {
    x: number;
    y: number;
    children: ReactNode;
}) {
    return (
        <div
            role="tooltip"
            className="pointer-events-none fixed z-50 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md"
            style={{ left: x, top: y }}
        >
            {children}
        </div>
    );
}
