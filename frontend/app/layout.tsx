import type { Metadata } from "next";
import "./globals.css";
import { InterwovenKitProvider } from "./providers";

export const metadata: Metadata = {
  title: "FreeLaunch - Trustless Freelance Payments",
  description: "On-chain escrow for freelancers and clients on Initia",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('unhandledrejection', function(e) {
            if (e.reason && String(e.reason).includes('MetaMask')) {
              e.preventDefault();
            }
          });
        `}} />
        <InterwovenKitProvider>{children}</InterwovenKitProvider>
      </body>
    </html>
  );
}
