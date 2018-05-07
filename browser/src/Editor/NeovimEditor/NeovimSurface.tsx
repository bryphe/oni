/**
 * NeovimSurface.tsx
 *
 * UI layer for the Neovim editor surface
 */

import * as React from "react"
import { connect } from "react-redux"

import { IEvent } from "oni-types"

import { NeovimInstance, NeovimScreen } from "./../../neovim"
import { INeovimRenderer } from "./../../Renderer"

import { Cursor } from "./../../UI/components/Cursor"
import { CursorLine } from "./../../UI/components/CursorLine"
import { InstallHelp } from "./../../UI/components/InstallHelp"
import { TabsContainer } from "./../../UI/components/Tabs"
import { ToolTips } from "./../../UI/components/ToolTip"
import { TypingPrediction } from "./../../UI/components/TypingPredictions"

import { TypingPredictionManager } from "./../../Services/TypingPredictionManager"

import { setViewport } from "./../NeovimEditor/NeovimEditorActions"
import { NeovimBufferLayers } from "./NeovimBufferLayersView"
import { NeovimEditorLoadingOverlay } from "./NeovimEditorLoadingOverlay"
import { NeovimInput } from "./NeovimInput"
import { NeovimRenderer } from "./NeovimRenderer"

export interface INeovimSurfaceProps {
    autoFocus: boolean
    neovimInstance: NeovimInstance
    renderer: INeovimRenderer
    screen: NeovimScreen
    typingPrediction: TypingPredictionManager

    onActivate: IEvent<void>

    onKeyDown?: (key: string) => void
    onBufferClose?: (bufferId: number) => void
    onBufferSelect?: (bufferId: number) => void
    onFileDrop?: (files: FileList) => void
    onImeStart: () => void
    onImeEnd: () => void
    onBounceStart: () => void
    onBounceEnd: () => void
    onTabClose?: (tabId: number) => void
    onTabSelect?: (tabId: number) => void
    setViewport: any
}

interface IFileDropHandler {
    target: HTMLElement
    handleFiles: (files: FileList) => void
}

class FileDropHandler extends React.Component<IFileDropHandler> {
    public componentDidMount() {
        this.addDropHandler()
    }

    public componentDidUpdate(prevProps: IFileDropHandler) {
        if (!prevProps.target && this.props.target) {
            this.addDropHandler()
        }
    }

    public addDropHandler() {
        if (!this.props.target) {
            return
        }

        this.props.target.ondragenter = ev => {
            console.log("dragenter.............")
            ev.preventDefault()
        }

        this.props.target.ondragover = ev => {
            console.log("dragover.............")
            ev.preventDefault()
        }

        this.props.target.ondragleave = ev => {
            console.log("dragleave.............")
            ev.preventDefault()
        }

        this.props.target.ondragend = ev => {
            console.log("drag end ev ============: ", ev)
        }

        this.props.target.ondrop = ev => {
            console.log("detecting drop event", ev)
            ev.preventDefault()

            const { files } = ev.dataTransfer
            console.log("files: ", files)

            if (files.length) {
                this.props.handleFiles(files)
            }
        }
    }

    public render(): JSX.Element {
        return null
    }
}

class NeovimSurface extends React.Component<INeovimSurfaceProps> {
    private observer: any
    private _editor: HTMLDivElement

    public componentDidMount(): void {
        // tslint:disable-next-line
        this.observer = new window["ResizeObserver"](([entry]: any) => {
            this.setDimensions(entry.contentRect.width, entry.contentRect.height)
        })

        this.observer.observe(this._editor)
    }

    public setDimensions = (width: number, height: number) => {
        this.props.setViewport(width, height)
    }

    public render(): JSX.Element {
        return (
            <div className="container vertical full">
                <div className="container fixed">
                    <TabsContainer
                        onBufferSelect={this.props.onBufferSelect}
                        onBufferClose={this.props.onBufferClose}
                        onTabClose={this.props.onTabClose}
                        onTabSelect={this.props.onTabSelect}
                    />
                </div>
                <div className="container full">
                    <div
                        className="stack"
                        style={{ pointerEvents: "all" }}
                        ref={(e: HTMLDivElement) => (this._editor = e)}
                    >
                        <NeovimRenderer
                            renderer={this.props.renderer}
                            neovimInstance={this.props.neovimInstance}
                            screen={this.props.screen}
                        />
                        <FileDropHandler
                            target={this._editor}
                            handleFiles={this.props.onFileDrop}
                        />
                    </div>
                    <div className="stack layer">
                        <TypingPrediction typingPrediction={this.props.typingPrediction} />
                        <Cursor typingPrediction={this.props.typingPrediction} />
                        <CursorLine lineType={"line"} />
                        <CursorLine lineType={"column"} />
                    </div>
                    <NeovimInput
                        startActive={this.props.autoFocus}
                        onActivate={this.props.onActivate}
                        typingPrediction={this.props.typingPrediction}
                        neovimInstance={this.props.neovimInstance}
                        screen={this.props.screen}
                        onBounceStart={this.props.onBounceStart}
                        onBounceEnd={this.props.onBounceEnd}
                        onImeStart={this.props.onImeStart}
                        onImeEnd={this.props.onImeEnd}
                        onKeyDown={this.props.onKeyDown}
                    />
                    <NeovimBufferLayers />
                    <div className="stack layer">
                        <ToolTips />
                    </div>
                    <NeovimEditorLoadingOverlay />
                    <InstallHelp />
                </div>
            </div>
        )
    }
}
export default connect(null, { setViewport })(NeovimSurface)
