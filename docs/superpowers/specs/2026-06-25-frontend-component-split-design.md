# Frontend Component Split Design

Date: 2026-06-25

## Goal

Optimize the Vue frontend for the model authenticity dashboard by reducing the size and responsibility of `web/src/App.vue`, improving form usability, and making report rendering safer against malformed backend responses.

## Scope

This change covers the frontend only.

Included:

- Split `App.vue` into a container plus four focused display/input components.
- Reuse existing probe and highlight arrays instead of duplicating literal arrays in templates.
- Add API Key show/hide behavior using the existing `showApiKey` state.
- Improve `/api/probe` response parsing so non-JSON or empty error responses produce useful messages.
- Clamp score, risk, and progress values to the `0-100` UI range.
- Keep the current visual style and Tailwind utility approach.

Excluded:

- Backend API changes.
- New dependencies.
- Large visual redesign.
- Full keyboard navigation overhaul for the custom model dropdown.
- Moving business logic into a composable.

## Architecture

`web/src/App.vue` remains the container component. It owns application state, computed values, request handling, report normalization, and download behavior.

New components live under `web/src/components/`:

```text
web/src/components/
├─ ConfigPanel.vue
├─ TargetSummary.vue
├─ LoadingPanel.vue
└─ ReportPanel.vue
```

### `ConfigPanel.vue`

Purpose: Render the detection configuration form.

Responsibilities:

- Platform selection.
- Model dropdown and custom model input.
- Base URL input.
- API Key input with show/hide button.
- Submit button.

Inputs:

- `target`
- `customModel`
- `platform`
- `platforms`
- `selectedModelOption`
- `currentModelLabel`
- `loading`
- `modelMenuOpen`
- `showApiKey`

Events:

- `update:target`
- `update:customModel`
- `update:modelMenuOpen`
- `update:showApiKey`
- `selectPlatform`
- `submit`

### `TargetSummary.vue`

Purpose: Render the current target summary and probe coverage card.

Responsibilities:

- Show current model, base URL, and connection state.
- Show platform, model tier, and API key status.
- Show probe coverage from the `probeCoverage` array.

Inputs:

- `target`
- `platform`
- `selectedModelOption`
- `currentModelLabel`
- `connectionState`
- `probeCoverage`

### `LoadingPanel.vue`

Purpose: Render the detection progress UI.

Responsibilities:

- Show loading title and rotating loading copy.
- Show current step and progress bar.
- Show all loading steps.
- Show current target metadata.

Inputs:

- `loadingCopy`
- `loadingSteps`
- `loadingStepIndex`
- `currentModelLabel`
- `baseUrl`

### `ReportPanel.vue`

Purpose: Render both successful and failed report states.

Responsibilities:

- Show error report when `error` is present.
- Show successful report header, metrics, signals, dimensions, evidence, and probe details.
- Emit a download event for JSON report download.

Inputs:

- `error`
- `report`
- `metrics`
- `metricCards`
- `dimensionEntries`
- `finalScore`
- `expectedScore`
- `riskScore`

Events:

- `download`

## Data Flow

The design keeps a single source of truth in `App.vue`.

```text
App.vue state/computed
  ↓ props
Panel components
  ↓ emits
App.vue handlers
```

Child components do not call `/api/probe`, normalize reports, or mutate shared state directly. They emit changes back to `App.vue`.

## Error Handling

`runProbe()` should not assume that every response is valid JSON.

The response parser will:

1. Read the response as text.
2. Try to parse JSON only when text exists.
3. Fall back to raw text for non-JSON errors.
4. Use `data.message` or `data.error` when available.
5. Use a generic message when the response is empty or has no useful message.

This preserves compatibility with the current backend response shape while making proxy, server, and HTML error pages easier to diagnose.

## Score Safety

The UI will clamp values before using them for visible scores or dimensions that control layout.

Affected values:

- Final score.
- Expected score.
- Risk score.
- Final score progress bar width.
- Risk circle stroke offset.
- Dimension progress bar widths.

The clamp helper returns a number in the `0-100` range. Percentage formatting still accepts raw `0-1` scores and displays `-` for invalid numbers.

## Usability Improvements

The API Key input will use `showApiKey` to toggle between `password` and `text` input types. The button will be inside or next to the API Key field and will not submit the form.

The template will use existing arrays:

- `probeCoverage` for probe coverage items.
- `readyHighlights` for empty-state highlights.

This removes duplicate literals and keeps labels easier to maintain.

## Validation

After implementation:

1. Run the frontend TypeScript/build command available in the project.
2. Check for Vue template/type errors.
3. Confirm no unused variables remain in the touched files.
4. Confirm the app still has these states:
   - Empty ready state.
   - Loading state.
   - Error state.
   - Successful report state.

## Risks and Mitigations

Risk: Prop/event wiring could accidentally break form updates.

Mitigation: Keep `App.vue` as the source of truth and use explicit event handlers for each state update.

Risk: Moving report markup could accidentally change visual layout.

Mitigation: Preserve existing Tailwind classes during extraction and avoid visual redesign.

Risk: Type definitions for component props could become verbose.

Mitigation: Import existing types from `types.ts` and define small local interfaces only where needed.
