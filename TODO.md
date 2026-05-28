# TODO List

- [x] Fix: Missing filePath in captionMonitor for transcript storage. Implemented `generateTranscriptFilePath` in `MeetJoiner` to create a unique file path based on meeting ID and date, and passed it to the `ctx` object for `startTranscriptMonitor`.
- [x] Fix: `ENOENT: no such file or directory` error when saving transcript. Added `fs.mkdir` with `recursive: true` in `transcriptStorage.js` to ensure the directory exists before appending the transcript file.
- [x] Fix: `TypeError: Cannot set properties of undefined (setting 'isStopping')` in `stopTranscriptMonitor`. Modified `socraticbot.js` to pass `this.joiner` as the `ctx` object to `stopTranscriptMonitor`.