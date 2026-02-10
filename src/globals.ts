import { App } from 'obsidian'

export let ObsidianApp: App = null

export function setObsidianApp(app: App) {
    ObsidianApp = app
}
