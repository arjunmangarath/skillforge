import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className)}
    >
      {/* Brain left lobe */}
      <path
        d="M8 14c0-3.5 2-6 5-6.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5c3 .5 5 3 5 6.5 0 1.5-.4 2.9-1.1 4H9.1A7.9 7.9 0 0 1 8 14z"
        fill="currentColor"
        opacity="0.25"
      />
      {/* Brain outline */}
      <path
        d="M9.1 18H8.5A3.5 3.5 0 0 1 5 14.5C5 12.6 6.1 11 7.7 10.4A6.5 6.5 0 0 1 7 7.5C7 4.46 9.46 2 12.5 2c.98 0 1.9.27 2.68.74A4.5 4.5 0 0 1 19.5 2a4.5 4.5 0 0 1 4.46 4.02A3.5 3.5 0 0 1 27 9.5c0 1.19-.6 2.24-1.5 2.88V14a4 4 0 0 1-4 4H9.1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Brain center line */}
      <path
        d="M16 4v10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* Left bumps */}
      <path
        d="M8.5 10.5 Q11 9 11 12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      {/* Right bumps */}
      <path
        d="M23.5 10.5 Q21 9 21 12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      {/* Thunderbolt overlay — centered, punching through */}
      <path
        d="M18.5 14 L14 21.5 h4 L13.5 30 L22 19.5 h-4.5 L20 14z"
        fill="#6366f1"
        stroke="#6366f1"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
