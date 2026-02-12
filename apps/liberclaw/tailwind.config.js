/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        claw: {
          orange: "#ff5e00",
          "orange-light": "#ff8533",
          "orange-dark": "#cc4b00",
          red: "#ff003c",
          "red-light": "#ff3366",
        },
        surface: {
          base: "#0a0810",
          raised: "#131018",
          overlay: "#1a1424",
          border: "#2a2235",
        },
        text: {
          primary: "#f0ede8",
          secondary: "#8a8494",
          tertiary: "#5a5464",
          inverse: "#0a0810",
        },
        status: {
          running: "#00e676",
          deploying: "#ffab00",
          failed: "#ff1744",
          stopped: "#546e7a",
        },
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrainsMono", "Menlo", "monospace"],
      },
      borderRadius: {
        card: "12px",
        button: "8px",
      },
      boxShadow: {
        "glow-sm": "0 0 8px rgba(255, 94, 0, 0.15)",
        "glow-md": "0 0 16px rgba(255, 94, 0, 0.2)",
        "glow-lg": "0 0 32px rgba(255, 94, 0, 0.25)",
      },
    },
  },
  plugins: [],
};
