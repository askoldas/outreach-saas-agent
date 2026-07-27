# Opptium color system

The canonical color and elevation tokens live in `src/styles/globals.css`. They are native CSS custom properties imported once by the root application layout. Component CSS should use semantic tokens rather than primitive palette values.

## Palette and roles

- Cyan primitives (`--cyan-*`) represent Opptium, research, discovery, processing, links, active navigation, progress, and primary actions.
- Jade primitives (`--jade-*`) represent qualification, verified evidence, opportunity, and positive outcomes. Jade is not used for ordinary primary actions.
- Neutral primitives (`--neutral-*`) provide the canvas, surfaces, borders, and text hierarchy.
- Semantic state tokens cover success, warning, danger, and information states, including their soft backgrounds.

The finalized core colors are primary cyan `#087f9c` and secondary jade `#43c995`. Jade remains supporting rather than replacing cyan on primary interactions.

## Component mappings

- Primary actions: `--color-brand`, `--color-brand-hover`, and `--color-brand-active`.
- Secondary actions: white surface and strong border, with a soft-cyan hover.
- Links and focus: `--color-link`, `--color-link-hover`, and `--color-focus`.
- Active/researching states: the selected or information cyan tokens.
- Qualified/verified states: `--color-success` on `--color-success-soft`.
- Review and error states: warning and danger semantic pairs.
- Canvas, cards, tables, and inputs: foundation surface, border, and text tokens.

## Typography and report density

The application uses an Inter-first system font stack without a build-time remote-font dependency. The canonical token file defines caption, table, UI, body, section-title, and page-title sizes with matching line heights and weights. Report tables use 14/20 regular text, 12/16 semibold headers, 48px compact rows, constrained columns, ellipsis, and intentional expanded detail rows. Buttons and compact filter controls use the shared UI and control-height tokens.

Legacy aliases such as `--color-ink` and `--color-line` temporarily map to the new semantic system so established component modules retain their structure while using the centralized palette.

## Accessibility

- Jade backgrounds use `--color-accent-contrast`, `--color-accent-strong`, or semantic success text, never unchecked white text.
- Jade `#43c995` is not used for small body text on white; pale cyan and jade are backgrounds rather than body-text colors.
- Important controls and text should meet WCAG AA contrast.
- Every keyboard-focusable control retains a visible cyan outline; primary controls may additionally use `--focus-ring`.
- Status labels retain text and are never communicated by color alone.
- Disabled buttons use muted surface and subtle text tokens and do not animate on hover.

## Justified literal colors

- Primitive and exceptional semantic values are defined only in the canonical token block.
- Semi-transparent `rgb()` values remain in component CSS for backdrops, glass surfaces, sidebar overlays, and the auth-page decorative gradient because their opacity is contextual.
- `public/Opptium_logo.svg` retains its embedded official logo colors and geometry.

## Logo mapping

- Wordmark and smaller foreground annulus: cyan `#087f9c`.
- Larger rear annulus and `i` dot: jade `#43c995`.
- All Opptium-owned logo variants use the finalized colors while retaining their original geometry and dimensions.
- No mint compatibility aliases remain; all internal references use jade primitives or semantic accent tokens.
