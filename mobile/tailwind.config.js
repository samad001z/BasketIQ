/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind compiles these class names to RN styles via Metro.
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ONE accent (green) drives all emphasis/CTAs.
        accent: {
          DEFAULT: "#16A34A",
          dark: "#15803D",
          light: "#E8F7EE", // soft tint for badges/best-option surfaces
        },
        // Text ramp.
        ink: {
          DEFAULT: "#0E1A13",
          soft: "#566159",
          muted: "#8B948D",
        },
        // Surfaces.
        surface: {
          DEFAULT: "#FFFFFF",
          sunken: "#F4F6F4", // app background / tiles
        },
        line: "#EAEEEB", // hairline borders / dividers
        // Platform brand colors (used only as small dots).
        blinkit: "#F5C518",
        zepto: "#7C3AED",
        instamart: "#F97316",
      },
      // Two families: Inter (text), Space Grotesk (display / prices).
      // Each weight is its own loaded family (see app/_layout.tsx).
      fontFamily: {
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
        "sans-bold": ["Inter_700Bold"],
        display: ["SpaceGrotesk_600SemiBold"],
        "display-bold": ["SpaceGrotesk_700Bold"],
      },
      borderRadius: {
        "4xl": "28px",
      },
    },
  },
  plugins: [],
};
