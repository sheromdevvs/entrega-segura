# Recording outline · target 2:50

**Not yet a verified full-settlement recording.** Local UI and the API integration are ready. Buyer-approved captures and an actual verified PayPal webhook still need to be recorded after testing. Do not present pending items as successes or fill them with invented IDs. No real money is used.

| Time      | Screen                                       | What to show / say                                                                                                                                                                               |
| --------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0:00–0:20 | Landing `/`                                  | A personalized-gift shop needs an anticipo to manufacture; the buyer wants to pay the balance on delivery. One $24 hoodie, $12 production deposit, $12 balance.                                  |
| 0:20–0:40 | Private Pascal `/demo/entrega-segura`        | Select the fictional hoodie. Show the disclosed production-deposit policy. Click checkout: server-to-server API opens the separate public-code app.                                              |
| 0:40–1:05 | PayPal Sandbox approval                      | Use a sandbox personal buyer. Approve $24. Never show passwords, developer secrets or personal/live PayPal details.                                                                              |
| 1:05–1:25 | Judge money strip + audit                    | Capture $12 with `final_capture: false`; show actual authorization/capture IDs when validation is complete. Expand the raw response.                                                             |
| 1:25–1:55 | Courier chat + delivery gate                 | Send “Ya entregué el pedido, el código es [displayed code]”. AI extracts delivered; deterministic code validates the code and captures the remaining $12 exactly once. Show matching receipt ID. |
| 1:55–2:15 | Refusal / absence on separate approved order | Refusal voids only the balance. Absence waits once; a second attempt asks the shop. Clearly label simulated courier events.                                                                      |
| 2:15–2:35 | Payment evidence + Pascal status             | Show a real `verification_status: SUCCESS` webhook only after receiving one. Return to Pascal to see status via its private backend.                                                             |
| 2:35–2:50 | README / evidence                            | Public MIT code, real sandbox vs simulated channels, 22/24 text parser accuracy and its limitations.                                                                                             |

## Actual IDs currently available

- UI-only independent example: reservation `ES-39F322CA9BB8E54F`, PayPal order `4DY60622WE284035M`.
- Local Pascal integration example: reservation `ES-C4A5806BD0640CFD`, PayPal order `3FA03383UF288110T`.
- Initial compatibility probe: reservation `ES-F70EC843DF1E6A89`, PayPal order `5HF18070VE796464W`.
- All three were created in the real sandbox. At writing, these examples are awaiting buyer approval. Order approval URLs can expire; create a fresh order if necessary.
- Deposit capture ID: **pending approval and validation**.
- Balance capture ID: **pending validation**.
- Verified webhook ID and SUCCESS log: **pending hosted HTTPS receiver**.

Use a fresh dedicated order per final scenario and replace this section with the exact successful IDs before filming. The local screenshots in `reports/screenshots/` show the implementation; they are not evidence of completed settlement.
