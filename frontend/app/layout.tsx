import type { Metadata } from "next";
import { Inter, Manrope, JetBrains_Mono, Plus_Jakarta_Sans, Sora } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { BrandingProvider } from "@/lib/branding-context";

// Primary UI face for the whole authenticated app - nav, forms, tables, buttons, body text.
const appSans = Inter({
  variable: "--font-app-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Headings face - page titles, section headers, dashboard headings.
const appHeading = Manrope({
  variable: "--font-app-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Technical/tabular data - ticket & asset IDs, IPs, logs, timestamps.
const appMono = JetBrains_Mono({
  variable: "--font-app-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Display face used only for the auth screens' brand panel headline - the rest of the (dense,
// data-heavy) admin UI keeps Inter/Manrope throughout via --font-sans/--font-heading.
const displayFont = Plus_Jakarta_Sans({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

// Landing page only (the "premium enterprise tech" theme) - Manrope for everything, Sora
// reserved for the hero's own headline. Neither is used anywhere in the authenticated app.
const landingSans = Manrope({
  variable: "--font-landing-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const landingDisplay = Sora({
  variable: "--font-landing-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Admin Portal",
  description: "Sign in to manage your organization.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${appSans.variable} ${appHeading.variable} ${appMono.variable} ${displayFont.variable} ${landingSans.variable} ${landingDisplay.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <BrandingProvider>
            <AuthProvider>
              {children}
              <Toaster richColors closeButton />
            </AuthProvider>
          </BrandingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
