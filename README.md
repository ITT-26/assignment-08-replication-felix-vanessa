[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/sPpq67Dc)

# Assignment 8: Replicating Interaction Techniques 

A replication of the interaction technique introduced in:

> Jens Grubert, Eyal Ofek, Michel Pahud, Matthias Kranz, and Dieter
> Schmalstieg. 2016. **GlassHands: Interaction Around Unmodified Mobile
> Devices Using Sunglasses.** In *Proceedings of the 2016 ACM International
> Conference on Interactive Surfaces and Spaces (ISS '16)*. ACM.
> https://dl.acm.org/doi/abs/10.1145/2992154.2992162

Our documentation on how we found the interaction technique we wanted to copy is in [`Research_doc.md`](./Research_doc.md)

## Prototype: Offline CV Pipeline

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

For **hand tracking** we first tried a colour-based approach, which worked fine, but
MediaPipe's hand landmarker turned out to be more accurate.

**Choosing the right glasses** matters a lot. The lenses should be large enough to
give as much resolution as possible, and curved just the right amount: enough to see
a good portion of the table area, but not so much that the hands and phone become too
small to track. They also need to be reflective enough that you cannot see through to
the eye region, and the colour of the reflection should roughly match the real world.

### Running the Prototype

```bash
cd prototype
python -m venv .venv
.venv\Scripts\activate        # Windows (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
python cv_video.py path/to/video.mov   # space = pause, q = quit
```

Also expects `hand_landmarker.task` and the local `hand_landmark_drawer` module
alongside `cv_video.py`.

## Web App: Live Browser Implementation

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

### Opening the Web App on Your Phone

The dev server uses a **self-signed certificate**, so the browser can't
verify it and will show a security warning ("Your connection is not
private" / "This connection is not secure"). This is expected, you need to
tell the browser to proceed anyway:

- **iOS, Safari (recommended):** tap **Show Details** → **visit this
  website** → **Visit Website**. Safari handles the untrusted certificate
  and camera permissions most reliably on iOS.
- **Android — Chrome:** tap **Advanced** → **Proceed to `<ip>` (unsafe)**.

Make sure your phone and computer are on the **same Wi-Fi network**, then
grant the **camera permission** when prompted.

## AI Disclaimer

Porting the CV pipeline from the Python prototype to React was done with the
help of Claude Code. It was also used for UI layout generation, specifically the
app mockups in the Cut-Paste Demo.

