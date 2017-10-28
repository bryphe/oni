/**
 * LanguageEditorIntegration
 *
 * Responsible for listening to editor events,
 * and hooking up the language service functionality.
 */

import * as isEqual from "lodash/isEqual"
import { Observable } from "rxjs/Observable"

import "rxjs/add/observable/never"

// import * as types from "vscode-languageserver-types"

import { contextMenuManager } from "./../ContextMenu"
import { editorManager } from "./../EditorManager"
// import { getCodeActions } from "./CodeAction"
import { commitCompletion, getCompletions, resolveCompletionItem } from "./Completion"
import * as Definition from "./Definition"
import * as Hover from "./Hover"
import { languageManager } from "./LanguageManager"
// import { checkAndShowQuickInfo, hideQuickInfo } from "./QuickInfo"
import * as SignatureHelp from "./SignatureHelp"

import * as AutoCompletionUtility from "./../AutoCompletionUtility"

export const addNormalModeLanguageFunctionality = (bufferUpdates$: Observable<Oni.EditorBufferChangedEventArgs>, cursorMoved$: Observable<Oni.Cursor>, modeChanged$: Observable<string>) => {

    const latestPositionAndVersion$ =
        bufferUpdates$
           .combineLatest(cursorMoved$, modeChanged$)
           .map((combined: any[]) => {
                const [bufferEvent, cursorPosition, mode] = combined
                return {
                    language: bufferEvent.buffer.language,
                    filePath: bufferEvent.buffer.filePath,
                    version: bufferEvent.buffer.version,
                    line: cursorPosition.line,
                    column: cursorPosition.column,
                    mode,
                }
           })
           .distinctUntilChanged(isEqual)

    const shouldUpdateNormalModeAdorners$ = latestPositionAndVersion$
        .debounceTime(250) // TODO: Use config setting 'editor.quickInfo.delay'
        .combineLatest(modeChanged$)
        .filter((combinedArgs: [any, string]) => {
            const [, mode] = combinedArgs
            return mode === "normal"
        })
        .map((combinedArgs: [any, string]) => {
            const [val ] = combinedArgs
            return val
        })

    Definition.initDefinitionUI(latestPositionAndVersion$, shouldUpdateNormalModeAdorners$)
    Hover.initHoverUI(latestPositionAndVersion$, shouldUpdateNormalModeAdorners$)
}

export interface ILatestCursorAndBufferInfo {
    filePath: string,
    language: string,
    cursorLine: number,
    contents: string,
    cursorColumn: number,
}

export const addInsertModeLanguageFunctionality = (cursorMoved$: Observable<Oni.Cursor>, modeChanged$: Observable<Oni.Vim.Mode>) => {

    const latestCursorAndBufferInfo$: Observable<ILatestCursorAndBufferInfo> = cursorMoved$
            .auditTime(10)
            .mergeMap(async (cursorPos) => {
                const editor = editorManager.activeEditor
                const buffer = editor.activeBuffer

                const changedLines: string[] = await buffer.getLines(cursorPos.line, cursorPos.line + 1)
                const changedLine = changedLines[0]
                return {
                    filePath: buffer.filePath,
                    language: buffer.language,
                    cursorLine: cursorPos.line,
                    contents: changedLine,
                    cursorColumn: cursorPos.column,
                }
            })

    SignatureHelp.initUI(latestCursorAndBufferInfo$, modeChanged$)

    const currentCompletionMeet$ = latestCursorAndBufferInfo$
        .map((changeInfo) => {
            const token = languageManager.getTokenRegex(changeInfo.language)
            const meet = AutoCompletionUtility.getCompletionMeet(changeInfo.contents, changeInfo.cursorColumn, token)
            console.log(`[COMPLETION] Got meet at position: ${meet.position} with base: ${meet.base} - shouldExpand: ${meet.shouldExpandCompletions}`)
            return {
                ...changeInfo,
                meetLine: changeInfo.cursorLine,
                meetPosition: meet.position,
                meetBase: meet.base,
                shouldExpand: meet.shouldExpandCompletions,
            }
        })
        .distinctUntilChanged(isEqual)

    let lastMeet: any = null

    currentCompletionMeet$.subscribe((newMeet) => { lastMeet = newMeet })

    const $completions = currentCompletionMeet$
        .map((bufferMeetInfo) => ({
            language: bufferMeetInfo.language,
            filePath: bufferMeetInfo.filePath,
            line: bufferMeetInfo.cursorLine,
            character: bufferMeetInfo.meetPosition,
            shouldExpand: bufferMeetInfo.shouldExpand,
        }))
        .distinctUntilChanged(isEqual)
        .filter((info) => info.shouldExpand)
        .mergeMap((completionInfo: any) => {
            return Observable.defer(async () => {
                console.log(`[COMPLETION] Requesting completions at line ${completionInfo.line} and character ${completionInfo.character}`)
                newContextMenu.hide()
                const results = await getCompletions(completionInfo.language, completionInfo.filePath, completionInfo.line, completionInfo.character)

                return {
                    completions: results,
                    meetLine: completionInfo.line,
                    meetPosition: completionInfo.character,
                }
            })
        })

    const newContextMenu = contextMenuManager.create()
    newContextMenu.onItemSelected.subscribe((completionItem) => {
        const meetInfo = lastMeet
        if (meetInfo) {
            commitCompletion(meetInfo.cursorLine, meetInfo.contents, meetInfo.meetPosition, meetInfo.cursorColumn, completionItem.label)
            newContextMenu.hide()
        }
    })

    newContextMenu.onSelectedItemChanged.subscribe(async (newItem) => {
        const result = await resolveCompletionItem(lastMeet.language, lastMeet.filePath, newItem.rawCompletion)
        newContextMenu.updateItem(result)
    })

    modeChanged$.subscribe((mode) => {
        if (mode !== "insert") {
            newContextMenu.hide()
        }
    })

    $completions
        .combineLatest(currentCompletionMeet$)
        .subscribe((args: any[]) => {

        const [completionInfo, baseInfo] = args

        const { completions, meetLine, meetPosition } = completionInfo

        if (!completions || !completions.length || !baseInfo.shouldExpand) {
            newContextMenu.hide()
        } else if (meetLine !== baseInfo.meetLine || meetPosition !== baseInfo.meetPosition) {
            newContextMenu.hide()
        } else {
            newContextMenu.show(completions, baseInfo.meetBase)
        }

    })

}
