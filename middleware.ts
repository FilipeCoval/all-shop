// This file is no longer used for rewriting and can be safely removed.
// The rewriting logic has been moved to vercel.json for better performance and reliability.
export const config = {
  matcher: [], // Empty matcher ensures this middleware never runs.
};

export default function middleware() {
  // This is a no-op function to satisfy Vercel's build requirement for a default export.
  // The empty matcher in the config object ensures it's never actually invoked.
}
