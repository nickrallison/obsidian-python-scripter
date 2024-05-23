import { App, Editor, FileSystemAdapter, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';


interface PythonScripterSettings {
	pythonPath: string;
	pythonExe: string;
	pythonIndividualExes: { [index: string]: any };
	// useLastFile: boolean;
}

const DEFAULT_SETTINGS: PythonScripterSettings = {
	pythonPath: "",
	pythonExe: "",
	pythonIndividualExes: {},
	// useLastFile: false
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
				id: "run-" + files[index],
				name: 'Run ' + files[index],
				callback: () => {
					fs.stat(filePath, (err: any, stats: { isFile: () => any; isDirectory: () => any; }) => {
						if (err) {
							console.error(err);
							return;
						}
						let python_exe = "";
						if (this.settings.pythonExe != "") {
							python_exe = this.settings.pythonExe
						}
						else {
							python_exe = "python"
						}

						if (fileName in this.settings.pythonIndividualExes) {
							python_exe = this.settings.pythonIndividualExes[fileName];
							if (!fs.existsSync(this.settings.pythonIndividualExes[fileName])) {
								new Notice(`Python Exe: ${this.settings.pythonIndividualExes[fileName]} for ${fileName} does not exist`)
								console.log(`Python Exe: ${this.settings.pythonIndividualExes[fileName]} for ${fileName} does not exist`)
								return;
							}

						}
						console.log(`Python Exe: ${python_exe}`)
						if (stats.isFile()) {
							// var  local_current_file_path = this.app.workspace.activeEditor?.file?.path;
							var local_current_file_path = this.app.workspace.getActiveFile()?.path?.toString();
							if (local_current_file_path === undefined) {
								// local_current_file_path = "";
								local_current_file_path = "";
							}



							exec(`${python_exe} \"${filePath}\" \"${basePath}\" \"${local_current_file_path}\"`, { cwd: this.pythonDirectory }, (error: any, stdout: any, stderr: any) => {
								if (error) {
									new Notice(`Error executing script ${filePath}: ${error}`);
									console.log(`Error executing script ${filePath}: ${error}`)
									return;
								}
								new Notice(`Script ` + fileName + ` output:\n${stdout}`);
								console.log(`Script ` + fileName + ` output:\n${stdout}`)
							});
						} else if (stats.isDirectory()) {
							var dir = path.join(filePath);
							var local_current_file_path = this.app.workspace.activeEditor?.file?.path;
							if (local_current_file_path === undefined) {
								local_current_file_path = "";
							}
							exec(`${python_exe} \"${path.join(filePath, "src", "main.py")}\" \"${basePath}\" \"${local_current_file_path}\"`, { cwd: dir }, (error: any, stdout: any, stderr: any) => {
								if (error) {
									new Notice(`Error executing folder program: ${error}`);
									console.log(`Error executing folder program: ${error}`)
									return;
								}
								new Notice(`Script ` + fileName + " " + basePath + ` output:\n${stdout}`);
								console.log(`Script ` + fileName + " " + basePath + ` output:\n${stdout}`)
							});
						}
					});

				}
			}
			this.addCommand(obsidianCommand);
		}

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new PythonScripterSettingTab(this.app, this, files));

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
	files: string[];

	constructor(app: App, plugin: PythonScripterPlugin, files: string[]) {
		super(app, plugin);
		this.plugin = plugin;
		this.files = files
	}

	display(): void {
		const { containerEl } = this;

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
		new Setting(containerEl)
			.setName('Default Python Executable')
			.setDesc('Defaults to python')
			.addText(text => text
				.setPlaceholder('Enter path or command')
				.setValue(this.plugin.settings.pythonExe)
				.onChange(async (value) => {
					this.plugin.settings.pythonExe = value;
					await this.plugin.saveSettings();
				}));

		for (var index = 0; index < this.files.length; index++) {
			let file = this.files[index];
			new Setting(containerEl)
				.setName(`${file} Python Executable`)
				.setDesc(`Overides the default python executable for ${file}`)
				.addTextArea((area) => {
					area
						.setValue(this.plugin.settings.pythonIndividualExes[file])
						.onChange(async (value) => {
							this.plugin.settings.pythonIndividualExes[file] = value;
							await this.plugin.saveSettings();
						});
				});
		}
	}

}
