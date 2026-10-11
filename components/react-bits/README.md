# React Bits adaptations

Source: https://github.com/DavidHDev/react-bits
Pinned upstream commit: 3e619ca31732d5d6849ecd5130ddd7b266aa7bd7

- BlurText: `src/ts-default/TextAnimations/BlurText/BlurText.tsx`
- TiltedCard: `src/ts-default/Components/TiltedCard/TiltedCard.tsx` and CSS

Original license retained in LICENSE.md. Adaptations add reduced-motion handling, touch-device guards, SSR-visible text and accessible text semantics. The scene reel in ../scene-cards.tsx is project-specific Motion code; it is not the paid Momentum Ring component. No Pro license is required for these adaptations. Keep the upstream notice when distributing the website source.

- GlideSelect (JavaScript + CSS): source supplied by the user from React Bits. Adapted to the campus blue/white palette; retains controlled values, keyboard navigation, pointer scrubbing and reduced-motion styling. Added TypeScript declarations, visible focus outlines and viewport width protection. Fixed row hit-testing to use the list's own coordinates and enabled the trigger's standard click activation for assistive technologies.

- TechText (JavaScript + CSS): user-provided React Bits source. Added a first-frame callback for the accessible static fallback and suspension while the document is hidden. The home entrance disables dragging and labels, uses the project's blue palette, and unmounts the canvas on entry. Reduced-motion users receive static text without mounting this component.
