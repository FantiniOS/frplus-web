import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#09090b", // Zinco quase preto
        surface: "#18181b",    // Zinco escuro
        primary: "#3b82f6",    // Azul Vibrante
        secondary: "#a1a1aa",  // Cinza texto
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
export default config;