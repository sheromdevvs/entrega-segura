# Entrega Segura · Monochrome system v2

A small, coherent visual system for a delivery-aware checkout. Public principles from [Nu Brand System](https://building.nu.com/nu-brand-system/), [Nubank's 2026 brand refresh](https://blog.nubank.com.br/brand-refresh-como-renovamos-a-identidade-visual-do-nubank/) and [ElevenLabs](https://elevenlabs.io/) informed the work. Nubank's confidential internal NuDS content was not accessed. No brand logos, proprietary typefaces or UI source were copied.

## Foundations

- **Ink #111111, White #FFFFFF:** primary actions, typography and large editorial contrast.
- **Surface #F6F6F6, Line #E7E7E7, Muted #737373:** controlled hierarchy, quiet grouping and secondary text. No green or purple accent.
- **DM Sans variable:** locally hosted OFL font, display weight 450–500, UI/body 400–550, labels 500–600. Large optical headings use tight tracking; operational text uses normal tracking and tabular-looking currency.
- **8 px base rhythm:** larger steps for sections, tighter steps inside payment controls. Rounded pill actions; 8–16 px functional surfaces; 24 px reserved for larger narrative modules.
- **Iconography:** one 24 px coordinate grid, 1.5 px stroke, consistent endpoints. Icons accompany explicit text where the action needs explanation.

## Photography

Black-and-white, original synthetic photographs of hands, paper, cotton and ceramics. Natural light and close framing support the actual product story. Hero delivery, craft preparation, pet portrait frame and fictional defect evidence are separate assets, all explicitly identified as AI-created. No stock testimonials or real customer stories are invented. See [assets and prompts](visual-assets.md).

## Components and states

Shared navigation, primary/secondary/text buttons, state badges, money overview, conversation composer, evidence disclosures, scenario controls, operator actions, search/filter controls and a persistent store overview use the same vocabulary. The public `/design-system` page demonstrates the core system.

Statuses rely on **labels, iconography and border/fill treatment** rather than color alone. A dark badge means a completed outcome; a dashed border calls attention to review. Errors use an explicit explanation and a stronger monochrome border.

## Interaction and accessibility

- Visible keyboard focus; skip link; semantic headings, navigation, tables and named controls.
- Arrow-key tab navigation; native labelled fields; explicit selected and pressed states.
- Reduced-motion preference respected; no scroll-triggered content hiding.
- Responsive layouts replace desktop columns with readable mobile flows. Tables scroll within their own boundary.
- Microphone capture occurs only after an explicit click. Upload remains an alternative. Transcripts are editable before sending.
- Every action has a real handler, state or destination. The landing voice example plays an actual labelled synthetic note.
- Guided money, actual model calls and PayPal Sandbox are visibly distinguished. No synthetic ID or signature is offered as actual provider evidence.

## Content voice

Spanish for buyer/shop interactions, English labels where they help judges inspect the technical evidence. Use usted, concrete amounts and short explanations. No unsupported guarantees: authorizations expire, captures can fail, disputes still apply. The model explains conversations; deterministic rules govern money.
