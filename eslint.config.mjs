import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    eslintConfigPrettier,
    eslintPluginPrettier,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/explicit-function-return-type': 'error',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-unnecessary-type-assertion': 'error',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'max-lines-per-function': ['warn', { max: 40, skipBlankLines: true, skipComments: true }],
            complexity: ['error', 10],
            'max-params': ['warn', 4],
        },
    },
    {
        files: ['**/*.test.ts'],
        rules: {
            'max-lines-per-function': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
        },
    },
    {
        ignores: ['dist/**', 'coverage/**', 'node_modules/**', '*.config.*', '_configs/**'],
    }
);
