# Plan a Three-Stop Walking Route in Google Maps

A seven-screen interactive tutorial built with VisoReady Agent from the real, English Google Maps interface.

**Colosseum > Pantheon > Trevi Fountain, Rome.** No Google account is needed to play this captured tutorial.

## Try the Demo

- [Download the full package (ZIP)](https://github.com/berkanarin/VisoReady-Agent/archive/refs/heads/main.zip) and extract it. The ZIP includes the demo, editable project, Agent and current VisoReady editor.
- Open `demos/google-maps-walking-route/index.html` from the extracted folder in a browser. GitHub file and raw HTML pages display source code, not the running demo.
- Open `VisoReady.html` at the package root and import `demos/google-maps-walking-route/project.ohig.json` to edit the annotations and share your own version.
- Use the highlighted controls or the player's Next button to advance. Text entry is demonstrated, not simulated as an exercise.

This is a screenshot-based walkthrough, not a live Google Maps session. It does not create or save a route to your account. Directions, travel times, place information and the live interface can change. Consult Google Maps before travelling.

## What You Will Learn

1. Turn a selected place into your starting point.
2. Switch to walking directions.
3. Set the Pantheon as your destination.
4. Add a third place to the route.
5. Choose Trevi Fountain.
6. Review the complete route.
7. Open detailed directions and find the share control.

The tutorial begins just after searching for **Colosseum, Rome** and selecting **Directions**. The capture recipe performs those setup actions too. Adding stops is demonstrated; dragging to reorder stops is not part of this demo.

## Real Screens, Editable Result

Captured in a fresh signed-out Chromium session, using an English locale and Google Maps' English language setting. No account cookies, personal projects or location permission were used. Local street and business names may remain in their original language.

Screenshots are unaltered full-viewport PNGs. The flow adds thin frame highlights, without circular markers or camera zoom. Google branding and map attribution remain visible. Captures, timestamps, source URLs and SHA-256 hashes are retained in [captures/manifest.json](captures/manifest.json).

Each explanation has a short English heading, such as **Explore on foot** or **Your route is ready**, followed by a complementary instruction. The same title settings are retained in the editable project and the recapture recipe.

This desktop-interface tutorial is best viewed on a laptop or desktop. The player also runs on a phone, but its full-map screenshots and targets are small. Use Next when a highlighted control is difficult to tap. See [QA.md](QA.md).

## Reproduce Locally

From the VisoReady Agent package folder, after setup:

```powershell
pnpm exec tsx examples/google-maps-walking-route.ts output/maps-fresh
```

Use a new output folder for every run. The script records actual browser actions, builds an editable project and checks its offline player. It does not publish anything. [recipe.json](recipe.json) is the capture recipe used for this example; selectors may need updating when Google changes its UI. Cookie-consent or challenge screens may require human review. Do not bypass them.

`settleMs` allows map tiles to paint after a control is ready; it is not proof that every tile has loaded. Visually review every fresh capture before sharing it.

## Rights and Attribution

This is an independent instructional example, not affiliated with or endorsed by Google. Google Maps screenshots and map data are third-party material and **are not licensed under this repository's MIT license**. See [ATTRIBUTION.md](ATTRIBUTION.md) before reuse or publication.

Official references: [Google Maps directions help](https://support.google.com/maps/answer/144339?co=GENIE.Platform%3DDesktop&hl=en) and [Google geo usage guidelines](https://about.google/brand-resource-center/products-and-services/geo-guidelines/).
