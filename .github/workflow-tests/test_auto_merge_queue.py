"""Keep consumer withdrawal queue isolation and the protected admission route.

These are static caller contracts, not a claim of atomic GitHub label/merge writes.
The shared workflow rechecks eligibility and cleans up its acknowledged request;
server-side merge and final read/write races remain outside this local contract.
"""

import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
WITHDRAWAL_GROUP = (
    "automerge-${{ github.event.pull_request.number }}"
    "${{ ((github.event.action == 'unlabeled' && github.event.label.name == 'automerge') "
    "|| github.event.action == 'converted_to_draft' "
    "|| (github.event.action == 'edited' && github.event.changes.base)) "
    "&& format('-withdrawal-{0}', github.run_id) || '' }}"
)


def workflow():
    """Read this consumer's actual caller; preserve YAML event/scalar spellings."""
    source = ROOT / ".github/workflows/auto-merge.yml"
    return yaml.load(source.read_text(), Loader=yaml.BaseLoader)  # nosec B506 - strings only


class AutoMergeQueueTests(unittest.TestCase):
    """Admission cannot cancel a queued withdrawal through the old shared group."""

    def test_withdrawals_have_distinct_per_run_concurrency_keys(self):
        """Label removal, draft conversion and every base edit keep their own queue."""
        self.assertEqual(workflow()["concurrency"]["group"], WITHDRAWAL_GROUP)

    def test_earlier_events_are_not_cancelled_by_later_admission(self):
        """A subsequent admission must not cancel an admitted withdrawal run."""
        self.assertEqual(workflow()["concurrency"]["cancel-in-progress"], "false")

    def test_admission_and_withdrawal_events_still_reach_the_caller(self):
        events = workflow()["on"]["pull_request_target"]["types"]
        self.assertCountEqual(
            events,
            ["opened", "synchronize", "reopened", "ready_for_review", "labeled",
             "unlabeled", "edited", "converted_to_draft"],
        )

    def test_protected_native_route_and_required_security_context_remain(self):
        caller = workflow()["jobs"]["auto-merge"]
        self.assertEqual(caller["with"]["native-auto-merge"], "true")
        self.assertEqual(caller["with"]["required-status-checks"], "CodeQL")
        self.assertEqual(caller["secrets"]["BOT_PAT"], "${{ secrets.BOT_PAT }}")
        self.assertEqual(caller["permissions"], {"contents": "read", "pull-requests": "write"})


if __name__ == "__main__":
    unittest.main()
