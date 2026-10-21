# Google Analytics for Obaid Web Lab

This integration uses the GA4 property/measurement ID \`G-430L3RWFVF\`. The site uses GitHub Pages, so it must never contain a Google Analytics Data API service-account key, OAuth refresh token, or other private credential.

## Privacy behavior

- The Google tag is not downloaded until a visitor selects **Allow analytics**.
- The choice can be changed from **Privacy & analytics settings** in the footer or on \`privacy.html\`.
- Declining keeps the website fully usable and prevents new analytics events from being sent.
- Google Signals and advertising personalization are disabled in the tag configuration.
- The code only sends allowlisted event parameters. It does not send search terms, editor code, editor contents, file names, or form values.
- The preference is stored in local storage on the current device. Clearing site data resets it.

## Events recorded after consent

| Event | What it tells you |
| --- | --- |
| \`page_view\` | Which allowed site sections/routes were viewed, including class/note IDs |
| \`resource_open\` | Whether a class or study note was opened |
| \`library_search\` | A search was used and how many results matched; the query itself is not sent |
| \`resource_file_select\` / \`workspace_file_select\` | File extension selected in a class reader/editor |
| \`resource_download\` | A ZIP or file download was clicked; only download kind and file extension are sent |
| \`workspace_action\` | Preview, local draft save/reset, explorer and related editor actions |
| \`scroll_depth\` | A visitor reached 50% or 90% page scroll |
| \`theme_toggle\` | The visitor switched the colour theme |

GA4 also records standard session and engagement metrics when the Google tag is active. Reports are aggregate/pseudonymous analytics, not a reliable list of real-world names. Do not attempt to identify individual visitors.

## Where to review the data

1. Open [Google Analytics](https://analytics.google.com/) and select the property containing \`G-430L3RWFVF\`.
2. Use **Reports → Realtime** to confirm visits shortly after deployment.
3. Use **Reports → Engagement → Events** to review event counts such as \`resource_open\`, \`library_search\`, \`resource_download\`, and \`workspace_action\`.
4. Use **Admin → Data display → Custom definitions** to register event-scoped dimensions for \`resource_type\`, \`resource_id\`, \`download_type\`, \`file_type\`, \`action\`, and \`percent\` if you want those values available in custom reports. These dimensions are not retroactive.
5. For implementation debugging, use the GA4 DebugView with a controlled test visit. Do not ask visitors to share private browsing details.

Newly collected events may not appear in standard reports immediately. A static GitHub Pages site cannot securely embed a private GA4 reporting dashboard by placing API credentials in browser code. Keep detailed reports inside the Google Analytics account or use a server-side integration with protected credentials.

## Deployment note

The GitHub Pages workflow copies \`analytics.js\` and \`privacy.html\` into the published site and checks JavaScript syntax. Merge the pull request into \`main\` to deploy. Then test the consent controls and confirm accepted visits in GA4 Realtime. A visitor who declines should not generate page or interaction events.
