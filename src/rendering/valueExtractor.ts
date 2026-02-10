import { IJiraIssue } from "../interfaces/issueInterfaces"
import { ESearchColumnsTypes, ISearchColumn, SEARCH_COLUMNS_DESCRIPTION } from "../interfaces/settingsInterfaces"
import { JIRA_STATUS_COLOR_MAP } from "./renderingCommon"

function dateToStr(fullDate: string): string {
    if (fullDate) {
        const d = new Date(fullDate)
        return d.toLocaleDateString()
    }
    return fullDate
}

function deltaToStr(delta: number): string {
    if (delta) {
        const h = Math.floor(delta / 3600)
        const m = Math.floor(delta % 3600 / 60)
        const s = Math.floor(delta % 3600 % 60)
        let timeStr = ''
        if (h > 0) {
            timeStr += h + 'h'
        }
        if (m > 0) {
            timeStr += m + 'm'
        }
        if (s > 0) {
            timeStr += s + 's'
        }
        return timeStr
    }
    return ''
}

export function getIssueStringValue(column: ISearchColumn, issue: IJiraIssue): string {
    switch (column.type) {
        case ESearchColumnsTypes.KEY:
            return issue.key
        case ESearchColumnsTypes.SUMMARY:
            return issue.fields.summary
        case ESearchColumnsTypes.DESCRIPTION:
            return issue.fields.description || ''
        case ESearchColumnsTypes.TYPE:
            return issue.fields.issuetype?.name || ''
        case ESearchColumnsTypes.CREATED:
            return dateToStr(issue.fields.created)
        case ESearchColumnsTypes.UPDATED:
            return dateToStr(issue.fields.updated)
        case ESearchColumnsTypes.REPORTER:
            return issue.fields.reporter?.displayName || ''
        case ESearchColumnsTypes.ASSIGNEE:
            return issue.fields.assignee?.displayName || ''
        case ESearchColumnsTypes.PRIORITY:
            return issue.fields.priority?.name || ''
        case ESearchColumnsTypes.STATUS:
            return issue.fields.status?.name || ''
        case ESearchColumnsTypes.DUE_DATE:
            return dateToStr(issue.fields.duedate)
        case ESearchColumnsTypes.RESOLUTION:
            return issue.fields.resolution?.name || ''
        case ESearchColumnsTypes.RESOLUTION_DATE:
            return dateToStr(issue.fields.resolutiondate)
        case ESearchColumnsTypes.PROJECT:
            return issue.fields.project?.name || ''
        case ESearchColumnsTypes.ENVIRONMENT:
            return issue.fields.environment || ''
        case ESearchColumnsTypes.AGGREGATE_PROGRESS:
            return issue.fields.aggregateprogress?.percent?.toString() + '%'
        case ESearchColumnsTypes.AGGREGATE_TIME_ESTIMATED:
            return deltaToStr(issue.fields.aggregatetimeestimate)
        case ESearchColumnsTypes.AGGREGATE_TIME_ORIGINAL_ESTIMATE:
            return deltaToStr(issue.fields.aggregatetimeoriginalestimate)
        case ESearchColumnsTypes.AGGREGATE_TIME_SPENT:
            return deltaToStr(issue.fields.aggregatetimespent)
        case ESearchColumnsTypes.TIME_ESTIMATE:
            return deltaToStr(issue.fields.timeestimate)
        case ESearchColumnsTypes.TIME_ORIGINAL_ESTIMATE:
            return deltaToStr(issue.fields.timeoriginalestimate)
        case ESearchColumnsTypes.TIME_SPENT:
            return deltaToStr(issue.fields.timespent)
        case ESearchColumnsTypes.PROGRESS:
            return issue.fields.progress?.percent?.toString() + '%'
        case ESearchColumnsTypes.LAST_VIEWED:
            return dateToStr(issue.fields.lastViewed)
        case ESearchColumnsTypes.FIX_VERSIONS:
            return issue.fields.fixVersions?.map(v => v.name).join(', ') || ''
        case ESearchColumnsTypes.COMPONENTS:
            return issue.fields.components?.map(c => c.name).join(', ') || ''
        case ESearchColumnsTypes.LABELS:
            return issue.fields.labels?.join(', ') || ''
        case ESearchColumnsTypes.CUSTOM_FIELD:
            if (issue.fields[column.extra]) {
                const val = issue.fields[column.extra]
                if (typeof val === 'object') {
                    if (Array.isArray(val)) {
                        return val.map((v: any) => v.value || v.name || v.toString()).join(', ')
                    }
                    const v = val as any
                    return v.value || v.name || JSON.stringify(val)
                }
                return String(val)
            }
            return ''
        default:
            return ''
    }
}
