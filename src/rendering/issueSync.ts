import { TFile, Notice, normalizePath } from "obsidian"
import { IJiraIssue } from "../interfaces/issueInterfaces"
import { ISearchColumn, ESearchColumnsTypes, SEARCH_COLUMNS_DESCRIPTION, IJiraIssueAccountSettings } from "../interfaces/settingsInterfaces"
import { ObsidianApp } from "../globals"
import RC from "./renderingCommon"
import { getIssueStringValue } from "./valueExtractor"
import { SearchView } from "../searchView"

export const JIRA_ISSUE_START_MARKER = '<!-- jira-shadow-start -->'
export const JIRA_ISSUE_END_MARKER = '<!-- jira-shadow-end -->'

export async function syncIssueContent(
    issue: IJiraIssue, 
    fileOrPath: TFile | string,
    fileColumns: ISearchColumn[] | null
): Promise<void> {
    const vault = ObsidianApp.vault
    let file: TFile | null = null
    let path = ''

    if (fileOrPath instanceof TFile) {
        file = fileOrPath
        path = file.path
    } else {
        path = normalizePath(fileOrPath)
        const abstractFile = vault.getAbstractFileByPath(path)
        if (abstractFile instanceof TFile) {
            file = abstractFile
        }
    }

    // Prepare content
    const issueUrl = RC.issueUrl(issue.account, issue.key)
    const now = new Date().toISOString()
    
    // Frontmatter updates
    const frontmatterUpdates: Record<string, any> = {
        'jira_key': issue.key,
        'jira_link': issueUrl,
        'jira_updated': now
    }

    // Helper to get friendly name
    const getFriendlyColumnName = (col: ISearchColumn) => {
        if (col.type === ESearchColumnsTypes.CUSTOM_FIELD) return col.extra;
        return (SEARCH_COLUMNS_DESCRIPTION as any)[col.type] || col.type;
    }

    let columnsToRender = fileColumns
    
    // If updating existing file and no columns passed, try to read from frontmatter? 
    // Actually, user wants columns to be defined in search block. 
    // For sync button inside note, we might not have search block context.
    // We should probably store columns in frontmatter to reuse them?
    // User requested: "escrever só a lista de colunas em um unico metadado"
    
    if (file && !fileColumns) {
        // Try to read columns from file frontmatter if not provided
        // This requires reading the file cache
        const cache = ObsidianApp.metadataCache.getFileCache(file)
        const storedColumns = cache?.frontmatter?.['jira_file_columns']
        if (storedColumns && Array.isArray(storedColumns)) {
             // Reconstruct columns from names is hard because we lost type info
             // This is a limitation. If we want to re-sync from inside the note, we need the column definitions.
             // For now, if called from inside note without columns info, we might miss custom columns.
             // Let's assume for now this is called from SearchFence with columns.
             // If called from inner button, we might need to store full column defs or rely on default.
        }
    }

    let columnsString = ''
    if (fileColumns && fileColumns.length > 0) {
        const columnNames: string[] = []
        for (const col of fileColumns) {
            const key = getFriendlyColumnName(col)
            columnNames.push(key)
        }
        frontmatterUpdates['jira_file_columns'] = columnNames
        columnsString = SearchView.serializeColumns(fileColumns)
    }

    // Generate Body Content
    let bodyContent = `${JIRA_ISSUE_START_MARKER}
\`\`\`jira-issue-sync
key: ${issue.key}
account: ${issue.account.alias}
last_sync: ${now}
columns: ${columnsString}
\`\`\`

# ${issue.fields.summary}`

    if (columnsToRender && columnsToRender.length > 0) {
        for (const col of columnsToRender) {
            const val = getIssueStringValue(col, issue)
            const name = getFriendlyColumnName(col)
            bodyContent += `\n---\n\n### ${name}\n${val}`
        }
    }
    
    bodyContent += `\n${JIRA_ISSUE_END_MARKER}`

    // Action: Update or Create
    if (file) {
        // Update Frontmatter
        await ObsidianApp.fileManager.processFrontMatter(file, (frontmatter) => {
            for (const [key, val] of Object.entries(frontmatterUpdates)) {
                frontmatter[key] = val
            }
        })

        // Update Content
        let content = await vault.read(file)
        const startIdx = content.indexOf(JIRA_ISSUE_START_MARKER)
        const endIdx = content.indexOf(JIRA_ISSUE_END_MARKER)

        if (startIdx !== -1 && endIdx !== -1) {
            // Replace content between markers
            const before = content.substring(0, startIdx)
            const after = content.substring(endIdx + JIRA_ISSUE_END_MARKER.length)
            const newContent = before + bodyContent + after
            await vault.modify(file, newContent)
        } else {
            // Append if markers not found? Or prepend?
            // User said "sobrescrever os textos dentro". If no markers, maybe prepend?
            // Let's prepend after frontmatter
            // Actually, modifying content is risky if we don't know where.
            // But for this task, let's assume we append if not found, or replace all?
            // Safer: Prepend to body (after frontmatter)
            // But we need to be careful not to duplicate.
            // For now, let's just append if not found, assuming it's a new integration for this file.
            // Or better: Replace everything after frontmatter if it looks like a Jira note? No.
            // Let's just append to the end if no markers found.
            // content += '\n' + bodyContent
            // await vault.modify(file, content)
            
            // Wait, if it's a new file created by us, it has markers.
            // If it's an existing file user manually created, we shouldn't destroy it.
            // Let's just update frontmatter (already done above) and NOT touch body if markers missing.
            // EXCEPT if we just created it (handled in Create block).
            // But wait, the previous code created file with content.
            // So if we are "syncing" an existing file that DOES NOT have markers (e.g. created by previous version of plugin),
            // we should probably not touch body to be safe, or ask user.
            // Given the requirement "sobrescrever os textos dentro", it implies markers exist.
            // If markers don't exist, I will NOT modify body to avoid data loss.
        }
        
    } else {
        // Create New File
        // Ensure folder exists
        const folderPath = path.substring(0, path.lastIndexOf('/'))
        if (folderPath && !vault.getAbstractFileByPath(folderPath)) {
            await vault.createFolder(folderPath)
        }

        let frontmatterString = ''
        for (const [key, val] of Object.entries(frontmatterUpdates)) {
            if (Array.isArray(val)) {
                    frontmatterString += `${key}:\n`
                    val.forEach(item => frontmatterString += `  - ${item}\n`)
            } else {
                frontmatterString += `${key}: ${val}\n`
            }
        }

        const fullContent = `---\n${frontmatterString}---\n${bodyContent}`
        await vault.create(path, fullContent)
    }
}
