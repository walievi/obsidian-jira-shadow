import { addIcon } from "obsidian"
import gitDeleteIcon from './git-delete.svg'
import gitMergeIcon from './git-merge.svg'
import gitPullRequestIcon from './git-pull-request.svg'
import visibleIcon from './visible.svg'
import hiddenIcon from './hidden.svg'

export const setupIcons = () => {
    addIcon('jira-shadow-git-delete', gitDeleteIcon)
    addIcon('jira-shadow-git-merge', gitMergeIcon)
    addIcon('jira-shadow-git-pull-request', gitPullRequestIcon)
    addIcon('jira-shadow-visible', visibleIcon)
    addIcon('jira-shadow-hidden', hiddenIcon)
}
