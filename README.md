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

1. Open http://127.0.0.1:4173 in Chrome or Edge. Wait for **Ready offline**. Use the browser's install option if offered.
2. Choose **Morogo**, select **Dry**, and record the reading. Verify that the demo status says **Below demo range**.
3. Stop the preview server and reload the exact same URL. The dashboard should reopen with Morogo and the recorded reading.
4. Open **Knowledge library**, search **morogo**, and inspect the provenance and permission labels. Change the scenario and record another reading while offline.
5. On a phone, first serve the contents of **dist** at the root of an HTTPS origin. Open the URL on that phone, wait for **Ready offline**, install or add to the home screen if offered, then enable airplane mode and reopen. A plain HTTP laptop Wi-Fi IP can show the UI but generally cannot install the offline service worker.

Each device and browser origin has its own cache and database. Keep the exact same scheme, address and port for an offline rehearsal. Browser site-data removal clears both. See the [Vite preview guide](https://vite.dev/guide/static-deploy.html) and [browser secure-context rules](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts).

## What the database stores

IndexedDB opens **agrishield**, version 1. The **workspace** store saves one local demo record with the selected crop, selected scenario, and the 30 most recent explicitly recorded or successfully fetched readings. Readings include source, crop, time and moisture. No database server, account, or sync setup is needed.

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

The browser queries the same-origin path **GET /api/moisture**. Vite's dev or preview server forwards it to the configured origin. The endpoint contract is **HTTP 200**, **application/json**, and a finite numeric moisture value from 0 to 100. Return **Cache-Control: no-store**:

```json
{ "moisture": 52.4, "source": "esp32" }
```

Once the board and probe are confirmed, connect the ESP32 and laptop to the same Wi-Fi network. Change **AGRISHIELD_SENSOR_ORIGIN** in **.env.local** to the ESP32's HTTP origin, such as **http://192.168.1.42**, and restart preview. The ESP32 must implement the endpoint above and convert readings using calibration for the actual probe and soil. Firmware and physical validation depend on the board and probe. A static HTTPS deployment supports the offline demo. For live readings on another device, put the same-origin API behind a server that can reach the ESP32 on the local network.

All crop ranges are illustrative. The app does not control irrigation. Library content and interface are English-only. Use Tab, Shift+Tab, and a screen reader to rehearse navigation through the crop controls, live status and library search.


## Enable Firebase sign-in

Accounts are optional. The first verified email link, SMS code, or Google sign-in creates a Firebase Authentication account. The Firebase browser SDK remembers a signed-in account on that browser until sign-out or session invalidation. Sign-up and sign-in require internet. The offline dashboard, library, and readings continue through Workbox and IndexedDB, including in guest mode. Readings are shared within a browser profile and are not synced or secured by the account.

1. Create a Firebase project and register a Web app. Copy its apiKey, authDomain, projectId, and appId into the corresponding VITE_FIREBASE variables in .env.local. Use the Web app configuration only. Keep service-account keys out of the frontend.
2. In **Authentication → Sign-in method**, enable **Email/Password** and **Email link (passwordless sign-in)**. In the Account tab choose Email, send the link, then open it and confirm the original email address. A link opened in a different browser may require re-entering the address.
3. Enable **Google** and set the support email in the Firebase console. In Account, use **Continue with Google**. Your browser must allow the sign-in pop-up.
4. Enable **Phone**, allow South Africa in the SMS region policy, and configure billing if required for live SMS. Use an authorised HTTPS host for testing SMS with reCAPTCHA. Add a fictional test number and its code in the Firebase console for rehearsal. The app accepts South African numbers such as 082 123 4567 or +27821234567.
5. Add your app's hostname under **Authentication → Settings → Authorised domains**. The loopback host for local email or Google testing may need to be added manually. For phone tests use the authorised HTTPS host.
6. Restart dev or rebuild and restart preview. For a hosted test, deploy the new contents of dist to your authorised HTTPS site. Verify each provider, reload to check that the session is remembered, and sign out on a shared device.

The ZIP's prebuilt demo has no Firebase project configuration. Firebase stores identities. IndexedDB stores device-local readings. Account linking and cross-device data sync are outside this prototype.

[Firebase email sign-in](https://firebase.google.com/docs/auth/web/email-link-auth) · [Phone sign-in](https://firebase.google.com/docs/auth/web/phone-auth) · [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)
