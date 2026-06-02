import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isSupportedUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://");
}
