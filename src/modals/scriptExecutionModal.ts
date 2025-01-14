// src/modals/scriptExecutionModal.ts
import { App, Modal, Setting, Notice, TextComponent } from 'obsidian';
import { ScriptManager } from '../managers/scriptManager';
import { PluginSettings } from '../settings/pluginSettings';
import { ScriptSettings } from '../settings/scriptSettings';

export class ScriptExecutionModal extends Modal {
    app: App;
    settings: PluginSettings;
    scriptManager: ScriptManager;
    selectedScript: string = '';
    commandPreview: HTMLElement;

    constructor(app: App, settings: PluginSettings, scriptManager: ScriptManager) {
        super(app);
        this.app = app;
        this.settings = settings;
        this.scriptManager = scriptManager;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Run Script' });

        // Dropdown to select script
        const scriptDropdown = new Setting(contentEl)
            .setName('Select Script')
            .setDesc('Choose a script to run.')
            .addDropdown(dropdown => {
                Object.keys(this.settings.scripts).forEach(scriptPath => {
                    dropdown.addOption(scriptPath, scriptPath);
                });
                dropdown.setValue('');
                dropdown.onChange(value => {
                    this.selectedScript = value;
                    this.updateCommandPreview();
                });
            });

        // Command Preview
        this.commandPreview = contentEl.createEl('p', { text: 'Command Preview: ' });

        // Run button
        new Setting(contentEl)
            .addButton(button => {
                button.setButtonText('Run Script')
                    .onClick(async () => {
                        const scriptConfig = this.settings.scripts[this.selectedScript];
                        const args: string[] = await this.getArgs(scriptConfig);
                        this.scriptManager.runScript(this.selectedScript, scriptConfig, args);
                        this.close();
                    });
            });

        this.updateCommandPreview();
    }

    async getArgs(scriptConfig: ScriptSettings): Promise<string[]> {
        const args: string[] = [];
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

    updateCommandPreview() {
        if (this.selectedScript) {
            const scriptConfig = this.settings.scripts[this.selectedScript];
            const cmd = scriptConfig.interpreter
                ? `${scriptConfig.interpreter} ${this.selectedScript}`
                : `${this.selectedScript}`;
            this.commandPreview.setText(`Command Preview: ${cmd}`);
        } else {
            this.commandPreview.setText('Command Preview: No script selected.');
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}