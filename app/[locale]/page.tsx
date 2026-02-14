"use client";
import Link from "next/link";
import { useAppProvider } from "./_components/AppProvider";

export default function Home() {
    const { locale } = useAppProvider();
    return (
        <main className="flex-1 w-full max-w-5xl flex flex-col gap-8 p-6 items-center justify-center">
            <h1 className="text-5xl font-bold -mt-32">
                Ceratora - Coming Soon
            </h1>
            <Link
                href={`/${locale}/image-tools`}
                className="px-4 py-2 border border-neutral-300 rounded-xl w-fit"
            >
                Image Toolkit
            </Link>
        </main>
    );
}
