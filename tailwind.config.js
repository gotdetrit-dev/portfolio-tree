import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve content globs relative to this config file, not the process cwd,
// so Tailwind scans the right files regardless of where Vite is launched from.
// Forward slashes are required — fast-glob treats backslashes as escapes.
const root = dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/')

/** @type {import('tailwindcss').Config} */
export default {
  content: [`${root}/index.html`, `${root}/src/**/*.{js,jsx}`],
  theme: {
    extend: {},
  },
  plugins: [],
}
