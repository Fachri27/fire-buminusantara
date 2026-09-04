import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/assets/**",
  ]),
  {
    files: ["hooks/**/*.ts"],
    rules: {
      // Hook kustom di sini memakai awalan Indonesia "gunakan", bukan "use" —
      // rules-of-hooks hanya mengenali awalan "use", jadi seluruh hook di
      // berkas ini salah dibaca sebagai "bukan hook" (positif palsu massal).
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    rules: {
      "react-hooks/set-state-in-effect": "error",
    },
  },
]);

export default eslintConfig;
