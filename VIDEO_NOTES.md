# Recording outline · target 2:50

The implementation is complete for local review. The new monochrome UI, original imagery, guided scenarios and operational tools are ready. **The buyer-approved PayPal lifecycle and deployed webhooks are deliberately awaiting final account validation.** Never substitute guided balances or invented provider IDs for real evidence.

| Time      | Screen                                   | Demonstration                                                                                                                                                                                                  |
| --------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:20 | Landing `/`                              | A personalized-gift maker needs a production deposit; the buyer pays the balance on delivery. Show the original parcel photograph and the $24 / $12 / $12 story.                                               |
| 0:20–0:40 | Private Pascal `/demo/entrega-segura`    | Fictional catalog, disclosed deposit policy, private server-to-server checkout. Pascal source stays private.                                                                                                   |
| 0:40–1:05 | `/judge?mode=sandbox` and PayPal Sandbox | After final validation, record the actual buyer approval. Use the validated single-approval strategy or the implemented split strategy with both approvals. Hide passwords and secrets.                        |
| 1:05–1:25 | Money ledger + evidence                  | Show actual completed deposit and retained balance authorization, provider IDs and raw responses. These slots remain pending until account validation.                                                         |
| 1:25–1:55 | Courier conversation                     | Text, audio or fictional image is interpreted by AI. The deterministic gate checks delivery and the matching buyer code before any balance capture. Record an actual successful capture only after validation. |
| 1:55–2:15 | Alternative outcomes                     | Use clearly labelled guided examples for refusal, two absences, incomplete delivery and a defect photograph. Show the shop's explicit partial-refund decision. Guided money is illustrative.                   |
| 2:15–2:35 | Shop and Pascal status                   | Shop filters, activity and evidence export. Show an authentic verified PayPal webhook only after hosting and validation; otherwise say it remains pending.                                                     |
| 2:35–2:50 | README and source                        | Public MIT implementation, private Pascal boundary, 58 passing local tests. Historical text-parser evaluation: 22/24 on a small labelled set, not a general accuracy claim.                                    |

## Recording evidence to fill after final validation

- Fresh local reservation reference and selected payment strategy.
- Actual completed deposit capture ID and authorization ID.
- Actual final capture ID, plus duplicate-event evidence of no second charge.
- Separate fresh-order void and partial refund IDs.
- Verified PayPal webhook ID with genuine `verification_status: SUCCESS`.
- Public HTTPS URL, only after an authorized deployment.

Screenshots under `reports/screenshots/v2/` show the new local UI. They do not prove payment settlement. Earlier real sandbox API checks and created-but-unapproved orders are historical, not validation of this revision. No final video has been recorded.
