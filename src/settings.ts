import { App, Notice, PluginSettingTab, Setting, TextComponent } from 'obsidian'
import JiraClient from './client/jiraClient'
import { COLOR_SCHEMA_DESCRIPTION, EAuthenticationTypes, EColorSchema, ESearchColumnsTypes, IJiraIssueAccountSettings, IJiraIssueSettings, SEARCH_COLUMNS_DESCRIPTION } from './interfaces/settingsInterfaces'
import type JiraIssuePlugin from './main'
import { getRandomHexColor } from './utils'

const AUTHENTICATION_TYPE_DESCRIPTION = {
    [EAuthenticationTypes.OPEN]: 'Open',
    [EAuthenticationTypes.BASIC]: 'Basic Authentication',
    [EAuthenticationTypes.CLOUD]: 'Jira Cloud',
    [EAuthenticationTypes.BEARER_TOKEN]: 'Bearer Token',
}

export const DEFAULT_SETTINGS: IJiraIssueSettings = {
    accounts: [],
    apiBasePath: '/rest/api/latest',
    cacheTime: '15m',
    searchResultsLimit: 10,
    cache: {
        columns: [],
    },
    colorSchema: EColorSchema.FOLLOW_OBSIDIAN,
    logRequestsResponses: false,
    logImagesFetch: false,
    savedQueries: [],
}

export const DEFAULT_ACCOUNT: IJiraIssueAccountSettings = {
    alias: 'Default',
    host: 'https://mycompany.atlassian.net',
    authenticationType: EAuthenticationTypes.OPEN,
    password: '',
    priority: 1,
    color: '#000000',
    use2025Api: false,
    cache: {
        statusColor: {},
        customFieldsIdToName: {},
        customFieldsNameToId: {},
        customFieldsType: {},
        jqlAutocomplete: {
            fields: [],
            functions: {},
        },
    },
}

function deepCopy(obj: any): any {
    return JSON.parse(JSON.stringify(obj))
}

export class JiraIssueSettingTab extends PluginSettingTab {
    private _plugin: JiraIssuePlugin
    private _onChangeListener: (() => void) | null = null
    private _showPassword = false

    constructor(app: App, plugin: JiraIssuePlugin) {
        super(app, plugin)
        this._plugin = plugin
    }

    async loadSettings(): Promise<void> {
        // Read plugin data and fill new fields with default values
        Object.assign(SettingsData, DEFAULT_SETTINGS, await this._plugin.loadData())
        for (const i in SettingsData.accounts) {
            SettingsData.accounts[i] = Object.assign({}, DEFAULT_ACCOUNT, SettingsData.accounts[i])
        }
        SettingsData.cache = deepCopy(DEFAULT_SETTINGS.cache)

        if (SettingsData.accounts.length === 0 || SettingsData.accounts[0] === null) {
            if (SettingsData.host) {
                // Legacy credentials migration
                SettingsData.accounts = [
                    {
                        priority: 1,
                        host: SettingsData.host,
                        authenticationType: SettingsData.authenticationType,
                        username: SettingsData.username,
                        password: SettingsData.password,
                        bareToken: SettingsData.bareToken,
                        alias: DEFAULT_ACCOUNT.alias,
                        color: DEFAULT_ACCOUNT.color,
                        cache: DEFAULT_ACCOUNT.cache,
                        use2025Api: false,
                    }
                ]
            } else {
                // First installation
                SettingsData.accounts = [DEFAULT_ACCOUNT]
            }
            this.saveSettings()
        }
        this.accountsConflictsFix()
    }

    async saveSettings() {
        const settingsToStore: IJiraIssueSettings = Object.assign({}, SettingsData, {
            // Global cache settings cleanup
            cache: DEFAULT_SETTINGS.cache, jqlAutocomplete: null, customFieldsIdToName: null, customFieldsNameToId: null, statusColorCache: null
        })
        // Account cache settings cleanup
        settingsToStore.accounts.forEach(account => account.cache = DEFAULT_ACCOUNT.cache)
        // Delete old properties
        delete (settingsToStore as any)['darkMode']
        delete (settingsToStore as any)['host']
        delete (settingsToStore as any)['authenticationType']
        delete (settingsToStore as any)['username']
        delete (settingsToStore as any)['password']
        delete (settingsToStore as any)['customFieldsNames']
        delete (settingsToStore as any)['inlineIssueUrlToTag']
        delete (settingsToStore as any)['inlineIssuePrefix']
        delete (settingsToStore as any)['searchColumns']
        delete (settingsToStore as any)['showColorBand']
        delete (settingsToStore as any)['showJiraLink']

        await this._plugin.saveData(settingsToStore)

        if (this._onChangeListener) {
            this._onChangeListener()
        }
    }

    onChange(listener: () => void) {
        this._onChangeListener = listener
    }

    display(): void {
        // Clean the page
        this.containerEl.empty()
        this.displayHeader()
        this.displayAccountsSettings()
        this.displayRenderingSettings()
        this.displayExtraSettings()
        this.displayFooter()
    }

    displayHeader() {
        const { containerEl } = this
        containerEl.createEl('h2', { text: 'Jira Shadow' })
        const description = containerEl.createEl('p')
        description.appendText('Need help? Explore the ')
        description.appendChild(createEl('a', {
            text: 'Jira Shadow documentation',
            href: 'https://marc0l92.github.io/obsidian-jira-issue/',
        }))
        description.appendText('.')

    }

    displayFooter() {
        const { containerEl } = this
        containerEl.createEl('h3', { text: 'Support development' })

        const supportDiv = containerEl.createEl('div')
        supportDiv.setAttr('style', 'text-align: center; background-color: var(--background-secondary); padding: 15px; border-radius: 10px;')
        
        // Current Maintainer
        supportDiv.createEl('p', { text: 'Project by William Steffen Alievi' }).setAttr('style', 'font-weight: bold; margin-bottom: 5px;')
        const williamLinks = supportDiv.createEl('div')
        williamLinks.setAttr('style', 'margin-bottom: 10px; font-size: 0.9em;')
        williamLinks.appendChild(createEl('a', { text: '@walievi', href: 'https://github.com/walievi' }))
        williamLinks.appendText(' | ')
        williamLinks.appendChild(createEl('a', { text: 'Repository', href: 'https://github.com/walievi/obsidian-jira-shadow' }))
        
        const walieviLink = supportDiv.createEl('a', { href: 'https://ko-fi.com/walievi' })
        walieviLink.appendChild(createEl('img', {
            attr: {
                src: 'https://ko-fi.com/img/githubbutton_sm.svg',
                height: '36',
                alt: 'Buy William a Coffee'
            }
        }))

        supportDiv.createEl('hr').setAttr('style', 'margin: 15px 0; border: none; border-top: 1px solid var(--background-modifier-border);')

        // Original Creator
        supportDiv.createEl('p', { text: 'Base Project Creator: Marco Lucarella' }).setAttr('style', 'font-weight: bold; margin-bottom: 5px;')
        const marcoLinks = supportDiv.createEl('div')
        marcoLinks.setAttr('style', 'margin-bottom: 10px; font-size: 0.9em;')
        marcoLinks.appendChild(createEl('a', { text: '@marc0l92', href: 'https://github.com/marc0l92' }))
        marcoLinks.appendText(' | ')
        marcoLinks.appendChild(createEl('a', { text: 'Original Repository', href: 'https://github.com/marc0l92/obsidian-jira-issue' }))

        const marcoLink = supportDiv.createEl('a', { href: 'https://ko-fi.com/marc0l92' })
        marcoLink.appendChild(createEl('img', {
            attr: {
                src: 'https://ko-fi.com/img/githubbutton_sm.svg',
                height: '36',
                alt: 'Buy Marco a Coffee'
            }
        }))
    }

    displayAccountsSettings() {
        const { containerEl } = this
        containerEl.createEl('h3', { text: 'Accounts' })

        for (const account of SettingsData.accounts) {
            const accountSetting = new Setting(containerEl)
                .setName(`${account.priority}: ${account.alias}`)
                .setDesc(account.host)
                .addExtraButton(button => button
                    .setIcon('pencil')
                    .setTooltip('Modify')
                    .onClick(async () => {
                        // Change page
                        this.displayModifyAccountPage(account)
                    }))
                .addExtraButton(button => button
                    .setIcon('trash')
                    .setTooltip('Delete')
                    .setDisabled(SettingsData.accounts.length <= 1)
                    .onClick(async () => {
                        SettingsData.accounts.remove(account)
                        this.accountsConflictsFix()
                        await this.saveSettings()
                        // Force refresh
                        this.display()
                    }))
            accountSetting.infoEl.setAttr('style', 'padding-left:5px;border-left:5px solid ' + account.color)
        }
        new Setting(containerEl)
            .addButton(button => button
                .setButtonText("Add account")
                .setCta()
                .onClick(async value => {
                    SettingsData.accounts.push(this.createNewEmptyAccount())
                    this.accountsConflictsFix()
                    await this.saveSettings()
                    // Force refresh
                    this.display()
                }))
    }

    displayModifyAccountPage(prevAccount: IJiraIssueAccountSettings, newAccount: IJiraIssueAccountSettings = null) {
        if (!newAccount) newAccount = Object.assign({}, prevAccount)
        const { containerEl } = this
        containerEl.empty()
        containerEl.createEl('h3', { text: 'Modify account' })

        new Setting(containerEl)
            .setName('Alias')
            .setDesc('Name of this account.')
            .addText(text => text
                .setPlaceholder('Example: Company name')
                .setValue(newAccount.alias)
                .onChange(async value => {
                    newAccount.alias = value
                }))
        new Setting(containerEl)
            .setName('Host')
            .setDesc('Hostname of your company Jira server.')
            .addText(text => text
                .setPlaceholder('Example: ' + DEFAULT_ACCOUNT.host)
                .setValue(newAccount.host)
                .onChange(async value => {
                    newAccount.host = value
                }))
        new Setting(containerEl)
            .setName('Authentication type')
            .setDesc('Select how the plugin should authenticate in your Jira server.')
            .addDropdown(dropdown => dropdown
                .addOptions(AUTHENTICATION_TYPE_DESCRIPTION)
                .setValue(newAccount.authenticationType)
                .onChange(async value => {
                    newAccount.authenticationType = value as EAuthenticationTypes
                    this._showPassword = false
                    // Force refresh
                    this.displayModifyAccountPage(prevAccount, newAccount)
                }))
        if (newAccount.authenticationType === EAuthenticationTypes.BASIC) {
            new Setting(containerEl)
                .setName('Username')
                .setDesc('Username to access your Jira Server account using HTTP basic authentication.')
                .addText(text => text
                    // .setPlaceholder('')
                    .setValue(newAccount.username)
                    .onChange(async value => {
                        newAccount.username = value
                    }))
            new Setting(containerEl)
                .setName('Password')
                .setDesc('Password to access your Jira Server account using HTTP basic authentication.')
                .addText(text => text
                    // .setPlaceholder('')
                    .setValue(newAccount.password)
                    .onChange(async value => {
                        newAccount.password = value
                    }).inputEl.setAttr('type', this._showPassword ? 'text' : 'password'))
                .addExtraButton(button => button
                    .setIcon(this._showPassword ? 'jira-shadow-hidden' : 'jira-shadow-visible')
                    .setTooltip(this._showPassword ? 'Hide password' : 'Show password')
                    .onClick(async () => {
                        this._showPassword = !this._showPassword
                        // Force refresh
                        this.displayModifyAccountPage(prevAccount, newAccount)
                    }))
        } else if (newAccount.authenticationType === EAuthenticationTypes.CLOUD) {
            new Setting(containerEl)
                .setName('Email')
                .setDesc('Email of your Jira Cloud account.')
                .addText(text => text
                    // .setPlaceholder('')
                    .setValue(newAccount.username)
                    .onChange(async value => {
                        newAccount.username = value
                    }))
            const apiTokenDescription = new Setting(containerEl)
                .setName('API Token')
                .addText(text => text
                    // .setPlaceholder('')
                    .setValue(newAccount.password)
                    .onChange(async value => {
                        newAccount.password = value
                    }).inputEl.setAttr('type', this._showPassword ? 'text' : 'password'))
                .addExtraButton(button => button
                    .setIcon(this._showPassword ? 'jira-shadow-hidden' : 'jira-shadow-visible')
                    .setTooltip(this._showPassword ? 'Hide password' : 'Show password')
                    .onClick(async () => {
                        this._showPassword = !this._showPassword
                        // Force refresh
                        this.displayModifyAccountPage(prevAccount, newAccount)
                    }))
                .descEl
            apiTokenDescription.appendText('API token of your Jira Cloud account (')
            apiTokenDescription
                .appendChild(createEl('a', {
                    text: 'Official Documentation',
                    href: 'https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/'
                }))
            apiTokenDescription.appendText(').')
        } else if (newAccount.authenticationType === EAuthenticationTypes.BEARER_TOKEN) {
            new Setting(containerEl)
                .setName('Bearer token')
                .setDesc('Token to access your Jira account using OAuth3 Bearer token authentication.')
                .addText(text => text
                    // .setPlaceholder('')
                    .setValue(newAccount.bareToken)
                    .onChange(async value => {
                        newAccount.bareToken = value
                    }).inputEl.setAttr('type', this._showPassword ? 'text' : 'password'))
                .addExtraButton(button => button
                    .setIcon(this._showPassword ? 'jira-shadow-hidden' : 'jira-shadow-visible')
                    .setTooltip(this._showPassword ? 'Hide password' : 'Show password')
                    .onClick(async () => {
                        this._showPassword = !this._showPassword
                        // Force refresh
                        this.displayModifyAccountPage(prevAccount, newAccount)
                    }))
        }
        new Setting(containerEl)
            .setName('Priority')
            .setDesc('Accounts search priority.')
            .addDropdown(dropdown => dropdown
                .addOptions(this.createPriorityOptions())
                .setValue(newAccount.priority.toString())
                .onChange(async value => {
                    newAccount.priority = parseInt(value)
                }))
        let colorTextComponent: TextComponent = null
        const colorInput = new Setting(containerEl)
            .setName('Color band')
            .setDesc('Color of the tags border. Use colors in hexadecimal notation (Example: #000000).')
            .addText(text => {
                text
                    .setPlaceholder('Example: #000000')
                    .setValue(newAccount.color)
                    .onChange(async value => {
                        newAccount.color = value.replace(/[^#0-9A-Fa-f]/g, '')
                        if (newAccount.color[0] != '#') newAccount.color = '#' + newAccount.color
                        colorInput.setAttr('style', 'border-left: 5px solid ' + newAccount.color)
                    })
                colorTextComponent = text
            })
            .addExtraButton(button => button
                .setIcon('dice')
                .setTooltip('New random color')
                .onClick(async () => {
                    newAccount.color = getRandomHexColor()
                    if (colorTextComponent != null) colorTextComponent.setValue(newAccount.color)
                    colorInput.setAttr('style', 'border-left: 5px solid ' + newAccount.color)
                })).controlEl.children[0]
        colorInput.setAttr('style', 'border-left: 5px solid ' + newAccount.color)

        new Setting(containerEl)
            .setName('Use 2025 search api')
            .setDesc(`In Aug 2025, Atlassian replaced the search api with a new one. Activate this option if you use Jira Cloud or you get the error 410 when searching issues.`)
            .addToggle(toggle => toggle
                .setValue(newAccount.use2025Api)
                .onChange(async value => {
                    newAccount.use2025Api = value
                    await this.saveSettings()
                }))

        new Setting(containerEl)
            .addButton(button => button
                .setButtonText("Back")
                .setWarning()
                .onClick(async value => {
                    this._showPassword = false
                    this.display()
                }))
            .addButton(button => button
                .setButtonText("Test Connection")
                .onClick(async value => {
                    button.setDisabled(true)
                    button.setButtonText("Testing...")
                    try {
                        await JiraClient.testConnection(newAccount)
                        new Notice('Jira Shadow: Connection established!')
                        try {
                            const loggedUser = await JiraClient.getLoggedUser(newAccount)
                            new Notice(`Jira Shadow: Logged as ${loggedUser.displayName}`)
                        } catch (e) {
                            new Notice('Jira Shadow: Logged as Guest')
                            console.error('Jira Shadow:TestConnection', e)
                        }
                    } catch (e) {
                        console.error('Jira Shadow:TestConnection', e)
                        new Notice('Jira Shadow: Connection failed!')
                    }
                    button.setButtonText("Test Connection")
                    button.setDisabled(false)
                }))
            .addButton(button => button
                .setButtonText("Save")
                .setCta()
                .onClick(async value => {
                    this._showPassword = false
                    // Swap priority with another existing account
                    SettingsData.accounts.find(a => a.priority === newAccount.priority).priority = prevAccount.priority
                    Object.assign(prevAccount, newAccount)
                    this.accountsConflictsFix()
                    await this.saveSettings()
                    this.display()
                }))
    }

    displayRenderingSettings() {
        const { containerEl } = this
        containerEl.createEl('h3', { text: 'Rendering' })

        new Setting(containerEl)
            .setName('Default search results limit')
            .setDesc('Maximum number of search results to retrieve when using jira-search without specifying a limit.')
            .addText(text => text
                // .setPlaceholder('Insert a number')
                .setValue(SettingsData.searchResultsLimit.toString())
                .onChange(async value => {
                    SettingsData.searchResultsLimit = parseInt(value) || DEFAULT_SETTINGS.searchResultsLimit
                    await this.saveSettings()
                }))
        new Setting(containerEl)
            .setName('Color schema')
            // .setDesc('')
            .addDropdown(dropdown => dropdown
                .addOptions(COLOR_SCHEMA_DESCRIPTION)
                .setValue(SettingsData.colorSchema)
                .onChange(async value => {
                    SettingsData.colorSchema = value as EColorSchema
                    await this.saveSettings()
                }))
    }

    displayExtraSettings() {
        const { containerEl } = this
        containerEl.createEl('h3', { text: 'Cache' })

        new Setting(containerEl)
            .setName('Cache time')
            .setDesc('Time before the cached issue status expires. A low value will refresh the data very often but do a lot of requests to the server.')
            .addText(text => text
                .setPlaceholder('Example: 15m, 24h, 5s')
                .setValue(SettingsData.cacheTime)
                .onChange(async value => {
                    SettingsData.cacheTime = value
                    await this.saveSettings()
                }))

        containerEl.createEl('h3', { text: 'Troubleshooting' })
        new Setting(containerEl)
            .setName('Log data request and responses')
            .setDesc('Log in the console (CTRL+Shift+I) all the API requests and responses performed by the plugin.')
            .addToggle(toggle => toggle
                .setValue(SettingsData.logRequestsResponses)
                .onChange(async value => {
                    SettingsData.logRequestsResponses = value
                    await this.saveSettings()
                }))
        new Setting(containerEl)
            .setName('Log images requests and responses')
            .setDesc('Log in the console (CTRL+Shift+I) all the images fetch requests and responses performed by the plugin.')
            .addToggle(toggle => toggle
                .setValue(SettingsData.logImagesFetch)
                .onChange(async value => {
                    SettingsData.logImagesFetch = value
                    await this.saveSettings()
                }))
    }

    createNewEmptyAccount() {
        const newAccount = JSON.parse(JSON.stringify(DEFAULT_ACCOUNT))
        newAccount.priority = SettingsData.accounts.length + 1
        this.accountsConflictsFix()
        return newAccount
    }

    accountsConflictsFix() {
        const aliases: string[] = []
        SettingsData.accounts.sort((a, b) => a.priority - b.priority)
        let priority = 1
        for (const account of SettingsData.accounts) {
            while (aliases.indexOf(account.alias) >= 0) account.alias += '1'
            aliases.push(account.alias)

            account.priority = priority
            priority++
        }
    }

    createPriorityOptions(): Record<string, string> {
        const options: Record<string, string> = {}
        for (let i = 1; i <= SettingsData.accounts.length; i++) {
            options[i.toString()] = i.toString()
        }
        return options
    }
}
export const SettingsData: IJiraIssueSettings = deepCopy(DEFAULT_SETTINGS)
