import { MarkdownPostProcessorContext, setIcon, Notice, TFile } from "obsidian"
import ObjectsCache from "../objectsCache"
import JiraClient from "../client/jiraClient"
import RC from "./renderingCommon"
import { getAccountByAlias } from "../utils"
import { syncIssueContent } from "./issueSync"
import { ObsidianApp } from "../globals"
import { SearchView } from "../searchView"
import { ISearchColumn } from "../interfaces/settingsInterfaces"

export const SyncFenceRenderer = async (source: string, rootEl: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> => {
    const lines = source.split('\n')
    let key = ''
    let accountAlias = ''
    let lastSync = ''
    let columnsString = ''

    for (const line of lines) {
        const parts = line.split(':')
        const k = parts[0].trim()
        const v = parts.slice(1).join(':').trim()
        
        if (k === 'key') key = v
        if (k === 'account') accountAlias = v
        if (k === 'last_sync') lastSync = v
        if (k === 'columns') columnsString = v
    }

    if (!key) {
        RC.renderSearchError(rootEl, 'Missing key', null)
        return
    }

    const container = createDiv({ cls: 'jira-shadow-sync-container' })

    const info = createSpan({ text: `Last sync: ${lastSync || 'Never'}`, parent: container })

    const syncBtn = createEl('button', { text: 'Sync Now', parent: container })
    setIcon(syncBtn, 'sync-small')

    syncBtn.onclick = async () => {
        syncBtn.disabled = true
        syncBtn.setText('Syncing...')
        try {
            const account = getAccountByAlias(accountAlias)
            const issue = await JiraClient.getIssue(key, { account })
            
            // Re-use logic to update current file
            // Need to know current file path or TFile
            const file = ObsidianApp.vault.getAbstractFileByPath(ctx.sourcePath)
            
            let fileColumns: ISearchColumn[] = null
            if (columnsString) {
                try {
                    fileColumns = SearchView.parseColumns(columnsString)
                } catch (err) {
                    console.warn('Failed to parse columns from sync block', err)
                }
            }

            if (file instanceof TFile) {
                 await syncIssueContent(issue, file, fileColumns) 
                 new Notice(`Jira Shadow: ${key} synced successfully`)
            } else {
                 new Notice(`Jira Shadow: Could not find current file`)
            }

        } catch (e) {
            new Notice(`Jira Shadow: Sync failed - ${e.message}`)
            console.error(e)
        } finally {
            syncBtn.disabled = false
            syncBtn.setText('Sync Now')
        }
    }

    rootEl.replaceChildren(container)
}
