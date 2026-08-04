# SAM Feature Parity Matrix

This is a target classification, not a claim that parity is delivered.

| Target capability                                                     | Classification             | Notes                                                          |
| --------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------- |
| Multi-station media metadata and library ingest                       | M1 MVP                     | Begins with empty-library support and authorized test library. |
| Playlist, queue, rotations, filters, category/artist/title separation | M1 MVP                     | Durable programming model and validation.                      |
| Clocks, program blocks, scheduled events                              | M1 MVP                     | Timezone-aware schedule contracts.                             |
| Automated 24/7 playout                                                | later milestone            | Requires supervised runtime integration.                       |
| Crossfade, gap handling, loudness, processing, encoding               | later milestone            | Evaluate through Liquidsoap/runtime contracts.                 |
| Icecast output                                                        | later milestone            | Explicit adapter, isolated approval required.                  |
| SHOUTcast v1/v2 compatibility and relays                              | later milestone            | Adapter after Icecast.                                         |
| Per-station now-playing, output health, listener metrics, history     | later milestone            | Runtime/output observations; history begins with runtime work. |
| Browser library/programming/station/output admin                      | M1 MVP                     | M0 only has a status dashboard.                                |
| Users, roles, and audit                                               | M1 MVP                     | Design contract exists; enforcement later.                     |
| Live-DJ takeover, priority, fallback, auditable handoff               | later milestone            | Requires runtime and live input model.                         |
| Existing 24Seven relay/dashboard integration                          | external integration       | Versioned API boundary prevents coupling.                      |
| Listener requests/features                                            | external integration       | Separate product/API scope.                                    |
| Recreating proprietary SAM internals or Windows-host coupling         | intentionally out of scope | Linux-native replacement, not a clone.                         |
