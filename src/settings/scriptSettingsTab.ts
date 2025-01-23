// src/settings/scriptSettingsTab.ts
import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import ScriptRunnerPlugin from '../main';
import { PluginSettings } from './pluginSettings';
import { ScriptSettingsModal } from '../modals/scriptSettingsModal';
import * as fs from 'fs';
import * as path from 'path';

export class ScriptSettingsTab extends PluginSettingTab {
    plugin: ScriptRunnerPlugin;
    constructor(app: App, plugin: ScriptRunnerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    // Method to list scripts in the directory
    async listScripts(): Promise<string[]> {
        const scriptsFolder = path.join(this.plugin.settings.scriptsFolder);
        // if the directory is an absolute path, print an error and return an empty array
        if (path.isAbsolute(this.plugin.settings.scriptsFolder)) {
            this.plugin.log(`Scripts directory path is absolute: ${this.plugin.settings.scriptsFolder}, change to local path`, 'silent');
            return [];
        }
        try {
            // Read the directory contents
            const items = await this.listFilesRecursive(scriptsFolder);
            return items;
        } catch (error) {
            this.plugin.log(`Scripts directory: ${scriptsFolder}`, 'verbose');

            this.plugin.log(`Error reading directory: ${error}`, 'silent');
            return [];
        }
    }

    async listFilesRecursive(dir: string): Promise<string[]> {
        try {
            let results: string[] = [];
            let dir_spaces_escaped = dir.replace(" ", "\ ");
            const items = await this.plugin.app.vault.adapter.list(dir_spaces_escaped);
            const scriptsFolder = path.join(this.plugin.app.vault.configDir, this.plugin.settings.scriptsFolder);

            // Add all files from current directory
            results = items.files.map((file) => {
                // Convert absolute paths to relative paths from scripts folder
                return file.replace(scriptsFolder + "/", "");
            });

            // cut all .git folders
            items.folders = items.folders.filter((folder) => !folder.includes('.git'));
      
            // Recursively process subdirectories
            for (const folder of items.folders) {
                const subResults = await this.listFilesRecursive(folder);
                results = results.concat(subResults);
            }
      
            return results;
        } catch (error) {
            this.plugin.log(`Error scanning directory ${dir}: ${error}`, "silent");
            return [];
        }
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();
    
        // Existing settings for verbosity and scripts folder
        new Setting(containerEl)
            .setName('Verbosity')
            .setDesc('Set the verbosity level for logging.')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('verbose', 'Verbose')
                    .addOption('normal', 'Normal')
                    .addOption('silent', 'Silent')
                    .setValue(this.plugin.settings.verbosity)
                    .onChange(async (value: 'verbose' | 'normal' | 'silent') => {
                        this.plugin.settings.verbosity = value;
                        await this.plugin.saveSettings();
                        new Notice(`Verbosity set to ${value}.`);
                    });
            });
    

        new Setting(containerEl)
            .setName("Scripts Folder")
            .setDesc("Select the folder containing your scripts.")
            .addText((text) => {
                text
                    .setValue(this.plugin.settings.scriptsFolder)
                    .onChange(async (value) => {
                        // Store the value but don't save yet
                        text.inputEl.value = value;
                    })
                    .inputEl.addEventListener("blur", async () => {
                        // Only save when the input loses focus
                        const value = text.inputEl.value;
                        this.plugin.settings.scriptsFolder = value;
                        await this.plugin.saveSettings();
                        new Notice("Scripts folder updated.");
                        this.display(); // Refresh the settings tab
                    });
            });
    
        // Dropdown to add a new script
        const scripts = await this.listScripts();
        this.plugin.log(`Scripts found: ${scripts}`, 'verbose');
        if (scripts.length > 0) {
            let selectedScript = '';
            new Setting(containerEl)
                .setName('Add Script')
                .setDesc('Select a script to add from the scripts folder.')
                .addDropdown(dropdown => {
                    dropdown.addOption('', 'Select a script…');
                    scripts.forEach(script => {
                        if (!this.plugin.settings.scripts[script]) {
                            dropdown.addOption(script, script);
                        }
                        else {
                            this.plugin.log(`Updating Dropdown for add script, Script "${script}" already exists in settings.`, 'verbose');
                        }
                    });
                    dropdown.onChange(value => {
                        selectedScript = value;
                        
                    });
                })
                .addButton(button => {
                    button.setButtonText('Add Script')
                        .onClick(async () => {
                            if (selectedScript === '') {
                                return new Notice('Please select a script.');
                            }
                            this.plugin.log(`Attempting to add script: "${selectedScript}"`, 'verbose');
                            if (!this.plugin.settings.scripts[selectedScript]) {
                                this.plugin.settings.scripts[selectedScript] = {};
                                await this.plugin.saveSettings();
                                new Notice(`Script "${selectedScript}" added.`);
                                this.plugin.log(`Script "${selectedScript}" added to settings.`, 'verbose');
                                this.display(); // Refresh the settings tab
                                
                            } else {
                                this.plugin.log(`Script "${selectedScript}" already exists in settings.`, 'verbose');
                            }
                        });
                });
    
            new Setting(containerEl)
                .setName('Remove Script')
                .setDesc('Select a script to remove from the available scripts.')
                .addDropdown(dropdown => {
                    dropdown.addOption('', 'Select a script…');
                    Object.keys(this.plugin.settings.scripts).forEach(script => {
                        dropdown.addOption(script, script);
                    });
                    dropdown.onChange(value => {
                        selectedScript = value;
                    });
                })
                .addButton(button => {
                    button.setButtonText('Remove Script')
                        .onClick(async () => {
                            if (selectedScript === '') {
                                return new Notice('Please select a script.');
                            }
                            this.plugin.log(`Attempting to remove script: "${selectedScript}"`, 'verbose');
                            if (this.plugin.settings.scripts[selectedScript]) {
                                delete this.plugin.settings.scripts[selectedScript];
                                await this.plugin.saveSettings();
                                new Notice(`Script "${selectedScript}" removed.`);
                                this.plugin.log(`Script "${selectedScript}" removed from settings.`, 'verbose');
                                this.display(); // Refresh the settings tab
                            }
                            else {
                                this.plugin.log(`Script "${selectedScript}" not found in settings.`, 'verbose');
                            }
                        });
                });
        } else {
            containerEl.createEl('p', { text: 'No scripts found in the specified folder.' });
        }
    
        // List of added scripts with command preview
        Object.keys(this.plugin.settings.scripts).forEach(scriptPath => {
            const scriptConfig = this.plugin.settings.scripts[scriptPath];
    
            // Command preview
            const commandPreview = scriptConfig.interpreter
                ? `${scriptConfig.interpreter} ${scriptPath}`
                : `${scriptPath}`;
    
            // Add placeholders for arguments
            const args: string[] = [];
            if (scriptConfig.arguments?.currentFile) {
                args.push('"[file path]"');
            }
            if (scriptConfig.arguments?.vaultPath) {
                args.push('"[vault path]"');
            }
            if (scriptConfig.arguments?.clipboard) {
                args.push('"[clipboard contents]"');
            }
            if (scriptConfig.arguments?.highlight) {
                args.push('"[highlighted contents]"');
            }
            if (scriptConfig.arguments?.predefined) {
                for (const arg of scriptConfig.arguments.predefined) {
                    args.push(`"${arg}"`);
                }
            }
            if (scriptConfig.arguments?.promptArgumentCount && scriptConfig.arguments.promptArgumentCount > 0) {
                for (let i = 0; i < scriptConfig.arguments.promptArgumentCount; i++) {
                    args.push(`"[prompted argument ${i + 1}]"`);
                }
            }
    
            const fullCommand = `${commandPreview} ${args.join(' ')}`;
    
            // Create a new setting for the script configuration
            const setting = new Setting(containerEl)
                .setName(`Configuration for ${scriptPath}`)
                .setDesc('Adjust settings for this script.')
                .addButton(button => {
                    button.setButtonText('Edit Settings')
                        .onClick(() => {
                            new ScriptSettingsModal(this.app, this.plugin, scriptPath, scriptConfig, this).open();
                        });
                });
            
            const exampleCommand = new Setting(containerEl)
                .setName(`Example Command for ${scriptPath}:`);
    
            // Add the command preview in its own row
            const commandPreviewRow = containerEl.createEl('div', {
                cls: 'command-preview-row',
            });
    
            const commandPreviewText = commandPreviewRow.createEl('textarea', {
                cls: 'command-preview-text',
                text: fullCommand,
            });
    
            // Apply CSS to make the textarea span the entire row and wrap or scroll
            commandPreviewText.style.width = '100%';
            commandPreviewText.style.height = 'auto';
            commandPreviewText.style.resize = 'vertical'; // Allow vertical resizing
            commandPreviewText.style.overflowY = 'auto';  // Add a vertical scrollbar if needed
            commandPreviewText.style.whiteSpace = 'pre-wrap'; // Allow text to wrap
            commandPreviewText.style.wordWrap = 'break-word'; // Break long words if necessary
            commandPreviewText.setAttribute('readonly', 'true'); // Make it read-only
        });
    }
}