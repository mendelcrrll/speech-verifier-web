# Speech Dataset Verifier

A static browser app for reviewing collected speech samples before they become a verified dataset.

The tool replaces the manual `verify.py`-style workflow with a web interface:

1. Import a collected dataset folder or zip file.
2. Review each speech sample in a focused annotation page.
3. Listen to the audio.
4. Mark the audio as valid or invalid.
5. Reveal and edit the transcript when needed.
6. Return to the home page to track progress.
7. Finish once every speech sample has been reviewed.
8. Download `verified.zip`.

## Why This Exists

The collection pipeline creates audio/transcript pairs, but a human still needs to validate whether each recording is usable and whether the transcript is acceptable. This app is the validation layer.

It can still run as a browser-only verifier:

- No database
- No direct filesystem writes
- Suitable for static hosting

In static mode, the app exports the verified result as a downloadable zip. When loaded through the backend, it saves reviews on the server and uploads the verified folder to S3.

## Supported Inputs

The app accepts either:

- A dataset folder selected with the import button
- A `.zip` file dragged onto the import box

Zip files are unpacked locally in the browser.

The parser currently supports the collected dataset layout:

```text
collected/{data_folder}/{single|binuaral}/{train|val}/{user}/
  sample1.wav
  sample1.txt
```

It also recognizes interference/noise folders:

```text
collected/{data_folder}/{single|binuaral}/inteference/{train|val}/{user}/
  sample1.wav
  sample1_noise_type.txt
```

Note: `binuaral` and `inteference` are intentionally supported because those spellings appear in the source dataset.

The parser ignores common macOS sidecar files:

- `__MACOSX/`
- `.DS_Store`
- files beginning with `._`

## Review Workflow

The home page shows:

- Dataset summary
- Review progress bar
- Finish button
- Checklist of speech samples and review state

Clicking a sample opens a dedicated annotation page. That page contains:

- Back, Previous, and Next navigation
- Sample metadata
- Audio player
- Audio quality decision buttons
- Transcript reveal/edit section

The transcript is hidden by default to reduce anchoring bias. Annotators are prompted to listen first, then reveal the transcript if needed.

## Audio Quality Rules

A sample should be marked invalid for:

- All zeros
- High background noise
- Weird distortion and artifacts

Otherwise, if the speech is usable for transcription, mark it valid.

## Development

Install dependencies:

```bash
cd apps/frontend
npm install
```

Run locally:

```bash
npm run dev
```

Build the static app:

```bash
npm run build
```

Preview the built app:

```bash
npm run preview
```

Run lint:

```bash
npm run lint
```

## Static Deployment

The production build is emitted to:

```text
apps/frontend/dist/
```

That folder can be served by any static host.

## Backend Deployment

The optional backend lives in:

```text
apps/backend/app/
```

Install and run it from that folder on the EC2 instance:

```bash
cd speech-verifier-web/apps/backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The backend expects AWS credentials from the EC2 environment, preferably through the instance IAM role. Configure verifier keys with a JSON file like:

```json
{
  "assigned-key": {
    "user": "verifier_001",
    "s3_uri": "s3://your-bucket/path/to/verification-package/",
    "verified_s3_uri": "s3://your-bucket/path/to/verification-package/verified/"
  }
}
```

By default the backend looks for:

```text
apps/backend/app/data/key_map.json
```

Useful environment variables:

```text
SPEECH_VERIFIER_KEY_MAP=/path/to/key_map.json
SPEECH_VERIFIER_WORKSPACE=/path/to/local/workspace
SPEECH_VERIFIER_CORS_ORIGINS=https://your-domain.example
```

If the frontend and backend are served from the same origin, no frontend API variable is needed. If they are split, build the frontend with:

```bash
cd speech-verifier-web/apps/frontend
VITE_API_BASE_URL=https://api.example.com npm run build
```

## Export Shape

When the user clicks Finish, the app downloads a zip containing:

```text
verified/{single|binuaral}/{train|val}/{user}/{sampleN}/
  recording.wav
  transcript.txt
  transcript_original.txt
```

Only speech samples marked valid are included in the verified speech folders.

Interference recordings are copied without manual review:

```text
verified/{single|binuaral}/inteference/{train|val}/{user}/
  sampleN.wav
  sampleN_noise_type.txt
```

## Code Map

```text
apps/frontend/src/App.tsx
  App shell.

apps/frontend/src/pages/HomePage.tsx
  Import, parsing, review state, home/sample page switching.

apps/frontend/src/pages/SamplePage.tsx
  Focused annotation page for a single speech sample.

apps/frontend/src/components/DatasetImporter.tsx
  Folder import and zip drag/drop entrypoint.

apps/frontend/src/components/DatasetSummary.tsx
  Home page dataset summary, progress, finish button, checklist.

apps/frontend/src/components/ReviewChecklist.tsx
  Clickable list of samples and their review status.

apps/frontend/src/components/SampleVerifier.tsx
  Audio playback, valid/invalid decision, transcript reveal/edit UI.

apps/frontend/src/services/datasetParser.ts
  Converts imported File objects into typed speech/interference samples.

apps/frontend/src/services/zipDatasetImporter.ts
  Reads a zip file and exposes entries as browser File objects.

apps/frontend/src/services/reviewRows.ts
  Maps parsed dataset state into checklist rows.

apps/frontend/src/types/
  Shared TypeScript data shapes.
```
