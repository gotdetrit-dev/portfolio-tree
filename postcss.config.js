import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Point Tailwind at this project's config explicitly. Tailwind otherwise
// discovers the config relative to the process cwd, which breaks when Vite
// is launched from a different directory.
const here = dirname(fileURLToPath(import.meta.url))

export default {
  plugins: {
    tailwindcss: { config: join(here, 'tailwind.config.js') },
    autoprefixer: {},
  },
}
