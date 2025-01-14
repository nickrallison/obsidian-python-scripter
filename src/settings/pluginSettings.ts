// src/settings/pluginSettings.ts
import { ScriptSettings } from './scriptSettings';

export interface PluginSettings {
    scriptsFolder: string;
    scripts: { [key: string]: ScriptSettings };
    verbosity: 'verbose' | 'normal' | 'silent';
}

export const DEFAULT_SETTINGS: PluginSettings = {
    scriptsFolder: '.obsidian/scripts',
    scripts: {},
    verbosity: 'normal',
};