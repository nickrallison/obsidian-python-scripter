// src/settings/scriptSettings.ts
export interface ScriptSettings {
    interpreter?: string;
    runDirectory?: string;  // Directory to run the script in
    arguments?: {
        currentFile?: boolean; // Include current file path
        vaultPath?: boolean;   // Include vault path
        clipboard?: boolean;   // Include clipboard contents
        highlight?: boolean;   // Include highlighted contents
        predefined?: string[]; // Predefined arguments
        promptArgumentCount?: number; // Number of arguments to prompt for
    };
    runType?: 'command' | 'icon';
    output?: {
        type?: 'notice' | 'insert';
        location?: 'end' | 'cursor';
    };
}