// src/main.ts
import { App, Plugin, FileSystemAdapter, Modal, TextComponent, Setting } from 'obsidian';
import { ScriptManager } from './managers/scriptManager';
import { ScriptExecutionModal } from './modals/scriptExecutionModal';
import { ScriptSettingsTab } from './settings/scriptSettingsTab';
import { ScriptSettings } from './settings/scriptSettings';
import { PluginSettings, DEFAULT_SETTINGS } from './settings/pluginSettings';

export default class ScriptRunnerPlugin extends Plugin {
    settings: PluginSettings;
    scriptManager: ScriptManager;
    ribbonIcons: Map<string, HTMLElement> = new Map(); // Track ribbon icons by script path

    async onload() {
        await this.loadSettings();
        this.scriptManager = new ScriptManager(this.app, this.settings, this);

        // Add settings tab
        this.addSettingTab(new ScriptSettingsTab(this.app, this));

        // Dynamically add commands and ribbon icons for each script
        this.addScriptCommandsAndIcons();
        this.refreshCommandsAndIcons();
    }

    onunload() {
        // Clean up ribbon icons
        this.ribbonIcons.forEach((icon) => icon.remove());
        this.ribbonIcons.clear();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.refreshCommandsAndIcons(); // Refresh commands and icons when settings are saved
    }

    getBasePath(): string {
        let basePath;
        if (this.app.vault.adapter instanceof FileSystemAdapter) {
            basePath = this.app.vault.adapter.getBasePath();
        } else {
            throw new Error('Cannot determine base path.');
        }
        return `${basePath}`;
    }

    log(message: string, level: 'verbose' | 'normal' | 'silent' = 'normal') {
        var logLevel: number = 0;
        var settingLogLevel: number = 0;
        switch (level) {
            case 'verbose':
                logLevel = 2;
                break;
            case 'normal':
                logLevel = 1;
                break;
            case 'silent':
                logLevel = 0;
                break;
        }
        switch (this.settings.verbosity) {
            case 'verbose':
                settingLogLevel = 2;
                break;
            case 'normal':
                settingLogLevel = 1;
                break;
            case 'silent':
                settingLogLevel = 0;
                break;
        }
        if (settingLogLevel >= logLevel) {
            console.log(`[ScriptRunner] ${message}`);
        }
    }

    addScriptCommandsAndIcons() {
        Object.keys(this.settings.scripts).forEach(scriptPath => {
            const scriptConfig = this.settings.scripts[scriptPath];

            // Add command for each script
            if (scriptConfig.runType === 'command') {
                this.log(`Adding command for script: ${scriptPath}`, 'verbose');
                this.addCommand({
                    id: `run-script-${scriptPath}`,
                    name: `Run Script: ${scriptPath}`,
                    callback: async () => {
                        const args = await this.promptForArguments(scriptConfig);
                        this.scriptManager.runScript(scriptPath, scriptConfig, args);
                    },
                });
            }

            // Add ribbon icon for each script
            if (scriptConfig.runType === 'icon') {
                this.log(`Adding ribbon icon for script: ${scriptPath}`, 'verbose');
                const icon = this.addRibbonIcon('play', `Run Script: ${scriptPath}`, async () => {
                    const args = await this.promptForArguments(scriptConfig);
                    this.scriptManager.runScript(scriptPath, scriptConfig, args);
                });
                this.ribbonIcons.set(scriptPath, icon); // Track the ribbon icon
            }
        });
    }

    refreshCommandsAndIcons() {
        // Clear existing commands
        // @ts-ignore - Accessing private property `commands`
        this.commands = {};

        // Clear existing ribbon icons
        this.ribbonIcons.forEach((icon) => icon.remove());
        this.ribbonIcons.clear();

        // Re-add commands and ribbon icons based on updated settings
        this.addScriptCommandsAndIcons();
    }

    async promptForArguments(scriptConfig: ScriptSettings): Promise<string[]> {
        const args: string[] = [];

        // add current file path argument
        if (scriptConfig.arguments?.currentFile) {
            var local_current_file_path = this.app.workspace.getActiveFile()?.path?.toString();
            if (!(local_current_file_path === undefined)) {
                args.push(local_current_file_path);
            } else {
                args.push("");
            }
        }

        // add vault path argument
        if (scriptConfig.arguments?.vaultPath) {
            args.push(this.getBasePath());
        }

        // add clipboard contents argument
        if (scriptConfig.arguments?.clipboard) {
            args.push(await navigator.clipboard.readText());
        }

        // add highlighted contents argument
        if (scriptConfig.arguments?.highlight) {
            const editor = this.app.workspace.activeEditor?.editor;
            if (editor) {
                const selectedText = editor.getSelection();
                args.push(selectedText || "");
            } else {
                args.push("");
            }
        }

        // Add predefined arguments
        if (scriptConfig.arguments?.predefined) {
            args.push(...scriptConfig.arguments.predefined);
        }

        // Prompt for arguments if promptArgumentCount is set
        if (scriptConfig.arguments?.promptArgumentCount && scriptConfig.arguments.promptArgumentCount > 0) {
            for (let i = 0; i < scriptConfig.arguments.promptArgumentCount; i++) {
                const arg = await this.promptForArgument(i + 1);
                if (arg !== null) {
                    args.push(arg);
                }
            }
        }

        return args;
    }

    async promptForArgument(index: number): Promise<string | null> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText(`Argument ${index}`);
            let inputValue = '';
            const input = new TextComponent(modal.contentEl)
                .setPlaceholder('Enter argument value')
                .onChange((value) => {
                    inputValue = value; // Store the input value
                });
            // Add a submit button
            new Setting(modal.contentEl)
                .addButton((btn) =>
                    btn
                        .setButtonText('Submit')
                        .setCta()
                        .onClick(() => {
                            resolve(inputValue); // Resolve with the input value
                            modal.close();
                        })
                );
            modal.open();
        });
    }
}

// Ensure the plugin is desktop-only
export const isDesktopOnly = true;