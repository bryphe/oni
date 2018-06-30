import * as Oni from "oni-api"
import { Event } from "oni-types"

import { CommandManager } from "./../browser/src/Services/CommandManager"
import { EditorManager } from "./../browser/src/Services/EditorManager"
import { MenuManager } from "./../browser/src/Services/Menu"
import { Notifications } from "./../browser/src/Services/Notifications"
import { SidebarManager } from "./../browser/src/Services/Sidebar"
import {
    VersionControlManager,
    VersionControlProvider,
} from "./../browser/src/Services/VersionControl"
import { IWorkspace, Workspace } from "./../browser/src/Services/Workspace"

const MockWorkspace = jest.fn<IWorkspace>().mockImplementation(() => ({
    activeDirectory: "test/dir",
}))

const MockEditorManager = jest.fn<EditorManager>().mockImplementation(() => ({
    activeBuffer: {
        onBufferEnter: new Event(),
    },
}))

const mockStatusBarShow = jest.fn()
const mockStatusBarHide = jest.fn()
const mockStatusBarSetContents = jest.fn()
const mockStatusBarDisposal = jest.fn()

const MockStatusbar = jest.fn<Oni.StatusBar>().mockImplementation(() => ({
    createItem() {
        return {
            show: mockStatusBarShow,
            hide: mockStatusBarHide,
            setContents: mockStatusBarSetContents,
            dispose: mockStatusBarDisposal,
        }
    },
}))

const MockSidebar = jest.fn<SidebarManager>().mockImplementation(() => ({
    activeDirectory: "test/dir",
}))

const mockMenuShow = jest.fn()
const MockMenu = jest.fn<MenuManager>().mockImplementation(() => ({
    create() {
        return {
            show: mockMenuShow,
            setItems(items: {}) {
                return items
            },
        }
    },
}))

const MockCommands = jest.fn<CommandManager>().mockImplementation(() => ({
    activeDirectory: "test/dir",
}))

const MockNotifications = jest.fn<Notifications>().mockImplementation(() => ({}))

const provider: VersionControlProvider = {
    name: "svn",
    onFileStatusChanged: null,
    onBranchChanged: null,
    onPluginActivated: null,
    onPluginDeactivated: null,
    onStagedFilesChanged: null,
    isActivated: true,
    fetchBranchFromRemote: () => null,
    stageFile: () => null,
    changeBranch: () => null,
    getLocalBranches: () => Promise.resolve(["branch1", "branch2"]),
    canHandleWorkspace: () => Promise.resolve(true),
    getDiff: () => Promise.resolve({}),
    activate: () => null,
    deactivate: () => null,
    getStatus: () => Promise.resolve({}),
    getRoot: () => Promise.resolve("/test/dir"),
    getBranch: () => Promise.resolve("local"),
}

describe("Version Control Manager tests", () => {
    let vcsManager: VersionControlManager
    beforeEach(() => {
        vcsManager = new VersionControlManager(
            new MockWorkspace(),
            new MockEditorManager(),
            new MockStatusbar(),
            new MockMenu(),
            new MockCommands(),
            new MockSidebar(),
            new MockNotifications(),
        )
        vcsManager.registerProvider(provider)
    })

    it("Should create a status bar item once initialised in a compatible repo", () => {
        // FIXME: this test relies on spying on a global mock need to figure out
        // how to refresh the mocks and have each be initialised correctly
        expect(mockStatusBarShow.mock.calls.length).toBe(1)
    })

    it("Should register a vcs provider", () => {
        expect(vcsManager.providers.size).toBe(1)
    })

    it("Should register the provider details", () => {
        expect(vcsManager.activeProvider.name).toBe("svn")
    })

    it("should correctly deregister a provider", () => {
        vcsManager.deactivateProvider()
        expect(vcsManager.activeProvider).toBeFalsy()
    })

    it("Should correctly hide the status bar item if the dir cannot handle the workspace", () => {
        provider.canHandleWorkspace = async () => Promise.reject(false)
        vcsManager.registerProvider(provider)
        expect(mockStatusBarHide.mock.calls.length).toBe(1)
    })

    it("should return the correct branch", async () => {
        const branch = await provider.getBranch()
        expect(branch).toBe("local")
    })

    it("Should return the correct local branches", async () => {
        const localBranches = await provider.getLocalBranches()
        expect(localBranches).toEqual(expect.arrayContaining(["branch1", "branch2"]))
    })
})
