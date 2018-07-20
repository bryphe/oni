import * as React from "react"
import { connect } from "react-redux"

import { sidebarItemSelected, styled, withProps } from "./../../UI/components/common"
import TextInput from "./../../UI/components/LightweightText"
import CommitsSection from "./../../UI/components/VersionControl/Commits"
import { SectionTitle, Title } from "./../../UI/components/VersionControl/SectionTitle"
import VersionControlStatus from "./../../UI/components/VersionControl/Status"
import { VimNavigator } from "./../../UI/components/VimNavigator"
import { StatusResult } from "./VersionControlProvider"
import { PrevCommits, VersionControlActions, VersionControlState } from "./VersionControlStore"

const TextArea = styled.textarea`
    width: 100%;
    background-color: inherit;
    color: inherit;
    font-size: inherit;
    font-family: inherit;
    padding: 0.5em;
    box-sizing: border-box;
    overflow: hidden;
    resize: vertical;
`

const StatusContainer = styled.div`
    overflow-x: hidden;
    overflow-y: auto;
`
const Explainer = styled.span`
    width: 100%;
    padding-left: 0.5rem;
    text-align: left;
    font-size: 0.8em;
    display: block;
    opacity: 0.4;
`

interface IStateProps {
    status: StatusResult
    hasFocus: boolean
    hasError: boolean
    activated: boolean
    committing: boolean
    message: string[]
    selectedItem: string
    commits: PrevCommits[]
}

interface IDispatchProps {
    cancelCommit: () => void
    updateCommitMessage: (message: string[]) => void
}

interface IProps {
    setError?: (e: Error) => void
    getStatus?: () => Promise<StatusResult | void>
    commitOne?: (message: string[], files: string[]) => Promise<void>
    commitAll?: (message: string[]) => Promise<void>
    updateSelection?: (selection: string) => void
    handleSelection?: (selection: string) => void
}

type ConnectedProps = IProps & IStateProps & IDispatchProps

interface State {
    modified: boolean
    staged: boolean
    untracked: boolean
    commits: boolean
}

interface ICommitHandlers {
    handleCommitMessage: (evt: React.ChangeEvent<HTMLInputElement>) => void
    handleCommitCancel: () => void
    handleCommitComplete: () => void
}

const CommitMessage: React.SFC<ICommitHandlers> = props => (
    <>
        <Explainer>Hit enter to commit the file</Explainer>
        <TextInput
            InputComponent={TextArea}
            onChange={props.handleCommitMessage}
            onCancel={props.handleCommitCancel}
            onComplete={props.handleCommitComplete}
            defaultValue="Enter a commit message"
        />
    </>
)

const OptionsBar = withProps<{ isSelected: boolean }>(styled.span)`
    ${p => p.isSelected && sidebarItemSelected};
    display: block;
    width: 100%;
    font-size: 0.8em;
`

interface IOptionProps {
    isSelected: boolean
}

const Options: React.SFC<IOptionProps> = ({ isSelected, children }) => {
    return <OptionsBar isSelected={isSelected}>{children}</OptionsBar>
}

interface IStagedOptions extends ICommitHandlers {
    titleId: string
    selectedId: string
    committing: boolean
    onClick: (selection: string) => void
    count: number
}

const StagedOptions: React.SFC<IStagedOptions> = props =>
    props.count ? (
        <Options isSelected={props.titleId === props.selectedId}>
            {props.committing ? (
                <CommitMessage
                    handleCommitCancel={props.handleCommitCancel}
                    handleCommitComplete={props.handleCommitComplete}
                    handleCommitMessage={props.handleCommitMessage}
                />
            ) : (
                <Explainer onClick={() => props.onClick(props.titleId)}>
                    commit all ({props.count})
                </Explainer>
            )}
        </Options>
    ) : null

export class VersionControlView extends React.Component<ConnectedProps, State> {
    public state: State = {
        modified: true,
        staged: true,
        untracked: true,
        commits: true,
    }

    public async componentDidMount() {
        await this.props.getStatus()
    }

    public async componentDidCatch(e: Error) {
        this.props.setError(e)
    }

    public toggleVisibility = (section: keyof State) => {
        this.setState(prevState => ({ ...prevState, [section]: !prevState[section] }))
    }

    public toggleOrAction = (id: string) => {
        const isSectionId = Object.keys(this.state).includes(id)
        if (isSectionId) {
            this.toggleVisibility(id as keyof State)
        }
        this.props.handleSelection(id)
    }

    public formatCommit = (message: string) => {
        return message.length >= 50 ? [message.substr(0, 50), message.substr(50)] : [message]
    }

    public handleCommitMessage = (evt: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = evt.currentTarget
        const message = this.formatCommit(value)
        this.props.updateCommitMessage(message)
    }

    public handleCommitOne = async () => {
        const { message, selectedItem } = this.props
        await this.props.commitOne(message, [selectedItem])
    }

    public handleCommitAll = async () => {
        const { message } = this.props
        await this.props.commitAll(message)
    }

    public handleCommitCancel = () => {
        this.props.cancelCommit()
    }

    public insertIf(condition: boolean, element: string[]) {
        return condition ? element : []
    }

    public isSelected = (id: string) =>
        this.props.committing &&
        this.props.status.staged.length &&
        this.state.staged &&
        this.props.selectedItem === id

    public render() {
        const error = this.props.hasError && "Something Went Wrong!"
        const inactive = !this.props.activated && "Version Control Not Available"
        const warning = error || inactive
        const {
            commits,
            committing,
            status: { modified, staged, untracked },
        } = this.props

        const commitSHAs = commits.map(({ commit }) => commit)

        const ids = [
            "commits",
            ...this.insertIf(this.state.commits, commitSHAs),
            "staged",
            ...this.insertIf(this.state.staged, ["commit_all", ...staged]),
            "modified",
            ...this.insertIf(this.state.modified, modified),
            "untracked",
            ...this.insertIf(this.state.untracked, untracked),
        ]

        return warning ? (
            <SectionTitle>
                <Title>{warning}</Title>
            </SectionTitle>
        ) : (
            <VimNavigator
                ids={ids}
                active={this.props.hasFocus && !committing}
                onSelected={this.toggleOrAction}
                onSelectionChanged={this.props.updateSelection}
                render={selectedId => (
                    <StatusContainer>
                        <CommitsSection
                            titleId="commits"
                            commits={commits}
                            selectedId={selectedId}
                            visibility={this.state.commits}
                            onClick={this.props.handleSelection}
                            toggleVisibility={() => this.toggleVisibility("commits")}
                        />
                        <VersionControlStatus
                            icon="plus-circle"
                            titleId="staged"
                            files={staged}
                            selectedId={selectedId}
                            committing={committing}
                            selectedToCommit={this.isSelected}
                            visibility={this.state.staged}
                            onClick={this.props.handleSelection}
                            optionsBar={
                                <StagedOptions
                                    titleId="commit_all"
                                    count={staged.length}
                                    selectedId={selectedId}
                                    onClick={this.props.handleSelection}
                                    handleCommitCancel={this.handleCommitCancel}
                                    handleCommitComplete={this.handleCommitAll}
                                    handleCommitMessage={this.handleCommitMessage}
                                    committing={this.isSelected("commit_all")}
                                />
                            }
                            toggleVisibility={() => this.toggleVisibility("staged")}
                        >
                            <CommitMessage
                                handleCommitCancel={this.handleCommitCancel}
                                handleCommitComplete={this.handleCommitOne}
                                handleCommitMessage={this.handleCommitMessage}
                            />
                        </VersionControlStatus>
                        <VersionControlStatus
                            icon="minus-circle"
                            files={modified}
                            titleId="modified"
                            selectedId={selectedId}
                            visibility={this.state.modified}
                            onClick={this.props.handleSelection}
                            toggleVisibility={() => this.toggleVisibility("modified")}
                        />
                        <VersionControlStatus
                            files={untracked}
                            icon="question-circle"
                            titleId="untracked"
                            selectedId={selectedId}
                            visibility={this.state.untracked}
                            onClick={this.props.handleSelection}
                            toggleVisibility={() => this.toggleVisibility("untracked")}
                        />
                    </StatusContainer>
                )}
            />
        )
    }
}

const mapStateToProps = (state: VersionControlState): IStateProps => ({
    status: state.status,
    hasFocus: state.hasFocus,
    hasError: state.hasError,
    activated: state.activated,
    committing: state.commit.active,
    message: state.commit.message,
    selectedItem: state.selected,
    commits: state.commit.previousCommits,
})

const ConnectedGitComponent = connect<IStateProps, IDispatchProps, IProps>(
    mapStateToProps,
    VersionControlActions,
)(VersionControlView)

export default ConnectedGitComponent
