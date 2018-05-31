import * as ChildProcess from "child_process"

import * as Oni from "oni-api"
import * as Log from "./../../Log"
import * as Platform from "./../../Platform"
import { configuration } from "./../../Services/Configuration"

export interface IShellEnvironmentFetcher {
    getEnvironmentVariables(): NodeJS.ProcessEnv
}

export class ShellEnvironmentFetcher implements IShellEnvironmentFetcher {
    private _env: NodeJS.ProcessEnv

    constructor(private _shellEnv = require("shell-env")) {
        this._env = this._shellEnv.sync()
        this._fixPath()
    }

    private _fixPath() {
        // Set the PATH to a derived path on MacOS as this is not set correctly in electron
        // the idea is based on https://github.com/sindresorhus/fix-path
        if (Platform.isMac() && this._env.PATH) {
            process.env.PATH = this._env.PATH
        }
    }

    public getEnvironmentVariables(): NodeJS.ProcessEnv {
        return this._env || this._shellEnv.sync()
    }
}

export class Process implements Oni.Process {
    public _spawnedProcessIds: number[] = []
    private _env: NodeJS.ProcessEnv

    constructor(
        private _shellEnvironmentFetcher: IShellEnvironmentFetcher = new ShellEnvironmentFetcher(),
    ) {}

    public getPathSeparator = () => {
        return Platform.isWindows() ? ";" : ":"
    }

    public mergePathEnvironmentVariable = (currentPath: string, pathsToAdd: string[]): string => {
        if (!pathsToAdd || !pathsToAdd.length) {
            return currentPath
        }

        const separator = this.getPathSeparator()

        const joinedPathsToAdd = pathsToAdd.join(separator)

        return currentPath + separator + joinedPathsToAdd
    }

    /**
     * API surface area responsible for handling process-related tasks
     * (spawning processes, managing running process, etc)
     */
    public execNodeScript = async (
        scriptPath: string,
        args: string[] = [],
        options: ChildProcess.ExecOptions = {},
        callback: (err: any, stdout: string, stderr: string) => void,
    ): Promise<ChildProcess.ChildProcess> => {
        const spawnOptions = await this.mergeSpawnOptions(options)
        spawnOptions.env.ELECTRON_RUN_AS_NODE = 1

        const execOptions = [process.execPath, scriptPath].concat(args)
        const execString = execOptions.map(s => `"${s}"`).join(" ")

        const proc = ChildProcess.exec(execString, spawnOptions, callback)
        this._spawnedProcessIds.push(proc.pid)
        return proc
    }

    /**
     * Get the set of process IDs that were spawned by Oni
     */
    public getPIDs = (): number[] => {
        return [...this._spawnedProcessIds]
    }

    /**
     * Get the __dirname of currently executing file
     */
    public getDirname = () => {
        return __dirname
    }

    /**
     * Wrapper around `child_process.exec` to run using electron as opposed to node
     */
    public spawnNodeScript = async (
        scriptPath: string,
        args: string[] = [],
        options: ChildProcess.SpawnOptions = {},
    ): Promise<ChildProcess.ChildProcess> => {
        const spawnOptions = await this.mergeSpawnOptions(options)
        spawnOptions.env.ELECTRON_RUN_AS_NODE = 1

        const allArgs = [scriptPath].concat(args)

        const proc = ChildProcess.spawn(process.execPath, allArgs, spawnOptions)
        this._spawnedProcessIds.push(proc.pid)
        return proc
    }

    /**
     * Spawn process - wrapper around `child_process.spawn`
     */
    public spawnProcess = async (
        startCommand: string,
        args: string[] = [],
        options: ChildProcess.SpawnOptions = {},
    ): Promise<ChildProcess.ChildProcess> => {
        const spawnOptions = await this.mergeSpawnOptions(options)

        const proc = ChildProcess.spawn(startCommand, args, spawnOptions)
        this._spawnedProcessIds.push(proc.pid)
        proc.on("error", (err: Error) => {
            Log.error(err)
        })

        return proc
    }

    public getPath() {
        return this._env ? this._env.PATH : process.env.Path || process.env.PATH
    }

    public mergeSpawnOptions = async (
        originalSpawnOptions: ChildProcess.ExecOptions | ChildProcess.SpawnOptions,
    ): Promise<any> => {
        try {
            if (!this._env) {
                this._env = this._shellEnvironmentFetcher.getEnvironmentVariables()
            }
        } catch (e) {
            Log.error(`[Oni Merge Spawn Options Error]: ${e.message}`)
        }

        const requiredOptions = {
            env: {
                ...process.env,
                ...(this._env || {}),
                ...originalSpawnOptions.env,
            },
        }

        requiredOptions.env.PATH = this.mergePathEnvironmentVariable(
            this.getPath(),
            configuration.getValue("environment.additionalPaths"),
        )

        return {
            ...originalSpawnOptions,
            ...requiredOptions,
        }
    }
}

export default new Process()
