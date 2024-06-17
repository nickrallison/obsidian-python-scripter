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
	promptedArgs: { [index: string]: boolean[] };
	dotFiles: { [index: string]: string };
	// useLastFile: boolean;
}

const DEFAULT_SETTINGS: PythonScripterSettings = {
	pythonPath: "",
	pythonExe: "",
	pythonIndividualExes: {},
	passVaultPath: {},
	passCurrentFile: {},
	additionalArgs: {},
	promptedArgs: {},
	dotFiles: {}
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
					fs.stat(filePath, async (err: any, stats: { isFile: () => any; isDirectory: () => any; }) => {
						if (err) {
							console.error(err);
							return;
						}

						// Fixing relative paths
						let dot_files = this.settings.dotFiles[fileName];
						if (dot_files != undefined && !path.isAbsolute(dot_files)) {
							dot_files = path.join(basePath, dot_files);
						}

						// Setting Environment Variables
						if (fileName in this.settings.dotFiles) {
							if (!fs.existsSync(dot_files)) {
								new Notice(`Error: ${dot_files} does not exist`)
								console.log(`Error: ${dot_files} does not exist`)
								return;
							}
							let dotFile = fs.readFileSync(dot_files, 'utf8');
							let lines = dotFile.split("\n");
							for (var i = 0; i < lines.length; i++) {
								let line = lines[i].split("=");
								if (line.length == 2) {
									process.env[line[0]] = line[1];
								}
							}
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

						var len = this.settings.additionalArgs[fileName].length;
						var buffer = 0;
						var args: string[] = [];
						if (this.settings.passVaultPath[fileName]) {
							buffer++;
						}
						if (this.settings.passCurrentFile[fileName]) {
							buffer++;
						}

						// args.fill("", 0, len + buffer)


						if (this.settings.passVaultPath[fileName]) {
							let get_vault_path = true;
							let get_file_path = true;
							if (this.settings.passVaultPath[fileName] === undefined) {
								this.settings.passVaultPath[fileName] = true;
								get_vault_path = true;
								this.saveSettings();
							}
							if (this.settings.passCurrentFile[fileName] === undefined) {
								this.settings.passCurrentFile[fileName] = true;
								get_file_path = true;
								this.saveSettings();
							}
							var args: string[] = [];
							if (get_vault_path) {
								args.push(basePath);
							}
							if (get_file_path) {
								var local_current_file_path = this.app.workspace.getActiveFile()?.path?.toString();
								if (!(local_current_file_path === undefined)) {
									args.push(local_current_file_path);
								} else {
									args.push("");
								}
							}
							if (this.settings.additionalArgs[fileName] === undefined) {
								this.settings.additionalArgs[fileName] = [];
							}
							for (var i = 0; i < this.settings.additionalArgs[fileName].length; i++) {
								let done = false;
								if (this.settings.promptedArgs[fileName][i]) {
									new Notice(`Prompting user for input for ${fileName} argument ${i + 1}`);
									console.log(`Prompting user for input for ${fileName} argument ${i + 1}`);
									let done = false;
									let modal = new ModalForm(this.app, (result) => {
										args[i + buffer] = result;
										done = true;
									});
									modal.open();


								} else {
									done = true;
									args[i + buffer] = this.settings.additionalArgs[fileName][i];
								}

								// Waiting on user input
								while (args[i + buffer] == undefined) {
									await sleep(20);

								}
								console.log(`Arg ${i + 1}: ${args[i + buffer]}`);
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
		// Create an area with preable information
		this.containerEl.createEl("p", { text: `Use the following areas to set settings per script, paths provided may either be absolute or relative to the vault path.` });

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
				.setName(`${file} .env File`)
				.setDesc(`Provides Runtime Environment Variables for ${file}`)
				.addTextArea((area) => {
					area
						.setValue(this.plugin.settings.dotFiles[file])
						.onChange(async (value) => {
							this.plugin.settings.dotFiles[file] = value;
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
							this.plugin.settings.promptedArgs[file].push(false);
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
							this.plugin.settings.promptedArgs[file].pop();
							await this.plugin.saveSettings();
							this.display();
						}).setIcon("minus");
				});
			if (!(file in this.plugin.settings.additionalArgs)) {
				this.plugin.settings.additionalArgs[file] = [];
			}
			if (!(file in this.plugin.settings.promptedArgs)) {
				this.plugin.settings.promptedArgs[file] = [];
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
					new Setting(containerEl)
						.setName(`Prompt User`)
						.setDesc(`Whether to prompt user for manual input for arg ${i + 3}`)
						.addToggle((area) => {
							area
								.setValue(this.plugin.settings.promptedArgs[file][i])
								.onChange(async (value) => {
									this.plugin.settings.promptedArgs[file][i] = value;
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
					new Setting(containerEl)
						.setName(`Prompt User`)
						.setDesc(`Whether to prompt user for manual input for arg ${i + 2}`)
						.addToggle((area) => {
							area
								.setValue(this.plugin.settings.promptedArgs[file][i])
								.onChange(async (value) => {
									this.plugin.settings.promptedArgs[file][i] = value;
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
					new Setting(containerEl)
						.setName(`Prompt User`)
						.setDesc(`Whether to prompt user for manual input for arg ${i + 2}`)
						.addToggle((area) => {
							area
								.setValue(this.plugin.settings.promptedArgs[file][i])
								.onChange(async (value) => {
									this.plugin.settings.promptedArgs[file][i] = value;
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
					new Setting(containerEl)
						.setName(`Prompt User`)
						.setDesc(`Whether to prompt user for manual input for arg ${i + 1}`)
						.addToggle((area) => {
							area
								.setValue(this.plugin.settings.promptedArgs[file][i])
								.onChange(async (value) => {
									this.plugin.settings.promptedArgs[file][i] = value;
									await this.plugin.saveSettings();
								});
						});
				}
			}


		}
	}



}

export class ModalForm extends Modal {
	result: string;
	onSubmit: (result: string) => void;

	constructor(app: App, onSubmit: (result: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h1", { text: "Specify your argument" });

		new Setting(contentEl)
			.setName("Argument")
			.addText((text) =>
				text.onChange((value) => {
					this.result = value
				}));

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Submit")
					.setCta()
					.onClick(() => {
						this.close();
						this.onSubmit(this.result);
					}));
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}

async function sleep(msec: number) {
	return new Promise(resolve => setTimeout(resolve, msec));
}