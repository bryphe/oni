import { createStore as createReduxStore } from "./../../Redux"
import { Commits, StatusResult } from "./VersionControlProvider"

interface ICommit {
    active: boolean
    message: string[]
    previousCommits: Commits[]
}

export interface VersionControlState {
    selected: string
    status: StatusResult
    commit: ICommit
    hasFocus: boolean
    hasError: boolean
    activated: boolean
}

interface IGenericAction<T, P = undefined> {
    type: T
    payload?: P
}

export const DefaultState: VersionControlState = {
    selected: null,
    status: {
        currentBranch: null,
        staged: [],
        conflicted: [],
        created: [],
        modified: [],
        remoteTrackingBranch: null,
        deleted: [],
        untracked: [],
        ahead: null,
        behind: null,
    },
    commit: {
        message: [],
        active: false,
        previousCommits: [],
    },
    hasFocus: null,
    activated: null,
    hasError: false,
}

type ISelectAction = IGenericAction<"SELECT", { selected: string }>
type IActivateAction = IGenericAction<"ACTIVATE">
type IDeactivateAction = IGenericAction<"DEACTIVATE">
type IEnterAction = IGenericAction<"ENTER">
type ILeaveAction = IGenericAction<"LEAVE">
type IErrorAction = IGenericAction<"ERROR">
type IStatusAction = IGenericAction<"STATUS", { status: StatusResult }>
type ICommitStartAction = IGenericAction<"COMMIT_START">
type ICommitCancelAction = IGenericAction<"COMMIT_CANCEL">
type ICommitSuccessAction = IGenericAction<"COMMIT_SUCCESS", { commit: Commits }>
type IUpdateCommitMessageAction = IGenericAction<"UPDATE_COMMIT_MESSAGE", { message: string[] }>
type IAction =
    | ISelectAction
    | IStatusAction
    | IEnterAction
    | ILeaveAction
    | IErrorAction
    | IDeactivateAction
    | IActivateAction
    | ICommitStartAction
    | ICommitCancelAction
    | ICommitSuccessAction
    | IUpdateCommitMessageAction

export interface IVersionControlActions {
    cancelCommit: () => ICommitCancelAction
    updateCommitMessage: (message: string[]) => IUpdateCommitMessageAction
}

export const VersionControlActions: IVersionControlActions = {
    cancelCommit: () => ({ type: "COMMIT_CANCEL" }),
    updateCommitMessage: (message: string[]) => ({
        type: "UPDATE_COMMIT_MESSAGE",
        payload: { message },
    }),
}

export function reducer(state: VersionControlState, action: IAction) {
    switch (action.type) {
        case "ENTER":
            return { ...state, hasFocus: true }
        case "SELECT":
            return { ...state, selected: action.payload.selected }
        case "COMMIT_START":
            return { ...state, commit: { ...state.commit, active: true } }
        case "COMMIT_CANCEL":
            return { ...state, commit: { ...state.commit, message: [], active: false } }
        case "COMMIT_SUCCESS":
            return {
                ...state,
                commit: {
                    message: [],
                    active: false,
                    previousCommits: [...state.commit.previousCommits, action.payload.commit],
                },
            }
        case "UPDATE_COMMIT_MESSAGE":
            return { ...state, commit: { ...state.commit, message: action.payload.message } }
        case "LEAVE":
            return { ...state, hasFocus: false }
        case "STATUS":
            return {
                ...state,
                status: action.payload.status,
            }
        case "DEACTIVATE":
            return {
                ...state,
                activated: false,
                status: DefaultState.status,
            }
        case "ACTIVATE":
            return {
                ...state,
                activated: true,
            }
        case "ERROR":
            return {
                ...state,
                hasError: true,
            }
        default:
            return state
    }
}

export default createReduxStore("Version Control", reducer, DefaultState)
