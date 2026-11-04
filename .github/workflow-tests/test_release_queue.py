"""Protect pending release requests without changing pull-request cancellation."""

import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]


def workflow(name):
    """Read the committed consumer workflow, not the canonical generator."""
    return yaml.safe_load((ROOT / ".github/workflows" / name).read_text())


class ReleaseQueueTest(unittest.TestCase):
    """Release publication stays serialized while pending requests are retained."""

    def test_release_requests_share_one_non_cancelling_pending_queue(self):
        """All release events retain the same publication lock and pending queue."""
        self.assertEqual(
            workflow("release-pipeline.yml")["concurrency"],
            {
                "group": "release-${{ github.repository }}",
                "cancel-in-progress": False,
                "queue": "max",
            },
        )

    def test_superseded_pull_request_validation_still_cancels(self):
        """Release queue retention must not preserve obsolete pull-request runs."""
        concurrency = workflow("quality-gate.yml")["concurrency"]
        self.assertEqual(
            concurrency["cancel-in-progress"],
            "${{ github.event_name == 'pull_request' }}",
        )
        self.assertNotIn("queue", concurrency)
        self.assertNotEqual(
            concurrency["group"], "release-${{ github.repository }}"
        )


if __name__ == "__main__":
    unittest.main()
