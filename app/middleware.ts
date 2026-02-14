import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LOCALES = ["en", "uk", "ru"] as const;
const DEFAULT_LOCALE = "en";

type Locale = (typeof LOCALES)[number];

function getPreferredLocale(request: NextRequest): Locale {
    const cookieLocale = request.cookies.get("locale")?.value;
    if (cookieLocale && LOCALES.includes(cookieLocale as Locale)) {
        return cookieLocale as Locale;
    }

    const acceptLanguage = request.headers.get("accept-language");
    if (acceptLanguage) {
        const browserLocales = acceptLanguage
            .split(",")
            .map((lang) => lang.split(";")[0].trim().split("-")[0]);

        const matched = browserLocales.find((lang) =>
            LOCALES.includes(lang as Locale),
        );
        if (matched) return matched as Locale;
    }

    return DEFAULT_LOCALE;
}

export function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    const pathSegments = pathname.split("/");
    const firstSegment = pathSegments[1];

    const firstSegmentIsLocale = LOCALES.includes(firstSegment as Locale);
    const firstSegmentIsInvalid = firstSegment !== "" && !firstSegmentIsLocale;

    if (firstSegmentIsLocale) {
        return NextResponse.next();
    }

    const preferredLocale = getPreferredLocale(request);

    if (pathname === "/") {
        return NextResponse.redirect(
            new URL(`/${preferredLocale}`, request.url),
        );
    }

    if (firstSegmentIsInvalid) {
        return NextResponse.redirect(
            new URL(`/${preferredLocale}${pathname}`, request.url),
        );
    }

    return NextResponse.redirect(new URL(`/${preferredLocale}`, request.url));
}

export const config = {
    matcher: ["/((?!_next|api|.*\\.[^/]*$).*)"],
};
