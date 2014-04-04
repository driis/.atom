# Your init script
#
# Atom will evaluate this file each time a new window is opened. It is run
# after packages are loaded/activated and after the previous editor state
# has been restored.
#
path = require 'path'

# Add cut-line command
atom.workspaceView.command 'my:cut-line', ->
  editor = atom.workspaceView.getActiveView().getEditor()
  editor.selectLine()
  editor.cutSelectedText()

atom.workspaceView.command 'my:stacktrace-transform', ->
  editor = atom.workspaceView.getActiveView().getEditor()
  text = editor.getText()
  text = text.split(/0x[0-9a-f]+/)
  editor.setText(text.join("\n"))

# Open markdown files soft-wrapped.
atom.workspaceView.eachEditorView (editorView) ->
  editor = editorView.getEditor()
  if path.extname(editor.getPath()) is '.md'
    editor.setSoftWrap(true)
