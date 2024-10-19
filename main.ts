import { App, Editor, FileSystemAdapter, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

class Args {
	pass_vault_path: boolean;
	pass_current_file: boolean;

	additional_args: string[];
	additional_args_desc: string[];
	prompted: boolean[];
	length: number;

	pythonExe: string;
	dotFile: string;

	constructor(pass_vault_path: boolean, pass_current_file: boolean, additional_args: string[], additional_args_desc: string[], prompted: boolean[], pythonExe: string = "", dotFile: string = "") {
		this.pass_vault_path = pass_vault_path;
		this.pass_current_file = pass_current_file;

		this.additional_args = additional_args;
		this.additional_args_desc = additional_args_desc;
		this.prompted = prompted;
		this.length = additional_args.length;

		this.pythonExe = pythonExe;
		this.dotFile = dotFile;
	}
}

interface PythonScripterSettings {
	pythonPath: string;
	pythonExe: string;

	args: { [index: string]: Args };
	// useLastFile: boolean;
}

const DEFAULT_SETTINGS: PythonScripterSettings = {
	pythonPath: "",
	pythonExe: "",

	args: {},

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

						if (!(fileName in this.settings.args)) {
							this.settings.args[fileName] = new Args(true, true, [], [], []);
						}

						let additional_args = this.settings.args[fileName];

						// Setting Environment Variables
						let dot_file = additional_args.dotFile;
						if (dot_file != "") {
							// console.log(`${dot_file}`);
							if (!path.isAbsolute(dot_file)) {
								dot_file = path.join(basePath, dot_file);
							}
							if (!fs.existsSync(dot_file)) {
								new Notice(`Error: ${dot_file} does not exist`)
								console.log(`Error: ${dot_file} does not exist`)
								return;
							}
							let dotFile = fs.readFileSync(dot_file, 'utf8');
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


						if (additional_args.pythonExe != "") {
							python_exe = additional_args.pythonExe;
							if (!fs.existsSync(python_exe)) {
								new Notice(`Python Exe: $python_exe} for ${fileName} does not exist`)
								console.log(`Python Exe: ${python_exe} for ${fileName} does not exist`)
								return;
							}
						}

						// console.log(`Python Exe: ${python_exe}`)

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
						var args: string[] = [];
						var buffer = 0;

						let get_vault_path = additional_args.pass_vault_path;
						if (get_vault_path) {

							args.push(basePath);
							buffer++;
						}

						let get_file_path = additional_args.pass_current_file;
						if (get_file_path) {
							var local_current_file_path = this.app.workspace.getActiveFile()?.path?.toString();
							if (!(local_current_file_path === undefined)) {
								args.push(local_current_file_path);
							} else {
								args.push("");
							}
							buffer++;
						}

						for (var i = 0; i < additional_args.length; i++) {
							let done = false;
							if (additional_args.prompted[i]) {
								new Notice(`Prompting user for input for ${fileName} argument ${i + 1}`);
								console.log(`Prompting user for input for ${fileName} argument ${i + 1}`);
								let done = false;
								let modal = new ModalForm(this.app, additional_args, i ,(result) => {
									args[i + buffer] = result;
									done = true;
								});
								modal.open();


							} else {
								done = true;
								args[i + buffer] = additional_args.additional_args[i];
							}

							// Waiting on user input
							while (args[i + buffer] == undefined) {
								await sleep(20);

							}
							// console.log(`Arg ${i + 1}: ${args[i + buffer]}`);
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

	async display(): Promise<void> {
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
			if (!(file in this.plugin.settings.args)) {
				this.plugin.settings.args[file] = new Args(true, true, [], [], []);
				await this.plugin.saveSettings();
			}

			this.containerEl.createEl("h2", { text: `${file}` });
			new Setting(containerEl)
				.setName(`${file} Python Executable`)
				.setDesc(`Overides the default python executable for ${file}`)
				.addTextArea((area) => {
					area
						.setValue(this.plugin.settings.args[file].pythonExe)
						.onChange(async (value) => {
							this.plugin.settings.args[file].pythonExe = value;
							await this.plugin.saveSettings();
						});
				});
			new Setting(containerEl)
				.setName(`${file} .env File`)
				.setDesc(`Provides Runtime Environment Variables for ${file}`)
				.addTextArea((area) => {
					area
						.setValue(this.plugin.settings.args[file].dotFile)
						.onChange(async (value) => {
							this.plugin.settings.args[file].dotFile = value;
							await this.plugin.saveSettings();
						});
				});
			new Setting(containerEl)
				.setName(`Pass Vault Path`)
				.setDesc(`Whether to pass the vault path to ${file}`)
				.addToggle((area) => {
					area
						.setValue(this.plugin.settings.args[file].pass_vault_path)
						.onChange(async (value) => {
							this.plugin.settings.args[file].pass_vault_path = value;
							await this.plugin.saveSettings();
							this.display();
						});
				});
			new Setting(containerEl)
				.setName(`Pass Active File Path`)
				.setDesc(`Whether to pass the active file path to  to ${file}`)
				.addToggle((area) => {
					area
						.setValue(this.plugin.settings.args[file].pass_current_file)
						.onChange(async (value) => {
							this.plugin.settings.args[file].pass_current_file = value;
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
							this.plugin.settings.args[file].length++;
							resize(this.plugin.settings.args[file].additional_args, this.plugin.settings.args[file].length, "");
							resize(this.plugin.settings.args[file].additional_args_desc, this.plugin.settings.args[file].length,"")
							resize(this.plugin.settings.args[file].prompted, this.plugin.settings.args[file].length, false);
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
							this.plugin.settings.args[file].length--;
							resize(this.plugin.settings.args[file].additional_args, this.plugin.settings.args[file].length, "");
							resize(this.plugin.settings.args[file].additional_args_desc, this.plugin.settings.args[file].length,"")
							resize(this.plugin.settings.args[file].prompted, this.plugin.settings.args[file].length, false);
							await this.plugin.saveSettings();
							this.display();
						}).setIcon("minus");
				});

			if (this.plugin.settings.args[file].pass_vault_path && this.plugin.settings.args[file].pass_current_file) {
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
				for (var i = 0; i < this.plugin.settings.args[file].length; i++) {
					new Setting(containerEl)
						.setName(`Arg ${i + 3}`)
						.addText((area) => {
							const index = i;
							area
								.setPlaceholder('Enter argument')
								.setValue(this.plugin.settings.args[file].additional_args[index])
								.onChange((value) => {
									this.plugin.settings.args[file].additional_args[index] = value;
									this.plugin.saveSettings();
								});
						});
					new Setting(containerEl)
						.setName(`Description for Arg ${i + 3}`)
						.addText((area) => {
							const index = i;
							area
								.setPlaceholder('Enter Description')
								.setValue(this.plugin.settings.args[file].additional_args_desc[index])
								.onChange((value) => {
									this.plugin.settings.args[file].additional_args_desc[index] = value;
									this.plugin.saveSettings();
								});
						});
					new Setting(containerEl)
						.setName(`Prompt User for Arg ${i + 3}`)
						.setDesc(`Whether to prompt user for manual input for arg ${i + 3}`)
						.addToggle((area) => {
							const index = i;
							area
								.setValue(this.plugin.settings.args[file].prompted[i])
								.onChange((value) => {
									this.plugin.settings.args[file].prompted[index] = value;
									resize(this.plugin.settings.args[file].additional_args, this.plugin.settings.args[file].length, "");
									resize(this.plugin.settings.args[file].prompted, this.plugin.settings.args[file].length, false);
									this.plugin.saveSettings();
								});
						});
				}
			}
			else if (this.plugin.settings.args[file].pass_vault_path && !this.plugin.settings.args[file].pass_current_file) {
				new Setting(containerEl)
					.setName(`Arg 1`)
					.addText((area) => {
						area
							.setValue("[vault path]")
							.setPlaceholder("[vault path]")
							.setDisabled(true)
					});
				for (var i = 0; i < this.plugin.settings.args[file].length; i++) {
					new Setting(containerEl)
						.setName(`Arg ${i + 2}`)
						.addText((area) => {
							const index = i;
							area
								.setPlaceholder('Enter argument')
								.setValue(this.plugin.settings.args[file].additional_args[index])
								.onChange((value) => {
									this.plugin.settings.args[file].additional_args[index] = value;
									this.plugin.saveSettings();
								});
						});
					new Setting(containerEl)
						.setName(`Description for Arg ${i + 2}`)
						.addText((area) => {
							const index = i;
							area
								.setPlaceholder('Enter Description')
								.setValue(this.plugin.settings.args[file].additional_args_desc[index])
								.onChange((value) => {
									this.plugin.settings.args[file].additional_args_desc[index] = value;
									this.plugin.saveSettings();
								});
						});
					new Setting(containerEl)
						.setName(`Prompt User for Arg ${i + 2}`)
						.setDesc(`Whether to prompt user for manual input for arg ${i + 2}`)
						.addToggle((area) => {
							const index = i;
							area
								.setValue(this.plugin.settings.args[file].prompted[index])
								.onChange((value) => {
									this.plugin.settings.args[file].prompted[index] = value;
									resize(this.plugin.settings.args[file].additional_args, this.plugin.settings.args[file].length, "");
									resize(this.plugin.settings.args[file].prompted, this.plugin.settings.args[file].length, false);
									this.plugin.saveSettings();
								});
						});
				}
			}
			else if (!this.plugin.settings.args[file].pass_vault_path && this.plugin.settings.args[file].pass_current_file) {
				new Setting(containerEl)
					.setName(`Arg 1`)
					.addText((area) => {
						area
							.setValue("[active file]")
							.setPlaceholder("[active file]")
							.setDisabled(true)
					});
				for (var i = 0; i < this.plugin.settings.args[file].length; i++) {
					new Setting(containerEl)
						.setName(`Arg ${i + 2}`)
						.addText((area) => {
							const index = i;
							area
								.setPlaceholder('Enter argument')
								.setValue(this.plugin.settings.args[file].additional_args[index])
								.onChange((value) => {
									this.plugin.settings.args[file].additional_args[index] = value;
									this.plugin.saveSettings();
								});
						});
					new Setting(containerEl)
						.setName(`Description for Arg ${i + 2}`)
						.addText((area) => {
							const index = i;
							area
								.setPlaceholder('Enter Description')
								.setValue(this.plugin.settings.args[file].additional_args_desc[index])
								.onChange((value) => {
									this.plugin.settings.args[file].additional_args_desc[index] = value;
									this.plugin.saveSettings();
								});
						});
					new Setting(containerEl)
						.setName(`Prompt User for Arg ${i + 2}`)
						.setDesc(`Whether to prompt user for manual input for arg ${i + 2}`)
						.addToggle((area) => {
							const index = i;
							area
								.setValue(this.plugin.settings.args[file].prompted[i])
								.onChange((value) => {
									this.plugin.settings.args[file].prompted[index] = value;
									resize(this.plugin.settings.args[file].additional_args, this.plugin.settings.args[file].length, "");
									resize(this.plugin.settings.args[file].prompted, this.plugin.settings.args[file].length, false);
									this.plugin.saveSettings();
								});
						});
				}
			} else {
				for (var i = 0; i < this.plugin.settings.args[file].length; i++) {
					new Setting(containerEl)
						.setName(`Arg ${i + 1}`)
						.addText((area) => {
							const index = i;
							area
								.setPlaceholder('Enter argument')
								.setValue(this.plugin.settings.args[file].additional_args[i])
								.onChange(async (value) => {
									this.plugin.settings.args[file].additional_args[index] = value;
									await this.plugin.saveSettings();
								});
						});
					new Setting(containerEl)
						.setName(`Description for Arg ${i + 1}`)
						.addText((area) => {
							const index = i;
							area
								.setPlaceholder('Enter Description')
								.setValue(this.plugin.settings.args[file].additional_args_desc[index])
								.onChange((value) => {
									this.plugin.settings.args[file].additional_args_desc[index] = value;
									this.plugin.saveSettings();
								});
						});
					new Setting(containerEl)
						.setName(`Prompt User for Arg ${i + 1}`)
						.setDesc(`Whether to prompt user for manual input for arg ${i + 1}`)
						.addToggle((area) => {
							const index = i;
							area
								.setValue(this.plugin.settings.args[file].prompted[i])
								.onChange((value) => {
									this.plugin.settings.args[file].prompted[index] = value;
									resize(this.plugin.settings.args[file].additional_args, this.plugin.settings.args[file].length, "");
									resize(this.plugin.settings.args[file].prompted, this.plugin.settings.args[file].length, false);
									this.plugin.saveSettings();
								});
						});
				}
			}


		}
	}



}

export class ModalForm extends Modal {
	result: string;
	additional_args: Args;
	index: number;
	onSubmit: (result: string) => void;

	constructor(app: App, additional_args: Args, index: number, onSubmit: (result: string) => void) {
		super(app);
		this.additional_args = additional_args;
		this.index = index;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h1", { text: "Specify your argument" });

		new Setting(contentEl)
			.setName("Argument")
			.setDesc(`${this.additional_args.additional_args_desc[this.index]}`)
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

function resize(arr: any[], size: number, defval: any) {
	while (arr.length > size) { arr.pop(); }
	while (arr.length < size) { arr.push(defval); }
}