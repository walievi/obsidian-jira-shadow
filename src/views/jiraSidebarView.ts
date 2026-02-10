import { ItemView, WorkspaceLeaf, Notice, setIcon, setTooltip, Setting, ButtonComponent, TextComponent, TextAreaComponent, Modal, App, FuzzySuggestModal, TFolder } from 'obsidian'
import { SettingsData } from '../settings'
import JiraClient from '../client/jiraClient'
import { ISavedQuery, ISearchColumn } from '../interfaces/settingsInterfaces'
import { syncIssueContent } from '../rendering/issueSync'
import { SearchView } from '../searchView'
import JiraIssuePlugin from '../main'

export const JIRA_SIDEBAR_VIEW_TYPE = 'jira-shadow-sidebar-view'

export class JiraSidebarView extends ItemView {
    plugin: JiraIssuePlugin
    currentQueryId: string | null = null
    
    // UI Elements
    nameInput: TextComponent
    queryInput: TextAreaComponent
    destinationInput: TextComponent
    fileColumnsInput: TextAreaComponent
    resultsContainer: HTMLElement
    homeContainer: HTMLElement
    queryContainer: HTMLElement
    queryListContainer: HTMLElement
    searchTerm = ''

    constructor(leaf: WorkspaceLeaf, plugin: JiraIssuePlugin) {
        super(leaf)
        this.plugin = plugin
    }

    getViewType(): string {
        return JIRA_SIDEBAR_VIEW_TYPE
    }

    getDisplayText(): string {
        return 'Jira Shadow'
    }

    getIcon(): string {
        return 'search'
    }

    async onOpen() {
        const container = this.containerEl.children[1]
        container.empty()
        container.addClass('jira-sidebar-view')

        // Create main containers
        this.homeContainer = container.createDiv({ cls: 'jira-home-container' })
        this.queryContainer = container.createDiv({ cls: 'jira-query-container' })
        this.queryContainer.hide()

        this.renderHome()
        this.renderQueryForm()
    }

    renderHome() {
        this.homeContainer.empty()
        
        const header = this.homeContainer.createDiv({ cls: 'jira-home-header' })

        header.createEl('h3', { text: 'Saved filters' })
        
        new ButtonComponent(header)
            .setButtonText('New filter')
            .setCta()
            .onClick(() => this.openQuery(null))

        // Search Input
        const searchContainer = this.homeContainer.createDiv({ cls: 'jira-search-container' })
        
        new TextComponent(searchContainer)
            .setPlaceholder('Search filters...')
            .setValue(this.searchTerm)
            .onChange((value) => {
                this.searchTerm = value
                this.renderQueryList()
            })

        this.queryListContainer = this.homeContainer.createDiv({ cls: 'jira-queries-list' })
        this.renderQueryList()
    }

    renderQueryList() {
        this.queryListContainer.empty()

        const filteredQueries = SettingsData.savedQueries.filter(q => 
            q.name.toLowerCase().includes(this.searchTerm.toLowerCase())
        )

        if (filteredQueries.length === 0) {
            this.queryListContainer.createDiv({ 
                text: this.searchTerm ? 'No matching filters found.' : 'No saved filters yet.', 
                cls: 'jira-empty-message'
            })
            return
        }

        filteredQueries.forEach(q => {
            const item = this.queryListContainer.createDiv({ cls: 'jira-query-item' })

            item.createSpan({ text: q.name, cls: 'query-name' })
            
            const actions = item.createDiv({ cls: 'jira-query-actions' })

            // Clone Button
            new ButtonComponent(actions)
                .setIcon('copy')
                .setTooltip('Clone')
                .onClick((e) => {
                    e.stopPropagation()
                    this.cloneQuery(q.id)
                })

            // Delete Button
            new ButtonComponent(actions)
                .setIcon('trash')
                .setTooltip('Delete')
                .setClass('jira-delete-btn') // Optional for custom styling
                .onClick((e) => {
                    e.stopPropagation()
                    this.confirmDelete(q)
                })
            
            item.onclick = () => this.openQuery(q.id)
        })
    }

    async cloneQuery(id: string) {
        const original = SettingsData.savedQueries.find(q => q.id === id)
        if (!original) return

        new InputModal(
            this.app,
            'Clone Filter',
            `${original.name} (Copy)`,
            'New Filter Name',
            async (newName) => {
                const newQuery: ISavedQuery = {
                    ...original,
                    id: Date.now().toString(),
                    name: newName
                }

                SettingsData.savedQueries.push(newQuery)
                await this.plugin.saveData(SettingsData)
                new Notice('Query cloned')
                this.renderHome()
            }
        ).open()
    }

    confirmDelete(query: ISavedQuery) {
        new ConfirmationModal(
            this.app,
            'Delete Filter',
            `Are you sure you want to delete the filter "${query.name}"?`,
            async () => {
                await this.deleteQuery(query.id)
            }
        ).open()
    }

    async deleteQuery(id: string) {
        SettingsData.savedQueries = SettingsData.savedQueries.filter(q => q.id !== id)
        await this.plugin.saveData(SettingsData)
        new Notice('Query deleted')
        this.renderHome()
    }

    openQuery(id: string | null) {
        this.homeContainer.hide()
        this.queryContainer.show()
        this.loadQuery(id)
        if (id) {
             // If opening an existing query, maybe auto-run? 
             // "preenchido a consulta" -> filled the query.
             // User didn't say auto-run, but it's often convenient. 
             // Let's stick to filling it for now, user can click Search.
             this.runSearch()
        } else {
            this.resultsContainer.empty()
        }
    }

    showHome() {
        this.queryContainer.hide()
        this.homeContainer.show()
        this.renderHome()
    }

    renderQueryForm() {
        this.queryContainer.empty()
        
        // Back button
        const header = this.queryContainer.createDiv({ cls: 'jira-query-header' })
        
        new ButtonComponent(header)
            .setIcon('arrow-left')
            .setTooltip('Back to list')
            .onClick(() => this.showHome())
        
        header.createSpan({ text: 'Filter details' })

        // --- Form Section ---
        const formContainer = this.queryContainer.createDiv({ cls: 'jira-query-form' })
        
        new Setting(formContainer)
            .setName('Name')
            .addText(text => {
                this.nameInput = text
                text.setPlaceholder('Query name')
            })

        new Setting(formContainer)
            .setName('JQL query')
            .addTextArea(text => {
                this.queryInput = text
                text.setPlaceholder('project = MYPROJ AND status = Open')
                text.inputEl.rows = 3
            })

        new Setting(formContainer)
            .setName('Destination')
            .setDesc('Folder path relative to vault root')
            .addText(text => {
                this.destinationInput = text
                text.setPlaceholder('Jira/Issues')
            })
            .addExtraButton(btn => {
                btn.setIcon('folder')
                   .setTooltip('Select Folder')
                   .onClick(() => {
                       new FolderSuggestModal(this.app, (path) => {
                           this.destinationInput.setValue(path)
                       }).open()
                   })
            })

        new Setting(formContainer)
            .setName('File columns')
            .setDesc('Columns to sync into file body')
            .addTextArea(text => {
                this.fileColumnsInput = text
                text.setPlaceholder('description, assignee, created')
                text.inputEl.rows = 2
            })

        // --- Action Buttons ---
        const actionsContainer = this.queryContainer.createDiv({ cls: 'jira-form-actions' })

        new ButtonComponent(actionsContainer)
            .setButtonText('Save')
            .onClick(() => this.saveCurrentQuery())

        new ButtonComponent(actionsContainer)
            .setButtonText('Clone')
            .onClick(() => this.cloneCurrentQuery())

        new ButtonComponent(actionsContainer)
            .setButtonText('Delete')
            .setWarning()
            .onClick(() => this.deleteCurrentQuery())

        new ButtonComponent(actionsContainer)
            .setButtonText('Search')
            .setCta()
            .onClick(() => this.runSearch())

        // --- Results Section ---
        this.queryContainer.createEl('h3', { text: 'Results' })
        this.resultsContainer = this.queryContainer.createDiv({ cls: 'jira-search-results' })
    }

    loadQuery(id: string | null) {
        this.currentQueryId = id
        if (!id) {
            this.nameInput.setValue('')
            this.queryInput.setValue('')
            this.destinationInput.setValue('')
            this.fileColumnsInput.setValue('')
        } else {
            const query = SettingsData.savedQueries.find(q => q.id === id)
            if (query) {
                this.nameInput.setValue(query.name)
                this.queryInput.setValue(query.query)
                this.destinationInput.setValue(query.destination)
                this.fileColumnsInput.setValue(query.fileColumns)
            }
        }
    }

    async saveCurrentQuery() {
        const name = this.nameInput.getValue()
        if (!name) {
            new Notice('Please provide a name')
            return
        }

        const newQuery: ISavedQuery = {
            id: this.currentQueryId || Date.now().toString(),
            name: name,
            query: this.queryInput.getValue(),
            destination: this.destinationInput.getValue(),
            fileColumns: this.fileColumnsInput.getValue()
        }

        if (this.currentQueryId) {
            const index = SettingsData.savedQueries.findIndex(q => q.id === this.currentQueryId)
            if (index !== -1) {
                SettingsData.savedQueries[index] = newQuery
            }
        } else {
            SettingsData.savedQueries.push(newQuery)
            this.currentQueryId = newQuery.id
        }

        await this.plugin.saveData(SettingsData)
        new Notice('Query saved')
    }

    async cloneCurrentQuery() {
        // Clone from form state
        // When in detail view, cloning should open the new query
        
        // 1. Get current values (user might have edited them)
        const currentName = this.nameInput.getValue()
        
        new InputModal(
            this.app,
            'Clone Filter',
            `${currentName} (Copy)`,
            'New Filter Name',
            async (newName) => {
                const newQuery: ISavedQuery = {
                    id: Date.now().toString(),
                    name: newName,
                    query: this.queryInput.getValue(),
                    destination: this.destinationInput.getValue(),
                    fileColumns: this.fileColumnsInput.getValue()
                }

                SettingsData.savedQueries.push(newQuery)
                await this.plugin.saveData(SettingsData)
                new Notice('Query cloned')
                
                // Open the new query
                this.openQuery(newQuery.id)
            }
        ).open()
    }

    async deleteCurrentQuery() {
        // Delete from form state
        if (!this.currentQueryId) {
            // New filter mode - Confirm cancellation/discard
            new ConfirmationModal(
                this.app,
                'Cancel Creation',
                'Are you sure you want to cancel creating this filter? All changes will be lost.',
                async () => {
                    this.showHome()
                }
            ).open()
            return
        }
        
        new ConfirmationModal(
            this.app,
            'Delete Filter',
            'Are you sure you want to delete this filter?',
            async () => {
                SettingsData.savedQueries = SettingsData.savedQueries.filter(q => q.id !== this.currentQueryId)
                await this.plugin.saveData(SettingsData)
                this.currentQueryId = null
                this.showHome()
                new Notice('Query deleted')
            }
        ).open()
    }

    async runSearch() {
        this.resultsContainer.empty()
        this.resultsContainer.createDiv({ text: 'Searching...', cls: 'jira-search-loading' })

        try {
            const jql = this.queryInput.getValue().trim()
            if (!jql) {
                this.renderError('Please enter a JQL query.')
                return
            }

            const account = SettingsData.accounts[0]
            if (!account) {
                this.renderError('No Jira account configured. Please check your settings.')
                return
            }

            const issuesResult = await JiraClient.getSearchResults(jql, { account })
            const issues = issuesResult.issues
            
            this.resultsContainer.empty()
            
            if (issues.length === 0) {
                this.resultsContainer.createDiv({ text: 'No issues found.', cls: 'jira-no-results' })
                return
            }

            const table = this.resultsContainer.createEl('table')
            table.style.width = '100%'
            table.style.borderCollapse = 'collapse'

            const thead = table.createEl('thead')
            const headerRow = thead.createEl('tr')
            headerRow.style.textAlign = 'left'
            
            // Fixed simplified columns for sidebar view
            const cols = ['Key', 'Summary', 'Status', 'Actions']
            cols.forEach(c => headerRow.createEl('th', { text: c, attr: { style: 'padding: 5px; border-bottom: 1px solid var(--background-modifier-border)' } }))

            const tbody = table.createEl('tbody')

            const fileColumnsStr = this.fileColumnsInput.getValue()
            let fileColumns: ISearchColumn[] | null = null
            if (fileColumnsStr) {
                try {
                    fileColumns = SearchView.parseColumns(fileColumnsStr)
                } catch (e) {
                    console.warn('Invalid file columns', e)
                }
            }

            const destination = this.destinationInput.getValue()

            for (const issue of issues) {
                const row = tbody.createEl('tr')
                
                row.createEl('td', { text: issue.key, attr: { style: 'padding: 5px;' } })
                row.createEl('td', { text: issue.fields.summary, attr: { style: 'padding: 5px;' } })
                row.createEl('td', { text: issue.fields.status.name, attr: { style: 'padding: 5px;' } })
                
                const actionTd = row.createEl('td', { attr: { style: 'padding: 5px;' } })
                
                // Jira Link Button
                const linkBtn = actionTd.createEl('button')
                setIcon(linkBtn, 'link')
                setTooltip(linkBtn, 'Open in Jira')
                linkBtn.style.marginRight = '5px'
                linkBtn.onclick = () => {
                     const url = `${account.host}/browse/${issue.key}`
                     window.open(url, '_blank')
                }

                // Sync Button
                const syncBtn = actionTd.createEl('button')
                setIcon(syncBtn, 'sync-small')
                setTooltip(syncBtn, 'Sync to Note')
                syncBtn.onclick = async () => {
                    syncBtn.disabled = true
                    try {
                        const fullPath = destination ? `${destination}/${issue.key}.md` : `${issue.key}.md`
                        await syncIssueContent(issue, fullPath, fileColumns)
                        new Notice(`Synced ${issue.key}`)
                    } catch (e) {
                        new Notice(`Error: ${e.message}`)
                        console.error(e)
                    } finally {
                        syncBtn.disabled = false
                    }
                }
            }

        } catch (e) {
            this.renderError(e.message)
        }
    }

    renderError(message: string) {
        this.resultsContainer.empty()
        
        const errorContainer = this.resultsContainer.createDiv({ cls: 'jira-error-container' })
        errorContainer.style.padding = '10px'
        errorContainer.style.backgroundColor = 'var(--background-modifier-error)'
        errorContainer.style.color = 'var(--text-on-accent)'
        errorContainer.style.borderRadius = '4px'
        errorContainer.style.marginBottom = '10px'

        const iconDiv = errorContainer.createDiv()
        iconDiv.style.float = 'left'
        iconDiv.style.marginRight = '8px'
        setIcon(iconDiv, 'alert-triangle')

        const msgDiv = errorContainer.createDiv()
        
        // Enhance known error messages
        if (message.includes('Bad Request')) {
            msgDiv.createEl('strong', { text: 'Invalid Query (JQL)' })
            msgDiv.createDiv({ text: 'Please check your JQL syntax. Common errors include misspelled field names or invalid operators.' })
            msgDiv.createDiv({ text: `Details: ${message.replace('Bad Request: ', '')}`, attr: { style: 'font-size: 0.9em; margin-top: 5px; opacity: 0.9;' } })
        } else if (message.includes('Unauthorized') || message.includes('Forbidden')) {
            msgDiv.createEl('strong', { text: 'Authentication Error' })
            msgDiv.createDiv({ text: 'Please check your API token and permissions.' })
             msgDiv.createDiv({ text: `Details: ${message}`, attr: { style: 'font-size: 0.9em; margin-top: 5px; opacity: 0.9;' } })
        } else {
            msgDiv.createEl('strong', { text: 'Error Occurred' })
            msgDiv.createDiv({ text: message })
        }
    }
}

export class ConfirmationModal extends Modal {
    constructor(app: App, private title: string, private content: string, private onConfirm: () => void) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: this.title });
        contentEl.createDiv({ text: this.content });

        const btnDiv = contentEl.createDiv({ attr: { style: 'margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;' } });

        new ButtonComponent(btnDiv)
            .setButtonText('Cancel')
            .onClick(() => this.close());

        new ButtonComponent(btnDiv)
            .setButtonText('Confirm')
            .setCta()
            .setWarning()
            .onClick(() => {
                this.onConfirm();
                this.close();
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
    constructor(app: App, private onChoose: (path: string) => void) {
        super(app);
    }

    getItems(): TFolder[] {
        return this.app.vault.getAllLoadedFiles()
            .filter((f): f is TFolder => f instanceof TFolder);
    }

    getItemText(item: TFolder): string {
        return item.path;
    }

    onChooseItem(item: TFolder, evt: MouseEvent | KeyboardEvent): void {
        this.onChoose(item.path);
    }
}

export class InputModal extends Modal {
    private result: string

    constructor(
        app: App, 
        private title: string, 
        private defaultValue: string, 
        private placeholder: string,
        private onSubmit: (result: string) => void
    ) {
        super(app);
        this.result = defaultValue;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: this.title });

        const inputDiv = contentEl.createDiv();
        const textInput = new TextComponent(inputDiv)
            .setPlaceholder(this.placeholder)
            .setValue(this.defaultValue)
            .onChange(value => {
                this.result = value
            });
        
        textInput.inputEl.style.width = '100%';
        textInput.inputEl.focus();
        textInput.inputEl.select();

        // Handle Enter key
        textInput.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.submit();
            }
        });

        const btnDiv = contentEl.createDiv({ attr: { style: 'margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;' } });

        new ButtonComponent(btnDiv)
            .setButtonText('Cancel')
            .onClick(() => this.close());

        new ButtonComponent(btnDiv)
            .setButtonText('Save')
            .setCta()
            .onClick(() => this.submit());
    }

    submit() {
        if (this.result) {
            this.onSubmit(this.result);
            this.close();
        } else {
            new Notice('Name cannot be empty');
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
