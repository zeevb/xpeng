# September 19 export handoff

The two exportable groups reached their respective September 11 mobile-export
cutoffs. Use these group sections as new FAQ source material:

| Group | File in `raw-data/exports/` | New records |
| --- | --- | ---: |
| קהילת אקספנג - XPENG | `xpeng_whatsapp_export-2026-09-19T17-15-56-797Z.json` | 1,024 |
| Xpeng G6 | `xpeng_whatsapp_export-2026-09-19T17-23-04-091Z.json` | 362 |

Both selected sections have `status: incremental_complete` and
`incrementalBoundaryReached: true`. This establishes reaching the mobile cutoff
within the available Web message history, not independent proof of complete phone
history. Records include text and media metadata/captions; no attachment content
was downloaded. The last mobile-export minute is intentionally overlapped.

The second file also contains 59 community records already included in the first
file. The first file's 45 G6 records are superseded by the second file's G6 section.
Select the sections above rather than concatenating all runs. The selected total
is 1,386 records before final editorial review, with no overlap between groups.

Two groups were skipped because Advanced Chat Privacy is enabled:

- 🟠G6 Drivers Club IL (Xpeng)
- קהילת אקספנג (Xpeng)

The JSON files are local, Git-ignored sources. They have best-effort redaction and
require review before using their content in the public FAQ. No FAQ changes or
publication were performed in this export task.

## Exporter corrections

- Partial and legacy runs no longer advance cutoffs using their generation time.
- Mobile timestamps use Israel time, with a last-minute overlap.
- Group-creation/security events cannot falsely satisfy the history cutoff.
- Transient history banners are accepted only after 30 seconds without progress.
- Download filenames normalized by Playwright are recognized and preserved.
- Browser-command failures receive up to three bounded attempts.

Six offline regression tests passed, and both selected group exports were
verified in a logged-in browser. Intermittent browser closures were reproduced;
their underlying cause remains undetermined. Retry handling limits their impact.
