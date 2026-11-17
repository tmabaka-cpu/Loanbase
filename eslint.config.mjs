import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // CLAUDE.md: the domain layer holds the business rules and must not depend on
    // the web framework, the database or the worker.
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["next", "next/*", "react", "react-dom"], message: "The domain layer must not depend on the web framework." },
            { group: ["@/db", "@/db/*", "@/worker", "@/worker/*", "@/app", "@/app/*", "postgres", "drizzle-orm", "drizzle-orm/*", "pg-boss"], message: "The domain layer must not depend on the database, the worker or the app." },
          ],
        },
      ],
    },
  },
);
