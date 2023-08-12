import { App, Editor, FileSystemAdapter, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
var path = require('path');
var fs = require('fs');
const { exec } = require('child_process');
// Remember to rename these classes and interfaces!



interface MyPluginSettings {
	pythonPath: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	pythonPath: ""
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	pythonDirectory: string;

	getBasePath(): string {
        let basePath;
        // base path
        if (this.app.vault.adapter instanceof FileSystemAdapter) {
            basePath = this.app.vault.adapter.getBasePath();
        } else {
            throw new Error('Cannot determine base path.');
        }
        return `${basePath}`;
    }

	async onload() {
		await this.loadSettings();
		var basePath = this.getBasePath();
		var defaultRelativePath: string = path.join(this.app.vault.configDir, "scripts", "python");
		this.pythonDirectory = path.join(basePath, defaultRelativePath);
		if (this.settings.pythonPath != "") {
			this.pythonDirectory = path.join(basePath, this.settings.pythonPath);
		} else {
			this.pythonDirectory = path.join(basePath, defaultRelativePath);
		}
		try {
			this.app.vault.createFolder(this.pythonDirectory);
			//new Notice(this.pythonDirectory + " created");
		} catch (error) {
			new Notice("Error creating " + this.pythonDirectory);
		}




		var files: [string] = fs.readdirSync(this.pythonDirectory);
		for (var index = 0; index < files.length; index++) {
			const filePath = path.join(this.pythonDirectory, files[index]);
			const fileName = files[index];
			const obsidianCommand = {
				id: "run-"+files[index],
				name: 'Run '+files[index],
				callback: () => {
					exec(`python ${filePath}`, (error: any, stdout: any, stderr: any) => {
						if (error) {
							new Notice(`Error executing Python script: ${error}`);
							return;
						}
					  
						new Notice(`Python script ` +  fileName + ` output:\n${stdout}`);
					});
				}
			}
			this.addCommand(obsidianCommand);
		} 



		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Python Script Path')
			.setDesc('Defaults to config\\scripts\\python')
			.addText(text => text
				.setPlaceholder('Enter path')
				.setValue(this.plugin.settings.pythonPath)
				.onChange(async (value) => {
					this.plugin.settings.pythonPath = value;
					await this.plugin.saveSettings();
				}));
	}
}
