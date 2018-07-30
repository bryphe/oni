import * as fs from "fs-extra"
import { Commands, Editor, EditorManager, Workspace } from "oni-api"
import { IEvent } from "oni-types"
import * as path from "path"

import { SidebarManager } from "../Sidebar"
import { SessionActions, SessionsPane, store } from "./"
import { getUserConfigFolderPath } from "./../../Services/Configuration/UserConfiguration"

export interface ISession {
    name: string
    id: string
    file: string
    directory: string
    updatedAt: number
    workspace: string
}

export interface ISessionService {
    sessionsDir: string
    sessions: ISession[]
    persistSession(sessionName: string): Promise<ISession>
    restoreSession(sessionName: string): Promise<ISession>
}

interface UpdatedEditor extends Editor {
    onQuit: IEvent<void>
    persistSession(sessionDetails: ISession): Promise<ISession>
    restoreSession(sessionDetails: ISession): Promise<ISession>
}
export interface IEditorCandidate extends EditorManager {
    activeEditor: UpdatedEditor
}

/**
 * Class SessionManager
 *
 * Provides a service to manage oni session i.e. buffers, screen layout etc.
 *
 */
export class SessionManager implements ISessionService {
    private _store = store({ sessionManager: this, fs })
    private _sessionsDir = path.join(getUserConfigFolderPath(), "sessions")

    constructor(
        private _editorManager: IEditorCandidate,
        private _sidebarManager: SidebarManager,
        private _commands: Commands.Api,
        private _workspace: Workspace.Api,
    ) {
        fs.ensureDirSync(this.sessionsDir)
        this._sidebarManager.add(
            "save",
            new SessionsPane({ store: this._store, commands: this._commands }),
        )
        this._setupSubscriptions()
    }

    public get sessions() {
        return this._store.getState().sessions
    }

    public get sessionsDir() {
        return this._sessionsDir
    }

    public persistSession = async (sessionName: string) => {
        const sessionDetails = this._updateSession(sessionName)
        await this._editorManager.activeEditor.persistSession(sessionDetails)
        return sessionDetails
    }

    public restoreSession = async (sessionName: string) => {
        const sessionDetails = this._updateSession(sessionName)
        await this._editorManager.activeEditor.restoreSession(sessionDetails)
        return sessionDetails
    }

    public getSessionMetadata(sessionName: string, file = this._getSessionFilename(sessionName)) {
        const metadata = {
            file,
            updatedAt: Date.now(),
            name: sessionName,
            id: sessionName,
            directory: this.sessionsDir,
            workspace: this._workspace.activeWorkspace,
        }
        return metadata
    }

    private _getSessionFilename(name: string) {
        return path.join(this.sessionsDir, `${name}.vim`)
    }

    private _updateSession(sessionName: string) {
        const session = this.getSessionMetadata(sessionName)
        const action = SessionActions.updateSession(session)
        this._store.dispatch(action)
        return session
    }

    private _setupSubscriptions() {
        this._editorManager.activeEditor.onBufferEnter.subscribe(() => {
            const action = SessionActions.updateCurrentSession()
            this._store.dispatch(action)
        })
        this._editorManager.activeEditor.onQuit.subscribe(() => {
            const action = SessionActions.updateCurrentSession()
            this._store.dispatch(action)
        })
    }
}

function init() {
    let instance: SessionManager
    return {
        activate: (
            editorManager: EditorManager,
            sidebarManager: SidebarManager,
            commandManager: Commands.Api,
            workspace: Workspace.Api,
        ) => {
            instance = new SessionManager(
                editorManager as IEditorCandidate,
                sidebarManager,
                commandManager,
                workspace,
            )
        },
        getInstance: () => instance,
    }
}
export const { activate, getInstance } = init()
