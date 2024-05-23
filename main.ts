import { App, Editor, FileSystemAdapter, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';


interface PythonScripterSettings {
	pythonPath: string;
	pythonExe: string;
	pythonIndividualExes: { [index: string]: string };
	passVaultPath: { [index: string]: boolean };
	passCurrentFile: { [index: string]: boolean };
	additionalArgs: { [index: string]: string[] };
	// useLastFile: boolean;
}

const DEFAULT_SETTINGS: PythonScripterSettings = {
	pythonPath: "",
	pythonExe: "",
	pythonIndividualExes: {},
	passVaultPath: {},
	passCurrentFile: {},
	additionalArgs: {},
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

						// Getting Executable
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

						// Getting Main File
						let main_file = "";
						if (stats.isFile()) {
							main_file = filePath;
						} else if (stats.isDirectory()) {
							main_file = path.join(filePath, "src", "main.py");
						}
						else {
							new Notice(`Error: ${filePath} is not a file or directory`)
							console.log(`Error: ${filePath} is not a file or directory`)
							return;
						}

						// Getting Arguments
						var args = [];
						if (this.settings.passVaultPath[fileName]) {
							args.push(basePath);
						}
						if (this.settings.passCurrentFile[fileName]) {
							var local_current_file_path = this.app.workspace.getActiveFile()?.path?.toString();
							if (!(local_current_file_path === undefined)) {
								args.push(local_current_file_path);
							} else {
								args.push("");
							}
						}
						for (var i = 0; i < this.settings.additionalArgs[fileName].length; i++) {
							args.push(this.settings.additionalArgs[fileName][i]);
						}

						// Running the script
						let command = `${python_exe} \"${main_file}\"`;
						for (var i = 0; i < args.length; i++) {
							command += ` \"${args[i]}\"`;
						}

						exec(command, { cwd: this.pythonDirectory }, (error: any, stdout: any, stderr: any) => {
							if (error) {
								new Notice(`Error executing script ${filePath}: ${error}`);
								console.log(`Error executing script ${filePath}: ${error}`)
								return;
							}
							new Notice(`Script ` + fileName + ` output:\n${stdout}`);
							console.log(`Script ` + fileName + ` output:\n${stdout}`)
						});
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
		this.containerEl.createEl("h1", { text: `Default Behavior` });
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
		this.containerEl.createEl("h1", { text: `Scripts` });
		for (var index = 0; index < this.files.length; index++) {
			let file = this.files[index];
			if (!(file in this.plugin.settings.passVaultPath)) {
				this.plugin.settings.passVaultPath[file] = true;
			}
			if (!(file in this.plugin.settings.passCurrentFile)) {
				this.plugin.settings.passCurrentFile[file] = true;
			}
			this.containerEl.createEl("h2", { text: `${file}` });
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
			new Setting(containerEl)
				.setName(`Pass Vault Path`)
				.setDesc(`Whether to pass the vault path to ${file}`)
				.addToggle((area) => {
					area
						.setValue(this.plugin.settings.passVaultPath[file])
						.onChange(async (value) => {
							this.plugin.settings.passVaultPath[file] = value;
							await this.plugin.saveSettings();
							this.display();
						});
				});
			new Setting(containerEl)
				.setName(`Pass Active File Path`)
				.setDesc(`Whether to pass the active file path to  to ${file}`)
				.addToggle((area) => {
					area
						.setValue(this.plugin.settings.passCurrentFile[file])
						.onChange(async (value) => {
							this.plugin.settings.passCurrentFile[file] = value;
							await this.plugin.saveSettings();
							this.display();
						});
				});
			this.containerEl.createEl("h3", { text: `Arguments` });
			new Setting(containerEl)
				.setName(`Add Argument`)
				.setDesc(``)
				.addButton((area) => {
					area
						.onClick(async (value) => {
							this.plugin.settings.additionalArgs[file].push("");
							await this.plugin.saveSettings();
							this.display();
						}).setIcon("plus");
				});
			new Setting(containerEl)
				.setName(`Remove Argument`)
				.setDesc(``)
				.addButton((area) => {
					area
						.onClick(async (value) => {
							this.plugin.settings.additionalArgs[file].pop();
							await this.plugin.saveSettings();
							this.display();
						}).setIcon("minus");
				});
			if (!(file in this.plugin.settings.additionalArgs)) {
				this.plugin.settings.additionalArgs[file] = [];
			}
			if (this.plugin.settings.passVaultPath[file] && this.plugin.settings.passCurrentFile[file]) {
				new Setting(containerEl)
					.setName(`Arg 1`)
					.addText((area) => {
						area
							.setValue("[vault path]")
							.setPlaceholder("[vault path]")
							.setDisabled(true)
					});
				new Setting(containerEl)
					.setName(`Arg 2`)
					.addText((area) => {
						area
							.setValue("[active file]")
							.setPlaceholder("[active file]")
							.setDisabled(true)
					});
				for (var i = 0; i < this.plugin.settings.additionalArgs[file].length; i++) {
					new Setting(containerEl)
						.setName(`Arg ${i + 3}`)
						.addText((area) => {
							area
								.setPlaceholder('Enter argument')
								.setValue(this.plugin.settings.additionalArgs[file][i])
								.onChange(async (value) => {
									this.plugin.settings.additionalArgs[file][i] = value;
									await this.plugin.saveSettings();
								});
						});
				}
			}
			else if (this.plugin.settings.passVaultPath[file] && !this.plugin.settings.passCurrentFile[file]) {
				new Setting(containerEl)
					.setName(`Arg 1`)
					.addText((area) => {
						area
							.setValue("[vault path]")
							.setPlaceholder("[vault path]")
							.setDisabled(true)
					});
				for (var i = 0; i < this.plugin.settings.additionalArgs[file].length; i++) {
					new Setting(containerEl)
						.setName(`Arg ${i + 2}`)
						.addText((area) => {
							area
								.setPlaceholder('Enter argument')
								.setValue(this.plugin.settings.additionalArgs[file][i])
								.onChange(async (value) => {
									this.plugin.settings.additionalArgs[file][i] = value;
									await this.plugin.saveSettings();
								});
						});
				}
			}
			else if (!this.plugin.settings.passVaultPath[file] && this.plugin.settings.passCurrentFile[file]) {
				new Setting(containerEl)
					.setName(`Arg 1`)
					.addText((area) => {
						area
							.setValue("[active file]")
							.setPlaceholder("[active file]")
							.setDisabled(true)
					});
				for (var i = 0; i < this.plugin.settings.additionalArgs[file].length; i++) {
					new Setting(containerEl)
						.setName(`Arg ${i + 2}`)
						.addText((area) => {
							area
								.setPlaceholder('Enter argument')
								.setValue(this.plugin.settings.additionalArgs[file][i])
								.onChange(async (value) => {
									this.plugin.settings.additionalArgs[file][i] = value;
									await this.plugin.saveSettings();
								});
						});
				}
			} else {
				for (var i = 0; i < this.plugin.settings.additionalArgs[file].length; i++) {
					new Setting(containerEl)
						.setName(`Arg ${i + 1}`)
						.addText((area) => {
							area
								.setPlaceholder('Enter argument')
								.setValue(this.plugin.settings.additionalArgs[file][i])
								.onChange(async (value) => {
									this.plugin.settings.additionalArgs[file][i] = value;
									await this.plugin.saveSettings();
								});
						});
				}
			}


		}
	}

}
