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
	pythonDirectoryRelative: string;

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
		var defaultRelativePath: string = path.join(".", this.app.vault.configDir, "scripts", "python");
		this.pythonDirectory = path.join(basePath, defaultRelativePath);
		this.pythonDirectoryRelative = defaultRelativePath
		if (this.settings.pythonPath != "") {
			this.pythonDirectory = path.join(basePath, this.settings.pythonPath);
			this.pythonDirectoryRelative = this.settings.pythonPath
		} else {
			this.pythonDirectory = path.join(basePath, defaultRelativePath);
			this.pythonDirectoryRelative = defaultRelativePath
		}
		console.log(this.pythonDirectoryRelative)
		try {
			await this.app.vault.createFolder(this.pythonDirectoryRelative);
			//new Notice(this.pythonDirectory + " created");
		} catch (error) {
			//new Notice("Error creating " + this.pythonDirectory);
		}





		var files: [string] = fs.readdirSync(this.pythonDirectory);
		for (var index = 0; index < files.length; index++) {
			const filePath = path.join(this.pythonDirectory, files[index]);
			const fileName = files[index];
			const obsidianCommand = {
				id: "run-"+files[index],
				name: 'Run '+files[index],
				callback: () => {
					fs.stat(filePath, (err: any, stats: { isFile: () => any; isDirectory: () => any; }) => {
						console.log(stats)
						if (err) {
						  console.error(err);
						  return;
						}
						if (stats.isFile()) {
							exec(`python ${filePath} ${this.pythonDirectory}`, {cwd: this.pythonDirectory}, (error: any, stdout: any, stderr: any) => {
								if (error) {
									new Notice(`Error executing script ${filePath}: ${error}`);
									return;
								}
							  
								new Notice(`Script ` +  fileName + ` output:\n${stdout}`);
							});
						} else if (stats.isDirectory()) {
							var dir = path.join(filePath);
							var executable = path.join(".", filePath, "src", "main.py");
							exec(`python ${executable} ${dir}`, {cwd: dir}, (error: any, stdout: any, stderr: any) => {
								if (error) {
									new Notice(`Error executing folder program: ${error}`);
									return;
								}
								new Notice(`Script ` +  fileName + ` output:\n${stdout}`);
							});
						}
					  });
				
				}
			}
			this.addCommand(obsidianCommand);
		} 




		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

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
			.setDesc('Defaults to .obsidian\\scripts\\python')
			.addText(text => text
				.setPlaceholder('Enter path')
				.setValue(this.plugin.settings.pythonPath)
				.onChange(async (value) => {
					this.plugin.settings.pythonPath = value;
					await this.plugin.saveSettings();
				}));
	}
}
