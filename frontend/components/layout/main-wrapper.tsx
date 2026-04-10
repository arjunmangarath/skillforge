"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";

  // Redirect to /login if no token stored (only when real Google OAuth is configured)
  useEffect(() => {
    if (isLoginPage) return;
    const token = localStorage.getItem("sf_token");
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const hasRealAuth = clientId && clientId !== "placeholder" && clientId !== "";
    if (hasRealAuth && !token) {
      router.replace("/login");
    } else if (!token) {
      // No real auth configured — auto-set dev token so API calls work
      localStorage.setItem("sf_token", "dev-token");
    }
  }, [pathname, isLoginPage, router]);

  if (isLoginPage) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <main className="ml-16 lg:ml-56 min-h-screen p-6">
      {children}
    </main>
  );
}
