' =====================================================================
' start-retentionlab-hidden.vbs
' Silently starts the RetentionLab Node server in the BACKGROUND.
' No console window, no browser prompt. Used by the Windows autostart.
'
' Location-independent: works no matter where the folder is placed,
' because it finds itself via ScriptFullName.
' =====================================================================
Option Explicit

Dim shell, fso, projectDir, cmdNode
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' --- This .vbs sits in the project folder, so its parent is the project ---
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)

' --- Start server.js in the background (0 = hidden window, False = don't wait) ---
' server.js loads .env automatically via dotenv.
shell.CurrentDirectory = projectDir
shell.Run """node"" server.js", 0, False

' Exit cleanly
Set shell = Nothing
Set fso = Nothing