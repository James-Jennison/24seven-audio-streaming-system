import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DisabledM3StagingRehearsalProposalBoundary,
  M3_STAGING_PROPOSAL_LIMITS,
  validateM3StagingRehearsalProposal,
  type M3StagingRehearsalProposal,
} from "../src/app/m3-staging-rehearsal-proposal.js";
import { seededStations } from "../src/domain/stations.js";
import { renderDashboard } from "../src/ui/dashboard.js";

const forbiddenContent =
  /filename|path|url|title|artist|album|tag|payload|metadata|credential|token|csrf|raw sql/i;

const proposal = (
  overrides: Partial<M3StagingRehearsalProposal> = {},
): M3StagingRehearsalProposal => ({
  id: "proposal:m310a",
  stationId: "station:m310a",
  reviewedCommit: "05009ea5d4f6bfa5b235a310d5e32d0f0d6c8bde",
  migrationIdentity: "migration:m3_asset_lifecycle",
  mode: "proposal_only",
  ownerAuthorizationRequired: true,
  ownerAuthorizationGranted: false,
  target: {
    classification: "isolated_staging",
    exposure: "loopback_only",
    input: "empty_non_production",
  },
  authorities: [
    "migration",
    "control_plane",
    "future_worker",
    "evidence_review",
  ],
  sandboxLimits: M3_STAGING_PROPOSAL_LIMITS,
  inactivePlanes: {
    m4Publication: "inactive",
    m5Runtime: "inactive",
    m7EncoderListener: "inactive",
  },
  rollback: {
    stopCategories: [
      "target_ambiguous",
      "authority_missing",
      "unexpected_input",
      "plane_activation",
    ],
    automaticRetry: false,
    automaticRollback: false,
    ownerDecisionRequired: true,
  },
  evidenceRequirements: [
    "ledger_schema",
    "station_isolation",
    "no_network_no_downstream_dispatch",
    "stop_cleanup",
  ],
  ...overrides,
});

test("M3.10 proposal requires reviewed identity, isolation, authority, limits, and inactive later planes", () => {
  assert.doesNotThrow(() => validateM3StagingRehearsalProposal(proposal()));
  assert.throws(
    () =>
      validateM3StagingRehearsalProposal(
        proposal({ reviewedCommit: "not-a-reviewed-commit" }),
      ),
    /invalid_reviewed_commit/,
  );
  const executionAttempt = {
    ...proposal(),
    ownerAuthorizationGranted: true,
  } as unknown as M3StagingRehearsalProposal;
  assert.throws(
    () => validateM3StagingRehearsalProposal(executionAttempt),
    /proposal_execution_forbidden/,
  );
  const publicTarget = {
    ...proposal(),
    target: {
      classification: "isolated_staging",
      exposure: "public",
      input: "empty_non_production",
    },
  } as unknown as M3StagingRehearsalProposal;
  assert.throws(
    () => validateM3StagingRehearsalProposal(publicTarget),
    /invalid_rehearsal_target/,
  );
  const sharedAuthority = {
    ...proposal(),
    authorities: ["migration", "migration", "future_worker", "evidence_review"],
  } as unknown as M3StagingRehearsalProposal;
  assert.throws(
    () => validateM3StagingRehearsalProposal(sharedAuthority),
    /invalid_rehearsal_authorities/,
  );
  assert.throws(
    () =>
      validateM3StagingRehearsalProposal(
        proposal({
          sandboxLimits: {
            ...M3_STAGING_PROPOSAL_LIMITS,
            maxConcurrentJobs: 0,
          },
        }),
      ),
    /invalid_processing_limits/,
  );
  assert.throws(
    () =>
      validateM3StagingRehearsalProposal(
        proposal({
          inactivePlanes: {
            m4Publication: "inactive",
            m5Runtime: "inactive",
            m7EncoderListener: "active" as never,
          },
        }),
      ),
    /plane_activation_forbidden/,
  );
});

test("M3.10 proposal boundary preserves station isolation and fail-closed recovery", () => {
  const owned = proposal();
  const other = proposal({ id: "proposal:m310b", stationId: "station:m310b" });
  const boundary = new DisabledM3StagingRehearsalProposalBoundary([
    owned,
    other,
  ]);
  const review = boundary.review(owned.stationId, owned.id);
  assert.deepEqual(review, {
    id: `review:${owned.id}`,
    stationId: owned.stationId,
    proposalId: owned.id,
    mode: "proposal_only",
    execution: "unavailable",
    rehearsalPerformed: false,
    evidenceStatus: "not_run",
  });
  assert.equal(Object.isFrozen(review), true);
  assert.throws(() => boundary.review(owned.stationId, other.id), /not_found/);
  assert.throws(
    () => boundary.assertProposalOwnership(owned.stationId, other),
    /station_reference_forbidden/,
  );
  const stopped = boundary.stopDecision(
    owned.stationId,
    owned.id,
    "unexpected_input",
  );
  assert.deepEqual(stopped, {
    stationId: owned.stationId,
    proposalId: owned.id,
    category: "unexpected_input",
    execution: "unavailable",
    cleanup: "not_started",
    automaticRetry: false,
    automaticRollback: false,
    nextAction: "owner_decision_required",
  });
  assert.equal(Object.isFrozen(stopped), true);
  assert.doesNotMatch(JSON.stringify({ review, stopped }), forbiddenContent);
});

test("M3.10 proposal has no executable adapter, route, or operational dashboard control", async () => {
  const source = await readFile(
    new URL("../../src/app/m3-staging-rehearsal-proposal.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /node:(?:child_process|fs|net|dgram|http)/);
  assert.doesNotMatch(source, /(?:spawn|exec|fetch|connect|listen)\s*\(/);

  const dashboard = renderDashboard(seededStations, {
    version: "0.1.0-test",
    buildId: "m310-test",
  });
  assert.match(dashboard, /Fixture\/example status is never live station data/);
  assert.match(dashboard, /aria-disabled": "true"/);
  assert.doesNotMatch(
    dashboard,
    /Run rehearsal|Activate staging|Start worker|Publish schedule|Start runtime/,
  );
});
