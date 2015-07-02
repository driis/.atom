# Your init script
#
# Atom will evaluate this file each time a new window is opened. It is run
# after packages are loaded/activated and after the previous editor state
# has been restored.
#
path = require 'path'

# Add cut-line command
atom.commands.add 'atom-workspace', 'my:cut-line', ->
  editor = atom.workspaceView.getActiveView().getEditor()
  if editor.getSelectedText().length == 0
    editor.selectLine()

  editor.cutSelectedText()
