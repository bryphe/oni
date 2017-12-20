/**
 * ExplorerSplit.tsx
 *
 */

import * as React from "react"
import { connect } from "react-redux"

import { IEvent } from "oni-types"

import { withTheme } from "styled-components"

import { KeyboardInputView } from "./../../Editor/KeyboardInput"

import { FileIcon } from "./../FileIcon"

import * as ExplorerSelectors from "./ExplorerSelectors"
import { IExplorerState } from "./ExplorerStore"

import { DefaultThemeColors, IThemeColors } from "./../../Services/Themes"

require("./Explorer.less") // tslint:disable-line

export interface IFileViewProps {
    fileName: string
    isSelected: boolean
    theme: IThemeColors
}

export class FileView extends React.PureComponent<IFileViewProps, {}> {
    public render(): JSX.Element {
        const style = {
            borderLeft: this.props.isSelected ? "4px solid rgb(97, 175, 239)" : "4px solid transparent",
            backgroundColor: this.props.isSelected ? "rgba(97, 175, 239, 0.1)" : "transparent",
        }
        return <div className="item" style={style}>
                <div className="icon"><FileIcon fileName={this.props.fileName} isLarge={true}/></div>
                <div className="name">{this.props.fileName}</div>
            </div>
    }
}

export interface INodeViewProps {
    node: ExplorerSelectors.ExplorerNode
    isSelected: boolean
    theme: IThemeColors
}

export class NodeView extends React.PureComponent<INodeViewProps, {}> {
    public render(): JSX.Element {
        const node = this.props.node

        switch (node.type) {
            case "file":
                return <FileView fileName={node.name} isSelected={this.props.isSelected} theme={this.props.theme}/>
            case "container":
                return <ContainerView expanded={node.expanded} name={node.name} isContainer={true} isSelected={this.props.isSelected} theme={this.props.theme}/>
            case "folder":
                return <ContainerView expanded={node.expanded} name={node.name} isContainer={false} isSelected={this.props.isSelected} theme={this.props.theme}/>
            default:
                return <div>{JSON.stringify(node)}</div>
        }
    }
}

export interface IContainerViewProps {
    isContainer: boolean
    expanded: boolean
    name: string
    isSelected: boolean
    theme: IThemeColors
}

export class ContainerView extends React.PureComponent<IContainerViewProps, {}> {
    public render(): JSX.Element {
        const headerStyle = {
            backgroundColor: this.props.isContainer ? "#1e2127" : this.props.isSelected ? "rgba(97, 175, 239, 0.1)" : "transparent",
            borderLeft: this.props.isSelected ? "4px solid rgb(97, 175, 239)" : "4px solid transparent",
        }

        return <div className="item" style={headerStyle}>
            <div className="icon">
                <i className="fa fa-caret-right" />
            </div>
            <div className="name">
                {this.props.name}
            </div>
        </div>
    }
}

export interface IExplorerContainerProps {
    onEnter: IEvent<void>
    onKeyDown: (key: string) => void
}

export interface IExplorerViewProps extends IExplorerContainerProps {
    nodes: ExplorerSelectors.ExplorerNode[]
    selectedId: string
    hasFocus: boolean
    // recentFiles: IRecentFile[]
    // workspaceRoot: string
    theme?: IThemeColors
}

export class ExplorerView extends React.PureComponent<IExplorerViewProps, {}> {

    public render(): JSX.Element {
        const theme = this.props.theme || DefaultThemeColors

        const containerStyle = {
            width: "200px",
            color: theme["explorer.foreground"] || theme["editor.foreground"],
            backgroundColor: theme["explorere.backgorund"] || theme["editor.background"],
            height: "100%",
        }

        const topColor = theme["explorer.highlight"] || theme["highlight.mode.normal.background"]

        const tabStyle = {
            height: "2.5em",
            lineHeight: "2.5em",
            textAlign: "center",
            borderTop: this.props.hasFocus ? `2px solid ${topColor}` : "2px solid transparent",
        }

        const nodes = this.props.nodes.map((node) => <NodeView 
            node={node} 
            isSelected={node.id === this.props.selectedId}
            theme={theme}/>)

        return <div style={containerStyle} className="explorer enable-mouse">
                <div className="header" style={tabStyle}>Explorer</div>
                <div className="items">
                    {nodes}
                </div>
                <div className="input">
                    <KeyboardInputView
                        top={0}
                        left={0}
                        height={12}
                        onActivate={this.props.onEnter}
                        onKeyDown={this.props.onKeyDown}
                        foregroundColor={"white"}
                        fontFamily={"Segoe UI"}
                        fontSize={"12px"}
                        fontCharacterWidthInPixels={12}

                        />
                </div>
            </div>
    }
}

const mapStateToProps = (state: IExplorerState, containerProps: IExplorerContainerProps): IExplorerViewProps => {
    return {
        ...containerProps,
        hasFocus: state.hasFocus,
        nodes: ExplorerSelectors.mapStateToNodeList(state),
        selectedId: state.selectedId,
    }
}

export const Explorer = withTheme(connect(mapStateToProps)(ExplorerView))
