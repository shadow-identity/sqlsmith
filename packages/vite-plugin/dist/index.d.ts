import type { Plugin } from 'vite';
export interface SqlsmithPluginOptions {
    input: string;
    output: string;
    dialect?: 'postgresql' | 'mysql' | 'sqlite' | 'bigquery';
    watch?: boolean;
}
export declare function sqlsmith(options: SqlsmithPluginOptions): Plugin;
//# sourceMappingURL=index.d.ts.map