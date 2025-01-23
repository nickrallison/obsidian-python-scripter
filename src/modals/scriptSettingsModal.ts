// src/modals/scriptSettingsModal.ts
import { App, Modal, Setting, Notice, TextComponent } from 'obsidian';
import { ScriptSettings } from '../settings/scriptSettings';
import { ScriptSettingsTab } from '../settings/scriptSettingsTab';
import ScriptRunnerPlugin from '../main';

export class ScriptSettingsModal extends Modal {
    app: App;
    plugin: ScriptRunnerPlugin;
    scriptPath: string;
    scriptConfig: ScriptSettings;
    scriptSettingsTab: ScriptSettingsTab;
    predefinedArgsContainer: HTMLElement; // Container for predefined arguments

    constructor(app: App, plugin: ScriptRunnerPlugin, scriptPath: string, scriptConfig: ScriptSettings, scriptSettingsTab: ScriptSettingsTab) {
        super(app);
        this.app = app;
        this.plugin = plugin;
        this.scriptPath = scriptPath;
        this.scriptConfig = scriptConfig;
        this.scriptSettingsTab = scriptSettingsTab;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty(); // Clear the modal content
        contentEl.createEl('h2', { text: `Settings for ${this.scriptPath}` });

        // Run Directory setting
        new Setting(contentEl)
            .setName('Run Directory')
            .setDesc('Specify the directory relative to the vault root to run the script in. (Defaults to the vault root directory)')
            .addText(text => {
                text.setValue(this.scriptConfig.runDirectory || '')
                    .onChange(value => {
                        this.scriptConfig.runDirectory = value;
                    });
            });

        // Interpreter setting
        new Setting(contentEl)
            .setName('Interpreter')
            .setDesc('Specify the interpreter if needed. Leave blank if the script is directly executable.')
            .addText(text => {
                text.setValue(this.scriptConfig.interpreter || '')
                    .onChange(value => {
                        this.scriptConfig.interpreter = value;
                    });
            });

        // Arguments settings
        new Setting(contentEl)
            .setName('Include Current File Path')
            .setDesc('Pass the current file\'s relative path as an argument to the script.')
            .addToggle(toggle => {
                toggle.setValue(this.scriptConfig.arguments?.currentFile || false)
                    .onChange(value => {
                        if (!this.scriptConfig.arguments) this.scriptConfig.arguments = {};
                        this.scriptConfig.arguments.currentFile = value;
                    });
            });

        new Setting(contentEl)
            .setName('Include Vault Path')
            .setDesc('Pass the absolute path of the vault as an argument to the script.')
            .addToggle(toggle => {
                toggle.setValue(this.scriptConfig.arguments?.vaultPath || false)
                    .onChange(value => {
                        if (!this.scriptConfig.arguments) this.scriptConfig.arguments = {};
                        this.scriptConfig.arguments.vaultPath = value;
                    });
            });

        new Setting(contentEl)
            .setName('Include Clipboard Contents')
            .setDesc('Pass the contents of the clipboard as an argument to the script.')
            .addToggle(toggle => {
                toggle.setValue(this.scriptConfig.arguments?.clipboard || false)
                    .onChange(value => {
                        if (!this.scriptConfig.arguments) this.scriptConfig.arguments = {};
                        this.scriptConfig.arguments.clipboard = value;
                    });
            });

        new Setting(contentEl)
            .setName('Include Highlighted Contents')
            .setDesc('Pass the highlighted text as an argument to the script.')
            .addToggle(toggle => {
                toggle.setValue(this.scriptConfig.arguments?.highlight || false)
                    .onChange(value => {
                        if (!this.scriptConfig.arguments) this.scriptConfig.arguments = {};
                        this.scriptConfig.arguments.highlight = value;
                    });
            });

        // Predefined Arguments
        this.predefinedArgsContainer = contentEl.createEl('div');
        this.predefinedArgsContainer.createEl('h3', { text: 'Predefined Arguments' });

        // Render existing predefined arguments
        this.renderPredefinedArguments();

        // Number of Arguments to Prompt For
        new Setting(contentEl)
            .setName('Number of Arguments to Prompt For')
            .setDesc('Specify the number of arguments to prompt the user for.')
            .addText(text => {
                text.setValue(this.scriptConfig.arguments?.promptArgumentCount?.toString() || '0')
                    .onChange(value => {
                        if (!this.scriptConfig.arguments) this.scriptConfig.arguments = {};
                        this.scriptConfig.arguments.promptArgumentCount = parseInt(value) || 0;
                    });
            });

        // Run type settings
        new Setting(contentEl)
            .setName('Run Type')
            .setDesc('Choose how the script should be run.')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('command', 'Command')
                    .addOption('icon', 'Ribbon Icon')
                    .setValue(this.scriptConfig.runType || 'command')
                    .onChange(value => {
                        this.scriptConfig.runType = value as 'command' | 'icon';
                    });
            });

        // Output settings
        new Setting(contentEl)
            .setName('Output Type')
            .setDesc('Choose how the script output should be handled.')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('notice', 'Notice')
                    .addOption('insert', 'Insert into File')
                    .setValue(this.scriptConfig.output?.type || 'notice')
                    .onChange(value => {
                        if (!this.scriptConfig.output) this.scriptConfig.output = {};
                        this.scriptConfig.output.type = value as 'notice' | 'insert';
                    });
            });

        new Setting(contentEl)
            .setName('Output Location')
            .setDesc('Choose where the output should be inserted in the file (if output type is "insert").')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('end', 'End of File')
                    .addOption('cursor', 'Cursor Location')
                    .setValue(this.scriptConfig.output?.location || 'end')
                    .onChange(value => {
                        if (!this.scriptConfig.output) this.scriptConfig.output = {};
                        this.scriptConfig.output.location = value as 'end' | 'cursor';
                    });
            });

        // Save button
        new Setting(contentEl)
            .addButton(button => {
                button.setButtonText('Save')
                    .onClick(async () => {
                        // Save the updated settings
                        this.plugin.settings.scripts[this.scriptPath] = this.scriptConfig;
                        await this.plugin.saveSettings();
                        new Notice(`Settings for ${this.scriptPath} saved.`);
                        this.close();
                    });
            });
    }

    renderPredefinedArguments() {
        this.predefinedArgsContainer.empty(); // Clear the container
        this.predefinedArgsContainer.createEl('h3', { text: 'Predefined Arguments' });

        const predefinedArgs = this.scriptConfig.arguments?.predefined || [];
        predefinedArgs.forEach((arg, index) => {
            const setting = new Setting(this.predefinedArgsContainer)
                .setName(`Argument ${index + 1}`)
                .addText(text => {
                    text.setValue(arg)
                        .onChange(value => {
                            if (!this.scriptConfig.arguments) this.scriptConfig.arguments = {};
                            if (!this.scriptConfig.arguments.predefined) this.scriptConfig.arguments.predefined = [];
                            this.scriptConfig.arguments.predefined[index] = value;
                        });
                });

            // Add a "Remove" button beside each argument
            setting.addButton(button => {
                button.setButtonText('Remove')
                    .onClick(() => {
                        if (!this.scriptConfig.arguments || !this.scriptConfig.arguments.predefined) return;
                        this.scriptConfig.arguments.predefined.splice(index, 1); // Remove the argument
                        this.renderPredefinedArguments(); // Re-render the arguments
                    });
            });
        });

        new Setting(this.predefinedArgsContainer)
            .addButton(button => {
                button.setButtonText('Add Argument')
                    .onClick(() => {
                        if (!this.scriptConfig.arguments) this.scriptConfig.arguments = {};
                        if (!this.scriptConfig.arguments.predefined) this.scriptConfig.arguments.predefined = [];
                        this.scriptConfig.arguments.predefined.push('');
                        this.renderPredefinedArguments(); // Dynamically add the new input field
                    });
            });
    }

    onClose() {
        this.contentEl.empty();
        this.scriptSettingsTab.display();
    }
}