# Jira Shadow

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![Obsidian](https://img.shields.io/badge/Obsidian-%3E%3D0.12.0-purple)

**Jira Shadow** is a specialized Obsidian plugin designed to **sync** ("shadow") Jira issues into your vault as real Markdown files.

Unlike other plugins that primarily *render* Jira data dynamically, **Jira Shadow** creates actual files on your disk. This approach unlocks the full potential of Obsidian's local-first architecture.

## Why "Shadow"?

By importing Jira issues as tangible Markdown files, you gain:
- **Offline Access**: View and edit your issues without an internet connection.
- **Graph Integration**: Visualize relationships between your tasks and your knowledge base using the Graph View.
- **Backlinking**: Link directly to specific Jira tickets using standard `[[Wikilinks]]`.
- **Native Search**: Leverage Obsidian's blazing fast search to find issues instantly.
- **Frontmatter Metadata**: Jira fields are automatically synced as YAML frontmatter properties, making them queryable by plugins like Dataview.

**Compatibility Note:** This plugin uses a unique ID (`jira-shadow`) and is engineered to run **side-by-side** with the original `obsidian-jira-issue` plugin. You can use the original plugin for dynamic views and **Jira Shadow** for robust file syncing without any conflicts.

## Key Features

### 🗂️ JQL Query Manager
Manage your Jira workflows directly from a dedicated sidebar view.
- **Saved Filters**: Create and save complex JQL queries (e.g., "My High Priority Bugs").
- **Flexible Destinations**: Route different queries to specific folders (e.g., `/Work/Bugs` vs `/Work/Features`).
- **Custom Content**: Control which Jira fields are written to the file body.

### 🔄 Intelligent Sync
- **One-Click Updates**: Sync all issues matching your filters with a single button press.
- **Smart Updates**: Re-syncing updates the issue content and metadata while preserving your local links.
- **Sync Fences**: Use ````jira-shadow-sync```` blocks in your notes to render dynamic lists that can trigger syncs.

## Installation

1.  Download the latest release (`main.js`, `manifest.json`, `styles.css`).
2.  Create a folder named `jira-shadow` in your vault's `.obsidian/plugins/` directory.
3.  Move the downloaded files into that folder.
4.  Enable **Jira Shadow** in **Settings > Community Plugins**.

## Configuration

1.  Navigate to **Settings > Jira Shadow**.
2.  **Add Account**:
    - **Name**: A friendly identifier (e.g., "Corporate Jira").
    - **Host**: Your Jira instance URL (e.g., `https://your-company.atlassian.net`).
    - **Username**: Your Jira email address.
    - **API Token**: Generate a token at [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens).

## Usage Guide

### 1. Open the Sidebar
Click the **Jira Shadow** icon (magnifying glass) in the right ribbon or run the command `Jira Shadow: Open Jira Shadow Sidebar`.

### 2. Create a Filter
- Click **New Filter**.
- **Name**: "Sprint Tasks"
- **JQL Query**: `project = "PROJ" AND sprint in openSprints() AND assignee = currentUser()`
- **Destination**: `Projects/Current Sprint`
- **File Columns**: `description, priority, due, assignee`
- Click **Save**.

### 3. Sync Issues
- Click **Search** to preview the results.
- (Coming Soon) Click the Sync button to download all matching issues as markdown files.

## License

Jira Shadow is licensed under the GNU AGPLv3 license.
