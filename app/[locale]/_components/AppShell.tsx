"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
    Code2,
    Globe,
    Home,
    Image as ImageIcon,
    Menu,
    Moon,
    PanelLeftClose,
    PanelLeftOpen,
    Sun,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppProvider } from "./AppProvider";
import { Locale, LOCALES, useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface NavItem {
    href: string;
    label: string;
    icon: typeof Home;
    soon?: boolean;
}

const SIDEBAR_STORAGE_KEY = "ceratora-sidebar-collapsed";
const sidebarListeners = new Set<() => void>();

function subscribeSidebar(listener: () => void) {
    sidebarListeners.add(listener);
    return () => {
        sidebarListeners.delete(listener);
    };
}

function getSidebarSnapshot() {
    try {
        return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

function getSidebarServerSnapshot() {
    return false;
}

function setSidebarCollapsed(value: boolean) {
    try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, value ? "1" : "0");
    } catch {
        // ignore (e.g. storage disabled)
    }
    sidebarListeners.forEach((listener) => listener());
}

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { locale, theme, toggleTheme, setLocale } = useAppProvider();
    const t = useTranslation(locale);
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const collapsed = useSyncExternalStore(
        subscribeSidebar,
        getSidebarSnapshot,
        getSidebarServerSnapshot,
    );

    const mounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );

    useEffect(() => {
        if (!menuOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenuOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [menuOpen]);

    const navItems: NavItem[] = [
        { href: `/${locale}`, label: t.header.home, icon: Home },
        {
            href: `/${locale}/image-tools`,
            label: t.header.imageTools,
            icon: ImageIcon,
        },
        {
            href: `/${locale}/code-tools`,
            label: t.header.codeTools,
            icon: Code2,
            soon: true,
        },
    ];

    const isActive = (href: string) =>
        href === `/${locale}` ? pathname === href : pathname.startsWith(href);

    const activeLabel =
        navItems.find((item) => !item.soon && isActive(item.href))?.label ?? "";

    const themeIcon = mounted ? (
        theme === "light" ? (
            <Moon className="h-4 w-4" />
        ) : (
            <Sun className="h-4 w-4" />
        )
    ) : (
        <span className="h-4 w-4" />
    );

    const renderSidebar = (
        isCollapsed: boolean,
        onNavigate?: () => void,
    ) => (
        <div className="flex h-full flex-col">
            <div
                className={cn(
                    "flex h-14 shrink-0 items-center border-b",
                    isCollapsed ? "justify-center px-2" : "px-5",
                )}
            >
                <Link
                    href={`/${locale}`}
                    onClick={onNavigate}
                    title="Ceratora"
                    className={cn(
                        "font-bold tracking-tight transition-opacity hover:opacity-80",
                        isCollapsed ? "text-xl" : "text-lg",
                    )}
                >
                    {isCollapsed ? "C" : "Ceratora"}
                </Link>
            </div>

            <nav
                className={cn(
                    "flex flex-col gap-1 p-2",
                    isCollapsed && "items-stretch",
                )}
            >
                {navItems.map((item) => {
                    if (item.soon) {
                        return (
                            <div
                                key={item.href}
                                title={item.label}
                                className={cn(
                                    "flex cursor-not-allowed items-center gap-3 rounded-md text-sm font-medium text-muted-foreground/60",
                                    isCollapsed
                                        ? "justify-center p-2"
                                        : "px-3 py-2",
                                )}
                            >
                                <item.icon className="h-4 w-4 shrink-0" />
                                {!isCollapsed && (
                                    <>
                                        {item.label}
                                        <span className="ml-auto rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                                            {t.home.soon}
                                        </span>
                                    </>
                                )}
                            </div>
                        );
                    }
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={item.label}
                            aria-label={item.label}
                            aria-current={active ? "page" : undefined}
                            onClick={onNavigate}
                            className={cn(
                                "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
                                isCollapsed
                                    ? "justify-center p-2"
                                    : "px-3 py-2",
                                active
                                    ? "bg-accent text-accent-foreground"
                                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                            )}
                        >
                            <item.icon className="h-4 w-4 shrink-0" />
                            {!isCollapsed && item.label}
                        </Link>
                    );
                })}
            </nav>

            <div
                className={cn(
                    "mt-auto flex flex-col gap-3 border-t",
                    isCollapsed
                        ? "items-center p-2"
                        : "items-stretch p-3",
                )}
            >
                <div
                    className={cn(
                        "flex items-center gap-2",
                        isCollapsed && "flex-col",
                    )}
                >
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size={isCollapsed ? "icon-sm" : "sm"}
                                className="gap-2"
                                aria-label="Change language"
                            >
                                <Globe className="h-4 w-4" />
                                {!isCollapsed && (
                                    <span className="uppercase">{locale}</span>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            {LOCALES.map((loc: Locale) => (
                                <DropdownMenuItem
                                    key={loc}
                                    onClick={() => setLocale(loc)}
                                >
                                    {loc === "uk" && "🇺🇦 Українська"}
                                    {loc === "en" && "🇬🇧 English"}
                                    {loc === "ru" && "🇷🇺 Русский"}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={toggleTheme}
                        aria-label="Toggle theme"
                    >
                        {themeIcon}
                    </Button>
                </div>

                {!isCollapsed && (
                    <p className="px-1 text-[11px] text-muted-foreground">
                        {t.footer.developedBy} defosu-dev
                    </p>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex h-dvh w-full overflow-hidden bg-background">
            <aside
                className={cn(
                    "hidden shrink-0 border-r bg-card transition-[width] duration-200 lg:block",
                    collapsed ? "w-16" : "w-64",
                )}
            >
                {renderSidebar(collapsed)}
            </aside>

            {menuOpen && (
                <div
                    className="fixed inset-0 z-60 lg:hidden"
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r bg-card shadow-xl">
                        <button
                            type="button"
                            onClick={() => setMenuOpen(false)}
                            aria-label="Close menu"
                            className="absolute top-3.5 right-3 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        {renderSidebar(false, () => setMenuOpen(false))}
                    </div>
                </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur lg:gap-3 lg:px-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setMenuOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="hidden lg:inline-flex"
                        onClick={() => setSidebarCollapsed(!collapsed)}
                        aria-label={t.header.toggleSidebar}
                        title={t.header.toggleSidebar}
                    >
                        {collapsed ? (
                            <PanelLeftOpen className="h-5 w-5" />
                        ) : (
                            <PanelLeftClose className="h-5 w-5" />
                        )}
                    </Button>
                    <span className="truncate text-sm font-semibold">
                        {activeLabel || "Ceratora"}
                    </span>
                    <div className="ml-auto flex items-center gap-1 lg:hidden">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Change language"
                                >
                                    <Globe className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {LOCALES.map((loc: Locale) => (
                                    <DropdownMenuItem
                                        key={loc}
                                        onClick={() => setLocale(loc)}
                                    >
                                        {loc === "uk" && "🇺🇦 Українська"}
                                        {loc === "en" && "🇬🇧 English"}
                                        {loc === "ru" && "🇷🇺 Русский"}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={toggleTheme}
                            aria-label="Toggle theme"
                        >
                            {themeIcon}
                        </Button>
                    </div>
                </header>

                <div className="relative min-h-0 flex-1 overflow-hidden">
                    {children}
                </div>
            </div>
        </div>
    );
}
