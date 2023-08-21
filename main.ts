import { App, Editor, FileSystemAdapter, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';


interface PythonScripterSettings {
	pythonPath: string;
}

const DEFAULT_SETTINGS: PythonScripterSettings = {
	pythonPath: ""
}

export default class PythonScripterPlugin extends Plugin {
	settings: PythonScripterSettings;
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

		var files: string[] = fs.readdirSync(this.pythonDirectory);
		for (var index = 0; index < files.length; index++) {
			const filePath = path.join(this.pythonDirectory, files[index]);
			const fileName = files[index];
			const basePath = this.getBasePath();
			const obsidianCommand = {
				id: "run-"+files[index],
				name: 'Run '+files[index],
				callback: () => {
					fs.stat(filePath, (err: any, stats: { isFile: () => any; isDirectory: () => any; }) => {
						if (err) {
						  console.error(err);
						  return;
						}
						if (stats.isFile()) {
							exec(`python ${filePath} ${basePath}`, {cwd: this.pythonDirectory}, (error: any, stdout: any, stderr: any) => {
								if (error) {
									new Notice(`Error executing script ${filePath}: ${error}`);
									return;
								}
							  
								new Notice(`Script ` +  fileName + ` output:\n${stdout}`);
							});
						} else if (stats.isDirectory()) {
							var dir = path.join(filePath);
							var executable = path.join(".", filePath, "src", "main.py");
							exec(`python ${executable} ${basePath}`, {cwd: dir}, (error: any, stdout: any, stderr: any) => {
								if (error) {
									new Notice(`Error executing folder program: ${error}`);
									return;
								}
								new Notice(`Script ` +  fileName + " " + basePath + ` output:\n${stdout}`);
							});
						}
					  });
				
				}
			}
			this.addCommand(obsidianCommand);
		} 

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new PythonScripterSettingTab(this.app, this));

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

class PythonScripterSettingTab extends PluginSettingTab {
	plugin: PythonScripterPlugin;

	constructor(app: App, plugin: PythonScripterPlugin) {
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
