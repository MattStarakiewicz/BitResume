import type { NextConfig } from "next";

const isElectronExport = process.env.ELECTRON === "1";

const nextConfig: NextConfig = {
  ...(isElectronExport
    ? {
        output: "export" as const,
        images: { unoptimized: true },
        /* file:// w Electron — ścieżki muszą być względne do index.html, inaczej CSS/JS idą w „korzeń” dysku */
        assetPrefix: "./",
      }
    : {}),
};

export default nextConfig;
