// src/settings/scriptSettings.ts
export interface ScriptSettings {
    interpreter?: string;
    arguments?: {
        currentFile?: boolean; // Include current file path
        vaultPath?: boolean;   // Include vault path
        clipboard?: boolean;   // Include clipboard contents
        predefined?: string[]; // Predefined arguments
        promptArgumentCount?: number; // Number of arguments to prompt for
        promptOptions?: string[]; // Predefined options for the prompt
    };
    communication?: 'socket' | 'std';
    runType?: 'command' | 'icon';
    output?: {
        type?: 'notice' | 'insert';
        location?: 'end' | 'cursor';
    };
}