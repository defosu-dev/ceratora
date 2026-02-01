// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "./_components/AppProvider";
import Header from "./_components/Header";
import Footer from "./_components/Footer";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Ceratora - Image Processing Tools",
    description: "Convert, compress and edit images directly in your browser",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    // Встановлюємо тему
                                    const theme = localStorage.getItem('theme') ||
                                        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

                                    if (theme === 'dark') {
                                        document.documentElement.classList.add('dark');
                                    }

                                    // Встановлюємо мову
                                    const locale = localStorage.getItem('locale') ||
                                        navigator.language.split('-')[0] || 'en';

                                    document.documentElement.setAttribute('lang', locale);
                                } catch (e) {
                                    document.documentElement.setAttribute('lang', 'en');
                                }
                            })();
                        `,
                    }}
                />
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen items-center font-sans bg-white dark:bg-black`}
                suppressHydrationWarning
            >
                <AppProvider>
                    <Header />
                    {children}
                    <Footer />
                </AppProvider>
            </body>
        </html>
    );
}
