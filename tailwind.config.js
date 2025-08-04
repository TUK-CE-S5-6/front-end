// tailwind.config.js  (ESM)
import forms from '@tailwindcss/forms';
import lineClamp from '@tailwindcss/line-clamp';
import aspectRatio from '@tailwindcss/aspect-ratio';
import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['index.html', './src/**/*.{js,jsx,ts,tsx}'],
  plugins: [forms, lineClamp, aspectRatio, containerQueries],
};
