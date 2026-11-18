# AgriShield

AgriSquad's Agri-IKS hackathon prototype for smallholder vegetable growers in Limpopo and Mpumalanga. The English-language app uses React, Vite, Workbox and IndexedDB.

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
4. Open **Knowledge library**, search **morogo**, and inspect the provenance and permission labels. Change the scenario and record another reading while offline.
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

All crop ranges are illustrative. The app does not control irrigation. Library content and interface are English-only. Use Tab, Shift+Tab, and a screen reader to rehearse navigation through the crop controls, live status and library search.


## Enable Firebase sign-in

From the welcome page choose **Create an account** or **Sign in**. Successful verification opens the dashboard. **Account** is available after sign-in and manages the sign-in email and farm profile. **Explore the offline demo** at **/demo** opens a separate guest workspace. Email and password signup or the first Google sign-in creates a Firebase Authentication account. Use **Forgot password?** on the sign-in page to request a reset. The Firebase browser SDK remembers a signed-in account on that browser until sign-out or session invalidation. Sign-up and sign-in require internet. The offline dashboard, library, and readings continue through Workbox and IndexedDB, including in guest mode. Signed-in readings and farm details are stored on this device under the Firebase account ID. Guest data stays in its own workspace. Clearing browser data removes these local records.

1. Create a Firebase project and register a Web app. Copy its apiKey, authDomain, projectId, and appId into the corresponding VITE_FIREBASE variables in .env.local. Use the Web app configuration only. Keep service-account keys out of the frontend.
2. In **Authentication → Sign-in method**, enable **Email/Password**. Create an account on /signup, then test returning sign-in and password reset on /signin.
3. Enable **Google** and set the support email in the Firebase console. On the signup or sign-in page, use **Continue with Google**. Your browser must allow the sign-in pop-up.
4. Add your app's hostname under **Authentication → Settings → Authorised domains**. The loopback host for local Google testing may need to be added manually. Use localhost if Firebase already authorises that hostname.
5. Restart dev or rebuild and restart preview. For a hosted test, deploy the new contents of dist to your authorised HTTPS site and configure the host to serve index.html for /signup, /signin and /demo. Verify each provider, reload to check that the session is remembered, and sign out on a shared device.

The ZIP's prebuilt demo has no Firebase project configuration. Firebase stores identities. IndexedDB stores device-local readings. Account linking and cross-device data sync are outside this prototype. Email changes use a Firebase verification link sent to the new address.

[Firebase email and password sign-in](https://firebase.google.com/docs/auth/web/password-auth) · [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)

## Rehearse the field monitoring concept

On the dashboard, choose Tomatoes, then select Dry. The simulated moisture drops to 32% and the drip irrigation turns on below the 40% demo threshold. Switch to In range and see irrigation continue. Switch to Wet and see it stop above the crop's upper demo threshold. Differences between crop profiles are illustrative.

Set the simulated reservoir to 20% or less to request a refill. At 0%, the drip irrigation is blocked even when there is demand. Pause and resume controls affect only the simulator. The reservoir starts at 70% of 5 000 L. Refill is shown as a request and the slider controls the simulated water level.

Switch between Moisture, pH and Temperature under Sensor readings. Use Left and Right arrows to move between tabs with a keyboard. pH, temperature, rainfall and nutrient status are simulated. Record multiple readings for the same crop to see the moisture trend. Reservoir level, irrigation demand and pause state are kept on the device with the existing demo data.

The current local endpoint reads soil moisture only. A physical rollout requires calibrated field and tank sensors, an edge controller with hardware interlocks, and testing on the actual pump and separately identified refill and drip valves. Cloud telemetry, remote actuation, local-language alerts and AI analysis are outside this build.

## Identify sensors in the field

The dashboard starts with AS-001 in North Plot and AS-002 in South Plot. Select a sensor to see its simulation settings, moisture trend and recorded history. Choose **Register sensor** to enter an installed unit's permanent ID, plot, bed and optional landmark. Use **Edit location** when a unit moves. Existing single-sensor demo history is assigned to AS-001.

Open the sensor's **QR label** from the HTTPS deployment before printing. A QR created on localhost is only usable on the machine serving that address. The printed ID and landmark remain usable without internet. Once the app is cached on the device, a link for a registered sensor opens its workspace location offline. The register is device-local and scoped to the signed-in account or the separate demo workspace. Register the device on each browser that needs access.

The moisture endpoint must return the physical unit's ID in sensorId. AgriShield accepts a reading only when the returned ID matches the selected unit. The mock recognises AS-001 and AS-002. Multiple physical devices require a gateway or API that can route the sensor query to the right unit. Last recorded reports the time a reading was saved in this browser.

For development-only Firebase Auth Emulator testing, use a demo Firebase project and set VITE_FIREBASE_AUTH_EMULATOR_URL to http://127.0.0.1:9099 alongside the four Firebase Web settings. Vite production builds ignore this variable. Live Google and email/password use the Firebase project configured for the deployment.
