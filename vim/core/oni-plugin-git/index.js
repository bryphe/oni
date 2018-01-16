const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const fsStat = promisify(fs.stat);

const activate = Oni => {
  const React = Oni.dependencies.React;
  let isLoaded = false;
  try {
    const pathIsDir = async p => {
      try {
        const stats = await fsStat(p);
        return stats.isDirectory();
      } catch (error) {
        return error;
      }
    };

    const updateBranchIndicator = async evt => {
      if (!evt) {
        return;
      }
      const filePath = evt.filePath || evt.bufferFullPath;
      const gitId = 'oni.status.git';
      const gitBranchIndicator = Oni.statusBar.createItem(1, gitId);

      isLoaded = true;
      let dir;
      try {
        const isDir = await pathIsDir(filePath);
        const dir = isDir ? filePath : path.dirname(filePath);
        let branchName;
        let insertions;
        let deletions;
        let files;
        try {
          branchName = await Oni.services.git.getBranch(dir);
          try {
            ({
              deletions = null,
              insertions = null,
              files = [],
            } = await Oni.services.git.getGitSummary());
          } catch (e) {
            console.warn('[Oni.Git.Plugin]: Could not get Summary', e);
          }
        } catch (e) {
          gitBranchIndicator.hide();
          return;
          // return console.warn('[Oni.plugin.git]: No branch name found', e);
          // branchName = 'Not a Git Repo';
        }

        const props = {
          style: {
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
          },
        };

        const branchContainerProps = {
          style: {
            minWidth: '10px',
            textAlign: 'center',
            padding: '2px 4px 0 0',
          },
        };

        const branchIcon = Oni.ui.createIcon({
          name: 'code-fork',
          size: Oni.ui.iconSize.Default,
        });

        const insertionsSpan = React.createElement(
          'span',
          null,
          `+${insertions} `
        );

        const deletionsSpan = React.createElement(
          'span',
          null,
          `-${deletions} `
        );

        const branchContainer = React.createElement(
          'span',
          branchContainerProps,
          branchIcon
        );

        const branchNameContainer = React.createElement(
          'div',
          { width: '100%' },
          [`${branchName} `, insertionsSpan, deletionsSpan]
        );

        const gitBranch = React.createElement(
          'div',
          props,
          branchContainer,
          branchNameContainer
        );

        gitBranchIndicator.setContents(gitBranch);
        gitBranchIndicator.show();
      } catch (e) {
        console.log('[Oni.plugin.git]: ', e);
        return gitBranchIndicator.hide();
      }
    };

    if (!isLoaded) {
      updateBranchIndicator(Oni.editors.activeEditor.activeBuffer);
    }

    Oni.editors.activeEditor.onBufferEnter.subscribe(
      async evt => await updateBranchIndicator(evt)
    );
    Oni.workspace.onFocusGained.subscribe(
      async buffer => await updateBranchIndicator(buffer)
    );
  } catch (e) {
    console.warn('[Oni.plugin.git] ERROR', e);
  }
};

module.exports = {
  activate,
};
