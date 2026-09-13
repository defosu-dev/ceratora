"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useSyncExternalStore,
    ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Locale, LOCALES } from "@/lib/i18n";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "theme";
const themeListeners = new Set<() => void>();

function subscribeTheme(listener: () => void) {
    themeListeners.add(listener);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => {
        try {
            // Only follow the system when the user hasn't chosen explicitly.
            if (!localStorage.getItem(THEME_STORAGE_KEY)) listener();
        } catch {
            listener();
        }
    };
    const onStorage = (e: StorageEvent) => {
        if (e.key === THEME_STORAGE_KEY) listener();
    };

    media.addEventListener("change", onMediaChange);
    window.addEventListener("storage", onStorage);

    return () => {
        themeListeners.delete(listener);
        media.removeEventListener("change", onMediaChange);
        window.removeEventListener("storage", onStorage);
    };
}

function getThemeSnapshot(): Theme {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark") return saved;
        return window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    } catch {
        return "light";
    }
}

function getThemeServerSnapshot(): Theme {
    return "light";
}

function applyTheme(theme: Theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
}

function storeTheme(theme: Theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // ignore (e.g. storage disabled)
    }
    applyTheme(theme);
    themeListeners.forEach((listener) => listener());
}

interface AppContextType {
    locale: Locale;
    theme: Theme;
    setLocale: (newLocale: Locale) => void;
    toggleTheme: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({
    children,
    initialLocale,
}: {
    children: ReactNode;
    initialLocale?: Locale;
}) => {
    const pathname = usePathname();
    const router = useRouter();

    const segment = pathname ? pathname.split("/")[1] : undefined;
    const locale: Locale =
        initialLocale && LOCALES.includes(initialLocale)
            ? initialLocale
            : segment && LOCALES.includes(segment as Locale)
              ? (segment as Locale)
              : "en";

    const theme = useSyncExternalStore(
        subscribeTheme,
        getThemeSnapshot,
        getThemeServerSnapshot,
    );

    // The inline script in the layout already applied the theme class before
    // hydration, so keep the DOM in sync only for subsequent changes.
    const isFirstThemeRun = useRef(true);
    useEffect(() => {
        if (isFirstThemeRun.current) {
            isFirstThemeRun.current = false;
            return;
        }
        applyTheme(theme);
    }, [theme]);

    const setLocale = (newLocale: Locale) => {
        const rest = pathname.replace(/^\/[a-z]{2}/, "") || "/";
        document.cookie = `locale=${newLocale}; path=/; max-age=31536000`;
        router.push(`/${newLocale}${rest}`);
    };

    const toggleTheme = () => {
        storeTheme(theme === "light" ? "dark" : "light");
    };

    return (
        <AppContext.Provider value={{ locale, theme, setLocale, toggleTheme }}>
            <ToastContainer
                position="top-right"
                autoClose={3000}
                newestOnTop
                closeOnClick
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme={theme}
            />
            {children}
        </AppContext.Provider>
    );
};

export const useAppProvider = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppProvider must be used within an AppProvider");
    }
    return context;
};
