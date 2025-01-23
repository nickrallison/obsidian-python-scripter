// src/managers/scriptManager.ts
import { App, Notice, MarkdownView, FileSystemAdapter, Plugin } from 'obsidian';
import ScriptRunnerPlugin from '../main'; // Adjust the import path as necessary
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { ScriptSettings } from '../settings/scriptSettings';
import { PluginSettings } from '../settings/pluginSettings';

export class ScriptManager {
    app: App;
    plugin: ScriptRunnerPlugin;
    settings: PluginSettings;

    constructor(app: App, settings: PluginSettings, plugin: ScriptRunnerPlugin) {
        this.app = app;
        this.settings = settings;
        this.plugin = plugin;
    }

    runScript(scriptPath: string, scriptConfig: ScriptSettings, args: string[]) {
        let basePath = this.plugin.getBasePath();
        scriptPath = path.join(basePath, scriptPath);
        let interpreter: string | undefined = scriptConfig.interpreter;
        
        // Escape any unescaped quotes in the arguments
        const escapedArgs = args.map(arg => {
            // Replace any unescaped quotes with escaped quotes
            return `"${arg.replace(/"/g, '\\"')}"`;
        });
    
        // Quote the script path to handle spaces
        const quotedScriptPath = `"${scriptPath}"`;
    
        let cmd = scriptConfig.interpreter
            ? `"${scriptConfig.interpreter}" ${quotedScriptPath} ${escapedArgs.join(' ')}`
            : `${quotedScriptPath} ${escapedArgs.join(' ')}`;
    
        // check if command is executable
        this.plugin.log(`Running script: ${scriptPath}, with interpreter: ${interpreter}`, 'verbose');
        if (!this.isRunnable(interpreter, scriptPath)) {
            if (interpreter != undefined) {
                new Notice('Interpreter is not executable.', 5000);
                this.plugin.log(`Interpreter is not executable: ${interpreter}`, 'silent');
            } else {
                new Notice('Script is not executable.', 5000);
                this.plugin.log(`Script is not executable: ${scriptPath}`, 'silent');
            }
            return;
        }
    
        if (this.settings.verbosity === 'verbose') {
            this.plugin.log(`Executing command: ${cmd}`, 'verbose');
        }
    
        let scriptStartTime = Date.now();
        if (scriptConfig.runDirectory) {
            basePath = path.join(basePath, scriptConfig.runDirectory);
        }         
        process.chdir(basePath);
        console.log(`Running script: ${cmd} from ${basePath}`);
        exec(cmd, (error, stdout, stderr) => {
            // Handle output based on scriptConfig.output
            if (scriptConfig.output?.type === 'notice') {
                new Notice(stdout);
            } else if (scriptConfig.output?.type === 'insert') {
                const editor = (this.app.workspace.activeLeaf?.view as MarkdownView)?.editor;
                if (editor) {
                    if (scriptConfig.output.location === 'end') {
                        editor.replaceRange(stdout, { line: editor.lastLine(), ch: 0 });
                    } else if (scriptConfig.output.location === 'cursor') {
                        editor.replaceSelection(stdout);
                    }
                }
            }
    
            // Handle errors
            if (error) {
                new Notice('Error executing script.', 5000);
                this.plugin.log('Error executing script:', "silent");
            }
    
            const scriptEndTime = Date.now();
            const scriptDuration = scriptEndTime - scriptStartTime;
            new Notice(`Script executed successfully (took ${scriptDuration} ms), output: ${stdout}`, 5000);
            this.plugin.log(`Script executed successfully (took ${scriptDuration} ms), output: ${stdout}`, 'verbose');
            if (stderr) {
                this.plugin.log(`Script error: ${stderr}`, 'silent');
            }
        });
    }

    isRunnable(interpreter: string | undefined, scriptPath: string): boolean {
        // Check if the script exists
        try {
            fs.accessSync(scriptPath, fs.constants.F_OK);
        } catch (error) {
            this.plugin.log(`Script does not exist: ${scriptPath}`, 'silent');
            return false;
        }

        // Case 1: No interpreter specified
        if (!interpreter) {
            // The script itself must be executable
            if (!this.isExecutable(scriptPath)) {
                this.plugin.log(`Script is not executable and no interpreter is specified: ${scriptPath}`, 'silent');
                return false;
            }
            return true;
        }

        // Case 2: Interpreter is specified
        // The interpreter must be executable
        if (!this.isExecutable(interpreter)) {
            this.plugin.log(`Interpreter is not executable: ${interpreter}`, 'silent');
            return false;
        }

        // If the interpreter is specified, the script does not need to be executable
        return true;
    }

    private isExecutable(filePath: string): boolean {
        try {
            // On Windows, check if the file has an executable extension
            if (process.platform === 'win32') {
                const executableExtensions = ['.exe', '.bat', '.cmd'];
                const ext = path.extname(filePath).toLowerCase();
                if (!executableExtensions.includes(ext)) {
                    // If the file doesn't have an executable extension, it's not executable
                    return false;
                }
            }
            if (process.platform !== 'win32') {
                // On Unix-based systems, check if the file has the executable permission
                fs.accessSync(filePath, fs.constants.F_OK | fs.constants.X_OK);
            }
            return true;
        } catch (error) {
            // If the file doesn't exist, check if it's in the PATH
            if (error.code === 'ENOENT') {
                try {
                    const { execSync } = require('child_process');
                    let command: string;
                    if (process.platform === 'win32') {
                        // On Windows, use 'where' to check for the executable
                        command = `where ${filePath}`;
                    } else {
                        // On Unix-based systems, use 'which'
                        command = `which ${filePath}`;
                    }
                    execSync(command, { stdio: 'ignore' });
                    return true;
                } catch (err) {
                    return false;
                }
            }
            return false;
        }
    }
}