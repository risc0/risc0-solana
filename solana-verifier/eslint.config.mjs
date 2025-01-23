import typescriptEslint from "@typescript-eslint/eslint-plugin";
import unusedImports from "eslint-plugin-unused-imports";
import spellcheck from "eslint-plugin-spellcheck";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ),
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "unused-imports": unusedImports,
      spellcheck,
    },

    ignores: [
      "scripts/bad-verifier",
      "scripts/groth16",
      "loaderV3",
      "loaderV4",
      "verify-router",
    ],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: "module",

      parserOptions: {
        project: ["./tsconfig.json"],
      },
    },

    rules: {
      "unused-imports/no-unused-imports": "error",

      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],

      "spellcheck/spell-checker": [
        "warn",
        {
          skipWords: [
            "nestjs",
            "axios",
            "typeorm",
            "lodash",
            "verifier",
            "rpc",
            "estop",
            "upgradable",
            "groth",
            "bpf",
            "localhost",
            "pda",
            "uint8",
            "lamports",
            "solana",
            "keypair",
            "codec",
            "chai",
            "deployer",
            "pubkey",
            "verifiers",
            "struct",
            "idl",
            "ownable",
            "utf8",
            "readonly",
            "metas",
          ],
          skipIfMatch: ["http://[^s]*", "^\\/\\/.*"],
          minLength: 3,
        },
      ],

      "no-console": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
];
