"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Locale, LOCALES } from "@/lib/i18n";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface AppContextType {
    locale: Locale;
    theme: "light" | "dark";
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

    const [theme, setThemeState] = useState<"light" | "dark">("light");

    useEffect(() => {
        try {
            const saved = localStorage.getItem("theme") as
                | "light"
                | "dark"
                | null;
            if (saved) {
                setThemeState(saved);
                document.documentElement.classList.toggle(
                    "dark",
                    saved === "dark",
                );
            } else {
                const prefersDark = window.matchMedia(
                    "(prefers-color-scheme: dark)",
                ).matches;
                const next = prefersDark ? "dark" : "light";
                setThemeState(next);
                document.documentElement.classList.toggle("dark", prefersDark);
            }
        } catch {
            // ignore
        }
    }, []);

    const setLocale = (newLocale: Locale) => {
        const rest = pathname.replace(/^\/[a-z]{2}/, "") || "/";
        document.cookie = `locale=${newLocale}; path=/; max-age=31536000`;
        router.push(`/${newLocale}${rest}`);
    };

    const toggleTheme = () => {
        const next = theme === "light" ? "dark" : "light";
        setThemeState(next);
        localStorage.setItem("theme", next);
        document.documentElement.classList.toggle("dark", next === "dark");
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
