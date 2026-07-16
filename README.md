[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/sPpq67Dc)

# Assignment 8: Replicating Interaction Techniques 

A replication of the interaction technique introduced in:

> Jens Grubert, Eyal Ofek, Michel Pahud, Matthias Kranz, and Dieter
> Schmalstieg. 2016. **GlassHands: Interaction Around Unmodified Mobile
> Devices Using Sunglasses.** In *Proceedings of the 2016 ACM International
> Conference on Interactive Surfaces and Spaces (ISS '16)*. ACM.
> https://dl.acm.org/doi/abs/10.1145/2992154.2992162

How we found this paper is documented in [`Research_doc.md`](./Research_doc.md).

## Offline CV Pipeline Prototype

![Screen recording of the offline prototype: a single cropped view of both lenses, with a hand skeleton drawn over each detected hand, a lens outline (originally used for phone detection), and an FPS counter](./prototype/prototype.gif)

Before building the web app, we created [`cv_video.py`](./prototype/cv_video.py) as a
prototyping tool. It let us test different computer-vision techniques (glasses
detection, reflection enhancement, phone detection, and hand/fingertip
tracking) offline against video we recorded with the phone in a simulated use
situation. Working against recorded footage instead of a live camera gave us a
fixed, repeatable input so we could iterate on the pipeline quickly before
porting it to the browser.

We first tried extracting the glasses region using **face landmarks**, similar to
the original paper. Even with smoothing, some wobble remained, which did not allow
reliable position tracking. We ended up sticking **two cyan dot stickers** to the
ends of the glasses frame instead. We track these dots by colour, smooth them, and
apply a similarity warp. The result is stable enough that MediaPipe hand
landmarking works reliably.

For **phone detection** we tried several techniques. One challenge was the rounded
corners of modern smartphones, which broke the rectangle-matching method we ran on
the phone mask.

For **hand tracking** we first tried a colour-based approach, but light leaking in
from behind and around the lenses washed out the skin-colour segmentation. We
switched to MediaPipe's hand landmarker instead, which doesn't depend on colour
and turned out to be more accurate.

### Running the Prototype

```bash
cd prototype
python -m venv .venv
.venv\Scripts\activate        # Windows (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
python cv_video.py path/to/video.mov   # space = pause, q = quit
```

`hand_landmarker.task` and the local `hand_landmark_drawer` module sit
alongside `cv_video.py` in the repo.

## Final Implementation as a Webapp

### Running the Web App

```powershell
cd frontend
npm install   # only needed the first time
npm run dev
```

`npm run dev` serves the app over **HTTPS** and prints a **Network** URL
(e.g. `https://x.x.x.x:5173`). Enter that IP address in the browser on
your phone to open the app. HTTPS (via `vite-plugin-mkcert`) is required
for webcam access on mobile, since browsers only grant camera permissions
in a secure context.

The dev server uses a **self-signed certificate**, so the browser can't
verify it and will show a security warning ("Your connection is not
private" / "This connection is not secure"). This is expected, you need to
tell the browser to proceed anyway:

- **iOS, Safari (recommended):** tap **Show Details** → **visit this
  website** → **Visit Website**, then **refresh the page** once. Safari
  handles the untrusted certificate and camera permissions most reliably on
  iOS.
- **Android, Chrome:** tap **Advanced** → **Proceed to `<ip>` (unsafe)**.

Make sure your phone and computer are on the **same Wi-Fi network**, then
grant the **camera permission** when prompted. The camera stream is shared
across tabs and automatically re-acquired if it drops (e.g. after locking your
phone), so you shouldn't need to grant permission again mid-session.

### Setup Tips

**Stick two cyan dot markers** onto your glasses' frame (near the outer edge of
each lens). The app tracks these by colour to lock onto the glasses, so
tracking won't work without them.

**Choosing the right glasses** matters a lot. The lenses should be large enough to
give as much resolution as possible, and curved just the right amount: enough to see
a good portion of the table area, but not so much that the hands and phone become too
small to track. They also need to be reflective enough that you cannot see through to
the eye region, and the colour of the reflection should roughly match the real world.

The demo also works best against a **uniform, high-contrast background**. We
used a black cloth laid on the table, which tracked hands far more reliably
than a cluttered or similarly-coloured desk.

**Keep the glasses roughly vertically centred** in the camera image. The dot
search is limited to a horizontal band (covering the middle half of the frame)
to cut down on false detections from other blue objects, so the dots need to
fall inside it. This is a generous margin, not a precise requirement. You can
check it in the Debug tab, where two cyan lines mark the band.

### Tracking Feedback

The rectified glasses reflection is shown at the top of every tab, so you can
always check the quality of the tracking. When MediaPipe detects a hand, a
skeleton is drawn over its landmarks: green normally, cyan while a pinch
gesture is detected.

The Debug tab additionally shows the raw camera feed, with the dot-search band
and crop overlay, the current frame rate, and a toggle for which hand (left or
right lens) drives the in-air gestures in the demos.

### Demos

The webapp features two demos, **Cut-Paste (CP)** and **Map Panning and
Tracing (MT)**, both built directly off the GlassHands
[supplementary video](https://dl.acm.org/doi/abs/10.1145/2992154.2992162#supplementary-materials).
We picked these two because they were the only techniques for which the
paper's user study found significant effects on ease of use and usefulness.

#### Cut-Paste (CP) (at 3:13 in the video)

Mirrors the paper's demo of dragging content (there, a photo) between apps on
the phone. Move an image while holding it down on the screen. Use your other
hand to make a pinch gesture in the reflection, then move it left or right to
paste the image between apps.

| Action | Result |
|--------|--------|
| Hold the image down (touch) | Image outlines orange |
| Drag the image (touch, while held) | Move the image around the screen |
| Pinch + move your other hand (in the reflection) | Paste the image into the next/previous app |
| Let go | Snap to the current app |

#### Map Panning and Tracing (MT) (at 2:47 in the video)

You can draw on the screen with one hand while using the free hand to pan the map with in-air gestures. To pan, move your free hand to the middle of the lens area, then pinch and move it in the direction you want to pan. Since the lens only covers a limited range of motion, release the pinch once you reach the edge, move your hand back to the middle, and pinch again to continue panning in the same direction, much like re-gripping a mouse to keep dragging.

| Action | Result |
|--------|--------|
| Drag on screen (touch) | Draw on the map |
| Move hand to lens centre | Position for the next pan |
| Pinch + move hand | Pan the map |
| Release pinch | Reset, ready to reposition |

## Scope

- **Phone/screen detection** was prototyped but cut from the final app. Rounded
  phone corners kept breaking rectangle-matching, and neither demo needs to know
  where the phone is, only the hand tracking.
- **On-surface vs. off-surface touch**: the paper detects touch-down from a
  microphone/accelerometer spike and touch-release from a hand-opening
  gesture. We had access to the same sensors, but chose a **pinch gesture** in
  the glasses' reflection instead, since MediaPipe gives more accurate,
  higher-definition gesture recognition than was available to the authors.
- **Table-area detection and coordinate unwarping**: the paper calibrates a
  checkerboard mapping from the reflection to real surface coordinates, so a
  hand position translates to an exact point on the table. We only care about
  the *change* in hand position, not its real-world location, so we skipped
  this entirely.

## Advantages & Limitations

**Advantages:** extends interaction beyond the phone's small screen with no
extra hardware besides the glasses; avoids finger occlusion, since input
happens beside the phone, not on it; enables genuinely simultaneous two-channel
input (e.g. trace on-screen while panning in the air). No checkerboard
calibration or fixed camera rig needed either, since we only track relative
hand motion. Camera quality and on-device compute have improved a lot since
2016, and MediaPipe's pinch recognition is more precise than the
microphone/accelerometer spike detection the paper relied on, so our setup is
both simpler and more robust than what the authors had available.

**Limitations:** needs the right glasses, marked with dot stickers for
reliable tracking rather than working with any pair off the shelf. It also
doesn't work well with low-contrast or cluttered backgrounds. The two lens
crops are two views of the *same* hand, not independent left/right hands, which
we only found out once we tried a two-hand gesture. Gestures are relative only
(pinch, drag direction); skipping coordinate unwarping means we can't point at
an exact spot the way the paper's calibrated mapping could. Holding an arm up
is also more tiring than touch over time. Performance is a limiting factor on
older phones: the demo runs at around 13 FPS with both hands tracked on the
iPhone 13 Pro we developed on, but noticeably worse on older or budget phones.

## AI Disclaimer

Claude Code was used to generate a faithful port of the CV pipeline from the Python prototype to React. It was also used to generate the office app mockups for the Cut-Paste demo.
