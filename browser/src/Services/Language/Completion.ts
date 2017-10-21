/**
 * Completion.ts
 */

// import * as os from "os"
import * as types from "vscode-languageserver-types"

// import { configuration } from "./../Configuration"

import * as UI from "./../../UI"

import { editorManager } from "./../EditorManager"
import { languageManager } from "./LanguageManager"

import * as Helpers from "./../../Plugins/Api/LanguageClient/LanguageClientHelpers"

import * as AutoCompletionUtility from "./../AutoCompletionUtility"

let lastFile:string = null
let lastLine:number = null
let lastColumn:number = null

// TODO:
// - Factor out event context to something simpler
// - Remove plugin manager
export const checkForCompletions = async (evt: Oni.EventContext) => {
    if (languageManager.isLanguageServerAvailable(evt.filetype)) {


        const line = evt.line - 1
        const column = evt.column - 1

        const buffer = editorManager.activeEditor.activeBuffer
        const currentLine = await buffer.getLines(line, line + 1)


        const token = languageManager.getTokenRegex(evt.filetype)
        const meet = AutoCompletionUtility.getCompletionMeet(currentLine[0], column, token)

        if (!meet) {
            return
        }

        const pos = meet.position + 1

        if (lastFile === evt.bufferFullPath && lastLine === line && pos === lastColumn) {
            UI.Actions.setCompletionBase(meet.base)
            return
        }

        lastFile = evt.bufferFullPath
        lastLine = line
        lastColumn = pos

        const args = {
            textDocument: { 
                uri: Helpers.wrapPathInFileUri(evt.bufferFullPath), 
            },
            position: {
                line,
                character: pos,
            }
        }

        const result = await languageManager.sendLanguageServerRequest(evt.filetype, evt.bufferFullPath, "textDocument/completion", args)

        const items = getCompletionItems(result)

        if (!items) {
            return
        }

        const completions = items.map((i) => ({
            label: i.label,
            detail: i.detail,
            documentation: getCompletionDocumentation(i),
            kind: i.kind,
            insertText: i.insertText,
        }))

        UI.Actions.showCompletions(evt.bufferFullPath, evt.line - 1, evt.column - 1, completions || [], meet.base)

        // console.dir(result)
        // debugger

    }
}

export const commitCompletion = async () => {
    const completion =  UI.Selectors.getSelectedCompletion() || ""

    const buffer = editorManager.activeEditor.activeBuffer
    const { line, column } = buffer.cursor

    const lines = await buffer.getLines(line, line + 1)
    const originalLine = lines[0]

    const newLine = AutoCompletionUtility.replacePrefixWithCompletion(originalLine, column, completion)

    await buffer.setLines(line, line + 1, [newLine])

    const cursorOffset = newLine.length - originalLine.length

    await buffer.setCursorPosition(line, column + cursorOffset)
} 

const getCompletionItems = (items: types.CompletionItem[] | types.CompletionList): types.CompletionItem[] => {
    if (!items) {
        return []
    }

    if (Array.isArray(items)) {
        return items
    } else {
        return items.items || []
    }
}

const getCompletionDocumentation = (item: types.CompletionItem): string | null => {
    if (item.documentation) {
        return item.documentation
    } else if (item.data && item.data.documentation) {
        return item.data.documentation
    } else {
        return null
    }
}
