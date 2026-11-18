# AgriShield

AgriSquad's Agri-IKS hackathon prototype for smallholder vegetable growers in Limpopo and Mpumalanga. The app uses React, Vite, Workbox and IndexedDB.

## Run in VS Code on Windows

Install Node.js 22.12 or newer and extract the project. Open the AgriShield folder in VS Code using **File → Open Folder**. Open **Terminal → New Terminal**, select PowerShell, and run:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:5173. Use Ctrl+C to stop the server. The development server is for editing and starts without offline caching.

## Rehearse the offline demo

Run these commands from the same project folder:

```powershell
npm.cmd run build
npm.cmd run preview
```

1. Open http://127.0.0.1:4173 in Chrome or Edge. Wait for **Ready offline**, then choose **Explore the offline demo**. Use the browser's install option if offered.
2. Choose **Morogo**, select **Dry**, and record the reading. Verify that the demo status says **Below demo range**.
3. Stop the preview server and reload the exact same /demo URL. The dashboard should reopen with Morogo and the recorded reading.
4. Open **Local Guide**, search **morogo**, and inspect the provenance and permission labels. Change the scenario and record another reading while offline.
5. On a phone, first serve the contents of **dist** at the root of an HTTPS origin. Open the URL on that phone, wait for **Ready offline**, install or add to the home screen if offered, then enable airplane mode and reopen. A plain HTTP laptop Wi-Fi IP can show the UI but generally cannot install the offline service worker.

Each device and browser origin has its own cache and database. Keep the exact same scheme, address and port for an offline rehearsal. Browser site-data removal clears both. See the [Vite preview guide](https://vite.dev/guide/static-deploy.html) and [browser secure-context rules](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts).

## What the database stores

IndexedDB opens **agrishield**, version 1. The **workspace** store saves one local demo record with the selected crop, selected scenario, and the 30 most recent explicitly recorded or successfully fetched readings per sensor. Readings include source, crop, time and moisture. No database server, account, or sync setup is needed.

The curated demo library lives in **src/library.json** and ships in the app bundle. Edit the JSON and rebuild to update it. Each entry carries provenance and permission metadata. The IKS entry demonstrates a permission-pending state using placeholder metadata. Keep pending or restricted practice details out of the shipped JSON and obtain permission from knowledge holders before publishing contributions.

## Test the local sensor path

In the first PowerShell terminal, start the mock:

```powershell
npm.cmd run mock-sensor
```

In a second terminal, configure the server-side proxy and start preview after building:

```powershell
Copy-Item .env.example .env.local
npm.cmd run preview
```

Expand **Local Wi-Fi sensor** and choose **Read endpoint**. Each request cycles through 28%, 49%, and 76% and displays **Mock sensor**. Stop the mock and try again. The app reports the failure and returns to simulation.

The browser queries the same-origin path **GET /api/moisture?sensor=AS-001**. Vite's dev or preview server forwards it to the configured origin. The endpoint contract is **HTTP 200**, **application/json**, and a finite numeric moisture value from 0 to 100. Return **Cache-Control: no-store**:

```json
{ "sensorId": "AS-001", "moisture": 52.4, "source": "esp32" }
```

Once the board and probe are confirmed, connect the ESP32 and laptop to the same Wi-Fi network. Change **AGRISHIELD_SENSOR_ORIGIN** in **.env.local** to the ESP32's HTTP origin, such as **http://192.168.1.42**, and restart preview. The ESP32 must implement the endpoint above and convert readings using calibration for the actual probe and soil. Firmware and physical validation depend on the board and probe. A static HTTPS deployment supports the offline demo. For live readings on another device, put the same-origin API behind a server that can reach the ESP32 on the local network.

All crop ranges are illustrative. The app does not control irrigation. Local Guide articles and specialist messages fall back to English. Use Tab, Shift+Tab, and a screen reader to rehearse navigation through the crop controls, live status and library search.


## Enable Firebase sign-in

From the welcome page choose **Create an account** or **Sign in**. Successful verification opens the dashboard. **Account** is available after sign-in and manages the sign-in email and farm profile. On first access, the app opens a farm-details dialog. Save the farm name, location and crops, or choose **Do this later**. **Explore the offline demo** at **/demo** opens a separate guest workspace. Email and password signup or the first Google sign-in creates a Firebase Authentication account. Use **Forgot password?** on the sign-in page to request a reset. The Firebase browser SDK remembers a signed-in account on that browser until sign-out or session invalidation. Sign-up and sign-in require internet. The offline dashboard, library, and readings continue through Workbox and IndexedDB, including in guest mode. Signed-in readings and farm details are stored on this device under the Firebase account ID. Guest data stays in its own workspace. Clearing browser data removes these local records.

1. Create a Firebase project and register a Web app. Copy its apiKey, authDomain, projectId, and appId into the corresponding VITE_FIREBASE variables in .env.local. Use the Web app configuration only. Keep service-account keys out of the frontend.
2. In **Authentication → Sign-in method**, enable **Email/Password**. Create an account on /signup, then test returning sign-in and password reset on /signin.
3. Enable **Google** and set the support email in the Firebase console. On the signup or sign-in page, use **Continue with Google**. Your browser must allow the sign-in pop-up.
4. Add your app's hostname under **Authentication → Settings → Authorised domains**. The loopback host for local Google testing may need to be added manually. Use localhost if Firebase already authorises that hostname.
5. Restart dev or rebuild and restart preview. For a hosted test, deploy the new contents of dist to your authorised HTTPS site and configure the host to serve index.html for /signup, /signin, /demo and /support. Verify each provider, reload to check that the session is remembered, and sign out on a shared device.

The ZIP's prebuilt demo has no Firebase project configuration. Firebase stores identities. IndexedDB stores device-local readings. Account linking and cross-device data sync are outside this prototype. Email changes use a Firebase verification link sent to the new address.

[Firebase email and password sign-in](https://firebase.google.com/docs/auth/web/password-auth) · [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)

## Rehearse the field monitoring concept

On the dashboard, choose Tomatoes, then select Dry. The simulated moisture drops to 32% and the drip irrigation turns on below the 40% demo threshold. Switch to In range and see irrigation continue. Switch to Wet and see it stop above the crop's upper demo threshold. Differences between crop profiles are illustrative.

Set the simulated reservoir to 20% or less to request a refill. At 0%, the drip irrigation is blocked even when there is demand. Pause and resume controls affect only the simulator. The reservoir starts at 70% of 5 000 L. Refill is shown as a request and the slider controls the simulated water level.

Switch between Moisture, pH and Temperature under Sensor readings. Use Left and Right arrows to move between tabs with a keyboard. pH, temperature, rainfall and nutrient status are simulated. Record multiple readings for the same crop to see the moisture trend. Reservoir level, irrigation demand and pause state are kept on the device with the existing demo data.

The current local endpoint reads soil moisture only. A physical rollout requires calibrated field and tank sensors, an edge controller with hardware interlocks, and testing on the actual pump and separately identified refill and drip valves. Cloud telemetry, remote actuation, local-language alerts and AI analysis are outside this build.

## Identify sensors in the field

The demo workspace starts with AS-001 in North Plot and AS-002 in South Plot. New accounts start with no sensors and zero readings. Go to Sensors to register a device. Select a sensor to see its simulation settings, moisture trend and recorded history. Choose **Register sensor** to enter an installed unit's permanent ID, plot, bed and optional landmark. Use **Edit location** when a unit moves. Existing single-sensor demo history is assigned to AS-001.

Open the sensor's **QR label** from the HTTPS deployment before printing. A QR created on localhost is only usable on the machine serving that address. The printed ID and landmark remain usable without internet. Once the app is cached on the device, a link for a registered sensor opens its workspace location offline. Signed-in Grower accounts sync their sensor register through Firestore. The app keeps an offline copy. The demo register stays on the device.

The moisture endpoint must return the physical unit's ID in sensorId. AgriShield accepts a reading only when the returned ID matches the selected unit. The mock recognises AS-001 and AS-002. Multiple physical devices require a gateway or API that can route the sensor query to the right unit. Last recorded reports the time a reading was saved in this browser.

For development-only Firebase Auth Emulator testing, use a demo Firebase project and set VITE_FIREBASE_AUTH_EMULATOR_URL to http://127.0.0.1:9099 alongside the four Firebase Web settings. Vite production builds ignore this variable. Live Google and email/password use the Firebase project configured for the deployment.

## Insights and Local Guide

Insights counts registered sensors, saved readings and sensors with readings in the current device workspace. The Local Guide bundles offline field notes with provenance and permission labels. Its weather warning link opens the official South African Weather Service website online.

## Profile and connection status

Open the top-right avatar to reach Account settings or add a team member to the device-local roster. This roster does not send invitations or grant access. The avatar ring is green for online, blue for a weak connection when the browser reports one, and red when offline. Its accessible name and profile menu also show the status in text.

The bundled JPEGs are generated editorial imagery and are included in the offline build. The signup portrait is public/field-hero.jpg and the dashboard panorama is public/farm-panorama.jpg.

Image prompts used to produce the assets:

- Signup portrait. Photoreal editorial hero photograph for a premium AgriTech web app. Portrait 4:5 crop. Southern African smallholder vegetable farm in Limpopo at golden hour, lush ordered rows of broad-leaf cabbage with rich red-brown soil leading into soft distant green hills, understated drip line, a Black South African adult farmer in practical work clothes and sun hat seen in profile on the RIGHT third checking a plant, authentic documentary photography, warm natural light, deep forest greens and muted gold, confident and modern, visual focal point in the upper middle, clear dark foliage at bottom for a text overlay. No text, no logo, no graphical interfaces, no watermarks.
- Dashboard panorama. Wide landscape editorial photograph for a professional farm-monitoring dashboard banner, 3:1 panoramic desired, close-to-medium view over a smallholder cabbage field in Limpopo at early morning, vivid honest leafy greens, orderly rows and subtle drip irrigation tubing, distant low hills under a warm pale sky, photographic realism, clean composition, quiet left half for a dark overlay and bright field detail on right. No people, no letters, no graphics, no logos or watermark.

## Pilot languages

Use the header selector to switch between English, siSwati, Xitsonga, Tshivenḓa and isiNdebele. The choice is saved on the device. Translations ship with the app and can be selected offline. The pilot covers navigation, sign-up and sign-in labels, dashboard and sensor headings, and common forms. Local Guide articles, some explanations and technical messages remain in English. The pilot wording in src/pilot-translations.txt needs review by fluent speakers before a public rollout.

The header uses the supplied AgriShield logo. On narrow screens, the navigation opens from the header menu button.

## Quick tools

The floating button opens sensor read-aloud, agricultural support and accessibility mode. Read-aloud uses bundled English audio and announces the reading source. The transcript also identifies the selected sensor. The demo also reads simulated pH, temperature, rainfall, nutrient status and reservoir level. Audio works offline after the app has cached the voice file.

The support page at /support lists district offices for Limpopo and Mpumalanga and links to national agricultural resources. The bundled directory is available offline and external websites need internet. Call the district office to locate the extension officer for your farm area.

Accessibility mode increases the base text size, strengthens contrast and disables the button's introductory pulse. The preference is saved on the device. The pulse also respects the operating system's reduced-motion preference.

## Deploy on Vercel

Add VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_APP_ID to the Vercel project's Production environment using your Firebase Web app values. Redeploy after saving the variables. Add the production hostname in Firebase Authentication under Settings → Authorized domains for Google sign-in. The Vercel rewrites serve the app on direct links to signup, sign-in, the demo and support.

## Specialist accounts and sensor data

Choose **IKS Specialist** during account creation to open the publication workspace. Drafts are saved privately on this device. The form captures provenance and permission status before accepting the draft text. A title and provenance note should omit restricted information while permission is pending.

To enable cloud readings, create a Cloud Firestore database in the same Firebase project as Authentication, then publish the included firestore.rules. For a project with existing rules, merge the accounts rules into its existing configuration. The prototype writes verified endpoint responses to accounts/{uid}/readings/{readingId}. Each record includes sensorId, crop, time (Unix milliseconds), source and moisture percentage. The mock source is labelled. Simulation is kept local. The owner-only rules protect each account's readings. The app subscribes to up to 100 recent cloud readings and retains its local history. The signed-in sensor register syncs through Firestore once its rules are published. Publication drafts are device-local, and no LLM is connected.

For emulator testing only, VITE_FIRESTORE_EMULATOR_URL can be set to http://127.0.0.1:8080 alongside the Auth Emulator setting. Run the Auth and Firestore emulators with the included firebase.json and a demo project.

On the hosted site, sign in as a Grower and select a registered sensor. Under **Sensor connection → Test Firebase sync**, choose **Save mock reading** to verify Firestore without hardware. This creates a 52% reading with source mock. The hosted dashboard listens for Firestore readings. The local Wi-Fi endpoint control is available in development or on loopback and requires a reachable local sensor proxy.

## Sync sensors between devices

Publish the current firestore.rules with the accounts/{uid}/sensors/{sensorId} block. Reopen the app on the original device under the same Grower account. Open **Sensors** and wait for **Sensor register synced to Firebase**. Existing local sensors are uploaded if their ID is missing from Firestore. Then sign in to the same account on the second device. The registry syncs by Firebase user ID. The demo workspace stays local.
