/**
 * index.ts
 *
 * Entry point for ONI's TypeScript Language Service integraiton
 */

/// <reference path="./../../../../definitions/Oni.d.ts" />
/// <reference path="./../../../../node_modules/typescript/lib/protocol.d.ts" />

import * as os from "os"
import * as path from "path"

import * as types from "vscode-languageserver-types"

import { QuickInfo } from "./QuickInfo"
import { TypeScriptServerHost } from "./TypeScriptServerHost"
import { LightweightLanguageClient } from "./LightweightLanguageClient"

export interface IDisplayPart {
    text: string
    kind: string
}

export const activate = (Oni) => {

    const host = new TypeScriptServerHost(Oni)
    const quickInfo = new QuickInfo(Oni, host)

    const lastOpenFile = null

    let lastBuffer: string[] = []

    const getFormattingEdits = (position: Oni.EventContext) => {
        return host.getFormattingEdits(position.bufferFullPath, 1, 1, lastBuffer.length, 0)
            .then((val) => {
                const edits = val.map((v) => {
                    const start = {
                        line: v.start.line,
                        column: v.start.offset,
                    }

                    const end = {
                        line: v.end.line,
                        column: v.end.offset,
                    }

                    return {
                        start,
                        end,
                        newValue: v.newText,
                    }

                })

                return {
                    filePath: position.bufferFullPath,
                    version: position.version,
                    edits,
                }
            })
    }

    const convertTypeScriptKindToCompletionItemKind = (kind: string): types.CompletionItemKind => {

        const typeScriptKindToCompletionKind = {
            "let": types.CompletionItemKind.Variable,
            "interface": types.CompletionItemKind.Interface,
            "alias": types.CompletionItemKind.Reference,
            "color": types.CompletionItemKind.Color,
            "const": types.CompletionItemKind.Value,
            "constructor": types.CompletionItemKind.Constructor,
            "class": types.CompletionItemKind.Class,
            "type": types.CompletionItemKind.Class,
            "directory": types.CompletionItemKind.File,
            "file": types.CompletionItemKind.File,
            "script": types.CompletionItemKind.File,
            "var": types.CompletionItemKind.Variable,
            "property": types.CompletionItemKind.Property,
            "parameter": types.CompletionItemKind.Variable,
            "module": types.CompletionItemKind.Module,
            "external module name": types.CompletionItemKind.Module,
            "method": types.CompletionItemKind.Method,
            "function": types.CompletionItemKind.Function,
            "unit": types.CompletionItemKind.Unit,
            "keyword": types.CompletionItemKind.Keyword,
            "text": types.CompletionItemKind.Text,
        }

        if (kind && typeScriptKindToCompletionKind[kind]) {
            return typeScriptKindToCompletionKind[kind]
        } else {
            return null
        }
    }

    const getCompletionDetails = (textDocumentPosition: Oni.EventContext, completionItem) => {

        if (!textDocumentPosition || !textDocumentPosition.bufferFullPath) {
            return Promise.resolve(null)
        }

        return host.getCompletionDetails(textDocumentPosition.bufferFullPath, textDocumentPosition.line, textDocumentPosition.column, [completionItem.label])
            .then((details) => {
                const entry = details[0]

                if (!entry) {
                    return null
                }

                return {
                    kind: convertTypeScriptKindToCompletionItemKind(entry.kind),
                    label: entry.name,
                    documentation: entry.documentation && entry.documentation.length ? entry.documentation[0].text : null,
                    detail: convertToDisplayString(entry.displayParts),
                }
            })
    }


    const getSignatureHelp = async (textDocumentPosition: Oni.EventContext): Promise<types.SignatureHelp> => {
        const result = await host.getSignatureHelp(textDocumentPosition.bufferFullPath, textDocumentPosition.line, textDocumentPosition.column)

        const items = result.items || []

        const signatureHelpItems = items.map((item): types.SignatureInformation => {
            const prefix = convertToDisplayString(item.prefixDisplayParts)
            const suffix = convertToDisplayString(item.suffixDisplayParts)
            const separator = convertToDisplayString(item.separatorDisplayParts)

            const parameters = item.parameters.map((p) => ({
                label: convertToDisplayString(p.displayParts),
                documentation: convertToDisplayString(p.documentation),
            }))

            const parameterLabels = parameters.map((p) => p.label)

            const label = prefix + parameterLabels.join(separator) + suffix

            return {
                label,
                documentation: convertToDisplayString(item.documentation),
                parameters,
            }
        })

        return {
            signatures: signatureHelpItems,
            activeSignature: result.selectedItemIndex,
            activeParameter: result.argumentIndex,
        }
    }

    const lightweightLanguageClient = new LightweightLanguageClient()

    Oni.language.registerLanguageClient("typescript", lightweightLanguageClient)
    Oni.language.registerLanguageClient("javascript", lightweightLanguageClient)

    // TODO:
    // - Migrate all this functionality to the new language client
    Oni.registerLanguageService({
        // getCompletionDetails,
        // getCompletions,
        // getFormattingEdits,
    })

    host.on("semanticDiag", (diagnostics) => {
        const fileName = diagnostics.file

        const diags = diagnostics.diagnostics || []

        const errors = diags.map((d) => {
            // Convert lines to zero-based to accomodate protocol
            const startPosition = types.Position.create(d.start.line - 1, d.start.offset - 1)
            const endPosition = types.Position.create(d.end.line - 1, d.end.offset - 1)
            const range = types.Range.create(startPosition, endPosition)

            const ret: types.Diagnostic =  {
                // type: null,
                code: d.code,
                message: d.text,
                range,
                severity: types.DiagnosticSeverity.Error
            }
            return ret
        })

        lightweightLanguageClient.notify("textDocument/publishDiagnostics", {
            uri: wrapPathInFileUri(fileName),
            diagnostics: errors,
        })
    })

    // TODO: Refactor to helpers?
    const getFilePrefix = () => {
        if (process.platform === "win32") {
            return "file:///"
        } else {
            return "file://"
        }
     }

    const wrapPathInFileUri = (filePath: string) => getFilePrefix() + filePath
    const unwrapFileUriPath = (uri: string) => decodeURIComponent((uri).split(getFilePrefix())[1])

    const protocolOpenFile = (message: string, payload: any) => {
        const textDocument: types.TextDocumentIdentifier = payload.textDocument
        const filePath = unwrapFileUriPath(textDocument.uri)
        host.openFile(filePath)
    }

    const isSingleLineChange = (range: types.Range): boolean => {

        if (range.start.line === range.end.line) {
            return true
        }

        if (range.start.character === 0 && range.end.character === 0 && range.start.line + 1 === range.end.line) {
            return true
        }

        return false
    }
    // const getCompletions = (textDocumentPosition: Oni.EventContext) => {
    //     if (textDocumentPosition.column <= 1) {
    //         return Promise.resolve({
    //             completions: [],
    //         })
    //     }

    //     const currentLine = lastBuffer[textDocumentPosition.line - 1]
    //     let col = textDocumentPosition.column - 2
    //     let currentPrefix = ""

    //     while (col >= 0) {
    //         const currentCharacter = currentLine[col]

    //         if (!currentCharacter.match(/[_a-z]/i)) {
    //             break
    //         }

    //         currentPrefix = currentCharacter + currentPrefix
    //         col--
    //     }

    //     const basePos = col

    //     if (currentPrefix.length === 0 && currentLine[basePos] !== ".") {
    //         return Promise.resolve({
    //             base: currentPrefix,
    //             completions: [],
    //         })
    //     }

    //     Oni.log.verbose("Get completions: current line " + currentLine)

    //     return host.getCompletions(textDocumentPosition.bufferFullPath, textDocumentPosition.line, textDocumentPosition.column, currentPrefix)
    //         .then((val: any[]) => {

    //             const results = val
    //                 .filter((v) => v.name.indexOf(currentPrefix) === 0 || currentPrefix.length === 0)
    //                 .map((v) => ({
    //                     label: v.name,
    //                     kind: convertTypeScriptKindToCompletionItemKind(v.kind),
    //                 }))

    //             return {
    //                 base: currentPrefix,
    //                 completions: results,
    //             }
    //         })
    // }

    const protocolGetCompletions = async (message: string, payload: any): Promise<types.CompletionItem[]> => {
        const textDocument: types.TextDocumentIdentifier = payload.textDocument
        const filePath = unwrapFileUriPath(textDocument.uri)
        const zeroBasedPosition: types.Position = payload.position

        const oneBasedPosition = {
            line: zeroBasedPosition.line + 1,
            column: zeroBasedPosition.character + 1,
        }

        const val = await host.getCompletions(filePath, oneBasedPosition.line, oneBasedPosition.column, "")

        const results = val
            .map((v) => ({
                label: v.name,
                kind: convertTypeScriptKindToCompletionItemKind(v.kind),
            }))

        return results
    }

    const protocolChangeFile = (message: string, payload: any) => {

        const textDocument: types.TextDocumentIdentifier = payload.textDocument
        const contentChanges: types.TextDocumentContentChangeEvent[] = payload.contentChanges

        if (!contentChanges || !contentChanges.length) {
            return
        }

        if (contentChanges.length > 1) {
            Oni.log.warn("Only handling first content change")
        }

        const filePath = unwrapFileUriPath(textDocument.uri)

        const change = contentChanges[0]
        if (!change.range) {
            host.updateFile(filePath, change.text)
        } else if (isSingleLineChange(change.range) && change.text) {
            host.changeLineInFile(filePath, change.range.start.line + 1, change.text.trim())
        } else {
            Oni.log.warn("Unhandled change request!")
        }
    }

    const findAllReferences = async (message: string, payload: any): Promise<types.Location[]> => {
        const textDocument: types.TextDocumentIdentifier = payload.textDocument
        const filePath = unwrapFileUriPath(textDocument.uri)
        const zeroBasedPosition: types.Position = payload.position

        const oneBasedPosition = {
            line: zeroBasedPosition.line + 1,
            column: zeroBasedPosition.character + 1,
        }

        const val = await host.findAllReferences(filePath, oneBasedPosition.line, oneBasedPosition.column)

        const mapResponseToLocation = (referenceItem: protocol.ReferencesResponseItem): types.Location => {
            const startPosition = types.Position.create(referenceItem.start.line - 1, referenceItem.start.offset - 1)
            const endPosition = types.Position.create(referenceItem.end.line - 1, referenceItem.end.offset - 1)
            const range = types.Range.create(startPosition, endPosition)

            return {
                uri: wrapPathInFileUri(referenceItem.file),
                range,
            }
        }

        return val.refs.map((v) => mapResponseToLocation(v))
    }

    const getDefinition = async (protocolName: string, payload: any): Promise<types.Location> => {

        const textDocument: types.TextDocument  = payload.textDocument
        const position: types.Position = payload.position

        const filePath = unwrapFileUriPath(textDocument.uri)
        const val: any = await host.getTypeDefinition(filePath, position.line + 1, position.character + 1)

        const resultPos = val[0]

        const range = types.Range.create(resultPos.start.line - 1, resultPos.start.offset - 1, resultPos.end.line - 1, resultPos.end.offset - 1)

        return {
            uri: wrapPathInFileUri(resultPos.file),
            range,
        }
    }

    const getQuickInfo = async (protocolName: string, payload: any): Promise<types.Hover> => {

        const textDocument: types.TextDocument  = payload.textDocument
        const position: types.Position = payload.position

        const filePath = unwrapFileUriPath(textDocument.uri)
        const val = await host.getQuickInfo(filePath, position.line + 1, position.character + 1)

        return {
            contents: [val.displayString, val.documentation]
        }
    }

    const getCodeActions = async (protocolName: string, payload: any): Promise<types.Command[]> => {

        const textDocument = payload.textDocument
        const range = payload.range
        const filePath = unwrapFileUriPath(textDocument.uri)

        const val = await host.getRefactors(filePath, range.start.line + 1, range.start.character + 1, range.end.line + 1, range.end.character + 1)

        // TODO: Implement code actions
        Oni.log.verbose(val)
        return val
    }

    lightweightLanguageClient.handleNotification("textDocument/didOpen", protocolOpenFile)
    lightweightLanguageClient.handleNotification("textDocument/didChange", protocolChangeFile)

    lightweightLanguageClient.handleRequest("textDocument/completion", protocolGetCompletions)
    lightweightLanguageClient.handleRequest("textDocument/codeAction", getCodeActions)
    lightweightLanguageClient.handleRequest("textDocument/definition", getDefinition)
    lightweightLanguageClient.handleRequest("textDocument/hover",  getQuickInfo)
    lightweightLanguageClient.handleRequest("textDocument/references",  findAllReferences)

    // TODO: Migrate to 'textDocument/didSave'
    Oni.on("buffer-saved", (args: Oni.EventContext) => {
        host.getErrorsAcrossProject(args.bufferFullPath)
    })

    // TODO: Refactor to separate file
    const convertToDisplayString = (displayParts: IDisplayPart[]) => {
        let ret = ""

        if (!displayParts || !displayParts.forEach) {
            return ret
        }

        displayParts.forEach((dp) => {
            ret += dp.text
        })

        return ret
    }
}
