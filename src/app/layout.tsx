import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { MARK } from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Gelbien", template: "%s · Gelbien" },
  description: "Personal finance tracker — expenses, budgets and insights, with your data in your own Google Sheet.",
  applicationName: "Gelbien",
  appleWebApp: { capable: true, title: "Gelbien", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// The intro plays once per launch (a home-screen app starts a new session when it's opened again after
// being closed); a reload, another tab of the same session or "reduce motion" go straight in.
const introScript = `try{var d=document.documentElement;if(sessionStorage.getItem("gelbien.intro")||matchMedia("(prefers-reduced-motion: reduce)").matches){d.dataset.intro="skip"}else{sessionStorage.setItem("gelbien.intro","1");d.dataset.intro="play"}}catch(e){document.documentElement.dataset.intro="skip"}`;

/** The coin flips in and is struck, the name rises, and the screen parts along a gold seam (see .intro in globals.css). */
function Intro() {
  return (
    <div className="intro" aria-hidden>
      <div className="intro__half intro__half--top" />
      <div className="intro__half intro__half--bottom" />
      <div className="intro__art">
        <svg viewBox="11 11 42 42" className="intro__coin">
          <defs>
            <clipPath id="intro-coin">
              <polygon points={MARK.coin} />
            </clipPath>
            <linearGradient id="intro-glint-fill" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#fff8e6" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff8e6" stopOpacity="0.7" />
              <stop offset="1" stopColor="#fff8e6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon className="intro__fill" points={MARK.coin} />
          <polygon className="intro__edge" points={MARK.coin} pathLength={1} />
          <polygon className="intro__rim" points={MARK.rim} />
          <path className="intro__g" d={MARK.g} pathLength={1} />
          <g clipPath="url(#intro-coin)">
            <g className="intro__glint">
              <rect x="-4" y="4" width="11" height="56" fill="url(#intro-glint-fill)" transform="rotate(20 32 32)" />
            </g>
          </g>
        </svg>
        <p className="intro__word">
          {Array.from("Gelbien", (c, i) => (
            <span key={i} style={{ ["--i" as string]: i }}>
              {c}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
      </head>
      <body className="min-h-full">
        <Intro />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
