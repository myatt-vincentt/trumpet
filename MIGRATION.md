# Migration notes

Per release tag, newest first. Read by the platform's own version surface
(`GET /platform/versions`) and served to creators' agents through `vincentt
outdated`. Accurate or absent — never speculative. `required: false` is the
authored "no action required," not silence.

## 1.12.0
required: false
Update the CLI to 0.27.4 or later first; older CLIs refuse runtime `2026.11.2`. The template moves to SDK `2.0.0-alpha.12`, harness `3.4.0` and that runtime: live visual edits, console footage.
- SDK `2.0.0-alpha.11` and `2.0.0-alpha.12` are additive. The console's visual editor shows an unsaved colour, font size or screen placement on `ScreenText`, `TextLabel`, `ScreenImage` and `ScreenShape` at once, and `XRProvider` lets the console preview the app on platform sample footage; app code does nothing for either. New core helpers place a tracked point or a viewport-pixel size in a screen transform. The SDK's own migration notes list every addition.
- Harness `3.4.0` (was `3.0.0`): in the console frame the preview can switch to the platform's sample footage and back to the camera, and Send feedback attaches the real screen with numbered marks. When the console pauses the app, the hold handler now runs one frame after the command, and every announce also declares `frame-still`. A project test that expects the hold at once, or an exact capability list, must wait a frame or include `frame-still`; the template's own render-hold tests are updated.
- `@vincentt-xr/runtime` moves from `2026.11.0` to `2026.11.2`, which carries these SDK and harness versions, so `vincentt build` loads them from runtime.vincentt.studio. An upgrade carries the new pins through package.json.
- Runtime `2026.11.2` needs CLI 0.27.4 or later; an older CLI refuses the build as not a released runtime. Smoke Build now installs `@vincentt-xr/cli@0.27.4`; the workflow file is not replaced by an upgrade, so a project whose CI installs an older CLI must raise that pin.
- The template grounding now targets SDK `2.0.0-alpha.12` and names the alpha.11 transform helpers. The grounding file is not replaced by an upgrade, so only new scaffolds get it.

## 1.11.0
required: true
The build is now `vincentt build` on shared runtime 2026.11.0; empty the build output folder once before the first build. Also a `full` frame option and `?record` capture controls.
- `pnpm build` now runs `vincentt build` (CLI 0.27.0 or later) instead of the template's own build script, carried by package.json. The template depends on `@vincentt-xr/runtime` `2026.11.0`: a build loads React, three, fiber, drei and the SDK from runtime.vincentt.studio and holds only the app's own code. Removing that dependency, or `vincentt build --self-contained`, gives a self-contained app. The old build and static-imports scripts can be deleted; the app-metadata script stays.
- The first `vincentt build` refuses a non-empty build output folder it did not write, such as one from the old build script. Empty it once. Later builds clear only the files the last build on this machine wrote; an added or edited file is refused, never deleted.
- The CLI now applies `app.config.json`: an unknown key, a wrong type, a `url` that is not `https://`, or an `image` outside the project fails the build. Code may import only code and styles; an image, video or model import from the source folder fails the build, so put the file in the public folder and refer to it by path.
- Every `VITE_*` switch is now dev-only. `VITE_INPUT_SOURCE`, `VITE_INPUT_URL`, `VITE_FRAMED_SOURCE` and `VITE_MOBILE_XR_ACCEPTANCE_HARNESS` work in `pnpm dev` and `pnpm preview`, never in `vincentt build` or a published app. A published app starts on the webcam; a framed one uses the camera only when the frame's address carries `?source=webcam`.
- The template depends on `@vincentt-xr/analytics` `^0.3.2`. Smoke Build installs `@vincentt-xr/cli@0.27.1` before `pnpm build`; the workflow file is not replaced by an upgrade, so a project whose CI runs `pnpm build` must add that install step, or CI fails with `vincentt` not found.
- `frame` in the source folder's frame config: `"phone"` (default, the fixed 9:16 frame as before) or `"full"` (the canvas is the whole viewport, under the notch). The new `FrameContainer` component reads it and replaces the SDK `AspectRatioContainer` in `App.tsx`; no `app.config.json` key. Nothing changes while it stays `"phone"`, and a project that kept its own `App.tsx` is unaffected until it adopts the new shell.
- `AGENTS.md` now opens every session on the platform: sign in (`vincentt login`), bind (`vincentt create` / `link`), `pnpm preview`, hand over the console page, then ask what to build. `pnpm dev` prints that its address is for checks only and, when the machine is not signed in or the folder is not bound, the commands that fix it.
- `?record` on the app's address shows the camera UI (the new `CaptureControls` component and its save helper): tap the shutter for a photo, hold to record, release to stop; `?record=audio` adds the microphone. Captures download on desktop and Android and open the share sheet on iOS; video is MP4 where the browser can record it, WebM otherwise.
- In record mode the canvas pixel ratio is pinned to `min(devicePixelRatio, 2)` and adaptive quality is off, so captures have the screen's resolution. `FaceBoundingBox` and `HandBoundingBox` size themselves through a new screen-fit helper, so they fit any canvas aspect and draw as before at 9:16.
- `index.html`'s viewport meta now carries `viewport-fit=cover`; the app stylesheet gains the `.cam-*` styles.

## 1.9.0
required: false
No action required. The template now depends on SDK `2.0.0-alpha.10`, which is additive.
- SDK `2.0.0-alpha.10` adds a body avatar and body occlusion, two people with stable ids, per-person masks, nail polish, hand effects, SDK-hosted rig models and stable wristwear. Nothing from alpha.9 changed meaning. The SDK's own migration note lists every addition. Its sample-clip picker no longer lists the numbered clips; a saved numbered id still resolves.
- A framed scene now opens on a sample clip that matches its trackers: a hand clip for a hand scene, then body, then face. The sample clip used when no input clip is set is now the idle-woman clip from the new sample set.
- The template grounding now targets SDK `2.0.0-alpha.10` and names its new APIs. The grounding file is not replaced by an upgrade, so only new scaffolds get it.

## 1.8.0
required: false
No action required. The development build now carries JSX source info, and the dev server reloads the page after every change.
- The development build now records each element's source file and line, which the desktop editor uses to map objects back to code. An upgrade carries this through esbuild.config.mjs. The production build is unchanged, byte for byte.
- The dev server now reloads the page, including a phone on a live preview, about a second after a source change. This lives in the dev server script and a new dev-html.mjs beside it, neither of which an upgrade replaces. To get live reload in an existing project, copy both files from a new scaffold, or ask your agent to. Only new scaffolds get it otherwise.

## 1.7.1
required: false
No action required.
- The template grounding now maps every SDK `2.0.0-alpha.9` door, including instructions and particles, names the remaining face-effects pieces, and adds patterns for hand try-on, touch objects, instruction prompts and particles. The grounding file is not replaced by an upgrade, so only new scaffolds get it.
- New scaffolds now include a credited low-poly hand model, hand-v1.glb, in the public models folder, with a CREDITS.md entry for its CC BY 4.0 source. An upgrade adds neither file; a project that wants the model can copy both from a new scaffold.

## 1.7.0
required: true
The template now depends on SDK `2.0.0-alpha.9`, where left and right mean the person's own side and FaceTracker content turns with the head; remove any swap or negated rotation your scene added.
- SDK `2.0.0-alpha.9` is a required update. Scene code needs changing if it swapped left and right, negated a head yaw or pitch, used the removed FaceWarp3D settings, or relied on LipEffect drawing above hands and glasses. Hand presence must now reach 0.65 (was 0.5), so faint hands drop out sooner. The SDK's own migration note lists every change.
- Sample videos and a configured video or photo are now bound as a video or an image and drawn as filmed, instead of pre-mirrored and bound as a mirrored webcam. The picture is unchanged; left and right now name the filmed person's own side. An upgrade carries this, because the shell files are replaced.
- The hand bounding box's hand option and its automatic colours now follow the person's own hands. The component is creator-owned, so an existing copy keeps its code but reads the new SDK sides.
- The template now depends on harness `3.0.0`. A production page no longer downloads the Share and feedback overlays or their QR code library; both buttons still appear in preview. Nothing in the template imported the moved names. A project that imported a Share or feedback helper from the package root now fails to build until it imports it from the share or annotate entry instead.
- The template grounding now states that it targets SDK `2.0.0-alpha.9` and explains the person's-own-side rule. The grounding file is not replaced by an upgrade, so only new scaffolds get it.

## 1.6.2
required: false
No action required.
- Same content as the 1.6.1 tag, which never released (its release job refused for a missing note, and release tags cannot be deleted).
- The agent contract (AGENTS.md) now has a "Storing visitor data" section: keep visitor state in `localStorage` or `sessionStorage`, use only `__Host-` cookies when a cookie is needed, and put an app with real visitor sign-in on a custom domain, because published apps share the `vincentt.app` parent domain. AGENTS.md is not replaced by an upgrade, so only new scaffolds get it.

## 1.6.0
required: false
No action required.
- The template now depends on harness `2.0.0`. The preview tunnel client moved into the CLI, so the app no longer installs it or its WebSocket library. Nothing in the template imported it. An upgrade carries the new pin.
- A framed app whose own address carries `source=webcam` now starts on the webcam instead of a sample video. The console gallery's Live frame uses this. A creator's preview frame never sets it, and a configured source is still never overridden.
- Release tooling only: the template's release job now runs in a tag-only environment and refuses tags that are not bare semver on main. It does nothing in a creator's project.

## 1.5.9
required: false
No action required.
- New scaffolds now start with SDK `2.0.0-alpha.8`; existing projects retain their current SDK pin until they update or reseed.
- The SDK's sample-media list now offers the hosted sample videos before the webcam, so the source list starts with a video and the webcam is still listed.
- SDK `2.0.0-alpha.8` is additive: holistic and iris tracking, reusable gestures, segmentation overlays and person cut-out, a coordinate toolkit, capability and camera permission handling, an asset cache, a tracking configuration and product placement AR. Adaptive quality is now on by default and can be turned off on the provider.
- The template grounding now states that it targets SDK `2.0.0-alpha.8`, and keeps its "(alpha.8)" markers so a project on an older pin can see which APIs need the newer SDK. The grounding file is not replaced by an upgrade, so only new scaffolds get it.

## 1.5.8
required: false
No action required.
- A brand-new scaffold's starting scene now runs face tracking only; the hand bounding box still ships but is not mounted. The scene is creator-owned, so an existing project keeps whatever trackers it already mounts.
- The page no longer loads the Poppins font from Google Fonts, because nothing in the template uses it. A project that styled its own text with Poppins now falls back to the system font unless it loads the font itself.
- The page now opens its connection to the platform CDN early, so the tracking files do not wait on connection setup when they are requested.
- Production builds now preload the entry's static script chunks. This is in the build script, which an upgrade does not replace, so only new scaffolds get it.
- The agent contract (AGENTS.md) now says `vincentt create` exits 4 with the `vincentt login` remedy in a folder that already holds an app when there is no account and no terminal, and quotes the preview ending lines without em-dashes, matching the CLI release that ships alongside. AGENTS.md is not replaced by an upgrade, so only new scaffolds get it.
- New scaffolds now start with SDK `2.0.0-alpha.7`; existing projects retain their current SDK pin until they update or reseed.

## 1.5.7
required: false
No action required.
- Release tooling only: the starter now carries two checks for the template's own release tags and its `latest` pointer. They run only in the template repository and do nothing in a creator's project.

## 1.5.6
required: false
No action required.
- The starter's default scene now demonstrates face and hand bounding boxes plus a footer HUD. These are creator-owned files, so upgrading an existing project will not add them; only a brand-new scaffold receives them.
- The starter's agent-contract docs were corrected to point at the SDK's own grounding file instead of a merge step that does not exist. Those docs are not touched by the upgrade either, so this only affects newly-scaffolded projects.

## 1.5.5
required: false
No action required.
- The local preview script now falls back automatically when the platform CLI is not resolvable on the shell's PATH, instead of only printing an install hint.
