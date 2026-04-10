import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { MainWrapper } from "@/components/layout/main-wrapper";

export const metadata: Metadata = {
  title: "SKILLFORGE — AI Learning Assistant",
  description: "Multi-agent AI system for personalized skill development",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Sidebar />
        <MainWrapper>{children}</MainWrapper>
      </body>
    </html>
  );
}
