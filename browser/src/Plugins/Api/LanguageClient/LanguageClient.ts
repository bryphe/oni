/**
 * LanguageClient.ts
 *
 * Handles Oni's client implementation of the Language Server Protocol:
 * https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md
 */

import * as isEqual from "lodash/isEqual"
import * as rpc from "vscode-jsonrpc"
import * as types from "vscode-languageserver-types"

import { ChildProcess } from "child_process"

import { getCompletionMeet } from "./../../../Services/AutoCompletionUtility"
import { Oni } from "./../Oni"

import * as Log from "./../../../Log"

import * as Helpers from "./LanguageClientHelpers"
import { LanguageClientLogger } from "./LanguageClientLogger"

const characterMatchRegex = /[_a-z]/i
/**
 * Options for starting the Language Server process
 */
export interface ServerRunOptions {
    /**
     * Specify `command` to use a shell command to spawn a process
     */
    command?: string

    /**
     * Specify `module` to run a JavaScript module
     */
    module?: string

    /**
     * Arguments to pass to the language service
     */
    args?: string[]

    // TODO: TransportKind option?

    /**
     * Indicates whether stderr of the LSP server is used for logs or actual errors
     */
    stderrAsLog?: boolean
}

/**
 * Options to send to the `initialize` method of the
 * Language Server
 */
export interface LanguageClientInitializationParams {
    clientName: string
    rootPath: string

    // Disable `textDocument/documentSymbol` requests, even if the LSP
    // supports it.
    disableDocumentSymbol?: boolean
}

/**
 * Function that takes an event (buffer-open event) and returns a language params
 * This should always return the same value for a particular file.
 */
export type InitializationParamsCreator = (filePath: string) => Promise<LanguageClientInitializationParams>

import { LanguageClientState, LanguageClientStatusBar } from "./LanguageClientStatusBar"

/**
 * Implementation of a client that talks to a server
 * implementing the Language Server Protocol:
 * https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md
 */
export class LanguageClient {
    private _currentPromise: Promise<any>
    private _connection: rpc.MessageConnection
    private _process: ChildProcess
    private _currentOpenDocumentPath: string
    private _currentBuffer: string[] = []
    private _initializationParams: LanguageClientInitializationParams
    private _serverCapabilities: Helpers.ServerCapabilities

    private _statusBar: LanguageClientStatusBar

    constructor(
        private _startOptions: ServerRunOptions,
        private _initializationParamsCreator: InitializationParamsCreator,
        private _oni: Oni) {

        this._currentPromise = Promise.resolve(null)

        this._statusBar = new LanguageClientStatusBar(this._oni)

        this._oni.on("buffer-enter", (args: Oni.EventContext) => {
            this._statusBar.show(args.filetype)
            this._statusBar.setStatus(LanguageClientState.Initializing)
            this._enqueuePromise(() => {
                return this._initializationParamsCreator(args.bufferFullPath)
                    .then((newParams: LanguageClientInitializationParams) => {

                        if (!this._initializationParams) {
                            this._initializationParams = newParams
                            return this.start(newParams)
                        }

                        if (!isEqual(this._initializationParams, newParams)) {
                            this._initializationParams = newParams

                            return this.end()
                                .then(() => this.start(newParams))
                        }

                        return null
                    })
            }, false)
        })

        this._oni.on("buffer-update", (args: Oni.BufferUpdateContext) => {
            return this._enqueuePromise(() => this._onBufferUpdate(args))
        })

        this._oni.on("buffer-leave", (args: Oni.EventContext) => {
            this._statusBar.hide()
        })

        this._oni.on("buffer-update-incremental", (args: Oni.IncrementalBufferUpdateContext) => {
            return this._enqueuePromise(() => this._onBufferUpdateIncremental(args))
        })

        const getCompletions = (textDocumentPosition: Oni.EventContext) => {
            return this._enqueuePromise(() => this._getCompletions(textDocumentPosition))
        }

        this._oni.registerLanguageService({
            getCompletions,
        })
    }

    public start(initializationParams: LanguageClientInitializationParams): Thenable<any> {
        const startArgs = this._startOptions.args || []

        const options = {
            cwd: process.cwd(),
        }

        if (this._startOptions.command) {
            Log.info(`[LANGUAGE CLIENT]: Starting process via '${this._startOptions.command}'`)
            this._process = this._oni.process.spawnProcess(this._startOptions.command, startArgs, options)
        } else if (this._startOptions.module) {
            Log.info(`[LANGUAGE CLIENT]: Starting process via node script '${this._startOptions.module}'`)
            this._process = this._oni.process.spawnNodeScript(this._startOptions.module, startArgs, options)
        } else {
            throw new Error("A command or module must be specified to start the server")
        }

        if (!this._process || !this._process.pid) {
            Log.error("[LANGUAGE CLIENT]: Unable to start language server process.")
            this._statusBar.setStatus(LanguageClientState.Error)
            return Promise.reject(null)
        }

        Log.info(`[LANGUAGE CLIENT]: Started process ${this._process.pid}`)

        this._process.on("close", (code: number, signal: string) => {
            Log.warn(`[LANGUAGE CLIENT]: Process closed with exit code ${code} and signal ${signal}`)
        })

        const logFunc = (msg: any) => {
            Log.debug(`[LANGUAGE CLIENT - DEBUG] ${msg}`)
        }
        const errFunc = (msg: any) => {
            Log.error(`[LANGUAGE CLIENT - ERROR]: ${msg}`)
            this._statusBar.setStatus(LanguageClientState.Error)
        }
        this._process.stderr.on("data", (this._startOptions.stderrAsLog) ? logFunc : errFunc)

        this._connection = rpc.createMessageConnection(
            (new rpc.StreamMessageReader(this._process.stdout)) as any,
            (new rpc.StreamMessageWriter(this._process.stdin)) as any,
            new LanguageClientLogger())

        this._currentOpenDocumentPath = null
        this._serverCapabilities = null

        this._connection.onNotification(Helpers.ProtocolConstants.Window.LogMessage, (args) => {
            Log.info(JSON.stringify(args))
        })

        this._connection.onNotification(Helpers.ProtocolConstants.Telemetry.Event, (args) => {
            Log.info(JSON.stringify(args))
        })

        this._connection.onNotification(Helpers.ProtocolConstants.Window.ShowMessage, (args) => {
            // TODO: Need alternate paradigm for showing a message
            alert(args)
        })

        this._connection.onNotification(Helpers.ProtocolConstants.TextDocument.PublishDiagnostics, (args) => {
            const diagnostics: types.Diagnostic[] = args.diagnostics

            this._oni.diagnostics.setErrors(this._initializationParams.clientName, Helpers.unwrapFileUriPath(args.uri), diagnostics)
        })

        // Register additional notifications here
        this._connection.listen()

        const { clientName, rootPath } = initializationParams

        const oniLanguageClientParams = {
            clientName,
            rootPath,
            capabilities: {
                highlightProvider: true,
            },
        }

        return this._connection.sendRequest(Helpers.ProtocolConstants.Initialize, oniLanguageClientParams)
            .then((response: any) => {
                this._statusBar.setStatus(LanguageClientState.Initialized)
                Log.info(`[LANGUAGE CLIENT: ${initializationParams.clientName}]: Initialized`)
                if (response && response.capabilities) {
                    this._serverCapabilities = response.capabilities
                }
            }, (err) => {
                this._statusBar.setStatus(LanguageClientState.Error)
                Log.error(err)
            })
    }

    public end(): Promise<void> {
        Log.warn("Closing current language service connection")
        this._connection.dispose()

        this._connection = null
        this._currentOpenDocumentPath = null
        return Promise.resolve(null)
    }

    private _enqueuePromise<T>(functionThatReturnsPromiseOrThenable: () => Promise<T> | Thenable<T>, requireConnection: boolean = true): Promise<T> {

        const promiseExecutor = () => {
            if (!this._connection && requireConnection) {
                return Promise.reject("No active language server connection")
            }

            return functionThatReturnsPromiseOrThenable()
        }

        const newPromise = this._currentPromise
            .then(() => promiseExecutor(),
            (err) => {
                Log.error(err)
                this._statusBar.setStatus(LanguageClientState.Error)
                return promiseExecutor()
            })

        this._currentPromise = newPromise
        return newPromise
    }

    private _getCompletionItems(items: types.CompletionItem[] | types.CompletionList): types.CompletionItem[] {
        if (!items) {
            return []
        }

        if (Array.isArray(items)) {
            return items
        } else {
            return items.items || []
        }
    }

    private _getCompletionDocumentation(item: types.CompletionItem): string | null {
        if (item.documentation) {
            return item.documentation
        } else if (item.data && item.data.documentation) {
            return item.data.documentation
        } else {
            return null
        }
    }

    private async _getCompletions(textDocumentPosition: Oni.EventContext): Promise<Oni.Plugin.CompletionResult> {
        if (!this._serverCapabilities || !this._serverCapabilities.completionProvider) {
            return null
        }

        const result = await this._connection.sendRequest<types.CompletionList>(
            Helpers.ProtocolConstants.TextDocument.Completion,
            Helpers.eventContextToTextDocumentPositionParams(textDocumentPosition))

        const items = this._getCompletionItems(result)

        if (!items) {
            return { base: "", completions: [] }
        }

        const currentLine = this._currentBuffer[textDocumentPosition.line - 1]
        const meetInfo = getCompletionMeet(currentLine, textDocumentPosition.column, characterMatchRegex)

        if (!meetInfo) {
            return { base: "", completions: [] }
        }

        const filteredItems = items.filter((item) => item.label.indexOf(meetInfo.base) === 0)

        const completions = filteredItems.map((i) => ({
            label: i.label,
            detail: i.detail,
            documentation: this._getCompletionDocumentation(i),
            kind: i.kind,
            insertText: i.insertText,
        }))

        return {
            base: meetInfo.base,
            completions,
        }
    }

    private _onBufferUpdateIncremental(args: Oni.IncrementalBufferUpdateContext): Thenable<void> {
        if (!args.eventContext.bufferFullPath) {
            return Promise.resolve(null)
        }

        const changedLine = args.bufferLine
        const lineNumber = args.lineNumber

        const previousLine = this._currentBuffer[lineNumber - 1]
        this._currentBuffer[lineNumber - 1] = changedLine

        if (this._serverCapabilities && this._serverCapabilities.textDocumentSync) {
            const isFullSync = this._serverCapabilities.textDocumentSync === Helpers.TextDocumentSyncKind.Full

            const changeTextDocumentParams = isFullSync ?
                Helpers.createDidChangeTextDocumentParams(args.eventContext.bufferFullPath, this._currentBuffer, args.eventContext.version)
                : Helpers.incrementalBufferUpdateToDidChangeTextDocumentParams(args, previousLine)

            this._connection.sendNotification(Helpers.ProtocolConstants.TextDocument.DidChange, changeTextDocumentParams)
        }

        return Promise.resolve(null)
    }

    private _onBufferUpdate(args: Oni.BufferUpdateContext): Thenable<void> {
        const lines = args.bufferLines
        const { bufferFullPath } = args.eventContext

        this._currentBuffer = lines

        if (this._currentOpenDocumentPath !== bufferFullPath) {
            this._currentOpenDocumentPath = bufferFullPath
            this._connection.sendNotification("textDocument/didOpen", {
                textDocument: Helpers.bufferUpdateToTextDocumentItem(args),
            })
        } else {
            this._connection.sendNotification(Helpers.ProtocolConstants.TextDocument.DidChange,
                Helpers.createDidChangeTextDocumentParams(bufferFullPath, lines, args.eventContext.version))
        }

        return Promise.resolve(null)
    }
}
