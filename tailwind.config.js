module.exports = {
  content: ["./App.tsx", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#171916",
        paper: "#f7f6f2",
        muted: "#777970",
        line: "#e5e5dc",
        moss: "#496347",
      },
    },
  },
  plugins: [],
};
