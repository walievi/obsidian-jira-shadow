import { App, Editor, MarkdownView, Notice, Plugin, WorkspaceLeaf } from 'obsidian'
import { JiraIssueSettingTab } from './settings'
import JiraClient from './client/jiraClient'
import ObjectsCache from './objectsCache'
import { SyncFenceRenderer } from './rendering/syncFenceRenderer'
import { setupIcons } from './icons/icons'
import API from './api/api'
import { JiraSidebarView, JIRA_SIDEBAR_VIEW_TYPE } from './views/jiraSidebarView'

export let ObsidianApp: App = null

export default class JiraIssuePlugin extends Plugin {
    private _settingTab: JiraIssueSettingTab
    public api = API

    async onload() {
        ObsidianApp = this.app
        this.registerAPI()
        this._settingTab = new JiraIssueSettingTab(this.app, this)
        await this._settingTab.loadSettings()
        this.addSettingTab(this._settingTab)
        JiraClient.updateCustomFieldsCache()
        // Load icons
        setupIcons()
        
        // Register View
        this.registerView(
            JIRA_SIDEBAR_VIEW_TYPE,
            (leaf) => new JiraSidebarView(leaf, this)
        )

        // Add Ribbon Icon
        this.addRibbonIcon('search', 'Jira Sync', () => {
            this.activateView()
        })

        // Fence rendering - Only keep Sync
        this.registerMarkdownCodeBlockProcessor('jira-issue-sync', SyncFenceRenderer)

        // Settings refresh
        this._settingTab.onChange(() => {
            ObjectsCache.clear()
            JiraClient.updateCustomFieldsCache()
        })

        // Commands
        this.addCommand({
            id: 'obsidian-jira-issue-clear-cache',
            name: 'Clear cache',
            callback: () => {
                ObjectsCache.clear()
                JiraClient.updateCustomFieldsCache()
                new Notice('JiraIssue: Cache cleaned')
            }
        })
        
        this.addCommand({
            id: 'open-jira-sidebar',
            name: 'Open Jira Sidebar',
            callback: () => {
                this.activateView()
            }
        })
    }

    async activateView() {
        const { workspace } = this.app
        let leaf: WorkspaceLeaf | null = null
        const leaves = workspace.getLeavesOfType(JIRA_SIDEBAR_VIEW_TYPE)

        if (leaves.length > 0) {
            leaf = leaves[0]
        } else {
            leaf = workspace.getRightLeaf(false)
            await leaf.setViewState({ type: JIRA_SIDEBAR_VIEW_TYPE, active: true })
        }
        workspace.revealLeaf(leaf)
    }

    onunload() {
        this._settingTab = null
    }

    private registerAPI() {
        // @ts-ignore
        window.$ji = API
    }
}
